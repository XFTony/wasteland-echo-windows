"""Author a constrained run study on the ranger fixed-length rig.

The action remains a graybox review candidate; no runtime asset is exported.
"""

from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
source = root / "art/animation/ranger/ranger-silhouette-v2.blend"
target = root / "art/animation/ranger/ranger-run-ik-v2.blend"
out = root / "output/animation/ranger/run-ik-v2"
out.mkdir(parents=True, exist_ok=True)
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
rig = bpy.data.objects["ranger_rig"]

# Name, frame within half-cycle, body height, front/back foot (y,z), hand
# swing. Each contact foot has sole z ~= 0 with the boot rest geometry.
poses = (
    ("contact", 1, -0.09, (-0.32, 0.15), (0.23, 0.28), 1.0),
    ("down", 4, -0.10, (-0.075, 0.15), (0.13, 0.24), 0.55),
    ("passing", 7, -0.04, (0.17, 0.15), (-0.15, 0.25), -0.5),
    ("flight", 10, 0.02, (0.30, 0.26), (-0.30, 0.22), -1.0),
)


def set_pose(frame, lead, pose):
    name, _, body_z, front, back, swing = pose
    rig.location.z = body_z
    rig.keyframe_insert(data_path="location", frame=frame)
    for side, suffix in ((-1, "L"), (1, "R")):
        is_front = side == lead
        y, z = front if is_front else back
        foot = bpy.data.objects[f"foot_ik.{suffix}"]
        foot.location = (side * 0.19, y, z)
        foot.keyframe_insert(data_path="location", frame=frame)
        hand = bpy.data.objects[f"hand_grip.{suffix}"]
        hand_y = (1 if is_front else -1) * 0.21 * swing
        hand.location = (side * 0.29, hand_y, 1.04 + body_z)
        hand.keyframe_insert(data_path="location", frame=frame)
    bpy.context.view_layer.update()
    for suffix in ("L", "R"):
        ankle = rig.matrix_world @ rig.pose.bones[f"shin.{suffix}"].tail
        target = Vector(bpy.data.objects[f"foot_ik.{suffix}"].location)
        hand = rig.matrix_world @ rig.pose.bones[f"forearm.{suffix}"].tail
        hand_target = Vector(bpy.data.objects[f"hand_grip.{suffix}"].location)
        foot_error = (ankle - target).length
        hand_error = (hand - hand_target).length
        print(
            "POSE_CHECK",
            frame,
            name,
            suffix,
            "foot",
            round(foot_error, 5),
            "hand",
            round(hand_error, 5),
        )
        if foot_error > 0.005 or hand_error > 0.005:
            raise ValueError(
                f"Unreachable {suffix} target in {name}: "
                f"{foot_error:.4f}, {hand_error:.4f}"
            )


keys = []
for half, lead in ((0, -1), (1, 1)):
    for pose in poses:
        name, local = pose[:2]
        frame = local + 12 * half
        set_pose(frame, lead, pose)
        keys.append((name, lead, frame))
set_pose(25, -1, poses[0])
# A planted foot must move back at a constant rate relative to the moving
# character. Default Bezier ease-in/out visibly slides at either end.
for suffix, start_frames in (("L", (1, 4)), ("R", (13, 16))):
    obj = bpy.data.objects[f"foot_ik.{suffix}"]
    action = obj.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    if curve.data_path == "location" and curve.array_index == 1:
                        for key in curve.keyframe_points:
                            if round(key.co.x) in start_frames:
                                key.interpolation = "LINEAR"
scene.frame_start, scene.frame_end = 1, 24
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(target))
for name, lead, frame in keys:
    scene.frame_set(frame)
    scene.render.filepath = str(
        out / f'pose_{frame:02d}_{name}_{"left" if lead<0 else "right"}.png'
    )
    bpy.ops.render.render(write_still=True)
