"""Import authored compact sprites to a small fixed grid; no joint pose synthesis."""
from pathlib import Path
import hashlib, importlib.util, json, statistics
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/characters/ranger/compact-motion-v1'
SOURCE = OUT / 'source'
spec = importlib.util.spec_from_file_location('pixel_source', Path(__file__).with_name('pixel-source-tools.py'))
pixel_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixel_source)
PALETTE = ['#161116','#261d20','#392c28','#513b2c','#715039','#946b47',
           '#b58a57','#d5a86b','#ebc687','#ffe0a0','#5c210f','#873014',
           '#b13a16','#df551b','#f77720','#ffab43','#ffcf67','#232228',
           '#36353f','#514d54','#6b6568','#8e8584','#b0a29a','#dacbbc',
           '#f5e9ce','#633e2a','#8e5935','#b87841','#dc9c57','#0d0b0d',
           '#a84522','#ede1cd']
COLORS = [tuple(bytes.fromhex(value[1:])) for value in PALETTE]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def opaque_box(image):
    box = image.getchannel('A').point(lambda a: 255 if a >= 200 else 0).getbbox()
    if not box:
        raise ValueError('Missing sprite')
    return box


def hood_center(image, box, scale):
    positions = []
    for y in range(box[1], min(box[3], box[1] + round(12 / scale))):
        for x in range(box[0], box[2]):
            r, g, b, a = image.getpixel((x, y))
            if a >= 200 and r > 90 and .5 * r < g < .95 * r and .2 * r < b < .85 * r:
                positions.append(x)
    if not positions:
        raise ValueError('Missing hood registration')
    return statistics.mean(positions)


