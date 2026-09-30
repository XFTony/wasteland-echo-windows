"""Build the ranger proportion study from the split-coat rig.

This is editable graybox source; painted materials and visual approval follow.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art/animation/ranger/ranger-silhouette-v2.blend"
OUTPUT = ROOT / "output/animation/ranger/proportions-v3"
TARGET = ROOT / "art/animation/ranger/ranger-proportions-v3.blend"
OUTPUT.mkdir(parents=True, exist_ok=True)
TARGET.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene


def shrink(name: str, factor: tuple[float, float, float], shift_z: float = 0) -> None:
    obj = bpy.data.objects[name]
    obj.scale = tuple(component * ratio for component, ratio in zip(obj.scale, factor))
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    world.translation += Vector((0, 0, shift_z))
    obj.matrix_world = world


def replace_pant(name: str, factors: tuple[float, ...]) -> None:
    obj = bpy.data.objects[name]
    old = obj.data
    minimum = min(vertex.co.z for vertex in old.vertices)
    maximum = max(vertex.co.z for vertex in old.vertices)
    radius = max(math.hypot(vertex.co.x, vertex.co.y) for vertex in old.vertices)
    count = 16
    vertices = []
    for ring, factor in enumerate(factors):
        t = ring / (len(factors) - 1)
        z = minimum + (maximum - minimum) * t
        for index in range(count):
            angle = math.tau * index / count
            vertices.append(
                (
                    radius * factor * math.cos(angle),
                    radius * factor * 1.07 * math.sin(angle),
                    z,
                )
            )
    faces = []
    for ring in range(len(factors) - 1):
        base, following = ring * count, (ring + 1) * count
        for index in range(count):
            next_index = (index + 1) % count
            faces.append(
                (
                    base + index,
                    base + next_index,
                    following + next_index,
                    following + index,
                )
            )
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple((len(factors) - 1) * count + index for index in range(count)))
    mesh = bpy.data.meshes.new(f"{name}_cloth_v3")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(bpy.data.materials["graybox_trousers"])
    mesh.update()
    obj.data = mesh


shrink("hood_outer_volume", (0.82, 0.84, 0.88), -0.025)
shrink("hood_point_volume", (0.83, 0.83, 0.82), -0.09)
shrink("hood_face_recess", (0.87, 0.88, 0.90))
for side, name in ((-1, "goggle_left"), (1, "goggle_right")):
    shrink(name, (0.78, 0.82, 0.82))
    obj = bpy.data.objects[name]
    world = obj.matrix_world.copy()
    world.translation.x = side * 0.081
    obj.matrix_world = world
shrink("gas_mask_canister", (0.85, 0.85, 0.85))

for side in ("left", "right"):
    replace_pant(f"{side}_thigh", (1.20, 1.28, 1.18, 1.08, 0.96))
    replace_pant(f"{side}_shin", (1.08, 1.17, 1.14, 0.98, 0.82))
    knee = bpy.data.objects[f"{side}_knee"]
    knee.data.materials.clear()
    knee.data.materials.append(bpy.data.materials["graybox_trousers"])
    knee.scale = tuple(
        component * factor for component, factor in zip(knee.scale, (1.04, 1.06, 1.05))
    )
    boot = bpy.data.objects[f"{side}_boot"]
    boot.scale = tuple(
        component * factor for component, factor in zip(boot.scale, (0.92, 0.86, 1.07))
    )
    bpy.context.view_layer.update()
    world = boot.matrix_world.copy()
    world.translation.z += 0.0063
    boot.matrix_world = world

# Future sidearms and close-combat props attach to the same wrist sockets.
# Attack poses and blade reach are separate clips; no melee attack is implied.
rig = bpy.data.objects["ranger_rig"]
bpy.context.view_layer.update()
for suffix in ("L", "R"):
    mount = bpy.data.objects.new(f"weapon_mount.{suffix}", None)
    scene.collection.objects.link(mount)
    mount.empty_display_type = "SPHERE"
    mount.empty_display_size = 0.07
    mount.location = rig.matrix_world @ rig.pose.bones[f"hand.{suffix}"].head
    bpy.context.view_layer.update()
    world = mount.matrix_world.copy()
    mount.parent = rig
    mount.parent_type = "BONE"
    mount.parent_bone = f"hand.{suffix}"
    mount.matrix_world = world

# The original painted ranger reads closer to this lower camera elevation:
# calves remain visible while hood and mask still read at game scale.
camera = bpy.data.objects["ranger_fixed_camera"]
camera_target = Vector((0, 0, 1.04))
elevation = math.radians(35)
azimuth = math.radians(35)
offset = (
    Vector(
        (
            math.sin(azimuth) * math.cos(elevation),
            -math.cos(azimuth) * math.cos(elevation),
            math.sin(elevation),
        )
    )
    * 6
)
camera.location = camera_target + offset
camera.rotation_euler = (
    (camera_target - camera.location).to_track_quat("-Z", "Y").to_euler()
)

scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
scene.render.filepath = str(OUTPUT / "neutral.png")
bpy.ops.render.render(write_still=True)
print("PROPORTIONS_V3", TARGET)
