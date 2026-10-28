"""Import generated enemy pose sheets, then export editable native sources.

Only --import-generated creates native sources. Normal export always reads the
edited .aseprite files; it never re-generates or silently replaces their art.
"""
from collections import deque
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import statistics
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/enemies/compact-v1'
RUNTIME = ROOT / 'web/assets/actors/compact-v1'
SPEC = {
    'drifter': ('游荡者', 38, 64, 56, 60, '蓝灰工作服、伸手蹒跚'),
    'runner': ('突袭者', 37, 64, 56, 76, '暗红背心、前倾疾跑'),
    'spitter': ('腐蚀者', 40, 64, 56, 58, '酸囊与背罐'),
    'brute': ('重甲者', 50, 80, 70, 72, '宽肩铁甲、重拳'),
    'screecher': ('警报者', 42, 64, 56, 62, '紫色披挂、扩音口器'),
    'crawler': ('爬行群', 24, 64, 56, 46, '低伏爬行、交替前臂'),
    'warden': ('荒原看守', 58, 80, 70, 88, '暗红长衣、信号脉冲装置'),
    'iron_colossus': ('铁幕巨像', 72, 96, 84, 112, '箱形重装、炉芯与双排气管')
}
HERO_PALETTE = json.loads((ROOT / 'art/characters/ranger/compact-motion-v1/metadata.json').read_text('utf-8'))['palette']
PALETTE = list(dict.fromkeys(HERO_PALETTE + [
    '#6b7254', '#8d9670', '#b7c28d', '#dde4b0', '#eff6d0',
    '#26363d', '#3b535b', '#587780', '#7d9996',
    '#352b3e', '#5a4264', '#80608e', '#ae86af',
    '#526125', '#7f9138', '#acc854', '#d9ed7b',
    '#521c24', '#80303a', '#b15152',
    '#303942', '#4a5661', '#72818a', '#a5b0ae',
    '#6e6753', '#969376', '#b9b48c', '#d9d1a5', '#f3e6bf'
]))
COLORS = [tuple(bytes.fromhex(color[1:])) for color in PALETTE]
spec = importlib.util.spec_from_file_location('native', Path(__file__).with_name('pixel-source-tools.py'))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def main_component(cell):
    """Exclude faint generated halo and adjacent-cell fragments, not body colors."""
    width, height = cell.size
    raw = bytearray(1 if a >= 200 else 0 for a in cell.getchannel('A').getdata())
    best = []
    for start in range(len(raw)):
        if not raw[start]:
            continue
        raw[start] = 0
        queue, component = deque([start]), []
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    adjacent = ny * width + nx
                    if raw[adjacent]:
                        raw[adjacent] = 0
                        queue.append(adjacent)
        if len(component) > len(best):
            best = component
    if len(best) < 1000:
        raise ValueError('Missing full enemy figure in source cell')
    mask = Image.new('L', cell.size, 0)
    values = bytearray(width * height)
    for index in best:
        values[index] = 255
    mask.frombytes(bytes(values))
    result = cell.copy()
    result.putalpha(mask)
    return result