def raster(image, width, height, source_x, source_y, scale, target_x, target_y, cache):
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    for y in range(height):
        sy = round((y - target_y) / scale + source_y)
        if not 0 <= sy < image.height:
            continue
        for x in range(width):
            sx = round((x - target_x) / scale + source_x)
            if not 0 <= sx < image.width:
                continue
            color = image.getpixel((sx, sy))
            if color[3] < 200:
                continue
            rgb = color[:3]
            if rgb not in cache:
                cache[rgb] = min(COLORS, key=lambda c: sum((a - b) ** 2 for a, b in zip(rgb, c)))
            result.putpixel((x, y), (*cache[rgb], 255))
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    idle_source = Image.open(SOURCE / 'body-idle-drawing.png').convert('RGBA')
    walk_source = Image.open(SOURCE / 'body-walk-drawings.png').convert('RGBA')
    gun_source = Image.open(SOURCE / 'sidearm-grip-drawing.png').convert('RGBA')
    if walk_source.size != (1536, 1024):
        raise ValueError('Expected 4x2 drawing layout')
    cache = {}
    idle_box = opaque_box(idle_source)
    idle_scale = 44 / (idle_box[3] - idle_box[1])
    idle_hood = hood_center(idle_source, idle_box, idle_scale)
    idle = raster(idle_source, 64, 64, idle_hood, idle_box[1], idle_scale, 34, 12, cache)
    cells = [walk_source.crop((i % 4 * 384, i // 4 * 512, (i % 4 + 1) * 384, (i // 4 + 1) * 512)) for i in range(8)]
    boxes = [opaque_box(cell) for cell in cells]
    scale = 44 / statistics.median(box[3] - box[1] for box in boxes)
    drawings = []
    registration = []
    for i, (cell, box) in enumerate(zip(cells, boxes)):
        center = hood_center(cell, box, scale)
        frame = raster(cell, 64, 64, center, box[1], scale, 34, 12, cache)
        # One stable head/chest preserves face identity. Below the waist all pose
        # pixels come from the distinct drawn boot / coat frames, not an IK rig.
        frame.paste(idle.crop((0, 0, 64, 42)), (0, 0))
        drawings.append(frame)
        registration.append({'sourceCell': i, 'sourceOpaqueBox': list(box), 'sourceHoodCenter': center})
    # Group the observed landing / support / recovery / reaching drawings into
    # one readable chibi cycle. These are source selections, not invented frames.
    order = [0, 4, 2, 6, 1, 5, 3, 7]
    frames = [idle] + [drawings[i] for i in order]
    unique_walk = len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames[1:]})
    if unique_walk < 6:
        raise ValueError(f'Too few distinct short-step drawings: {unique_walk}')
    for frame in frames:
        box = opaque_box(frame)
        if box[0] <= 1 or box[2] >= 63 or box[1] <= 1 or box[3] >= 62:
            raise ValueError(f'Clipped native sprite: {box}')
    atlas = Image.new('RGBA', (64 * len(frames), 64), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        atlas.alpha_composite(frame, (i * 64, 0))
    atlas_path = OUT / 'body-atlas.png'
    atlas.save(atlas_path)
    native = OUT / 'body-frames.aseprite'
    # Separate authoring layers remain full-sized cels for editing.
    upper, lower = [], []
    for frame in frames:
        a = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); a.paste(frame.crop((0, 0, 64, 42)), (0, 0))
        b = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); b.paste(frame.crop((0, 42, 64, 64)), (0, 42))
        upper.append(a); lower.append(b)
    pixel_source.write_layered_source(native, [{'name': 'drawn-lower-body', 'frames': lower},
                                             {'name': 'stable-head-and-chest', 'frames': upper}], [100] + [55] * 8)
    gun_box = opaque_box(gun_source)
    gun_scale = min(34 / (gun_box[2] - gun_box[0]), 17 / (gun_box[3] - gun_box[1]))
    gun = raster(gun_source, 36, 20, gun_box[0], gun_box[1], gun_scale, 1, 2, cache)
    gun_path = OUT / 'sidearm-grip.png'; gun.save(gun_path)
    pixel_source.write_source(OUT / 'sidearm-grip.aseprite', [gun], [100], 'pistol-and-both-hands')
    durations = [55] * 8
    frames[1].save(OUT / 'body-walk.webp', save_all=True, append_images=frames[2:], duration=durations,
                   loop=0, lossless=True, background=(0, 0, 0, 0))
    board = Image.new('RGBA', (640, 240), (25, 31, 34, 255)); pen = ImageDraw.Draw(board)
    for i, frame in enumerate(frames):
        x, y = i % 5 * 128, i // 5 * 120
        board.alpha_composite(frame.resize((128, 128), Image.Resampling.NEAREST), (x, y - 12))
        pen.text((x + 6, y + 2), 'IDLE' if i == 0 else f'STEP {i}', fill=(235, 197, 130, 255))
    board.save(OUT / 'body-contact-sheet.png')
    rows = [{'index': i, 'rect': [i * 64, 0, 64, 64], 'root': [32, 56],
             'kind': 'idle' if i == 0 else 'walk',
             'sourceCell': None if i == 0 else order[i - 1],
             'opaqueBox': list(opaque_box(frame))} for i, frame in enumerate(frames)]
    meta = {'date': '2026-10-23', 'id': 'study.ranger.compact-motion.v1',
            'bodyAtlas': 'body-atlas.png', 'weaponImage': 'sidearm-grip.png',
            'body': {'width': 64, 'height': 64, 'root': [32, 56], 'columns': 9, 'idleFrame': 0, 'walkFrames': list(range(1, 9))},
            'weapon': {'width': 36, 'height': 20, 'pivot': [9, 6], 'muzzle': [33, 6]},
            'frames': rows, 'walkDrawOrder': order, 'distinctWalkRasters': unique_walk,
            'sourceRegistration': registration, 'palette': PALETTE, 'paletteColors': len(PALETTE),
            'bodyScale': scale, 'idleScale': idle_scale, 'sharedUpperBodyRows': [0, 42],
            'walkCycleDistanceAtScaleOne': 34, 'bakedWeaponInBody': False,
            'weaponIncludesHands': True, 'visualApproved': False, 'runtimeIntegrated': False,
            'assetHashes': {p.name: sha(p) for p in [atlas_path, gun_path, native]},
            'sourceHashes': {p.name: sha(p) for p in SOURCE.glob('*.png')},
            'assetBytes': atlas_path.stat().st_size + gun_path.stat().st_size,
            'decodedRGBABytes': (atlas.width * atlas.height + gun.width * gun.height) * 4,
            'limitations': ['compact mirrored two-facing art convention', 'generated pose/shading polish pending',
                            'no complete back-facing character set', 'not integrated into main game']}
    (OUT / 'metadata.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    # Classic script data keeps file:// previews usable without fetch permissions.
    (OUT / 'asset-data.js').write_text('window.COMPACT_RANGER_DATA = ' + json.dumps(meta) + ';\n', encoding='utf-8')
    print(json.dumps({'bodyFrames': len(frames), 'distinctWalkRasters': unique_walk,
                      'assetBytes': meta['assetBytes'], 'decodedRGBABytes': meta['decodedRGBABytes']}))


if __name__ == '__main__':
    main()
