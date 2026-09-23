from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat, features


ROOT = Path(__file__).resolve().parents[1]
ASSETS = (
    ("art/generated/v1.0/runtime-snapshot/wasteland-ground-texture-v1.png", "web/assets/wasteland-ground-texture-v1.webp", 84, False),
    ("art/generated/v1.0/runtime-snapshot/wasteland-title-keyart-v1.png", "web/assets/wasteland-title-keyart-v1.webp", 88, False),
    ("art/generated/v1.2/runtime/menu-main-camp-v2.png", "web/assets/ui/backdrops/menu-main-camp-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/deployment-command-bunker-v2.png", "web/assets/ui/backdrops/deployment-command-bunker-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/inventory-armory-v2.png", "web/assets/ui/backdrops/inventory-armory-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/shop-quartermaster-v2.png", "web/assets/ui/backdrops/shop-quartermaster-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/settings-radio-room-v2.png", "web/assets/ui/backdrops/settings-radio-room-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/credits-archive-v2.png", "web/assets/ui/backdrops/credits-archive-v2.webp", 84, False),
    ("art/generated/v1.2/runtime/ui-field-plate-v2.png", "web/assets/ui/shared/ui-field-plate-v2.webp", 92, True),
    ("art/generated/v1.1/runtime/deployment-convoy-vignette-v1.png", "web/assets/ui/deployment/deployment-convoy-vignette-v1.webp", 90, True),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def normalized_rms(original: Image.Image, optimized: Image.Image) -> float:
    rgb_original = original.convert("RGB")
    rgb_optimized = optimized.convert("RGB")
    diff = ImageChops.difference(rgb_original, rgb_optimized)
    channels = ImageStat.Stat(diff).rms
    return round(sum(channels) / len(channels) / 255, 5)


def main() -> None:
    if not features.check("webp"):
        raise RuntimeError("The active Pillow build does not support WebP")
    report = []
    for source_relative, target_relative, quality, preserve_alpha in ASSETS:
        source = ROOT / source_relative
        target = ROOT / target_relative
        if not source.is_file():
            raise FileNotFoundError(source)
        with Image.open(source) as image:
            image.load()
            original = image.copy()
            save_image = original.convert("RGBA" if preserve_alpha else "RGB")
            save_image.save(
                target,
                "WEBP",
                quality=quality,
                method=6,
                lossless=preserve_alpha,
                exact=preserve_alpha,
            )
            with Image.open(target) as optimized:
                optimized.load()
                if optimized.size != original.size:
                    raise RuntimeError(f"Dimension mismatch for {target}")
                if preserve_alpha and optimized.convert("RGBA").getchannel("A").getextrema() != original.convert("RGBA").getchannel("A").getextrema():
                    raise RuntimeError(f"Alpha range mismatch for {target}")
                rms = normalized_rms(original, optimized)
        source_bytes = source.stat().st_size
        target_bytes = target.stat().st_size
        report.append({
            "source": source_relative.replace("\\", "/"),
            "runtime": str(target.relative_to(ROOT)).replace("\\", "/"),
            "sourceBytes": source_bytes,
            "runtimeBytes": target_bytes,
            "savedPercent": round((1 - target_bytes / source_bytes) * 100, 2),
            "normalizedRms": rms,
            "sha256": sha256(target),
        })
    output = {
        "format": "webp",
        "sourceBytes": sum(item["sourceBytes"] for item in report),
        "runtimeBytes": sum(item["runtimeBytes"] for item in report),
        "savedPercent": round((1 - sum(item["runtimeBytes"] for item in report) / sum(item["sourceBytes"] for item in report)) * 100, 2),
        "assets": report,
    }
    report_path = ROOT / "docs" / "runtime-assets-report.json"
    report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
