"""Verify complete directional and shooting constraints, never visual approval."""

from pathlib import Path
import json
import math
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ranger_directional_pose import RangerDirectionController, facing_policy

bpy.ops.wm.open_mainfile(
    filepath=str(ROOT / "art/animation/ranger/ranger-run-ik-v3.blend")
)
controller = RangerDirectionController()
results = []
failures = []


def check(sample, mode):
    if max(sample["errors"].values()) > 0.005:
        failures.append(
            {"mode": mode, "reason": "unreachable control", "sample": sample}
        )
    if sample["faceErrorDegrees"] > 0.1 or sample["boreErrorDegrees"] > 0.1:
        failures.append({"mode": mode, "reason": "aim orientation", "sample": sample})
    if abs(sample["waistDegrees"]) > 45.001:
        failures.append({"mode": mode, "reason": "waist limit", "sample": sample})
    if min(sample["bootSole"].values()) < -0.016:
        failures.append({"mode": mode, "reason": "boot penetration", "sample": sample})
    if not all(15 < value < 150 for value in sample["elbowDegrees"].values()):
        failures.append({"mode": mode, "reason": "elbow angle", "sample": sample})
    results.append({"mode": mode, **sample})


for degrees in range(-180, 180, 45):
    yaw = math.radians(degrees)
    for frame in range(1, 25):
        check(controller.apply(frame, yaw), "run")
    check(controller.apply(1, yaw, standing=True), "stand")
    for age in range(12):
        check(controller.apply(1, yaw, standing=True, shot_age=age), "fire")

# Backward aim across +/-180 must remain continuous; clamp-only policies jump.
previous = None
max_hip_step = 0.0
for degrees in range(170, 191):
    hip, _ = facing_policy(math.radians(degrees), 0, False)
    if previous is not None:
        max_hip_step = max(max_hip_step, abs(hip - previous))
    previous = hip
if math.degrees(max_hip_step) > 2:
    failures.append({"mode": "turn", "reason": "backward yaw discontinuity"})

# The current boots are ellipsoid grayboxes. Check their rendered mesh volumes,
# not merely the distance between ankle controls, while interpolating yaw.
min_clearance_score = 10.0
for degrees in range(-180, 180, 15):
    for frame in range(1, 25):
        controller.apply(frame, math.radians(degrees))
        left, right = [bpy.data.objects[f"{side}_boot"] for side in ("left", "right")]
        score = min(
            (other.matrix_world.inverted() @ (obj.matrix_world @ vertex.co)).length
            for obj, other in ((left, right), (right, left))
            for vertex in obj.data.vertices
        )
        min_clearance_score = min(min_clearance_score, score)
        if score < 0.95:
            failures.append(
                {
                    "mode": "boot-clearance",
                    "aimDegrees": degrees,
                    "frame": frame,
                    "ellipsoidScore": score,
                }
            )


def transforms():
    objects = [controller.rig, controller.weapon]
    for side in ("L", "R"):
        objects.extend(
            bpy.data.objects[f"{stem}.{side}"]
            for stem in ("foot_ik", "knee_pole", "hand_grip", "elbow_pole")
        )
    return [obj.matrix_world.copy() for obj in objects] + [
        (controller.rig.matrix_world @ bone.matrix).copy()
        for bone in controller.rig.pose.bones
    ]


for degrees in range(-180, 180, 45):
    controller.apply(1, math.radians(degrees))
    start = transforms()
    controller.apply(25, math.radians(degrees))
    end = transforms()
    difference = max(
        abs(a[i][j] - b[i][j])
        for a, b in zip(start, end)
        for i in range(4)
        for j in range(4)
    )
    if difference > 0.0001:
        failures.append(
            {"mode": "loop", "aimDegrees": degrees, "matrixDifference": difference}
        )

summary = {
    "samples": len(results),
    "runSamples": 192,
    "standSamples": 8,
    "fireSamples": 96,
    "bootClearanceSamples": 576,
    "minimumBootClearanceScore": min_clearance_score,
    "maxTargetErrorMetres": max(
        value for row in results for value in row["errors"].values()
    ),
    "minSoleMetres": min(
        value for row in results for value in row["bootSole"].values()
    ),
    "maxWaistDegrees": max(abs(row["waistDegrees"]) for row in results),
    "minElbowDegrees": min(
        value for row in results for value in row["elbowDegrees"].values()
    ),
    "maxElbowDegrees": max(
        value for row in results for value in row["elbowDegrees"].values()
    ),
    "minAnkleSeparationMetres": min(row["ankleSeparation"] for row in results),
    "maxHipStepDegreesAcrossBack": math.degrees(max_hip_step),
    "failures": failures,
    "visualApproved": False,
    "runtimeIntegrated": False,
}
output = ROOT / "output/animation/ranger/aim-v2"
output.mkdir(parents=True, exist_ok=True)
(output / "verification.json").write_text(
    json.dumps(summary, indent=2), encoding="utf-8"
)
(output / "projection.json").write_text(
    json.dumps(controller.image_metadata(), indent=2), encoding="utf-8"
)
print(json.dumps(summary))
if failures:
    raise AssertionError(f"{len(failures)} directional constraints failed")
