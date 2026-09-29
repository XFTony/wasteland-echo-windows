"""Render three neutral camera studies for the ranger animation pilot.

This is a volume and perspective study. It contains no approved character art
or motion. Run with Blender in one background process to reuse render startup.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/animation/ranger/camera-v1"
BLEND = ROOT / "art/animation/ranger/ranger-graybox-camera-v1.blend"
ELEVATIONS = (35, 42, 50)
AZIMUTH = 22


def material(name: str, value: float) -> bpy.types.Material:
    item = bpy.data.materials.new(name)
    item.diffuse_color = (value, value, value, 1)
    item.use_nodes = True
    shader = item.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (value, value, value, 1)
    shader.inputs["Roughness"].default_value = 0.85
    return item


def assign(obj: bpy.types.Object, name: str, mat: bpy.types.Material) -> bpy.types.Object:
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def sphere(name: str, location, scale, mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = assign(bpy.context.object, name, mat)
    obj.scale = scale
    return obj


def box(name: str, location, dimensions, mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = assign(bpy.context.object, name, mat)
    obj.dimensions = dimensions
    return obj


def link(name: str, start, end, radius: float, mat: bpy.types.Material) -> bpy.types.Object:
    begin = Vector(start)
    finish = Vector(end)
    direction = finish - begin
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=direction.length, location=(begin + finish) / 2)
    obj = assign(bpy.context.object, name, mat)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def build_character() -> None:
    coat = material("graybox_coat", 0.53)
    cloth = material("graybox_trousers", 0.30)
    trim = material("graybox_trim", 0.39)
    mask = material("graybox_mask", 0.13)
    metal = material("graybox_weapon", 0.22)

    # The large hood, split coat tails, mask and boots approximate the silhouette
    # of the approved painting. Fine modeling begins only after the camera gate.
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.39, radius2=0.28, depth=0.74, location=(0, 0.02, 1.28))
    assign(bpy.context.object, "coat_torso_volume", coat)
    sphere("hood_outer_volume", (0, 0.02, 1.79), (0.28, 0.29, 0.34), coat)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.245, radius2=0.035, depth=0.28, location=(-0.045, 0.05, 2.12))
    assign(bpy.context.object, "hood_point_volume", coat)
    sphere("hood_face_recess", (0, -0.255, 1.76), (0.235, 0.085, 0.19), mask)
    sphere("goggle_left", (-0.10, -0.328, 1.79), (0.075, 0.035, 0.052), trim)
    sphere("goggle_right", (0.10, -0.328, 1.79), (0.075, 0.035, 0.052), trim)
    sphere("gas_mask_canister", (0, -0.36, 1.64), (0.10, 0.10, 0.09), metal)
    box("scarf_band", (0, -0.20, 1.54), (0.44, 0.17, 0.13), trim)
    for side, name in ((-1, "left"), (1, "right")):
        bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.24, radius2=0.13, depth=0.87,
                                        location=(side * 0.16, -0.10, 0.83))
        panel = assign(bpy.context.object, f"coat_tail_{name}", coat)
        panel.rotation_euler[1] = side * 0.10
    box("belt", (0, -0.19, 1.08), (0.49, 0.11, 0.10), trim)

    for side, name in ((-1, "left"), (1, "right")):
        shoulder = (side * 0.32, 0.01, 1.56)
        elbow = (side * 0.39, -0.18, 1.30)
        hand = (side * 0.16, -0.42, 1.23)
        link(f"{name}_upper_arm", shoulder, elbow, 0.105, coat)
        link(f"{name}_forearm", elbow, hand, 0.085, trim)
        sphere(f"{name}_glove", hand, (0.10, 0.10, 0.08), mask)
        hip = (side * 0.17, 0.01, 1.03)
        knee = (side * 0.19, -0.025, 0.57)
        ankle = (side * 0.19, -0.03, 0.15)
        link(f"{name}_thigh", hip, knee, 0.145, cloth)
        sphere(f"{name}_knee", knee, (0.145, 0.14, 0.12), trim)
        link(f"{name}_shin", knee, ankle, 0.12, cloth)
        sphere(f"{name}_boot", (side * 0.19, -0.15, 0.09), (0.13, 0.24, 0.09), trim)

    # This bar marks scale and hand location only. Final weapon art is independent.
    link("pistol_scale_marker", (0.0, -0.47, 1.25), (0.65, -0.47, 1.25), 0.035, metal)


def aim_camera(camera: bpy.types.Object, elevation: int) -> None:
    target = Vector((0, 0, 1.04))
    elevation_rad = math.radians(elevation)
    azimuth_rad = math.radians(AZIMUTH)
    offset = Vector((math.sin(azimuth_rad) * math.cos(elevation_rad),
                     -math.cos(azimuth_rad) * math.cos(elevation_rad),
                     math.sin(elevation_rad))) * 6
    camera.location = target + offset
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.85


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    build_character()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "ranger_fixed_camera"
    scene = bpy.context.scene
    scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4, 6))
    light = bpy.context.object
    light.name = "upper_left_softbox"
    light.data.energy = 550
    light.data.shape = "DISK"
    light.data.size = 4.5

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 20
    scene.view_settings.view_transform = "Standard"

    OUTPUT.mkdir(parents=True, exist_ok=True)
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    aim_camera(camera, 42)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    for elevation in ELEVATIONS:
        aim_camera(camera, elevation)
        scene.render.filepath = str(OUTPUT / f"camera_{elevation}deg.png")
        bpy.ops.render.render(write_still=True)
        print(f"CAMERA_STUDY {elevation} {scene.render.filepath}")


if __name__ == "__main__":
    main()
