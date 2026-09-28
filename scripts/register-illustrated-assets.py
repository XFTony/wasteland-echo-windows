from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs" / "illustrated-assets-report.json"
MANIFEST = ROOT / "art" / "manifest.json"
LEDGER = ROOT / "docs" / "assets-ledger.csv"

IDS = {
    "menu-main-v3.webp": "menu.backdrop.main.v3",
    "deployment-command-garage-v3.webp": "menu.backdrop.deployment.v3",
    "inventory-armory-v3.webp": "menu.backdrop.inventory.v3",
    "shop-quartermaster-v3.webp": "menu.backdrop.shop.v3",
    "settings-radio-room-v3.webp": "menu.backdrop.settings.v3",
    "credits-archive-v3.webp": "menu.backdrop.credits.v3",
    "cover-survivor-v3.webp": "cover.survivor.v3",
    "ranger-armed-portrait-v1.webp": "actor.ranger.portrait.v1",
    "ranger-base-v1.webp": "actor.ranger.base.v1",
    "ranger-wanderer-upper-v1.webp": "actor.ranger.wanderer.upper.v1",
    "ranger-wanderer-walk-v1.webp": "actor.ranger.wanderer.walk.v1",
    "ranger-mechanic-v1.webp": "actor.ranger.mechanic.v1",
    "ranger-nightwatch-v2.webp": "actor.ranger.nightwatch.v2",
    "drifter-v1.webp": "actor.drifter.v1",
    "mechanic-base-v1.webp": "actor.mechanic.base.v1",
    "mechanic-mechanic-v2.webp": "actor.mechanic.mechanic.v2",
    "mechanic-nightwatch-v1.webp": "actor.mechanic.nightwatch.v1",
    "bulwark-base-v1.webp": "actor.bulwark.base.v1",
    "bulwark-mechanic-v1.webp": "actor.bulwark.mechanic.v1",
    "bulwark-nightwatch-v2.webp": "actor.bulwark.nightwatch.v2",
    "runner-v1.webp": "actor.runner.v1",
    "spitter-v1.webp": "actor.spitter.v1",
    "brute-v1.webp": "actor.brute.v1",
    "screecher-v1.webp": "actor.screecher.v1",
    "crawler-v1.webp": "actor.crawler.v1",
    "warden-v1.webp": "actor.warden.v1",
    "iron-colossus-v1.webp": "actor.iron-colossus.v1",
    "scrap-pistol-v1.webp": "weapon.scrap-pistol.v1",
    "swarm-smg-v1.webp": "weapon.swarm-smg.v1",
    "breaker-shotgun-v1.webp": "weapon.breaker-shotgun.v1",
    "needle-rifle-v1.webp": "weapon.needle-rifle.v1",
    "rust-revolver-v1.webp": "weapon.rust-revolver.v1",
    "ember-carbine-v1.webp": "weapon.ember-carbine.v1",
    "coil-cannon-v1.webp": "weapon.coil-cannon.v1",
    "wanderer-v1.webp": "outfit.wanderer.v1",
    "mechanic-v1.webp": "outfit.mechanic.v1",
    "nightwatch-v1.webp": "outfit.nightwatch.v1",
    "field-vest-v1.webp": "equipment.field-vest.v1",
    "iron-plate-v1.webp": "equipment.iron-plate.v1",
    "runner-boots-v1.webp": "equipment.runner-boots.v1",
    "magnet-helm-v1.webp": "equipment.magnet-helm.v1",
    "ammo-rig-v1.webp": "equipment.ammo-rig.v1",
    "signal-helm-v1.webp": "equipment.signal-helm.v1",
    "servo-greaves-v1.webp": "equipment.servo-greaves.v1",
    "stormstep-boots-v1.webp": "equipment.stormstep-boots.v1",
    "echo-apothecary-roof-v1.webp": "world.prop.echo.apothecary-roof.v1",
    "echo-shop-roof-v1.webp": "world.prop.echo.shop-roof.v1",
    "echo-warehouse-roof-v1.webp": "world.prop.echo.warehouse-roof.v1",
    "echo-container-v1.webp": "world.prop.echo.container.v1",
    "echo-railcar-v1.webp": "world.prop.echo.railcar.v1",
    "echo-ground-v1.webp": "world.ground.echo.v1",
    "freight-ground-v1.webp": "world.ground.freight.v1",
    "red-basin-ground-v1.webp": "world.ground.red-basin.v1",
}
RETIRED = {
    "cover.keyart.v1",
    "menu.backdrop.main.v2",
    "menu.backdrop.deployment.v2",
    "menu.backdrop.inventory.v2",
    "menu.backdrop.shop.v2",
    "menu.backdrop.settings.v2",
    "menu.backdrop.credits.v2",
}


