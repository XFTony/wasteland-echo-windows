from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, features

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "generated" / "v1.5" / "source"
MENU = (
    ("menu-main-keyart-v3-source.png", "web/assets/ui/backdrops/menu-main-v3.webp"),
    ("deployment-command-garage-v3-source.png", "web/assets/ui/backdrops/deployment-command-garage-v3.webp"),
    ("inventory-armory-v3-source.png", "web/assets/ui/backdrops/inventory-armory-v3.webp"),
    ("shop-quartermaster-v3-source.png", "web/assets/ui/backdrops/shop-quartermaster-v3.webp"),
    ("settings-radio-room-v3-source.png", "web/assets/ui/backdrops/settings-radio-room-v3.webp"),
    ("credits-archive-v3-source.png", "web/assets/ui/backdrops/credits-archive-v3.webp"),
)
CUTOUTS = (
    ("cover-survivor-v3-source.png", "web/assets/ui/characters/cover-survivor-v3.webp"),
    ("ranger-armed-portrait-v1-source.png", "web/assets/actors/ranger-armed-portrait-v1.webp"),
    ("ranger-base-v1-source.png", "web/assets/actors/ranger-base-v1.webp"),
    ("ranger-mechanic-v1-source.png", "web/assets/actors/ranger-mechanic-v1.webp"),
    ("ranger-nightwatch-v2-source.png", "web/assets/actors/ranger-nightwatch-v2.webp"),
    ("drifter-v1-source.png", "web/assets/actors/drifter-v1.webp"),
    ("mechanic-base-v1-source.png", "web/assets/actors/mechanic-base-v1.webp"),
    ("mechanic-mechanic-v2-source.png", "web/assets/actors/mechanic-mechanic-v2.webp"),
    ("mechanic-nightwatch-v1-source.png", "web/assets/actors/mechanic-nightwatch-v1.webp"),
    ("bulwark-base-v1-source.png", "web/assets/actors/bulwark-base-v1.webp"),
    ("bulwark-mechanic-v1-source.png", "web/assets/actors/bulwark-mechanic-v1.webp"),
    ("bulwark-nightwatch-v2-source.png", "web/assets/actors/bulwark-nightwatch-v2.webp"),
    ("runner-v1-source.png", "web/assets/actors/runner-v1.webp"),
    ("spitter-v1-source.png", "web/assets/actors/spitter-v1.webp"),
    ("brute-v1-source.png", "web/assets/actors/brute-v1.webp"),
    ("screecher-v1-source.png", "web/assets/actors/screecher-v1.webp"),
    ("crawler-v1-source.png", "web/assets/actors/crawler-v1.webp"),
    ("warden-v1-source.png", "web/assets/actors/warden-v1.webp"),
    ("iron-colossus-v1-source.png", "web/assets/actors/iron-colossus-v1.webp"),
    ("scrap-pistol-v1-source.png", "web/assets/weapons/scrap-pistol-v1.webp"),
    ("swarm-smg-v1-source.png", "web/assets/weapons/swarm-smg-v1.webp"),
    ("breaker-shotgun-v1-source.png", "web/assets/weapons/breaker-shotgun-v1.webp"),
    ("needle-rifle-v1-source.png", "web/assets/weapons/needle-rifle-v1.webp"),
    ("rust-revolver-v1-source.png", "web/assets/weapons/rust-revolver-v1.webp"),
    ("ember-carbine-v1-source.png", "web/assets/weapons/ember-carbine-v1.webp"),
    ("coil-cannon-v1-source.png", "web/assets/weapons/coil-cannon-v1.webp"),
    ("wanderer-outfit-v1-source.png", "web/assets/outfits/wanderer-v1.webp"),
    ("mechanic-outfit-v1-source.png", "web/assets/outfits/mechanic-v1.webp"),
    ("nightwatch-outfit-v1-source.png", "web/assets/outfits/nightwatch-v1.webp"),
    ("field-vest-v1-source.png", "web/assets/equipment/field-vest-v1.webp"),
    ("iron-plate-v1-source.png", "web/assets/equipment/iron-plate-v1.webp"),
    ("runner-boots-v1-source.png", "web/assets/equipment/runner-boots-v1.webp"),
    ("magnet-helm-v1-source.png", "web/assets/equipment/magnet-helm-v1.webp"),
    ("ammo-rig-v1-source.png", "web/assets/equipment/ammo-rig-v1.webp"),
    ("signal-helm-v1-source.png", "web/assets/equipment/signal-helm-v1.webp"),
    ("servo-greaves-v1-source.png", "web/assets/equipment/servo-greaves-v1.webp"),
    ("stormstep-boots-v1-source.png", "web/assets/equipment/stormstep-boots-v1.webp"),
    ("echo-apothecary-roof-v1-source.png", "web/assets/world/props/echo-apothecary-roof-v1.webp"),
    ("echo-shop-roof-v1-source.png", "web/assets/world/props/echo-shop-roof-v1.webp"),
    ("echo-warehouse-roof-v1-source.png", "web/assets/world/props/echo-warehouse-roof-v1.webp"),
    ("echo-container-v1-source.png", "web/assets/world/props/echo-container-v1.webp"),
    ("echo-railcar-v1-source.png", "web/assets/world/props/echo-railcar-v1.webp"),
)
ALPHA_CROP_THRESHOLDS = {
    # ImageGen left near-invisible alpha outside the container; crop to its visible body.
    "echo-container-v1-source.png": 8,
    "echo-railcar-v1-source.png": 8,
}
TEXTURES = (
    ("echo-ground-v1-source.png", "web/assets/world/echo-ground-v1.webp"),
    ("freight-ground-v1-source.png", "web/assets/world/freight-ground-v1.webp"),
    ("red-basin-ground-v1-source.png", "web/assets/world/red-basin-ground-v1.webp"),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def optimize(source_name: str, target_relative: str, kind: str) -> dict:
    source = SOURCE / source_name
    target = ROOT / target_relative
    if not source.is_file():
        raise FileNotFoundError(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.load()
        source_size = image.size
        if kind == "cutout":
            rgba = image.convert("RGBA")
            alpha = rgba.getchannel("A")
            threshold = ALPHA_CROP_THRESHOLDS.get(source_name, 1)
            bounds = alpha.point(lambda value: 255 if value >= threshold else 0).getbbox()
            if bounds is None:
                raise RuntimeError(f"Transparent cutout is empty: {source}")
            pad = max(4, round(max(source_size) * 0.015))
            bounds = (
                max(0, bounds[0] - pad), max(0, bounds[1] - pad),
                min(source_size[0], bounds[2] + pad), min(source_size[1], bounds[3] + pad),
            )
            rendered = rgba.crop(bounds)
            max_edge = 1200 if "cover-" in source_name else 768 if "portrait-" in source_name else 320 if "/outfits/" in target_relative or "/equipment/" in target_relative else 512
            rendered.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            rendered.save(target, "WEBP", lossless=True, exact=True, method=6)
        else:
            bounds = (0, 0, *source_size)
            rendered = image.convert("RGB")
            rendered.save(target, "WEBP", quality=86 if kind == "menu" else 82, method=6)
        runtime_size = rendered.size
    with Image.open(target) as optimized:
        optimized.load()
        if optimized.size != runtime_size:
            raise RuntimeError(f"Dimension mismatch for {target}")
        if kind == "cutout" and optimized.convert("RGBA").getchannel("A").getextrema()[0] != 0:
            raise RuntimeError(f"Cutout lost transparent margins: {target}")
    return {
        "source": source.relative_to(ROOT).as_posix(),
        "runtime": target.relative_to(ROOT).as_posix(),
        "kind": kind,
        "sourceWidth": source_size[0],
        "sourceHeight": source_size[1],
        "crop": list(bounds),
        "width": runtime_size[0],
        "height": runtime_size[1],
        "sourceBytes": source.stat().st_size,
        "runtimeBytes": target.stat().st_size,
        "sha256": sha256(target),
    }


def main() -> None:
    if not features.check("webp"):
        raise RuntimeError("Pillow WebP support is required")
    entries = [optimize(source, target, "menu") for source, target in MENU]
    entries += [optimize(source, target, "cutout") for source, target in CUTOUTS]
    entries += [optimize(source, target, "texture") for source, target in TEXTURES]
    report = {
        "style": "stylized-painted-wasteland-v1.5",
        "assets": entries,
        "runtimeBytes": sum(entry["runtimeBytes"] for entry in entries),
    }
    report_path = ROOT / "docs" / "illustrated-assets-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Optimized {len(entries)} illustrated assets ({report['runtimeBytes']} bytes)")


if __name__ == "__main__":
    main()
