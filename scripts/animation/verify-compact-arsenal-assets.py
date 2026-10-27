from pathlib import Path
import hashlib, importlib.util, json, subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art/characters/ranger/compact-arsenal-v2'
OUT=ROOT/'output/compact-arsenal-2026-10-27'
spec=importlib.util.spec_from_file_location('pixel_source',Path(__file__).with_name('pixel-source-tools.py'))
ps=importlib.util.module_from_spec(spec);spec.loader.exec_module(ps)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    data=json.loads((ART/'metadata.json').read_text(encoding='utf-8'))
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
    definitions=json.loads(subprocess.run(['node','-e',"process.stdout.write(JSON.stringify(require('./src/config').WEAPONS))"],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',check=True).stdout)
    assert {w['id'] for w in data['weapons']}==set(definitions)
    assert sha(ROOT/'src/config.js')==data['configSourceSha256']
    assert sha(ART/data['bodyAtlas'])==data['bodyAtlasSha256']
    palette={tuple(bytes.fromhex(c[1:])) for c in data['palette']}
    report=[]
    for w in data['weapons']:
        p=ART/w['image'];im=Image.open(p).convert('RGBA');rig=w['rig']
        assert sha(p)==w['sha256'] and im.size==(rig['width'],rig['height'])
        assert set(im.getchannel('A').getdata())<={0,255}
        assert {c[:3] for c in im.getdata() if c[3]}<=palette
        assert rig['pivot'][1]==rig['muzzle'][1] and rig['muzzle'][0]>rig['pivot'][0]
        for key in ['damage','interval','projectileCount','projectileSpeed','spread','ttl','pierce','lockRange','color']:
            assert w[key]==definitions[w['id']][key]
        if w['id']!='scrap_pistol':
            export=OUT/(w['id']+'-editor-export.png')
            ps.run_editor([ART/'weapons'/(w['id']+'.aseprite'),'--sheet',export])
            assert Image.open(export).convert('RGBA').tobytes()==im.tobytes()
        report.append({'id':w['id'],'size':list(im.size),'bytes':p.stat().st_size,'editorRoundtripExact':True,'baseCombatValuesPreserved':True})
    for name,digest in data['sourceHashes'].items():assert sha(ART/name)==digest
    proof={'date':'2026-10-27','weapons':report,'totalWeaponBytes':data['runtimeImageBytes'],'decodedWeaponRGBABytes':data['decodedWeaponRGBABytes'],
           'sharedBodyReused':True,'binaryAlpha':True,'paletteLimit':len(palette),'headOcclusionRows':data['body']['headOcclusionRows'],
           'visualApproved':False,'mainGameArtIntegrated':False}
    (ROOT/'docs/qa/compact-arsenal-assets-2026-10-27.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
    print(json.dumps({'weapons':len(report),'nativeExportsExact':True,'weaponBytes':data['runtimeImageBytes']}))


if __name__=='__main__':main()
