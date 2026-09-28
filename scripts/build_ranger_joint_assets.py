"""Pack the ranger's painted joint components into one compact runtime atlas."""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
UPPER_SOURCE = ROOT / "art/generated/v1.5/source/ranger-wanderer-upper-rig-v2-source.png"
LOWER_SOURCE = ROOT / "art/generated/v1.5/source/ranger-wanderer-lower-rig-v2-source.png"
TARGET = ROOT / "web/assets/actors/ranger-wanderer-joints-v2.webp"
CELL = 128
ALPHA_THRESHOLD = 16

# Stable semantic order matches src/render/ranger-rig.js. Splits fall inside verified
# transparent gaps of the two ImageGen source sheets.
PARTS = (
    ("torso", "upper", (0, 0, 800, 1024)),
    ("upper_arm_left", "upper", (800, 0, 1160, 506)),
    ("upper_arm_right", "upper", (1160, 0, 1536, 506)),
    ("forearm_left", "upper", (800, 506, 1160, 1024)),
    ("forearm_right", "upper", (1160, 506, 1536, 1024)),
    ("thigh_left", "lower", (0, 0, 512, 522)),
    ("thigh_right", "lower", (512, 0, 1024, 522)),
    ("shin_left", "lower", (0, 522, 512, 993)),
    ("shin_right", "lower", (512, 522, 1024, 993)),
    ("boot_left", "lower", (0, 993, 512, 1536)),
    ("boot_right", "lower", (512, 993, 1024, 1536)),
)


def component(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    region = source.crop(box)
    bounds = region.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0).getbbox()
    if bounds is None:
        raise ValueError(f"Empty rig part in region {box}")
    left = max(0, bounds[0] - 3)
    top = max(0, bounds[1] - 3)
    right = min(region.width, bounds[2] + 3)
    bottom = min(region.height, bounds[3] + 3)
    return region.crop((left, top, right, bottom))


def build() -> list[dict]:
    with Image.open(UPPER_SOURCE) as image:
        upper = image.convert("RGBA")
    with Image.open(LOWER_SOURCE) as image:
        lower = image.convert("RGBA")
    if upper.size != (1536, 1024) or lower.size != (1024, 1536):
        raise ValueError(f"Unexpected ranger rig source dimensions: {upper.size}, {lower.size}")

    atlas = Image.new("RGBA", (CELL * 4, CELL * 3))
    for index, (name, sheet, box) in enumerate(PARTS):
        cut = component(upper if sheet == "upper" else lower, box)
        scale = min(112 / cut.width, 112 / cut.height)
        width = max(1, round(cut.width * scale))
        height = max(1, round(cut.height * scale))
        painted = cut.resize((width, height), Image.Resampling.LANCZOS)
        x = (index % 4) * CELL + (CELL - width) // 2
        y = (index // 4) * CELL + 8
        atlas.alpha_composite(painted, (x, y))
        if painted.getchannel("A").getextrema()[1] < 200:
            raise ValueError(f"Rig part {name} has no opaque painted body")

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(TARGET, "WEBP", lossless=True, exact=True, method=6)
    with Image.open(TARGET) as check:
        if check.size != atlas.size or check.convert("RGBA").getchannel("A").getextrema()[0] != 0:
            raise ValueError("Ranger rig atlas lost its transparent cells")
    return [{
        "source": UPPER_SOURCE.relative_to(ROOT).as_posix(),
        "sourcePaths": [LOWER_SOURCE.relative_to(ROOT).as_posix()],
        "runtime": TARGET.relative_to(ROOT).as_posix(),
        "kind": "cutout",
        "sourceWidth": upper.width,
        "sourceHeight": upper.height,
        "crop": [0, 0, upper.width, upper.height],
        "width": atlas.width,
        "height": atlas.height,
        "sourceBytes": UPPER_SOURCE.stat().st_size + LOWER_SOURCE.stat().st_size,
        "runtimeBytes": TARGET.stat().st_size,
        "sha256": hashlib.sha256(TARGET.read_bytes()).hexdigest().upper(),
    }]


if __name__ == "__main__":
    item = build()[0]
    print(f"{item['runtime']}: {item['width']}x{item['height']}, {item['runtimeBytes']} bytes")