def import_poses(enemy_id, height, canvas, ground):
    source = Image.open(ART / 'source' / (enemy_id + '-walk.png')).convert('RGBA')
    if source.width % 4 or source.height % 2:
        raise ValueError('Expected exact 4x2 source layout')
    cell_w, cell_h = source.width // 4, source.height // 2
    cells = [main_component(source.crop((i % 4 * cell_w, i // 4 * cell_h,
                                        (i % 4 + 1) * cell_w, (i // 4 + 1) * cell_h))) for i in range(8)]
    boxes = [cell.getchannel('A').getbbox() for cell in cells]
    scale = height / statistics.median(box[3] - box[1] for box in boxes)
    row_baselines = [statistics.median(box[3] for box in boxes[row * 4:row * 4 + 4]) for row in range(2)]
    # Same imported scale and row baseline; preserve authored stride/airborne changes.
    centers = [statistics.median((box[0] + box[2]) / 2 for box in boxes[row * 4:row * 4 + 4]) for row in range(2)]
    frames, color_cache = [], {}
    for index, cell in enumerate(cells):
        result = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
        center, baseline = centers[index // 4], row_baselines[index // 4]
        for y in range(canvas):
            sy = round((y - ground) / scale + baseline)
            if not 0 <= sy < cell_h:
                continue
            for x in range(canvas):
                sx = round((x - canvas / 2) / scale + center)
                if not 0 <= sx < cell_w:
                    continue
                rgba = cell.getpixel((sx, sy))
                if not rgba[3]:
                    continue
                rgb = rgba[:3]
                if rgb not in color_cache:
                    color_cache[rgb] = min(COLORS, key=lambda c: sum((a - b) ** 2 for a, b in zip(rgb, c)))
                result.putpixel((x, y), (*color_cache[rgb], 255))
        frames.append(result)
    return frames, {'scale': scale, 'rowBaselines': row_baselines, 'rowCenters': centers,
                    'sourceBoxes': boxes, 'sourceSize': list(source.size)}


def export_all(import_generated=False):
    ART.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    temp = ROOT / 'output/compact-enemies-2026-10-28/export'
    temp.mkdir(parents=True, exist_ok=True)
    if import_generated and any((ART / (key + '.aseprite')).exists() for key in SPEC):
        raise FileExistsError('Native enemy sources already exist. Export edited sources without --import-generated.')
    previous_path = ART / 'metadata.json'
    previous = json.loads(previous_path.read_text('utf-8')) if previous_path.exists() else {}
    records = {}
    for key, (name, height, canvas, ground, stride, silhouette) in SPEC.items():
        source = ART / (key + '.aseprite')
        registration = previous.get('enemies', {}).get(key, {}).get('registration')
        if import_generated:
            frames, registration = import_poses(key, height, canvas, ground)
            native.write_source(source, frames, [90] * 8, key + '-authored-poses')
        if not source.exists():
            raise FileNotFoundError(source)
        exported, data = temp / (key + '.png'), temp / (key + '.json')
        native.run_editor([source, '--sheet', exported, '--sheet-type', 'horizontal', '--data', data, '--format', 'json-array'])
        descriptor = json.loads(data.read_text('utf-8'))
        if len(descriptor['frames']) != 8:
            raise ValueError(key + ': expected eight authored walk frames')
        sheet = Image.open(exported).convert('RGBA')
        frames = []
        for frame in descriptor['frames']:
            rect = frame['frame']
            image = sheet.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
            if image.size != (canvas, canvas) or not image.getchannel('A').getbbox():
                raise ValueError(key + ': wrong native canvas or empty frame')
            frames.append(image)
        if len({image.tobytes() for image in frames}) < 8:
            raise ValueError(key + ': repeated rather than drawn walk poses')
        atlas = Image.new('RGBA', (canvas * 8, canvas), (0, 0, 0, 0))
        for i, image in enumerate(frames):
            atlas.paste(image, (i * canvas, 0))
        png, webp = ART / (key + '-atlas.png'), RUNTIME / (key + '-atlas.webp')
        atlas.save(png, optimize=True)
        atlas.save(webp, lossless=True, exact=True, method=6)
        if Image.open(webp).convert('RGBA').tobytes() != atlas.tobytes():
            raise ValueError('Runtime WebP changed native pixels: ' + key)
        records[key] = {
            'name': name, 'assetId': 'actor.compact.' + key + '.v1', 'canvas': canvas,
            'columns': 8, 'root': [canvas // 2, ground], 'idleFrame': 1,
            'walkFrames': list(range(8)), 'stride': stride, 'pixelScale': 1.5,
            'referenceHeight': height, 'silhouette': silhouette, 'source': source.relative_to(ROOT).as_posix(),
            'atlas': png.relative_to(ROOT).as_posix(), 'runtime': webp.relative_to(ROOT).as_posix(),
            'sourceDrawing': 'art/enemies/compact-v1/source/' + key + '-walk.png',
            'sourceSha256': sha(source), 'atlasSha256': sha(png), 'runtimeSha256': sha(webp),
            'runtimeBytes': webp.stat().st_size, 'decodedRGBABytes': atlas.width * atlas.height * 4,
            'distinctFrames': 8, 'registration': registration,
            'frameBounds': [list(image.getchannel('A').getbbox()) for image in frames]
        }
    metadata = {'date': '2026-10-28', 'id': 'enemies.compact.v1', 'palette': PALETTE,
                'sourceMethod': 'Eight separately generated full-body poses per enemy, imported to native grid; no runtime joint warping.',
                'runtimeIntegrated': False, 'userVisualApproval': 'pending', 'enemies': records,
                'runtimeBytes': sum(r['runtimeBytes'] for r in records.values()),
                'decodedRGBABytes': sum(r['decodedRGBABytes'] for r in records.values())}
    previous_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in metadata.items() if key in ('id', 'runtimeBytes', 'decodedRGBABytes')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--import-generated', action='store_true')
    export_all(parser.parse_args().import_generated)
