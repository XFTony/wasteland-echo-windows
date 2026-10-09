"""Verify preserved keys, provenance, wrap drawings and actual raster exports.

Pixel-change diagnostics are not a visual continuity score or anatomy approval.
"""
from pathlib import Path
import hashlib, json, statistics
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def read_frames(data):
    atlas = Image.open(ROOT / data['atlasPath']).convert('RGBA')
    result = []
    for row in data['frames']:
        x, y, w, h = row['rect']
        result.append(atlas.crop((x, y, x + w, y + h)))
    return result


def change(a, b):
    pixels = [(p, q) for p, q in zip(a.getdata(), b.getdata()) if p[3] or q[3]]
    return sum(p != q for p, q in pixels) / len(pixels)


def main():
    data = json.loads((ROOT / 'art/animation/ranger/pixel-source/run-candidate-v4/metadata.json').read_text())
    old = json.loads((ROOT / 'art/animation/ranger/pixel-source/run-candidate-v2/metadata.json').read_text())
    frames, keys = read_frames(data), read_frames(old)
    assert len(frames) == 24
    assert sum(row['durationMs'] for row in data['frames']) == 400
    assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}) == 24
    for path, expected in data['sourceHashes'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest().upper() == expected
    for key in range(8):
        index = key * 3
        assert frames[index].tobytes() == keys[key].tobytes()
        assert data['frames'][index]['kind'] == 'original-key'
        assert data['frames'][index]['originalKey'] == key + 1
        assert sum(r['durationMs'] for r in data['frames'][index:index + 3]) == 50
        for offset in (1, 2):
            row = data['frames'][index + offset]
            assert row['kind'] == 'drawn-inbetween'
            assert row['fromKey'] == key + 1 and row['toKey'] == (key + 1) % 8 + 1
            assert abs(row['transitionFraction'] - offset / 3) < 1e-10
            assert (ROOT / row['sourcePath']).is_file()
    assert frames[-1].tobytes() != frames[0].tobytes()
    assert data['frames'][-2]['fromKey'] == data['frames'][-1]['fromKey'] == 8
    assert data['frames'][-2]['toKey'] == data['frames'][-1]['toKey'] == 1
    assert all(row['root'] == [64, 110] for row in data['frames'])
    changes = [change(a, b) for a, b in zip(frames, frames[1:] + frames[:1])]
    # A seam diagnostic, not a claim that independently drawn textures are identical.
    seam_head_delta = abs(data['frames'][-1]['opaqueBox'][1] - data['frames'][0]['opaqueBox'][1])
    assert seam_head_delta <= 1
    assert changes[-1] <= max(changes[:-1])
    art = Image.open(ROOT / data['artAtlasPath']).convert('RGBA')
    assert art.size == (12288, 512)
    assert hashlib.sha256((ROOT / data['artAtlasPath']).read_bytes()).hexdigest().upper() == data['artAtlasSha256']
    if data.get('videoPath'):
        video = ROOT / data['videoPath']
        assert video.stat().st_size > 1000
        assert hashlib.sha256(video.read_bytes()).hexdigest().upper() == data['videoSha256']
    result = {'date': '2026-10-09', 'originalKeysPixelsExact': 8, 'newFullCharacterDrawings': 16,
              'uniqueNativeFrames': 24, 'nativeAndWebpPeriodMs': 400, 'compatibleGifPeriodMs': 480,
              'originalKeyTimingPreserved': True, 'provenanceHashesValid': True,
              'lastToFirstDrawnInbetweens': 2, 'duplicateEndpointPlayed': False,
              'seamHeadDeltaNativePixels': seam_head_delta,
              'seamChangedForegroundFraction': changes[-1],
              'medianInteriorChangedForegroundFraction': statistics.median(changes[:-1]),
              'maxInteriorChangedForegroundFraction': max(changes[:-1]),
              'diagnosticLimit': 'Pixel change and registration do not prove natural gait or texture consistency',
              'visualApproved': False, 'runtimeIntegrated': False}
    (ROOT / 'docs/qa/ranger-drawn-inbetweens-2026-10-09.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
