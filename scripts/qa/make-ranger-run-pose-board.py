"""Compare the eight authored graybox run key poses at game display sizes."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / "output/animation/ranger/run-keys-v1"
SCREENSHOT = ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png"
POSES = (
    ("L CONTACT", "pose_01_contact_left.png"),
    ("L DOWN", "pose_04_down_left.png"),
    ("L PASS", "pose_07_passing_left.png"),
    ("L FLIGHT", "pose_10_flight_left.png"),
    ("R CONTACT", "pose_13_contact_right.png"),
    ("R DOWN", "pose_16_down_right.png"),
    ("R PASS", "pose_19_passing_right.png"),
    ("R FLIGHT", "pose_22_flight_right.png"),
)


def shared_crop(images: list[Image.Image]) -> tuple[int, int, int, int]:
    bounds = []
    for image in images:
        box = image.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        if box is None:
            raise ValueError("A key pose has no visible character")
        bounds.append(box)
    return (min(box[0] for box in bounds), min(box[1] for box in bounds),
            max(box[2] for box in bounds), max(box[3] for box in bounds))


def make_board(size: int, panel_width: int, panel_height: int) -> Image.Image:
    images = [Image.open(INPUT / filename).convert("RGBA") for _, filename in POSES]
    crop = shared_crop(images)
    ground = Image.open(SCREENSHOT).convert("RGB").crop((8, 355, 288, 655))
    background = ground.resize((panel_width, panel_height - 30), Image.Resampling.LANCZOS).convert("RGBA")
    board = Image.new("RGBA", (panel_width * 4, panel_height * 2), (0, 0, 0, 255))
    draw = ImageDraw.Draw(board)
    for index, (label, _) in enumerate(POSES):
        x = (index % 4) * panel_width
        y = (index // 4) * panel_height
        board.alpha_composite(background, (x, y + 30))
        draw.rectangle((x, y, x + panel_width - 1, y + 29), fill=(20, 20, 19, 255))
        draw.text((x + 9, y + 8), label, fill=(238, 232, 215), font=ImageFont.load_default())
        character = images[index].crop(crop)
        width = round(character.width * size / character.height)
        character = character.resize((width, size), Image.Resampling.LANCZOS)
        center = x + panel_width // 2
        foot = y + panel_height - 32
        draw.ellipse((center - 16, foot - 4, center + 16, foot + 4), fill=(13, 12, 11, 110))
        board.alpha_composite(character, (center - width // 2, foot - size))
        draw.rectangle((x, y + 30, x + panel_width - 1, y + panel_height - 1), outline=(180, 171, 146), width=1)
    return board


def main() -> None:
    for size, width, height in ((76, 220, 220), (152, 320, 350)):
        target = INPUT / f"run-key-poses-{size}px.png"
        make_board(size, width, height).save(target)
        print(target.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
