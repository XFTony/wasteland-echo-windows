"""Import six drawn grip groups and reference the existing pistol/body assets."""
from pathlib import Path
import hashlib, importlib.util, json, statistics, subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/characters/ranger/compact-arsenal-v2'
spec = importlib.util.spec_from_file_location('compact_assets', Path(__file__).with_name('build-compact-ranger-assets.py'))
base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main():
    source = ART / 'source'; output = ART / 'weapons'; output.mkdir(parents=True, exist_ok=True)
    layouts = {row['id']: row for row in json.loads((source / 'layout.json').read_text(encoding='utf-8'))}
    definitions = json.loads(subprocess.run(['node', '-e', "process.stdout.write(JSON.stringify(require('./src/config').WEAPONS))"],
                            cwd=ROOT, check=True, capture_output=True, text=True, encoding='utf-8').stdout)
    # Only the original seven weapons belong to this drawn source pack.
    definitions = {key:value for key,value in definitions.items() if key == 'scrap_pistol' or key in layouts}
    colors = base.COLORS + [tuple(bytes.fromhex(s)) for s in ['173f46','216d75','39aab3','6bdfdd','c4ffec','456155','79917a','bad3b0']]
    palette = ['#'+bytes(color).hex() for color in colors]
    cache = {}; rows = []; hashes = {}
    for weapon_id, definition in definitions.items():
        if weapon_id == 'scrap_pistol':
            row = {'id':weapon_id, 'image':'../compact-motion-v1/sidearm-grip.png',
                   'rig':{'width':36,'height':20,'pivot':[9,6],'muzzle':[33,6],
                          'chestY':-16,'aimOffsetX':3,'upShoulder':12,'upLift':8}}
        else:
            layout = layouts[weapon_id]; original = source / (weapon_id+'.png')
            image = Image.open(original).convert('RGBA'); box = base.opaque_box(image)
            if box[0] <= 0 or box[1] <= 0 or box[2] >= image.width or box[3] >= image.height:
                raise ValueError('Source cropped: '+weapon_id)
            width, height = layout['width'], layout['height']
            scale = min((width-2)/(box[2]-box[0]),(height-3)/(box[3]-box[1]))
            sprite = Image.new('RGBA',(width,height),(0,0,0,0))
            for y in range(height):
                sy = round((y-2)/scale+box[1])
                if not 0 <= sy < image.height: continue
                for x in range(width):
                    sx = round((x-1)/scale+box[0])
                    if not 0 <= sx < image.width: continue
                    pixel = image.getpixel((sx,sy))
                    if pixel[3] < 200: continue
                    rgb = pixel[:3]
                    if rgb not in cache: cache[rgb] = min(colors,key=lambda c:sum((a-b)**2 for a,b in zip(rgb,c)))
                    sprite.putpixel((x,y),(*cache[rgb],255))
            bounds = sprite.getchannel('A').getbbox()
            column = bounds[2]-2
            ys = [y for y in range(height) if sprite.getpixel((column,y))[3]]
            if not ys: raise ValueError('Muzzle column unavailable: '+weapon_id)
            axis = statistics.median(ys)+.5
            pivot = layout['pivot']; muzzle = bounds[2]
            chest = -15 if weapon_id == 'coil_cannon' else -16
            lift = max(0,50+chest-(muzzle-pivot)+min(4,max(.7,definition['recoil']*.35)))
            image_path = output/(weapon_id+'.png'); sprite.save(image_path)
            base.pixel_source.write_source(output/(weapon_id+'.aseprite'),[sprite],[100],'weapon-and-two-hands')
            row = {'id':weapon_id,'image':'weapons/'+weapon_id+'.png',
                   'rig':{'width':width,'height':height,'pivot':[pivot,axis],'muzzle':[muzzle,axis],
                          'chestY':chest,'aimOffsetX':3,'upShoulder':10,'upLift':lift},
                   'source': 'source/'+weapon_id+'.png','sourceBox':list(box),'importScale':scale}
            hashes['source/'+weapon_id+'.png'] = sha(original)
        row.update({'name':definition['name'],'interval':definition['interval'],'damage':definition['damage'],
                    'projectileCount':definition['projectileCount'],'projectileSpeed':definition['projectileSpeed'],
                    'spread':definition['spread'],'ttl':definition['ttl'],'pierce':definition['pierce'],
                    'lockRange':definition['lockRange'],'color':definition['color'],
                    'flashLife':definition['muzzleFlashLife'],'flashLength':min(12,definition['muzzleFlashLength']*.5),
                    'recoil':min(4,max(.7,definition['recoil']*.35)),
                    'flashWidth':5 if weapon_id in ('breaker_shotgun','coil_cannon') else 3})
        row['rig']['recoil'] = row['recoil']
        row['sha256'] = sha(ART/row['image']); rows.append(row)
    body_meta = json.loads((ART.parent/'compact-motion-v1/metadata.json').read_text(encoding='utf-8'))
    metadata = {'date':'2026-10-27','bodyAtlas':'../compact-motion-v1/body-atlas.png','body':{**body_meta['body'],'headOcclusionRows':38},
                'weapons':rows,'defaultWeaponId':'scrap_pistol','defaultAutoCombat':True,
                'palette':palette,'sourceHashes':hashes,'configSourceSha256':sha(ROOT/'src/config.js'),
                'bodyAtlasSha256':sha(ART.parent/'compact-motion-v1/body-atlas.png'),
                'runtimeImageBytes':sum((ART/r['image']).stat().st_size for r in rows),
                'decodedWeaponRGBABytes':sum(r['rig']['width']*r['rig']['height']*4 for r in rows),
                'visualApproved':False,'runtimeIntegrated':False}
    (ART/'metadata.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False),encoding='utf-8')
    (ART/'arsenal-data.js').write_text('window.COMPACT_ARSENAL_DATA = '+json.dumps(metadata,ensure_ascii=False)+';\n',encoding='utf-8')
    print(json.dumps({'weapons':len(rows),'weaponImageBytes':metadata['runtimeImageBytes'],'decodedWeaponRGBABytes':metadata['decodedWeaponRGBABytes']}))


if __name__ == '__main__': main()
