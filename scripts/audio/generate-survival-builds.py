"""Project-original mechanical, frost and melee sounds, without external recordings."""
from pathlib import Path
import hashlib
import json
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[2]
DESIGN = json.loads((ROOT / "art/combat/survival-builds-v1/design.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "godot/assets/audio/survival-v2"
SOURCE = ROOT / "art/combat/survival-builds-v1/audio"
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
records = []
for index, audio in enumerate(DESIGN["audio"]):
    rate = 22050
    count = round(rate * audio["seconds"])
    rng = random.Random(7711 + index)
    filtered = 0.0
    values = []
    for sample in range(count):
        time = sample / rate
        phase = sample / count
        noise = rng.uniform(-1, 1)
        filtered += (noise - filtered) * (0.18 if index in (0, 3) else 0.55)
        high = noise - filtered
        if audio["id"] == "ratchet_crossbow":
            value = (filtered * 1.7 + high * 0.20) * math.exp(-time * 32)
            value += math.sin(time * 2 * math.pi * 148) * math.exp(-time * 45) * 0.13
            value += high * math.exp(-((time - 0.055) / 0.006) ** 2) * 0.22
        elif audio["id"] == "frost_projector":
            value = (high * 0.65 + filtered * 0.30) * math.sin(math.pi * phase) ** 0.7 * math.exp(-time * 9)
        else:
            value = (filtered * (1.35 if index == 3 else 0.8) + high * 0.23) * math.sin(math.pi * phase) ** 2
            value *= math.exp(-time * (5 if index == 3 else 8))
        value *= min(1, time / 0.002, (audio["seconds"] - time) / 0.015)
        values.append(value)
    peak = max(abs(value) for value in values) or 1
    pcm = b"".join(struct.pack("<h", round(value / peak * 0.65 * 32767)) for value in values)
    destination = OUTPUT / (audio["id"] + ".wav")
    with wave.open(str(destination), "wb") as writer:
        writer.setparams((1, 2, rate, count, "NONE", "not compressed"))
        writer.writeframes(pcm)
    raw = destination.read_bytes()
    source = SOURCE / destination.name
    source.write_bytes(raw)
    records.append({"id": audio["id"], "runtime": destination.relative_to(ROOT).as_posix(),
                    "sourcePaths": [source.relative_to(ROOT).as_posix(), "scripts/audio/generate-survival-builds.py"],
                    "role": audio["role"], "seconds": audio["seconds"], "bytes": len(raw),
                    "sha256": hashlib.sha256(raw).hexdigest()})
manifest = {"version": "survival-builds-v1", "created": "2026-10-30",
            "generator": "Project original offline audio synthesis and native pixel shape descriptions",
            "usageTerms": "Project original; no third-party game assets or recordings reused",
            "design": "art/combat/survival-builds-v1/design.json", "assets": records,
            "proceduralWeapons": [weapon["id"] for weapon in DESIGN["weapons"]]}
(ROOT / "art/combat/survival-builds-v1/manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"audio": len(records), "bytes": sum(record["bytes"] for record in records)}))
