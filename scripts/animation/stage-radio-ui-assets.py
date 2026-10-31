"""Register the two reusable radio UI scenes and preserve retired artwork."""
from pathlib import Path
import csv
import hashlib
import json
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]


def main():
    manifest_path = ROOT / 'art/manifest.json'
    manifest = json.loads(manifest_path.read_text('utf-8'))
    retired = {'menu.backdrop.' + page + '.v3' for page in ['main', 'deployment', 'inventory', 'shop', 'settings', 'credits']}
    retired.update(['cover.survivor.v3', 'ui.field-plate.v2', 'deployment.convoy.v1'])
    ids = {'menu.radio.camp.v1', 'menu.radio.desk.v1'}
    manifest['assets'] = [entry for entry in manifest['assets'] if entry['id'] not in ids]
    for entry in manifest['assets']:
        if entry['id'] in retired:
            entry['status'] = 'inactive'
    records = []
    for name in ['camp', 'desk']:
        source = ROOT / 'art/ui/radio-v1/source' / (name + '.png')
        runtime = ROOT / 'web/assets/ui/radio-v1' / (name + '.webp')
        original = Image.open(source).convert('RGB')
        original.save(runtime, quality=90, method=6)
        exported = Image.open(runtime).convert('RGB')
        rms = sum(value ** 2 for value in ImageStat.Stat(ImageChops.difference(original, exported)).rms) ** 0.5 / (255 * 3 ** 0.5)
        if rms > 0.035:
            raise ValueError('Scene export visual error exceeded bound: ' + name)
        entry = {'id': 'menu.radio.' + name + '.v1', 'version': 'radio-v1', 'status': 'active',
                 'runtimePath': runtime.relative_to(ROOT).as_posix(), 'archivePath': source.relative_to(ROOT).as_posix(),
                 'sourcePaths': ['art/ui/radio-v1/source/generation-record.json'],
                 'width': exported.width, 'height': exported.height, 'bytes': runtime.stat().st_size,
                 'sha256': hashlib.sha256(runtime.read_bytes()).hexdigest().upper(),
                 'generator': 'OpenAI built-in ImageGen', 'normalizedRms': rms,
                 'notes': 'Reusable crop-safe pixel environment; all text, buttons and animation remain code-drawn.'}
        manifest['assets'].append(entry)
        records.append(entry)
    manifest['updatedAt'] = '2026-10-28'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    ledger_path = ROOT / 'docs/assets-ledger.csv'
    with ledger_path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        fields, rows = reader.fieldnames, [row for row in reader if row['asset_id'] not in ids]
    for entry in records:
        rows.append(dict(zip(fields, [entry['id'], 'pixel-ui-environment', entry['runtimePath'], '', 'Wasteland Echo / OpenAI ImageGen',
                    'Generated project asset; service terms review', '2026-10-28', 'true', '', 'pending', 'review-before-commercial-release'])))
    with ledger_path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields);writer.writeheader();writer.writerows(rows)
    print(json.dumps({'runtimeBytes': sum(r['bytes'] for r in records), 'scenes': len(records),
                      'maximumNormalizedRms': max(r['normalizedRms'] for r in records)}))


if __name__ == '__main__':
    main()
