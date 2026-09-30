"""Check sidearm hand reach at four yaw angles and render review stills.

This is only an IK reach test; a visible back-facing gun needs new torso art.
"""

import math
from pathlib import Path

import bpy

root = Path(__file__).resolve().parents[2]
out = root / "output/animation/ranger/run-sidearm-v1/aim-study"
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
rig = bpy.data.objects["ranger_rig"]
aim = bpy.data.objects["weapon_aim"]
max_error = 0.0
for degrees in (0, 90, 180, -90):
    scene.frame_set(1)
    aim.rotation_euler.z = math.radians(degrees)
    bpy.context.view_layer.update()
    errors = []
    for suffix, name in (
        ("L", "socket.sidearm.left_support"),
        ("R", "socket.sidearm.right_grip"),
    ):
        anchor = bpy.data.objects[name]
        hand = bpy.data.objects[f"hand_grip.{suffix}"]
        hand.location = anchor.matrix_world.translation
    bpy.context.view_layer.update()
    for suffix, name in (
        ("L", "socket.sidearm.left_support"),
        ("R", "socket.sidearm.right_grip"),
    ):
        anchor = bpy.data.objects[name]
        wrist = rig.matrix_world @ rig.pose.bones[f"forearm.{suffix}"].tail
        error = (wrist - anchor.matrix_world.translation).length
        errors.append((suffix, error))
        max_error = max(max_error, error)
        if error > 0.005:
            raise AssertionError(f"{degrees}° {suffix} hand missed by {error:.4f} m")
    print("AIM_CHECK", degrees, [(side, round(value, 5)) for side, value in errors])
    scene.render.filepath = str(out / f"aim_{degrees:+04d}.png")
    bpy.ops.render.render(write_still=True)
print("SIDEARM_AIM_REACH_VERIFIED", f"max_hand_error_m={max_error:.5f}")
