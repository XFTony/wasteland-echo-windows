"""Check that the ranger pilot rig preserves limb lengths and foot IK targets.

Run Blender with the rig .blend open, then this script via --python. This is a
technical check only: passing it does not approve the gait or character art.
"""

from __future__ import annotations

import bpy
from mathutils import Vector


POSES = (
    ("contact", -0.09, (-0.32, 0.13), (0.23, 0.28)),
    ("down", -0.10, (-0.12, 0.13), (0.13, 0.24)),
    ("passing", -0.04, (0.11, 0.25), (-0.08, 0.13)),
    ("flight", 0.02, (0.29, 0.30), (-0.30, 0.25)),
)
REQUIRED_BONES = (
    "root", "pelvis", "spine", "head",
    "thigh.L", "shin.L", "foot.L", "upper_arm.L", "forearm.L", "hand.L",
    "thigh.R", "shin.R", "foot.R", "upper_arm.R", "forearm.R", "hand.R",
)
MAX_TARGET_ERROR = 0.005


def main() -> None:
    rig = bpy.data.objects.get("ranger_rig")
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("Open ranger-rig-graybox-v1.blend before verification")
    missing = set(REQUIRED_BONES) - set(rig.data.bones.keys())
    if missing:
        raise AssertionError(f"Missing bones: {sorted(missing)}")
    for suffix in ("L", "R"):
        for marker in (f"foot_ik.{suffix}", f"knee_pole.{suffix}",
                       f"hand_grip.{suffix}"):
            if marker not in bpy.data.objects:
                raise AssertionError(f"Missing control: {marker}")
    if "weapon_muzzle" not in bpy.data.objects:
        raise AssertionError("Missing weapon muzzle marker")

    lengths = {
        (suffix, segment): rig.data.bones[f"{segment}.{suffix}"].length
        for suffix in ("L", "R") for segment in ("thigh", "shin")
    }
    worst_error = 0.0
    for name, body_z, left, right in POSES:
        rig.location.z = body_z
        for x, suffix, point in ((-0.19, "L", left), (0.19, "R", right)):
            bpy.data.objects[f"foot_ik.{suffix}"].location = (x, *point)
        bpy.context.view_layer.update()
        for suffix in ("L", "R"):
            foot = rig.matrix_world @ rig.pose.bones[f"shin.{suffix}"].tail
            target = Vector(bpy.data.objects[f"foot_ik.{suffix}"].location)
            error = (foot - target).length
            worst_error = max(worst_error, error)
            if error > MAX_TARGET_ERROR:
                raise AssertionError(
                    f"{name} {suffix} foot target missed by {error:.4f} m"
                )
            for segment in ("thigh", "shin"):
                bone = rig.pose.bones[f"{segment}.{suffix}"]
                if abs(bone.length - lengths[suffix, segment]) > 0.0001:
                    raise AssertionError(f"{name} {suffix} {segment} changed length")
    print(f"RIG_VERIFIED poses={len(POSES)} bones={len(rig.data.bones)} "
          f"max_foot_error_m={worst_error:.5f}")


if __name__ == "__main__":
    main()
