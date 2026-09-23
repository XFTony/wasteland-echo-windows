from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "web" / "assets" / "wasteland-title-keyart-v1.png"
TARGET = ROOT / "src-tauri" / "icons" / "icon.ico"

with Image.open(SOURCE) as image:
    rgba = image.convert("RGBA")
    side = max(rgba.size)
    canvas = Image.new("RGBA", (side, side), (18, 15, 12, 255))
    canvas.alpha_composite(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(TARGET, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(TARGET)
