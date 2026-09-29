"""Place the camera graybox next to current ranger art at actual combat sizes."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "output/animation/ranger/camera-v1"
SCREENSHOT = ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png"
BODY = ROOT / "web/assets/actors/ranger-base-v1.webp"
GUN = ROOT / "web/assets/weapons/scrap-pistol-v1.webp"
LABELS = (("CURRENT", None), ("35 DEG", 35), ("42 DEG", 42), ("50 DEG", 50))


def visible(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bounds = rgba.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("Empty comparison sprite")
    return rgba.crop(bounds)


def resized(image: Image.Image, height: int) -> Image.Image:
    return image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)


def board(sprite_height: int, panel_width: int, panel_height: int) -> Image.Image:
    ground = Image.open(SCREENSHOT).convert("RGB")
    source_patch = ground.crop((8, 355, 288, 655))
    background = source_patch.resize((panel_width, panel_height - 32), Image.Resampling.LANCZOS).convert("RGBA")
    result = Image.new("RGBA", (panel_width * 4, panel_height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(result)
    foot_y = panel_height - 50
    sprites = {None: visible(Image.open(BODY))}
    for _, angle in LABELS[1:]:
        sprites[angle] = visible(Image.open(INPUT / f"camera_{angle}deg.png"))
    gun = visible(Image.open(GUN))

    for index, (label, angle) in enumerate(LABELS):
        origin = index * panel_width
        result.alpha_composite(background, (origin, 32))
        draw.rectangle((origin, 0, origin + panel_width - 1, 31), fill=(20, 20, 19, 255))
        draw.text((origin + 13, 10), label, fill=(238, 232, 215), font=ImageFont.load_default())
        draw.ellipse((origin + panel_width // 2 - 18, foot_y - 4,
                      origin + panel_width // 2 + 18, foot_y + 5), fill=(15, 13, 12, 110))
        sprite = resized(sprites[angle], sprite_height)
        x = origin + (panel_width - sprite.width) // 2
        y = foot_y - sprite.height
        result.alpha_composite(sprite, (x, y))
        if angle is None:
            gun_image = resized(gun, max(5, round(sprite_height * 0.20)))
            gun_x = origin + panel_width // 2 - round(gun_image.width * 0.29)
            gun_y = foot_y - round(sprite_height * 0.40)
            result.alpha_composite(gun_image, (gun_x, gun_y))
        draw.rectangle((origin, 32, origin + panel_width - 1, panel_height - 1), outline=(180, 171, 146, 255), width=1)
    return result


def main() -> None:
    INPUT.mkdir(parents=True, exist_ok=True)
    for size, width, height in ((76, 280, 300), (152, 360, 430)):
        target = INPUT / f"camera-board-{size}px.png"
        board(size, width, height).save(target)
        print(target.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
