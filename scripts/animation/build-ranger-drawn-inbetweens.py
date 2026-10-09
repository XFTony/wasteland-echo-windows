"""Assemble illustrated in-betweens, never generate poses by joint deformation.

Original eight native keys remain byte-identical. New full-character drawings
are imported from ImageGen sheets with uniform resolution normalization and
whole-image head registration. All source choices and registrations are saved.
"""
from pathlib import Path
from array import array
import hashlib, importlib.util, json, math, statistics
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/animation/ranger/pixel-source/run-candidate-v4'
PREVIEW = ROOT / 'output/animation/ranger/pixel-run-candidate-v4'
SOURCE = ROOT / 'art/animation/ranger/pixel-source/ranger-run-keyposes-study-v2.png'
KEY_META = ROOT / 'art/animation/ranger/pixel-source/run-candidate-v2/metadata.json'
spec = importlib.util.spec_from_file_location('ps', Path(__file__).with_name('pixel-source-tools.py'))
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)
ROOT_NATIVE = (64, 110)
ROOT_ART = (256, 476)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def drawings(path, columns, rows):
    """Assign opaque connected pieces to sprites, retaining toes across grid lines.

    Generated drawings sometimes extend across an imaginary cell border while
    remaining isolated from the next character. Crop by artwork connectivity,
    not by blindly cutting off those pixels. No silhouette is repainted here.
    """
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    opaque = bytearray(1 if a >= 200 else 0 for a in image.getchannel('A').getdata())
    seen = bytearray(width * height)
    components = []
    for seed in range(width * height):
        if not opaque[seed] or seen[seed]:
            continue
        seen[seed] = 1
        queue = array('I', [seed])
        cursor = 0
        xmin = xmax = seed % width
        ymin = ymax = seed // width
        while cursor < len(queue):
            pixel = queue[cursor]
            cursor += 1
            x, y = pixel % width, pixel // width
            xmin, xmax = min(xmin, x), max(xmax, x)
            ymin, ymax = min(ymin, y), max(ymax, y)
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = ny * width + nx
                    if opaque[neighbor] and not seen[neighbor]:
                        seen[neighbor] = 1
                        queue.append(neighbor)
        if len(queue) >= 8:
            components.append(((xmin, ymin, xmax + 1, ymax + 1), queue))
    main = sorted(components, key=lambda c: len(c[1]), reverse=True)[:columns * rows]
    if len(main) != columns * rows or min(len(c[1]) for c in main) < 10000:
        raise ValueError(f'Missing isolated full-body drawings in {path}')
    anchors = {}
    for box, pixels in main:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        column, row = int(cx / (width / columns)), int(cy / (height / rows))
        index = row * columns + column
        if index in anchors:
            raise ValueError(f'Overlapping sprite assignment {path}: {index}')
        anchors[index] = (cx, cy)
    groups = {index: array('I') for index in anchors}
    for box, pixels in components:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        index = min(anchors, key=lambda i: math.dist((cx, cy), anchors[i]))
        groups[index].extend(pixels)
    result = []
    for index in range(columns * rows):
        pixels = groups[index]
        xmin = min(p % width for p in pixels)
        xmax = max(p % width for p in pixels) + 1
        ymin = min(p // width for p in pixels)
        ymax = max(p // width for p in pixels) + 1
        if xmin == 0 or xmax == width or ymin == 0 or ymax == height:
            raise ValueError(f'Drawing clipped by actual image edge: {path}, {index}')
        isolated = Image.new('RGBA', (xmax - xmin, ymax - ymin), (0, 0, 0, 0))
        for pixel in pixels:
            x, y = pixel % width, pixel // width
            isolated.putpixel((x - xmin, y - ymin), (*image.getpixel((x, y))[:3], 255))
        origin = (index % columns * width / columns, index // columns * height / rows)
        # A shared scale for the entire input sheet, never a per-pose bbox fit.
        normalization = 512 / (height / rows)
        hood = []
        for y in range(min(isolated.height, math.ceil(75 / normalization))):
            for x in range(isolated.width):
                r, g, b, a = isolated.getpixel((x, y))
                if a and r > 80 and .5 * r < g < .95 * r and .15 * r < b < .85 * r:
                    hood.append(x + xmin)
        if not hood:
            raise ValueError('Hood registration unavailable')
        result.append({'image': isolated, 'box': [xmin, ymin, xmax, ymax],
                       'origin': origin, 'normalization': normalization,
                       'hoodX': (statistics.mean(hood) - origin[0]) * normalization,
                       'topY': (ymin - origin[1]) * normalization,
                       'sourcePath': path.relative_to(ROOT).as_posix(), 'sourceCell': index})
    return result


def registered_art(entry, desired_top):
    norm = entry['normalization']
    origin = entry['origin']
    box = entry['box']
    source_root = (entry['hoodX'] - 22, 476 + entry['topY'] - desired_top)
    inverse = (1 / norm, 0, origin[0] - box[0] + (source_root[0] - ROOT_ART[0]) / norm,
               0, 1 / norm, origin[1] - box[1] + (source_root[1] - ROOT_ART[1]) / norm)
    art = entry['image'].transform((512, 512), Image.Transform.AFFINE, inverse,
                                   resample=Image.Resampling.NEAREST)
    bounds = art.getchannel('A').getbbox()
    if not bounds or bounds[0] == 0 or bounds[2] == 512 or bounds[1] == 0 or bounds[3] == 512:
        raise ValueError('Registered drawing is clipped')
    return art, {'sourcePath': entry['sourcePath'], 'sourceCell': entry['sourceCell'],
                 'sourceComponentBox': entry['box'], 'sheetResolutionScale': norm,
                 'sourceHoodCenterX': entry['hoodX'], 'sourceTopY': entry['topY'],
                 'registeredTopY': desired_top, 'sourceRoot': list(source_root)}


def native_frame(art, scale, colors, cache):
    result = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    for y in range(128):
        sy = round((y - ROOT_NATIVE[1]) / scale + ROOT_ART[1])
        if not 0 <= sy < art.height:
            continue
        for x in range(128):
            sx = round((x - ROOT_NATIVE[0]) / scale + ROOT_ART[0])
            if not 0 <= sx < art.width:
                continue
            r, g, b, a = art.getpixel((sx, sy))
            if not a:
                continue
            color = (r, g, b)
            if color not in cache:
                cache[color] = min(colors, key=lambda c: sum((p - q) ** 2 for p, q in zip(color, c)))
            result.putpixel((x, y), (*cache[color], 255))
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    metadata_path = OUT / 'metadata.json'
    previous = json.loads(metadata_path.read_text()) if metadata_path.is_file() else {}
    metadata_path.write_text(json.dumps({'sourceRevision': 'v4', 'exportFilesComplete': False,
                                         'complete': False, 'rebuildStatus': 'building'}), encoding='utf-8')
    keys = json.loads(KEY_META.read_text())
    scale = keys['sharedStudyScale']
    colors = [tuple(bytes.fromhex(c[1:])) for c in keys['opaquePalette']]
    key_atlas = Image.open(ROOT / keys['atlasPath']).convert('RGBA')
    key_source = Image.open(SOURCE).convert('RGBA')
    sources = [OUT / 'source/inbetweens-pairs-1-to-4.png',
               OUT / 'source/inbetweens-pairs-5-to-8.png',
               OUT / 'source/three-pose-revision.png']
    first, second, repairs = [drawings(p, c, r) for p, c, r in zip(sources, [2, 2, 3], [4, 4, 1])]
    authored = first + second
    for target, entry in zip([4, 5, 10], repairs):
        authored[target] = entry
    frames, artwork, records = [], [], []
    cache = {}
    for key in range(8):
        row = keys['frames'][key]
        x, y, w, h = row['rect']
        frames.append(key_atlas.crop((x, y, x + w, y + h)))
        cell = key_source.crop((key % 4 * 384, key // 4 * 512,
                                (key % 4 + 1) * 384, (key // 4 + 1) * 512))
        # Display-only high-resolution import. Native original pixels above are never changed.
        cell.putalpha(cell.getchannel('A').point(lambda a: 255 if a >= 200 else 0))
        root_x = row['sourceHoodCenterX'] - 22
        art = cell.transform((512, 512), Image.Transform.AFFINE,
                             (1, 0, root_x - ROOT_ART[0], 0, 1, 0),
                             resample=Image.Resampling.NEAREST)
        artwork.append(art)
        records.append({'kind': 'original-key', 'originalKey': key + 1,
                        'sourcePath': SOURCE.relative_to(ROOT).as_posix(),
                        'sourceCell': key, 'originalNativePixelsExact': True})
        for offset in range(2):
            t = (offset + 1) / 3
            end = (key + 1) % 8
            desired_top = (1 - t) * row['sourceOpaqueBox'][1] + t * keys['frames'][end]['sourceOpaqueBox'][1]
            art, record = registered_art(authored[key * 2 + offset], desired_top)
            artwork.append(art)
            frames.append(native_frame(art, scale, colors, cache))
            records.append({'kind': 'drawn-inbetween', 'fromKey': key + 1, 'toKey': end + 1,
                            'transitionFraction': t, **record})
    if len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}) != 24:
        raise ValueError('Twenty-four different drawings required')
    # Split each old 50 ms interval into 17 + 16 + 17 ms: preserve the 400 ms rhythm.
    durations = [17, 16, 17] * 8
    native = OUT / 'ranger-run-candidate-v4.aseprite'
    atlas = OUT / 'ranger-run-candidate-v4.png'
    export = PREVIEW / 'editor-export.json'
    ps.write_source(native, frames, durations, 'drawn-full-character-frames')
    ps.run_editor([native, '--sheet', atlas, '--sheet-type', 'horizontal', '--data', export,
                   '--format', 'json-array'])
    exported = json.loads(export.read_text())
    sheet = Image.open(atlas).convert('RGBA')
    if len(exported['frames']) != 24:
        raise ValueError('Wrong editor frame count')
    raw_atlas = Image.new('RGBA', (512 * 24, 512), (0, 0, 0, 0))
    for i, (frame, art, record, row) in enumerate(zip(frames, artwork, records, exported['frames'])):
        rect = row['frame']
        actual = sheet.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
        if actual.tobytes() != frame.tobytes() or row['duration'] != durations[i]:
            raise ValueError('Native editor export mismatch')
        raw_atlas.alpha_composite(art, (i * 512, 0))
        record.update(index=i, rect=[rect[k] for k in ('x', 'y', 'w', 'h')],
                      root=list(ROOT_NATIVE), durationMs=durations[i],
                      artRect=[i * 512, 0, 512, 512], artRoot=list(ROOT_ART),
                      opaqueBox=list(frame.getchannel('A').getbbox()))
    raw_path = OUT / 'ranger-run-drawn-art-v4.png'
    raw_atlas.save(raw_path)
    webp = OUT / 'ranger-run-candidate-v4.webp'
    frames[0].save(webp, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, lossless=True, minimize_size=False, background=(0, 0, 0, 0))
    # GIF has centisecond timing. Keep every frame >=20ms for broad viewer compatibility.
    gif_palette = [0, 0, 0] + [v for c in colors for v in c]
    gif_palette += [0] * (768 - len(gif_palette))
    ids = {c: i + 1 for i, c in enumerate(colors)}
    gifs = []
    for frame in frames:
        indexed = Image.new('P', (128, 128), 0)
        indexed.putpalette(gif_palette)
        indexed.putdata([ids[p[:3]] if p[3] else 0 for p in frame.getdata()])
        indexed.info['transparency'] = 0
        gifs.append(indexed)
    gif = OUT / 'ranger-run-candidate-v4.gif'
    gifs[0].save(gif, save_all=True, append_images=gifs[1:], duration=[20] * 24,
                 loop=0, transparency=0, disposal=2, optimize=False)
    # A contact sheet shows every actual drawing and the loop bridge together.
    contact = Image.new('RGBA', (6 * 256, 4 * 276), (24, 28, 24, 255))
    pen = ImageDraw.Draw(contact)
    for i, (art, record) in enumerate(zip(artwork, records)):
        tile = art.resize((256, 256), Image.Resampling.NEAREST)
        x, y = i % 6 * 256, i // 6 * 276
        contact.alpha_composite(tile, (x, y + 20))
        label = f'{i + 1:02} KEY {record["originalKey"]}' if record['kind'] == 'original-key' else f'{i + 1:02} {record["fromKey"]}->{record["toKey"]} +{round(record["transitionFraction"] * 3)}/3'
        pen.text((x + 8, y + 4), label, fill=(232, 197, 131, 255))
    contact_path = OUT / 'ranger-run-contact-sheet-v4.png'
    contact.save(contact_path)
    meta = {'date': '2026-10-09', 'sourceRevision': 'v4', 'role': 'illustrated full-character inbetween review',
            'sourceFrames': 24, 'originalKeyFrames': 8, 'newDrawnFrames': 16,
            'originalKeysByteIdentical': True, 'poseMethod': 'ImageGen full-character drawings; no skeletal pose generation',
            'sharedStudyScale': scale, 'worldScale': 1, 'referenceWorkingBodyPixels': 76,
            'sourcePaths': [SOURCE.relative_to(ROOT).as_posix()] + [p.relative_to(ROOT).as_posix() for p in sources],
            'sourceHashes': {p.relative_to(ROOT).as_posix(): sha(p) for p in [SOURCE] + sources},
            'nativePath': native.relative_to(ROOT).as_posix(), 'nativeSha256': sha(native),
            'atlasPath': atlas.relative_to(ROOT).as_posix(), 'atlasSha256': sha(atlas),
            'gifPath': gif.relative_to(ROOT).as_posix(), 'gifSha256': sha(gif),
            'gifDurationsMs': [20] * 24, 'gifTotalDurationMs': 480,
            'webpPath': webp.relative_to(ROOT).as_posix(), 'webpSha256': sha(webp),
            'artAtlasPath': raw_path.relative_to(ROOT).as_posix(), 'artAtlasSha256': sha(raw_path),
            'artWorldScale': scale, 'contactSheetPath': contact_path.relative_to(ROOT).as_posix(),
            'canvas': [128, 128], 'atlasSize': list(sheet.size), 'root': list(ROOT_NATIVE),
            'opaquePalette': keys['opaquePalette'], 'paletteColors': len(colors), 'frames': records,
            'totalDurationMs': sum(durations), 'assetBytes': atlas.stat().st_size,
            'decodedRGBABytes': sheet.width * sheet.height * 4,
            'nativeRoundtripExact': True, 'complete': False, 'exportFilesComplete': True,
            'visualApproved': False, 'runtimeIntegrated': False, 'handRetouched': False, 'bakedWeapon': True,
            'loopBridge': {'fromOriginalKey': 8, 'toOriginalKey': 1, 'inbetweenIndices': [22, 23], 'duplicateEndFrame': False},
            'pending': ['visual continuity and clothing consistency review', 'original gait key corrections if needed',
                        'independent weapon layers', 'runtime distance-driven playback']}
    video = ROOT / previous.get('videoPath', 'output/animation/ranger/pixel-run-candidate-v4/ranger-drawn-run-v4.webm')
    if previous.get('artAtlasSha256') == meta['artAtlasSha256'] and video.is_file() and sha(video) == previous.get('videoSha256'):
        meta['videoPath'] = video.relative_to(ROOT).as_posix()
        meta['videoSha256'] = previous['videoSha256']
    metadata_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    print(json.dumps({'frames': 24, 'originalKeysExact': 8, 'newDrawings': 16,
                      'periodMs': 400, 'nativeBytes': meta['assetBytes']}))


if __name__ == '__main__':
    main()
