"""Bake and render the corrected eight-direction sidearm study."""

from pathlib import Path
import json, math, sys
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ranger_directional_pose import RangerDirectionController

SOURCE = ROOT / "art/animation/ranger/ranger-run-ik-v3.blend"
TARGET = ROOT / "art/animation/ranger/ranger-directional-sidearm-v2.blend"
OUT = ROOT / "output/animation/ranger/aim-v2"
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = 0
c = RangerDirectionController()
stills_only = "--stills-only" in sys.argv
metadata = {
    "projection": c.image_metadata(),
    "directions": list(range(-180, 180, 45)),
    "frames": {"run": 24, "stand": 1, "fire": 12},
    "clips": {},
    "visualApproved": False,
    "runtimeIntegrated": False,
    "complete": False,
    "renderedFrames": 0,
}
(OUT / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
(OUT / "review.html").write_text(
    '<!doctype html><meta charset="utf-8"><p>方向预览正在重建。完成后请重新生成并打开评审页。</p>',
    encoding="utf-8",
)

for degrees in metadata["directions"]:
    yaw = math.radians(degrees)
    token = f"yaw{degrees:+04d}"
    sample = c.apply(1, yaw)
    step = 0.0816666667 * sample["strideScale"]
    origin = world_to_camera_view(c.scene, c.scene.camera, Vector((0, 0, 0)))
    travel = world_to_camera_view(c.scene, c.scene.camera, Vector((0, -step, 0)))
    metadata["clips"][token] = {
        "strideScale": sample["strideScale"],
        "supportStepWorld": step,
        "groundScrollPixelPerFrame": [
            -(travel.x - origin.x) * 256,
            (travel.y - origin.y) * 256,
        ],
    }
    for mode in ("stand", "run", "fire"):
        length = metadata["frames"][mode]
        frames = (1,) if stills_only else range(1, length + 1)
        for frame in frames:
            age = (1 if stills_only else frame - 1) if mode == "fire" else None
            c.apply(
                frame if mode == "run" else 1, yaw, standing=mode != "run", shot_age=age
            )
            folder = OUT / mode / token
            folder.mkdir(parents=True, exist_ok=True)
            c.scene.render.filepath = str(folder / f"frame_{frame:02d}.png")
            bpy.ops.render.render(write_still=True)
            exported = c.measure(
                frame if mode == "run" else 1, yaw, 0, 0, mode != "run", 0
            )
            if (
                max(exported["errors"].values()) > 0.005
                or exported["faceErrorDegrees"] > 0.1
                or exported["boreErrorDegrees"] > 0.1
            ):
                raise AssertionError(
                    f"Render evaluation overwrote pose: {mode} {degrees} frame {frame}"
                )
            metadata["renderedFrames"] += 1
    print("RENDERED_DIRECTION", degrees, flush=True)

for frame in range(1, 26):
    c.apply(frame, 0)
    c.keyframe_controls(frame)
c.apply(1, 0)
c.rig["aim_yaw_degrees"] = 0.0
c.rig["movement_yaw_degrees"] = 0.0
c.rig["direction_source_version"] = 2
c.scene.frame_start, c.scene.frame_end = 1, 24
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
metadata["complete"] = not stills_only and metadata["renderedFrames"] == 296
(OUT / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
print("DIRECTIONAL_SOURCE", TARGET, flush=True)
