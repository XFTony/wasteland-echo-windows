"""Verify technical contact and rig constraints of the ranger run study.

Run after opening ranger-run-ik-v2.blend. Passing this check does not approve
the animation's visual quality or authorize use in the game.
"""

from __future__ import annotations

import bpy
from mathutils import Vector


MAX_TARGET_ERROR = 0.005
MAX_GROUND_ERROR = 0.012
MIN_SWING_CLEARANCE = 0.05
SUPPORT = {"L": range(1, 8), "R": range(13, 20)}
CONTROL_NAMES = ("foot_ik.L", "foot_ik.R", "hand_grip.L", "hand_grip.R")


def boot_sole_z(label: str, depsgraph) -> float:
    obj = bpy.data.objects[f"{label}_boot"].evaluated_get(depsgraph)
    return min((obj.matrix_world @ vertex.co).z for vertex in obj.data.vertices)


def snapshot(rig: bpy.types.Object) -> tuple[tuple[float, ...], ...]:
    return (tuple(rig.location),) + tuple(
        tuple(bpy.data.objects[name].location) for name in CONTROL_NAMES
    )


def main() -> None:
    rig = bpy.data.objects.get("ranger_rig")
    if rig is None or rig.type != "ARMATURE":
        raise RuntimeError("Open ranger-run-ik-v2.blend before verification")
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lengths = {
        (side, segment): rig.data.bones[f"{segment}.{side}"].length
        for side in ("L", "R")
        for segment in ("thigh", "shin", "upper_arm", "forearm")
    }
    for side, label in (("L", "left"), ("R", "right")):
        if (
            bpy.data.objects[f"{label}_boot"].parent
            != bpy.data.objects[f"foot_ik.{side}"]
        ):
            raise AssertionError(f"{label} boot is not attached to its foot control")

    max_target_error = 0.0
    min_sole = 10.0
    support_y = {"L": [], "R": []}
    for frame in range(1, 25):
        scene.frame_set(frame)
        for side, label in (("L", "left"), ("R", "right")):
            for segment, control in (("shin", "foot_ik"), ("forearm", "hand_grip")):
                actual = rig.matrix_world @ rig.pose.bones[f"{segment}.{side}"].tail
                target = Vector(bpy.data.objects[f"{control}.{side}"].location)
                error = (actual - target).length
                max_target_error = max(max_target_error, error)
                if error > MAX_TARGET_ERROR:
                    raise AssertionError(
                        f"frame {frame}: {side} {segment} missed target by {error:.4f} m"
                    )
            for segment in ("thigh", "shin", "upper_arm", "forearm"):
                if (
                    abs(
                        rig.pose.bones[f"{segment}.{side}"].length
                        - lengths[side, segment]
                    )
                    > 0.0001
                ):
                    raise AssertionError(
                        f"frame {frame}: {side} {segment} changed length"
                    )
            sole = boot_sole_z(label, depsgraph)
            min_sole = min(min_sole, sole)
            if sole < -MAX_GROUND_ERROR:
                raise AssertionError(
                    f"frame {frame}: {label} boot penetrated {sole:.4f} m"
                )
            if frame in SUPPORT[side]:
                if abs(sole) > MAX_GROUND_ERROR:
                    raise AssertionError(
                        f"frame {frame}: {label} support foot is off ground"
                    )
                support_y[side].append(bpy.data.objects[f"foot_ik.{side}"].location.y)
            elif frame in SUPPORT["R" if side == "L" else "L"]:
                if sole < MIN_SWING_CLEARANCE:
                    raise AssertionError(
                        f"frame {frame}: {label} swing foot is too low"
                    )
            if frame in (10, 22) and sole < MIN_SWING_CLEARANCE:
                raise AssertionError(f"frame {frame}: {label} flight foot is too low")

    for side, positions in support_y.items():
        steps = [right - left for left, right in zip(positions, positions[1:])]
        if max(steps) - min(steps) > 0.001 or min(steps) <= 0:
            raise AssertionError(f"{side} support foot moves at uneven speed: {steps}")

    scene.frame_set(1)
    start = snapshot(rig)
    scene.frame_set(25)
    end = snapshot(rig)
    if any((Vector(a) - Vector(b)).length > 0.0001 for a, b in zip(start, end)):
        raise AssertionError("Run cycle does not wrap to its starting controls")

    print(
        f"RANGER_RUN_VERIFIED frames=24 max_target_error_m={max_target_error:.5f} "
        f"min_boot_sole_m={min_sole:.4f} "
        f"support_step_m={support_y['L'][1] - support_y['L'][0]:.5f}"
    )


if __name__ == "__main__":
    main()
