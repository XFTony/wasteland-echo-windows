"""Original short flame, electric, melee and landing samples; no external recordings."""
from pathlib import Path
import hashlib
import json
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[2]
DESIGN = json.loads((ROOT / "art/combat/fieldcraft-v2/design.json").read_text(encoding="utf-8"))
records = []
for index, audio in enumerate(DESIGN["audio"]):
    rate = 22050
    count = round(rate * audio["seconds"])
    rng = random.Random(9201 + index)
    filtered = 0.0
    values = []
    for sample in range(count):
        t = sample / rate
        p = sample / count
        noise = rng.uniform(-1, 1)
        filtered += (noise - filtered) * (0.12 if index == 4 else 0.35)
        envelope = min(1, t / 0.002, (audio["seconds"] - t) / 0.018)
        if audio["id"] == "ember_sprayer":
            value = (filtered * 1.2 + noise * 0.35) * math.sin(math.pi * p) ** 0.4
            value += noise * max(0, math.sin(t * 427)) ** 8 * 0.12
        elif audio["id"] == "arc_repeater":
            value = noise * math.exp(-t * 28) * 0.6
            value += math.sin(2 * math.pi * (700 * t - 600 * t * t)) * math.exp(-t * 24) * 0.3
            value += filtered * math.exp(-((t - 0.045) / 0.01) ** 2) * 0.5
        elif audio["id"] == "enemy_fall":
            value = filtered * math.exp(-t * 18) * 1.8 + math.sin(t * 2 * math.pi * 74) * math.exp(-t * 25) * 0.2
        else:
            value = (filtered * 1.1 + noise * 0.15) * math.sin(math.pi * p) ** 2
            value += filtered * math.exp(-((t - 0.09) / 0.017) ** 2) * 0.4
        values.append(value * envelope)
    peak = max(abs(v) for v in values) or 1
    gain = 0.5 if audio["id"] == "enemy_fall" else 0.60
    pcm = b"".join(struct.pack("<h", round(v / peak * gain * 32767)) for v in values)
    destination = ROOT / "godot" / audio["src"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as writer:
        writer.setparams((1, 2, rate, count, "NONE", "not compressed"))
        writer.writeframes(pcm)
    raw = destination.read_bytes()
    source = ROOT / "art/combat/fieldcraft-v2/audio" / destination.name
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(raw)
    records.append({"id": audio["id"], "runtime": destination.relative_to(ROOT).as_posix(),
                    "sourcePaths": [source.relative_to(ROOT).as_posix(), "scripts/audio/generate-fieldcraft.py"],
                    "seconds": audio["seconds"], "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
(ROOT / "art/combat/fieldcraft-v2/audio-manifest.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"audio": len(records), "bytes": sum(r["bytes"] for r in records)}))
