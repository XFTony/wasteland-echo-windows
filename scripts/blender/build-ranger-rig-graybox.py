"""Build an editable, fixed-bone-length ranger rig from the camera graybox.

This is a technical skeleton, not approved character art or a shippable action.
It creates real Blender bones, foot IK controls and stable attachment bone names.
"""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art/animation/ranger/ranger-graybox-camera-v1.blend"
TARGET = ROOT / "art/animation/ranger/ranger-rig-graybox-v1.blend"
PREVIEW = ROOT / "output/animation/ranger/rig-v1/neutral.png"


def add_bone(armature, name, head, tail, parent=None):
    bone = armature.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    if parent:
        bone.parent = armature.edit_bones[parent]
        bone.use_connect = False
    return bone


def bone_parent(obj: bpy.types.Object, rig: bpy.types.Object, bone_name: str) -> None:
    bpy.context.view_layer.update()
    original_world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = original_world


def make_marker(name: str, position, size: float = 0.12):
    marker = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(marker)
    marker.empty_display_type = "SPHERE"
    marker.empty_display_size = size
    marker.location = position
    return marker


def fit_link(name: str, start, end) -> None:
    """Set rest geometry once; the subsequent animation never scales a limb."""
    obj = bpy.data.objects[name]
    start, end = Vector(start), Vector(end)
    obj.location = (start + end) / 2
    obj.rotation_euler = (end - start).to_track_quat("Z", "Y").to_euler()
    local_z = [vertex.co.z for vertex in obj.data.vertices]
    obj.scale.z = (end - start).length / (max(local_z) - min(local_z))


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    bpy.context.preferences.filepaths.save_version = 0

    rig_data = bpy.data.armatures.new("ranger_motion_skeleton")
    rig = bpy.data.objects.new("ranger_rig", rig_data)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    add_bone(rig_data, "root", (0, 0, 0), (0, 0, 1.03))
    add_bone(rig_data, "pelvis", (0, 0, 1.03), (0, 0, 1.13), "root")
    add_bone(rig_data, "spine", (0, 0, 1.13), (0, 0, 1.55), "pelvis")
    add_bone(rig_data, "head", (0, 0, 1.55), (0, 0, 2.11), "spine")
    for side, suffix in ((-1, "L"), (1, "R")):
        hip = (side * .17, .01, 1.03)
        knee = (side * .19, -.18, .57)
        ankle = (side * .19, -.03, .15)
        name = "left" if side < 0 else "right"
        fit_link(f"{name}_thigh", hip, knee)
        fit_link(f"{name}_shin", knee, ankle)
        bpy.data.objects[f"{name}_knee"].location = knee
        add_bone(rig_data, f"thigh.{suffix}", hip, knee, "pelvis")
        add_bone(rig_data, f"shin.{suffix}", knee, ankle, f"thigh.{suffix}")
        add_bone(rig_data, f"foot.{suffix}", ankle,
                 (side * .19, -.23, .09), f"shin.{suffix}")
        shoulder = (side * .32, .01, 1.56)
        elbow = (side * .39, -.18, 1.30)
        wrist = (side * .16, -.42, 1.23)
        add_bone(rig_data, f"upper_arm.{suffix}", shoulder, elbow, "spine")
        add_bone(rig_data, f"forearm.{suffix}", elbow, wrist,
                 f"upper_arm.{suffix}")
        add_bone(rig_data, f"hand.{suffix}", wrist,
                 (side * .16, -.52, 1.23), f"forearm.{suffix}")
    bpy.ops.object.mode_set(mode="OBJECT")

    attached = {
        "coat_torso_volume": "spine",
        "hood_outer_volume": "head",
        "hood_point_volume": "head",
        "hood_face_recess": "head",
        "goggle_left": "head",
        "goggle_right": "head",
        "gas_mask_canister": "head",
        "scarf_band": "spine",
        "belt": "pelvis",
    }
    for side, suffix in (("left", "L"), ("right", "R")):
        attached.update({
            f"coat_tail_{side}": "pelvis",
            f"{side}_upper_arm": f"upper_arm.{suffix}",
            f"{side}_forearm": f"forearm.{suffix}",
            f"{side}_glove": f"hand.{suffix}",
            f"{side}_thigh": f"thigh.{suffix}",
            f"{side}_knee": f"thigh.{suffix}",
            f"{side}_shin": f"shin.{suffix}",
            f"{side}_boot": f"foot.{suffix}",
        })
    for obj_name, bone_name in attached.items():
        bone_parent(bpy.data.objects[obj_name], rig, bone_name)

    bpy.data.objects["pistol_scale_marker"].hide_render = True
    for side, suffix in ((-1, "L"), (1, "R")):
        ankle = (side * .19, -.03, .15)
        pole = (side * .19, -.65, .58)
        foot_target = make_marker(f"foot_ik.{suffix}", ankle)
        knee_pole = make_marker(f"knee_pole.{suffix}", pole)
        control = rig.pose.bones[f"shin.{suffix}"].constraints.new("IK")
        control.name = f"plant_foot.{suffix}"
        control.target = foot_target
        control.chain_count = 2
        control.pole_target = knee_pole
        control.pole_angle = 0
        make_marker(f"hand_grip.{suffix}",
                    (side * .16, -.42, 1.23), .08)
    make_marker("weapon_muzzle", (.65, -.47, 1.25), .10)
    rig.show_in_front = True
    rig_data.display_type = "STICK"
    scene.frame_start = 1
    scene.frame_end = 24
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
    scene.render.filepath = str(PREVIEW)
    bpy.ops.render.render(write_still=True)
    for suffix in ("L", "R"):
        shin = rig.pose.bones[f"shin.{suffix}"]
        print("RIG_NEUTRAL", suffix,
              tuple(round(v, 4) for v in (rig.matrix_world @ shin.tail)))
    print("RIG_BONES", len(rig_data.bones))
    print("RIG_OBJECTS_ATTACHED", len(attached))


if __name__ == "__main__":
    main()
