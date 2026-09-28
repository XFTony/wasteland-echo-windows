"""Build the ranger's compact combat layers from the approved painted cutout kit."""

from __future__ import annotations

import hashlib
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/generated/v1.5/source/ranger-wanderer-motion-kit-v1-source.png"
UPPER = ROOT / "web/assets/actors/ranger-wanderer-upper-v1.webp"
LOWER = ROOT / "web/assets/actors/ranger-wanderer-walk-v1.webp"
CELL = 160
FRAMES = 12
TRANSPARENCY_THRESHOLD = 16

# The ImageGen source is a three-column kit: one upper body and two independent legs.
# These bounds are deliberately checked, so a regenerated kit cannot silently shift.
PART_REGIONS = {
    "upper": (0, 0, 836, 1024),
    "left_leg": (908, 0, 1118, 1024),
    "right_leg": (1212, 0, 1536, 1024),
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def component(source: Image.Image, region: tuple[int, int, int, int]) -> Image.Image:
    cut = source.crop(region)
    visible = cut.getchannel("A").point(lambda value: 255 if value >= TRANSPARENCY_THRESHOLD else 0).getbbox()
    if visible is None:
        raise ValueError(f"Missing visible ranger component in {region}")
    left = max(0, visible[0] - 3)
    top = max(0, visible[1] - 3)
    right = min(cut.width, visible[2] + 3)
    bottom = min(cut.height, visible[3] + 3)
    return cut.crop((left, top, right, bottom))


def fit_height(image: Image.Image, height: int) -> Image.Image:
    width = round(image.width * height / image.height)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def leg_layer(leg: Image.Image, hip_x: int, phase: float, sign: int) -> Image.Image:
    swing = math.sin(phase) * sign
    lift = round(max(0, swing) * 5)
    layer = Image.new("RGBA", (CELL, CELL))
    layer.alpha_composite(leg, (round(hip_x - leg.width / 2), 78 - lift))
    return layer.rotate(-swing * 17, Image.Resampling.BICUBIC, center=(hip_x, 79), expand=False)


def entry(source: Image.Image, target: Path, crop: list[int]) -> dict:
    with Image.open(target) as rendered:
        rendered.load()
        if rendered.mode != "RGBA" or rendered.getchannel("A").getextrema()[0] != 0:
            raise ValueError(f"Motion art must retain transparent pixels: {target}")
        width, height = rendered.size
    return {
        "source": SOURCE.relative_to(ROOT).as_posix(),
        "runtime": target.relative_to(ROOT).as_posix(),
        "kind": "cutout",
        "sourceWidth": source.width,
        "sourceHeight": source.height,
        "crop": crop,
        "width": width,
        "height": height,
        "sourceBytes": SOURCE.stat().st_size,
        "runtimeBytes": target.stat().st_size,
        "sha256": sha256(target),
    }


def build() -> list[dict]:
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != (1536, 1024):
        raise ValueError(f"Unexpected ranger motion kit size: {source.size}")
    upper = fit_height(component(source, PART_REGIONS["upper"]), 106)
    left_leg = fit_height(component(source, PART_REGIONS["left_leg"]), 80)
    right_leg = fit_height(component(source, PART_REGIONS["right_leg"]), 80)
    if max(upper.width, left_leg.width, right_leg.width) > 112:
        raise ValueError("Ranger component is too wide for the 160px motion cell")

    upper_cell = Image.new("RGBA", (CELL, CELL))
    upper_cell.alpha_composite(upper, ((CELL - upper.width) // 2, 0))

    lower_atlas = Image.new("RGBA", (CELL * 4, CELL * 3))
    for frame in range(FRAMES):
        phase = frame * math.tau / FRAMES
        left = leg_layer(left_leg, 72, phase, 1)
        right = leg_layer(right_leg, 88, phase, -1)
        lower_frame = Image.new("RGBA", (CELL, CELL))
        if math.sin(phase) >= 0:
            lower_frame.alpha_composite(right)
            lower_frame.alpha_composite(left)
        else:
            lower_frame.alpha_composite(left)
            lower_frame.alpha_composite(right)
        lower_atlas.alpha_composite(lower_frame, ((frame % 4) * CELL, (frame // 4) * CELL))

    UPPER.parent.mkdir(parents=True, exist_ok=True)
    upper_cell.save(UPPER, "WEBP", lossless=True, exact=True, method=6)
    lower_atlas.save(LOWER, "WEBP", lossless=True, exact=True, method=6)
    return [
        entry(source, UPPER, list(PART_REGIONS["upper"])),
        entry(source, LOWER, [PART_REGIONS["left_leg"][0], 0, PART_REGIONS["right_leg"][2], 1024]),
    ]


if __name__ == "__main__":
    for result in build():
        print(f"{result['runtime']}: {result['width']}x{result['height']}, {result['runtimeBytes']} bytes")