def main() -> None:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    known = {entry["id"]: entry for entry in manifest["assets"]}
    for old_id in RETIRED:
        if old_id not in known:
            raise RuntimeError(f"Missing archived asset: {old_id}")
        known[old_id]["status"] = "inactive"
    if len(report["assets"]) != len(IDS):
        raise RuntimeError("Illustrated report and stable ID map differ")
    for item in report["assets"]:
        name = Path(item["runtime"]).name
        asset_id = IDS.get(name)
        if not asset_id:
            raise RuntimeError(f"Unknown illustrated asset: {name}")
        record = {
            "id": asset_id,
            "version": "1.5",
            "status": "active",
            "runtimePath": item["runtime"],
            "archivePath": item["source"],
            "width": item["width"],
            "height": item["height"],
            "pixelFormat": "RGBA" if item["kind"] == "cutout" else "RGB",
            "bytes": item["runtimeBytes"],
            "sha256": item["sha256"],
            "generator": "OpenAI ImageGen",
            "notes": "Stylized painted wasteland art; source and runtime crop recorded in illustrated-assets-report.json. Commercial terms review pending.",
        }
        if asset_id == "actor.ranger.nightwatch.v2":
            record["sourcePaths"] = ["art/generated/v1.5/source/ranger-nightwatch-v1-source.png"]
            record["notes"] += " First source variant archived but rejected because the 76px silhouette was too dark."
        if asset_id == "actor.mechanic.mechanic.v2":
            record["sourcePaths"] = ["art/generated/v1.5/source/mechanic-mechanic-v1-source.png"]
            record["notes"] += " First source variant archived but rejected because it resembled the default olive jacket at 76px."
        if asset_id == "actor.bulwark.nightwatch.v2":
            record["sourcePaths"] = ["art/generated/v1.5/source/bulwark-nightwatch-v1-source.png"]
            record["notes"] += " First source variant archived but rejected because its checkerboard background had no alpha channel."
        if asset_id in {"actor.ranger.wanderer.upper.v1", "actor.ranger.wanderer.walk.v1"}:
            record["notes"] += " Painted three-part motion kit baked into transparent runtime layers by build_ranger_motion_assets.py."
        if asset_id in known:
            known[asset_id].update(record)
        else:
            manifest["assets"].append(record)
            known[asset_id] = record
    manifest["updatedAt"] = "2026-09-27"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with LEDGER.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    existing = {row["asset_id"] for row in rows}
    for item in report["assets"]:
        asset_id = IDS[Path(item["runtime"]).name]
        if asset_id in existing:
            continue
        rows.append({
            "asset_id": asset_id,
            "asset_type": "art",
            "local_path": item["source"],
            "source_url": "",
            "creator": "OpenAI ImageGen",
            "license": "Generated project asset; verify applicable service terms before commercial release",
            "download_date": "2026-09-27",
            "modified": "true" if item["kind"] == "cutout" else "false",
            "attribution_text": "Generated for Wasteland Echo; source and runtime transformation recorded",
            "commercial_ok": "review-required",
            "review_status": "provisional",
        })
    with LEDGER.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Registered {len(IDS)} illustrated assets and retired {len(RETIRED)} legacy visuals")


if __name__ == "__main__":
    main()
