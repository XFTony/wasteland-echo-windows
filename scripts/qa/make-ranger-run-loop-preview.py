"""Make 76px/152px animated GIF reviews from rendered ranger loop frames."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = ROOT / "output/animation/ranger/run-ik-v2"
SCREENSHOT = ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png"


def shared_crop(images: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = [image.getchannel("A").getbbox() for image in images]
    if any(box is None for box in boxes):
        raise ValueError("Run loop contains an empty transparent frame")
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help="Ranger motion output directory containing loop/",
    )
    input_dir = parser.parse_args().input.resolve() / "loop"
    images = [
        Image.open(input_dir / f"frame_{frame:02d}.png").convert("RGBA")
        for frame in range(1, 25)
    ]
    crop = shared_crop(images)
    screenshot = Image.open(SCREENSHOT).convert("RGBA")
    ground = screenshot.crop((8, 355, 288, 655))
    for size, width, height in ((76, 220, 220), (152, 320, 350)):
        background = ground.resize((width, height - 30), Image.Resampling.LANCZOS)
        frames = []
        for image in images:
            panel = Image.new("RGBA", (width, height), (20, 20, 19, 255))
            panel.alpha_composite(background, (0, 30))
            draw = ImageDraw.Draw(panel)
            center, foot = width // 2, height - 32
            draw.ellipse(
                (center - 16, foot - 4, center + 16, foot + 4),
                fill=(13, 12, 11, 110),
            )
            sprite = image.crop(crop)
            sprite_width = round(sprite.width * size / sprite.height)
            sprite = sprite.resize((sprite_width, size), Image.Resampling.LANCZOS)
            panel.alpha_composite(sprite, (center - sprite_width // 2, foot - size))
            frames.append(panel.convert("RGB"))
        target = input_dir / f"run-loop-{size}px.gif"
        frames[0].save(
            target,
            save_all=True,
            append_images=frames[1:],
            duration=20,
            loop=0,
            optimize=True,
        )
        print(f"RANGER_RUN_GIF {target} {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
