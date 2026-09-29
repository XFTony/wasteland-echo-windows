"""Author and render eight run key poses on the ranger camera graybox.

The poses are intentionally sparse. Do not interpolate and ship an atlas until
the contact, down, passing and flight silhouettes pass visual review.
"""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art/animation/ranger/ranger-graybox-camera-v1.blend"
TARGET = ROOT / "art/animation/ranger/ranger-graybox-run-keys-v1.blend"
OUTPUT = ROOT / "output/animation/ranger/run-keys-v1"

# One half-cycle is authored as four named poses. The second half swaps which
# leg leads; these are explicit animation decisions, not a sine-driven gait.
KEY_POSES = (
    ("contact", 1, 0.02, 0.10, -0.34, 0.10, -0.16, 0.61, 0.25, 0.17, 0.13, 0.67),
    ("down", 4, -0.03, 0.14, -0.18, 0.10, -0.09, 0.55, 0.32, 0.19, 0.16, 0.65),
    ("passing", 7, 0.05, 0.12, 0.06, 0.10, 0.02, 0.59, -0.04, 0.35, -0.08, 0.75),
    ("flight", 10, 0.09, 0.08, 0.26, 0.25, 0.14, 0.67, -0.28, 0.20, -0.14, 0.69),
)


def segment(obj: bpy.types.Object, start: Vector, finish: Vector, frame: int) -> None:
    vector = finish - start
    local_z = [vertex.co.z for vertex in obj.data.vertices]
    original_length = max(local_z) - min(local_z)
    obj.location = (start + finish) / 2
    obj.rotation_euler = vector.to_track_quat("Z", "Y").to_euler()
    obj.scale.z = vector.length / original_length
    obj.keyframe_insert(data_path="location", frame=frame)
    obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    obj.keyframe_insert(data_path="scale", frame=frame)


def parent_torso(root: bpy.types.Object) -> None:
    names = ["coat_torso_volume", "hood_outer_volume", "hood_point_volume",
             "hood_face_recess", "goggle_left", "goggle_right", "gas_mask_canister",
             "scarf_band", "belt", "coat_tail_left", "coat_tail_right", "pistol_scale_marker"]
    bpy.context.view_layer.update()
    for name in names:
        obj = bpy.data.objects[name]
        world_matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world_matrix


def set_pose(name: str, frame: int, lead: int, values: tuple) -> None:
    (_, _, bob, lean, lead_ankle_y, lead_ankle_z, lead_knee_y, lead_knee_z,
     trail_ankle_y, trail_ankle_z, trail_knee_y, trail_knee_z) = values
    body = bpy.data.objects["animation_root"]
    body.location = (lead * 0.025, 0, 1.05 + bob)
    body.rotation_euler = (lean, 0, 0)
    body.keyframe_insert(data_path="location", frame=frame)
    body.keyframe_insert(data_path="rotation_euler", frame=frame)
    bpy.context.view_layer.update()

    for side, label in ((-1, "left"), (1, "right")):
        leading = side == lead
        knee_y = lead_knee_y if leading else trail_knee_y
        knee_z = lead_knee_z if leading else trail_knee_z
        ankle_y = lead_ankle_y if leading else trail_ankle_y
        ankle_z = lead_ankle_z if leading else trail_ankle_z
        hip = body.matrix_world @ Vector((side * 0.17, 0.01, -0.02))
        knee = Vector((side * 0.19, knee_y, knee_z))
        ankle = Vector((side * 0.19, ankle_y, ankle_z))
        segment(bpy.data.objects[f"{label}_thigh"], hip, knee, frame)
        segment(bpy.data.objects[f"{label}_shin"], knee, ankle, frame)
        kneecap = bpy.data.objects[f"{label}_knee"]
        kneecap.location = knee
        kneecap.keyframe_insert(data_path="location", frame=frame)
        boot = bpy.data.objects[f"{label}_boot"]
        boot.location = (side * 0.19, ankle_y - 0.12, max(0.08, ankle_z - 0.04))
        boot.rotation_euler = (0.20 if leading else -0.14, 0, 0)
        boot.keyframe_insert(data_path="location", frame=frame)
        boot.keyframe_insert(data_path="rotation_euler", frame=frame)

        shoulder = body.matrix_world @ Vector((side * 0.32, 0.01, 0.51))
        elbow = body.matrix_world @ Vector((side * 0.39, -0.18, 0.25))
        hand = body.matrix_world @ Vector((side * 0.16, -0.42, 0.18))
        segment(bpy.data.objects[f"{label}_upper_arm"], shoulder, elbow, frame)
        segment(bpy.data.objects[f"{label}_forearm"], elbow, hand, frame)
        glove = bpy.data.objects[f"{label}_glove"]
        glove.location = hand
        glove.keyframe_insert(data_path="location", frame=frame)
    print(f"KEY_POSE {frame} {name} lead={lead}")


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    bpy.context.preferences.filepaths.save_version = 0
    root = bpy.data.objects.new("animation_root", None)
    scene.collection.objects.link(root)
    root.location = (0, 0, 1.05)
    parent_torso(root)

    render_list = []
    for half, lead in ((0, -1), (1, 1)):
        for values in KEY_POSES:
            name, local_frame = values[:2]
            frame = local_frame + half * 12
            set_pose(name, frame, lead, values)
            render_list.append((name, "left" if lead < 0 else "right", frame))
    set_pose("wrap", 25, -1, KEY_POSES[0])
    scene.frame_start = 1
    scene.frame_end = 24
    scene.frame_set(1)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))

    for name, side, frame in render_list:
        scene.frame_set(frame)
        scene.render.filepath = str(OUTPUT / f"pose_{frame:02d}_{name}_{side}.png")
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED_KEY_POSE {frame} {name} {side}")


if __name__ == "__main__":
    main()
