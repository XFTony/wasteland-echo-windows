"""Build an internal two-hand sidearm pose over the refined ranger run.

The pistol mesh is a pose proxy. Runtime weapons and combat rules are untouched.
"""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art/animation/ranger/ranger-run-ik-v3.blend"
OUTPUT = ROOT / "output/animation/ranger/run-sidearm-v1"
TARGET = ROOT / "art/animation/ranger/ranger-run-sidearm-v1.blend"
OUTPUT.mkdir(parents=True, exist_ok=True)
TARGET.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
rig = bpy.data.objects["ranger_rig"]
scene.frame_set(1)
bpy.context.view_layer.update()


def attach_to(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def marker(
    name: str, local_position: tuple[float, float, float], parent: bpy.types.Object
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.location = rig.matrix_world @ Vector(local_position)
    obj.empty_display_type = "SPHERE"
    obj.empty_display_size = 0.06
    attach_to(obj, parent)
    return obj


def box(
    name: str, local_position, dimensions, material, parent: bpy.types.Object, pitch=0
) -> None:
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=rig.matrix_world @ Vector(local_position)
    )
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.rotation_euler.x = pitch
    obj.data.materials.append(bpy.data.materials[material])
    attach_to(obj, parent)


aim = marker("weapon_aim", (0, -0.15, 1.31), rig)
right = marker("socket.sidearm.right_grip", (0.10, -0.32, 1.25), aim)
left = marker("socket.sidearm.left_support", (-0.08, -0.38, 1.28), aim)
marker("socket.sidearm.muzzle", (0.06, -0.84, 1.31), aim)

box(
    "sidearm_proxy_receiver",
    (0.04, -0.46, 1.29),
    (0.14, 0.26, 0.09),
    "graybox_weapon",
    aim,
)
box(
    "sidearm_proxy_barrel",
    (0.06, -0.68, 1.31),
    (0.08, 0.25, 0.055),
    "graybox_weapon",
    aim,
)
box(
    "sidearm_proxy_grip",
    (0.09, -0.33, 1.20),
    (0.09, 0.12, 0.16),
    "graybox_weapon",
    aim,
    pitch=-0.18,
)
box(
    "sidearm_proxy_sight",
    (0.06, -0.68, 1.36),
    (0.045, 0.06, 0.025),
    "graybox_trim",
    aim,
)

max_error = 0.0
for frame in range(1, 26):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    for suffix, anchor in (("L", left), ("R", right)):
        hand_target = bpy.data.objects[f"hand_grip.{suffix}"]
        hand_target.location = anchor.matrix_world.translation
        hand_target.keyframe_insert(data_path="location", frame=frame)
    bpy.context.view_layer.update()
    for suffix, anchor in (("L", left), ("R", right)):
        wrist = rig.matrix_world @ rig.pose.bones[f"forearm.{suffix}"].tail
        error = (wrist - anchor.matrix_world.translation).length
        max_error = max(max_error, error)
        if error > 0.005:
            raise ValueError(
                f"Frame {frame} {suffix}: unreachable sidearm grip {error:.4f} m"
            )

scene.frame_start, scene.frame_end = 1, 24
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
for name, frame in (
    ("contact", 1),
    ("down", 4),
    ("passing", 7),
    ("flight", 10),
    ("contact", 13),
    ("down", 16),
    ("passing", 19),
    ("flight", 22),
):
    scene.frame_set(frame)
    side = "left" if frame < 13 else "right"
    scene.render.filepath = str(OUTPUT / f"pose_{frame:02d}_{name}_{side}.png")
    bpy.ops.render.render(write_still=True)
print("SIDEARM_VERIFIED", "frames=25", f"max_hand_error_m={max_error:.5f}")
