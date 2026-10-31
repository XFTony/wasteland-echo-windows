"""Actual source/export checks for the standalone compact-character pilot."""
from pathlib import Path
import hashlib, importlib.util, json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/characters/ranger/compact-motion-v1'
OUT = ROOT / 'output/compact-motion-2026-10-23'
spec = importlib.util.spec_from_file_location('pixel_source', Path(__file__).with_name('pixel-source-tools.py'))
ps = importlib.util.module_from_spec(spec); spec.loader.exec_module(ps)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = json.loads((ART / 'metadata.json').read_text())
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest().upper()
    for name, digest in meta['sourceHashes'].items():
        assert sha(ART / 'source' / name) == digest
    for name, digest in meta['assetHashes'].items():
        assert sha(ART / name) == digest
    palette = {tuple(bytes.fromhex(color[1:])) for color in meta['palette']}
    atlas = Image.open(ART / meta['bodyAtlas']).convert('RGBA')
    gun = Image.open(ART / meta['weaponImage']).convert('RGBA')
    assert atlas.size == (576, 64) and gun.size == (36, 20)
    for image in (atlas, gun):
        assert set(image.getchannel('A').getdata()) <= {0, 255}
        assert {pixel[:3] for pixel in image.getdata() if pixel[3]} <= palette
    frames = [atlas.crop((i * 64, 0, i * 64 + 64, 64)) for i in range(9)]
    assert len({hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames[1:]}) == 8
    assert all(frame.crop((0, 0, 64, 42)).tobytes() == frames[0].crop((0, 0, 64, 42)).tobytes() for frame in frames)
    assert any(frame.crop((0, 42, 64, 64)).tobytes() != frames[1].crop((0, 42, 64, 64)).tobytes() for frame in frames[2:])
    export = OUT / 'body-editor-export.png'; info = OUT / 'body-editor-export.json'
    ps.run_editor([ART / 'body-frames.aseprite', '--sheet', export, '--sheet-type', 'horizontal',
                   '--data', info, '--format', 'json-array', '--list-layers'])
    actual = Image.open(export).convert('RGBA')
    assert actual.tobytes() == atlas.tobytes()
    rows = json.loads(info.read_text())['frames']
    assert len(rows) == 9 and [row['duration'] for row in rows] == [100] + [55] * 8
    ps.run_editor([ART / 'sidearm-grip.aseprite', '--sheet', OUT / 'gun-editor-export.png'])
    assert Image.open(OUT / 'gun-editor-export.png').convert('RGBA').tobytes() == gun.tobytes()
    webp = Image.open(ART / 'body-walk.webp')
    assert webp.n_frames == 8
    for i in range(8):
        webp.seek(i); webp.load()
        assert webp.info['duration'] == 55
        assert webp.convert('RGBA').tobytes() == frames[i + 1].tobytes()
    proof = {'date': '2026-10-23', 'bodyFrames': 9, 'idleFrames': 1, 'distinctWalkFrames': 8,
             'bodyGrid': [64, 64], 'weaponGrid': [36, 20], 'paletteColors': 32,
             'binaryAlpha': True, 'sourceHashesValid': True, 'stableUpperBody': True,
             'drawnLowerBodyChanges': True, 'editorRoundtripExact': True,
             'bodyWebpFrames': 8, 'bodyWebpCycleMs': 440,
             'runtimeImageBytes': meta['assetBytes'], 'decodedRGBABytes': meta['decodedRGBABytes'],
             'visualApproved': False, 'runtimeIntegrated': False}
    (ROOT / 'docs/qa/compact-ranger-assets-2026-10-23.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    print(json.dumps(proof))


if __name__ == '__main__':
    main()
