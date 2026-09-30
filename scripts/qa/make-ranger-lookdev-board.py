"""Compare existing painting, rig-only pose and new art target at game sizes."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/animation/ranger/lookdev"
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = (
    ("EXISTING PAINTING", ROOT / "web/assets/actors/ranger-base-v1.webp"),
    ("RIG ONLY", ROOT / "output/animation/ranger/aim-v2/stand/yaw+000/frame_01.png"),
    (
        "NEW ART TARGET",
        ROOT / "art/animation/ranger/lookdev/ranger-sidearm-quality-target-v1.png",
    ),
)
ground = (
    Image.open(ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png")
    .convert("RGBA")
    .crop((8, 355, 288, 655))
)
for height, pw, ph in ((76, 280, 280), (152, 360, 400)):
    board = Image.new("RGBA", (pw * 3, ph), (20, 20, 19, 255))
    draw = ImageDraw.Draw(board)
    bg = ground.resize((pw, ph - 30), Image.Resampling.LANCZOS)
    for index, (label, path) in enumerate(SOURCES):
        x = index * pw
        board.alpha_composite(bg, (x, 30))
        draw.text((x + 10, 8), label, fill=(239, 225, 197))
        image = Image.open(path).convert("RGBA")
        box = (
            image.getchannel("A")
            .point(lambda alpha: 255 if alpha >= 8 else 0)
            .getbbox()
        )
        if box is None:
            raise ValueError(f"Empty lookdev source: {path}")
        image = image.crop(box)
        width = round(image.width * height / image.height)
        image = image.resize((width, height), Image.Resampling.LANCZOS)
        foot = ph - 32
        draw.ellipse(
            (x + pw // 2 - 15, foot - 4, x + pw // 2 + 15, foot + 4),
            fill=(10, 9, 8, 100),
        )
        board.alpha_composite(image, (x + (pw - width) // 2, foot - height))
    target = OUT / f"quality-board-{height}px.png"
    board.save(target)
    print(target)
