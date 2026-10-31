"""Export edited native owner sources; preserve approved default before publishing."""
from pathlib import Path
import hashlib,importlib.util,json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art/characters/ranger/modular-grips-v3'
OUT=ROOT/'output/modular-grips-2026-10-27/editor-staging'
spec=importlib.util.spec_from_file_location('verify_modular',Path(__file__).with_name('verify-modular-grips.py'))
verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)


def version(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()[:16]


def main():
    data=json.loads((ART/'metadata.json').read_text(encoding='utf-8'));OUT.mkdir(parents=True,exist_ok=True)
    images={};staged={}
    for asset_id,a in data['assets'].items():
        png=ART/a['path'];native=png.with_suffix('.aseprite');target=OUT/(asset_id.replace('.','-')+'.png')
        verify.ps.run_editor([native,'--sheet',target]);im=Image.open(target).convert('RGBA')
        if im.size!=(a['width'],a['height']):raise ValueError('Update atlas rectangles before changing its canvas: '+asset_id)
        if not set(im.getchannel('A').getdata())<={0,255}:raise ValueError('Native alpha must remain binary: '+asset_id)
        images[asset_id]=im;staged[asset_id]=target
    # Validate everything in staging before overwriting any live PNG.
    verify.check_defaults(data,images)
    for asset_id,a in data['assets'].items():
        png=(ART/a['path']).resolve();png.write_bytes(staged[asset_id].read_bytes());a['sha256']=verify.sha(png)
        data['editableSourceHashes'][png.with_suffix('.aseprite').relative_to(ROOT).as_posix()]=verify.sha(png.with_suffix('.aseprite'))
    for w in data['weapons']:w['version']=version({'rig':w['visual'],'image':data['assets'][w['visual']['asset']]['sha256']})
    for collection in (data['handSets'],data['cuffSets']):
        for profile in collection.values():
            config={k:v for k,v in profile.items() if k!='version'}
            asset_ids=set()
            def collect(value):
                if isinstance(value,dict):
                    if 'asset' in value:asset_ids.add(value['asset'])
                    for v in value.values():collect(v)
                elif isinstance(value,list):
                    for v in value:collect(v)
            collect(config)
            profile['version']=version({'profile':config,'atlasHashes':{i:data['assets'][i]['sha256'] for i in sorted(asset_ids)}})
    (ART/'metadata.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    (ART/'modular-data.js').write_text('window.MODULAR_GRIP_DATA = '+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
    print(json.dumps({'nativeSourcesExported':len(staged),'approvedDefaultPixelsExact':True,'migrationSeedHashesPreserved':True}))


if __name__=='__main__':main()
