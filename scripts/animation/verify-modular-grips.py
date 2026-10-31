"""Independent pixel/source verification for modular materials."""
from pathlib import Path
import hashlib,importlib.util,json,tempfile
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'art/characters/ranger/modular-grips-v3'
OUT=ROOT/'output/modular-grips-2026-10-27'
spec=importlib.util.spec_from_file_location('ps',Path(__file__).with_name('pixel-source-tools.py'))
ps=importlib.util.module_from_spec(spec);spec.loader.exec_module(ps)


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def compose(data,images,w,hand_id,cuff_id):
    layers=[]
    for profile in (data['handSets'][hand_id],data['cuffSets'][cuff_id]):
        slots=profile.get('overrides',{}).get(w['id']) or profile.get('poses',{}).get(w['visual']['family'])
        if slots is None:raise ValueError('Missing pose '+profile['id']+' / '+w['id'])
        for slot in ('primary','support'):
            grip=w['visual'][slot+'Grip']
            for p in slots[slot]:
                x,y=[grip[i]-p['anchor'][i] for i in (0,1)]
                if x!=int(x) or y!=int(y):raise ValueError('Off-grid source')
                sx,sy,width,height=p['rect'];image=images[p['asset']]
                if sx<0 or sy<0 or sx+width>image.width or sy+height>image.height:raise ValueError('Source crop out of bounds')
                layers.append((p['depth'],image.crop((sx,sy,sx+width,sy+height)),int(x),int(y)))
    v=w['visual'];left=min([0]+[x for _,_,x,y in layers]);top=min([0]+[y for _,_,x,y in layers])
    right=max([v['width']]+[x+im.width for _,im,x,y in layers]);bottom=max([v['height']]+[y+im.height for _,im,x,y in layers])
    out=Image.new('RGBA',(right-left,bottom-top),(0,0,0,0))
    for depth,im,x,y in layers:
        if depth=='back':out.alpha_composite(im,(x-left,y-top))
    out.alpha_composite(images[v['asset']],(-left,-top))
    for depth,im,x,y in layers:
        if depth=='front':out.alpha_composite(im,(x-left,y-top))
    return out,(left,top)


def check_defaults(data,images):
    rows=[]
    for w in data['weapons']:
        old=Image.open(ART/w['referenceImage']).convert('RGBA')
        new,origin=compose(data,images,w,data['defaultHands'],data['defaultCuffs'])
        if origin!=(0,0) or new.size!=old.size or new.tobytes()!=old.tobytes():raise ValueError('Approved default changed: '+w['id'])
        rows.append({'id':w['id'],'defaultPixelsExact':True})
    return rows


def main():
    OUT.mkdir(parents=True,exist_ok=True);data=json.loads((ART/'metadata.json').read_text(encoding='utf-8'))
    images={};editor_count=0
    for asset_id,a in data['assets'].items():
        p=ART/a['path'];assert sha(p)==a['sha256']
        im=Image.open(p).convert('RGBA');assert im.size==(a['width'],a['height'])
        assert set(im.getchannel('A').getdata())<={0,255};images[asset_id]=im
        exported=OUT/(asset_id.replace('.','-')+'-source-export.png')
        ps.run_editor([p.with_suffix('.aseprite'),'--sheet',exported])
        assert Image.open(exported).convert('RGBA').tobytes()==im.tobytes();editor_count+=1
    rows=check_defaults(data,images)
    # Reject a change to an exposed gun pixel before publishing editor exports.
    changed=images.copy();first=data['weapons'][0];asset=first['visual']['asset'];changed[asset]=images[asset].copy()
    pixel=max(((x,y) for y in range(changed[asset].height) for x in range(changed[asset].width) if changed[asset].getpixel((x,y))[3]),key=lambda p:p[0])
    changed[asset].putpixel(pixel,(1,254,1,255))
    try:check_defaults(data,changed)
    except ValueError:pass
    else:raise AssertionError('Default change should be rejected')
    seed_spec=importlib.util.spec_from_file_location('migration',Path(__file__).with_name('build-modular-grips.py'))
    migration=importlib.util.module_from_spec(seed_spec);seed_spec.loader.exec_module(migration)
    with tempfile.TemporaryDirectory(dir=OUT) as temporary:
        workspace=Path(temporary);source=workspace/'artist.aseprite';source.write_bytes(b'original source')
        assert workspace.resolve().is_relative_to(OUT.resolve())
        previous={'migrationSeedSourceHashes':{'artist.aseprite':sha(source)}}
        migration.ensure_sources_unchanged(previous,workspace=workspace);source.write_bytes(b'edited by artist')
        try:migration.ensure_sources_unchanged(previous,workspace=workspace)
        except ValueError:pass
        else:raise AssertionError('Edited source protection missing')
        migration.ensure_sources_unchanged(previous,reseed=True,workspace=workspace)
    edited=json.loads(json.dumps(data));edited['migrationSeedConfigHash']=migration.authoring_digest(data)
    edited['weapons'][0]['visual']['primaryGrip'][0]+=1
    try:migration.ensure_sources_unchanged(edited)
    except ValueError:pass
    else:raise AssertionError('Edited grip configuration protection missing')
    for w in data['weapons']:
        assert sha(ART/w['referenceImage'])==w['referenceSha256']
        exported=OUT/(w['id']+'-layered-source.png')
        ps.run_editor([ART/'source'/(w['id']+'.aseprite'),'--sheet',exported])
        assert Image.open(exported).convert('RGBA').tobytes()==Image.open(ART/w['referenceImage']).convert('RGBA').tobytes()
        old=images[w['visual']['asset']];before=old.tobytes()
        for h in data['handSets']:
            for c in data['cuffSets']:
                composed,origin=compose(data,images,w,h,c);assert composed.getchannel('A').getbbox()
        assert old.tobytes()==before
    for name,digest in data['editableSourceHashes'].items():assert sha(ROOT/name)==digest
    assert sha(ART/data['characters'][data['defaultCharacter']]['bodyAtlas'])==data['sharedBodySha256']
    report={'date':'2026-10-27','pilot':data['pilot'],'weapons':rows,'separateEditableAtlasesExact':editor_count,
            'layeredMigrationSnapshotsExact':len(rows),'handSets':len(data['handSets']),'cuffSets':len(data['cuffSets']),
            'binaryAlpha':True,'sharedBodyUnchanged':True,'defaultChangeRejected':True,'editedSourceProtected':True,'editedConfigurationProtected':True,'ownedAssetRGBABytes':sum(im.width*im.height*4 for im in images.values()),
            'ownedPNGBytes':sum((ART/a['path']).stat().st_size for a in data['assets'].values()),
            'newHandVisualApproved':False,'secondCharacterBodyValidated':False,'mainGameArtIntegrated':False}
    (ROOT/'docs/qa/modular-grips-assets-2026-10-27.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))


if __name__=='__main__':main()
