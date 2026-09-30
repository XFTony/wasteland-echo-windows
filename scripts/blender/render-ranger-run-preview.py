"""Render every frame of the internal ranger run loop for visual review.

Run with ranger-run-ik-v2.blend open. Frames go to ignored output/ only.
"""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_NAMES = {
    "ranger-run-ik-v2": "run-ik-v2",
    "ranger-run-ik-v3": "run-ik-v3",
    "ranger-run-sidearm-v1": "run-sidearm-v1",
}


def main() -> None:
    if "ranger_rig" not in bpy.data.objects:
        raise RuntimeError("Open a ranger motion .blend before rendering")
    name = Path(bpy.data.filepath).stem
    if name not in OUTPUT_NAMES:
        raise RuntimeError(f"Unsupported ranger motion source: {name}")
    output = ROOT / "output/animation/ranger" / OUTPUT_NAMES[name] / "loop"
    output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    for frame in range(1, 25):
        scene.frame_set(frame)
        scene.render.filepath = str(output / f"frame_{frame:02d}.png")
        bpy.ops.render.render(write_still=True)
    print(f"RANGER_RUN_PREVIEW frames=24 path={output}")


if __name__ == "__main__":
    main()
