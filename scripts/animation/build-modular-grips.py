"""Native sprite-source migration: semantic masks, repaired bases, replaceable parts.

Visible original pixels are preserved. New hidden pixels are authored in the
native-grid regions file; the second test hand uses an expanded plated shape.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[2]
STUDY=ROOT/'art/characters/ranger/modular-grips-v3'
WEAPONS=ROOT/'art/weapons/compact-modular-v1'
HANDS=ROOT/'art/characters/hand-sets/compact-v1'
CUFFS=ROOT/'art/characters/cuff-sets/compact-v1'
BASE=ROOT/'art/characters/ranger/compact-arsenal-v2'
OUTPUT=ROOT/'output/modular-grips-2026-10-27'
spec=importlib.util.spec_from_file_location('ps',Path(__file__).with_name('pixel-source-tools.py'))
ps=importlib.util.module_from_spec(spec);spec.loader.exec_module(ps)


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest().upper()
def version(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()[:16]


def authoring_digest(data):
    return version({'weapons':[w['visual'] for w in data.get('weapons',[])],
                    'handSets':{key:{k:v for k,v in p.items() if k!='version'} for key,p in data.get('handSets',{}).items()},
                    'cuffSets':{key:{k:v for k,v in p.items() if k!='version'} for key,p in data.get('cuffSets',{}).items()},
                    'characters':data.get('characters',{}),
                    'assets':{key:{k:v for k,v in a.items() if k!='sha256'} for key,a in data.get('assets',{}).items()}})


def ensure_sources_unchanged(previous,reseed=False,workspace=ROOT):
    if reseed:return
    if previous.get('migrationSeedConfigHash') and previous['migrationSeedConfigHash']!=authoring_digest(previous):
        raise ValueError('Edited grip/profile configuration would be overwritten; export native sources instead, or explicitly --reseed.')
    for name,expected in previous.get('migrationSeedSourceHashes',{}).items():
        p=workspace/name
        if p.is_file() and digest(p)!=expected:
            raise ValueError('Edited native source would be overwritten: '+name+'; use export-modular-grip-sources.py to export native edits, or explicitly --reseed from the migration recipe.')


def rows_mask(size,rows):
    mask=Image.new('L',size,0);d=ImageDraw.Draw(mask)
    for y,span in rows.items():d.line((span[0],int(y),span[1],int(y)),fill=255)
    return mask


def crop_part(image,grip):
    box=image.getchannel('A').getbbox()
    if not box:return None
    return {'image':image.crop(box),'anchor':[grip[0]-box[0],grip[1]-box[1]],'nativeOffset':list(box[:2])}


def pack(parts,path,asset_id,assets):
    path.parent.mkdir(parents=True,exist_ok=True)
    # Tight single-row packing keeps small source layers from becoming large textures.
    width=max(1,sum(p['image'].width+1 for p in parts.values()))
    height=max([p['image'].height for p in parts.values()]+[1])
    atlas=Image.new('RGBA',(width,height),(0,0,0,0));x=0;result={}
    for name,p in parts.items():
        im=p['image'];atlas.alpha_composite(im,(x,0))
        result[name]={'asset':asset_id,'rect':[x,0,im.width,im.height],'anchor':p['anchor'],'depth':p.get('depth','front')}
        x+=im.width+1
    atlas.save(path);ps.write_source(path.with_suffix('.aseprite'),[atlas],[100],'editable-parts-atlas')
    assets[asset_id]={'path':path.relative_to(STUDY).as_posix() if path.is_relative_to(STUDY) else __import__('os').path.relpath(path,STUDY).replace('\\','/'),
                      'sha256':digest(path),'width':width,'height':height}
    return result


def plated(part):
    old=part['image'];size=(old.width+2,old.height+2)
    original_mask=Image.new('L',size,0);original_mask.paste(old.getchannel('A'),(1,1));mask=original_mask.filter(ImageFilter.MaxFilter(3))
    # Add a top/right knuckle rim, retaining the original wrist and lower contour.
    for y in range(size[1]):
        for x in range(size[0]):
            if not original_mask.getpixel((x,y)) and (x==0 or y==size[1]-1):mask.putpixel((x,y),0)
    im=Image.new('RGBA',size,(0,0,0,0));w,h=size
    for y in range(h):
        for x in range(w):
            if not mask.getpixel((x,y)):continue
            edge=any(not(0<=nx<w and 0<=ny<h) or not mask.getpixel((nx,ny)) for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
            color='#172029' if edge else '#8da3a6' if y<3 and 2<=x<w-4 else '#586e79' if y<h-3 else '#35434c'
            im.putpixel((x,y),ImageColor_getrgb(color)+(255,))
    # Native pixel plate, knuckle notches and a warm rivet. Deliberate shape and
    # material edits, rather than merely tinting the previous glove.
    for y in range(3,h-1,2):
        for x in range(max(0,w-3),w-1):
            if mask.getpixel((x,y)):im.putpixel((x,y),(30,43,52,255))
    for x,y,color in ((2,2,(216,229,222,255)),(3,3,(197,145,77,255)),(2,h-3,(141,163,166,255))):
        if 0<=x<w and 0<=y<h and mask.getpixel((x,y)):im.putpixel((x,y),color)
    front=Image.new('RGBA',size,(0,0,0,0))
    # The fingers cross in front of the gun; the broad palm sits behind its grip.
    for y in range(h):
        for x in range(w):
            if x>=w-4 or (y<=2 and x>=w//2):front.putpixel((x,y),im.getpixel((x,y)))
    anchor=[part['anchor'][0]+1,part['anchor'][1]+1]
    return {'image':im,'anchor':anchor,'depth':'back'},{'image':front,'anchor':anchor,'depth':'front'}


def ImageColor_getrgb(color):
    return tuple(bytes.fromhex(color[1:]))


def steel_cuff(part):
    source=part['image'];im=source.copy()
    for y in range(im.height):
        for x in range(im.width):
            pixel=source.getpixel((x,y))
            if not pixel[3] or x<max(0,im.width-2):continue
            if sum(pixel[:3])<110:continue
            im.putpixel((x,y),(151,171,169,255) if y<im.height//2 else (72,93,106,255))
    return {'image':im,'anchor':part['anchor'].copy(),'depth':'front'}


def main(pilot=False,reseed=False):
    STUDY.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
    old_path=STUDY/'metadata.json'
    previous=json.loads(old_path.read_text(encoding='utf-8')) if old_path.is_file() else {}
    ensure_sources_unchanged(previous,reseed)
    source=json.loads((BASE/'metadata.json').read_text(encoding='utf-8'))
    region_path=STUDY/'source/regions.json';regions=json.loads(region_path.read_text(encoding='utf-8'))['weapons']
    selected=[w for w in source['weapons'] if not pilot or w['id'] in ('scrap_pistol','needle_rifle')]
    assets={};rows=[];legacy_hands={};legacy_cuffs={};representatives={};repairs=[];group_refs={}
    for w in selected:
        wid=w['id'];region=regions[wid];original=Image.open(BASE/w['image']).convert('RGBA')
        size=original.size;protected=rows_mask(size,region.get('protectedWeapon',{}))
        labels={};layers={name:Image.new('RGBA',size,(0,0,0,0)) for name in ('primaryHand','supportHand','primaryCuff','supportCuff')}
        masks={name:rows_mask(size,region[name]) for name in layers}
        for y in range(size[1]):
            for x in range(size[0]):
                if not original.getpixel((x,y))[3] or protected.getpixel((x,y)):continue
                for name in ('primaryCuff','supportCuff','primaryHand','supportHand'):
                    if masks[name].getpixel((x,y)):
                        labels[x,y]=name;layers[name].putpixel((x,y),original.getpixel((x,y)));break
        bare=original.copy()
        for point in labels:bare.putpixel(point,(0,0,0,0))
        patch=Image.new('RGBA',size,(0,0,0,0));draw=ImageDraw.Draw(patch)
        for p in region['hiddenPatches']:draw.polygon([tuple(point) for point in p['polygon']],fill=p['color'])
        repaired=0
        for point in labels:
            pixel=patch.getpixel(point)
            if pixel[3]:bare.putpixel(point,pixel);repaired+=1
        weapon_folder=WEAPONS/wid;weapon_folder.mkdir(parents=True,exist_ok=True)
        bare.save(weapon_folder/'weapon-base.png');ps.write_source(weapon_folder/'weapon-base.aseprite',[bare],[100],'complete-weapon-no-hands')
        native_layers=[{'name':'complete-weapon','frames':[bare]}]+[{'name':name,'frames':[im]} for name,im in layers.items()]
        ps.write_layered_source(STUDY/'source'/(wid+'.aseprite'),native_layers,[100])
        # Verify preservation before publishing a modular data file.
        combined=bare.copy()
        for im in layers.values():combined.alpha_composite(im)
        if combined.tobytes()!=original.tobytes():raise ValueError('Default reconstruction differs: '+wid)
        references={}
        for name,im in layers.items():
            slot='primary' if name.startswith('primary') else 'support'
            part=crop_part(im,region[slot+'Grip'])
            if part:
                key=wid+'.'+slot
                target=legacy_hands if name.endswith('Hand') else legacy_cuffs
                target[key]=part;references[name]=key
            else:references[name]=None
        if wid in ('scrap_pistol','needle_rifle','coil_cannon'):
            representatives[region['family']]={slot:legacy_hands[wid+'.'+slot] for slot in ('primary','support')}
        asset_id='weapon.'+wid
        relative=__import__('os').path.relpath(weapon_folder/'weapon-base.png',STUDY).replace('\\','/')
        assets[asset_id]={'path':relative,'sha256':digest(weapon_folder/'weapon-base.png'),'width':size[0],'height':size[1]}
        rig=w['rig'];intrinsic={'width':size[0],'height':size[1],'pivot':rig['pivot'],'muzzle':rig['muzzle'],
            'primaryGrip':region['primaryGrip'],'supportGrip':region['supportGrip'],'family':region['family'],'asset':asset_id}
        combat={k:v for k,v in w.items() if k not in ('rig','image','source','sourceBox','importScale','sha256')}
        rows.append({'id':wid,'name':w['name'],'visual':intrinsic,'combat':combat,
                     'referenceImage':__import__('os').path.relpath(BASE/w['image'],STUDY).replace('\\','/'),
                     'referenceSha256':w['sha256'],'version':version({'rig':intrinsic,'image':assets[asset_id]['sha256']})})
        group_refs[wid]=references
        repairs.append({'id':wid,'repairedHiddenPixels':repaired,'originalVisiblePixelsPreserved':True,'defaultPixelsExact':True})
    hands_regions=pack(legacy_hands,HANDS/'ranger-cloth/poses.png','hands.ranger-cloth',assets)
    cuffs_regions=pack(legacy_cuffs,CUFFS/'ranger-coat/poses.png','cuffs.ranger-coat',assets)
    plated_parts={};plated_poses={}
    for family,parts in representatives.items():
        plated_poses[family]={}
        for slot,part in parts.items():
            back,front=plated(part)
            for depth,p in [('back',back),('front',front)]:plated_parts[family+'.'+slot+'.'+depth]=p
            plated_poses[family][slot]=[family+'.'+slot+'.back',family+'.'+slot+'.front']
    plate_regions=pack(plated_parts,HANDS/'plated-test/poses.png','hands.plated-test',assets)
    steel_parts={name:steel_cuff(p) for name,p in legacy_cuffs.items()}
    steel_regions=pack(steel_parts,CUFFS/'steel-test/poses.png','cuffs.steel-test',assets)
    old_overrides={};cuff_overrides={};steel_overrides={}
    for wid,ref in group_refs.items():
        old_overrides[wid]={slot:[hands_regions[ref[slot+'Hand']]] for slot in ('primary','support')}
        cuff_overrides[wid]={slot:[cuffs_regions[ref[slot+'Cuff']]] if ref[slot+'Cuff'] else [] for slot in ('primary','support')}
        steel_overrides[wid]={slot:[steel_regions[ref[slot+'Cuff']]] if ref[slot+'Cuff'] else [] for slot in ('primary','support')}
    plate_poses={family:{slot:[plate_regions[key] for key in parts] for slot,parts in slots.items()} for family,slots in plated_poses.items()}
    representatives_by_family={regions[w['id']]['family']:w['id'] for w in selected if w['id'] in ('scrap_pistol','needle_rifle','coil_cannon')}
    cloth_poses={family:old_overrides[wid] for family,wid in representatives_by_family.items()}
    coat_poses={family:cuff_overrides[wid] for family,wid in representatives_by_family.items()}
    steel_poses={family:steel_overrides[wid] for family,wid in representatives_by_family.items()}
    hand_sets={'ranger-cloth':{'id':'ranger-cloth','label':'原布手套（逐像素兼容）','overrides':old_overrides,'poses':cloth_poses},
               'plated-test':{'id':'plated-test','label':'较宽金属护手（结构测试）','overrides':{},'poses':plate_poses}}
    cuff_sets={'ranger-coat':{'id':'ranger-coat','label':'原沙色袖口','overrides':cuff_overrides,'poses':coat_poses},
               'steel-test':{'id':'steel-test','label':'钢灰护腕（结构测试）','overrides':steel_overrides,'poses':steel_poses}}
    for profile,asset_id in [(hand_sets['ranger-cloth'],'hands.ranger-cloth'),(hand_sets['plated-test'],'hands.plated-test'),
                             (cuff_sets['ranger-coat'],'cuffs.ranger-coat'),(cuff_sets['steel-test'],'cuffs.steel-test')]:
        profile['version']=version({'profile':profile,'atlasSha256':assets[asset_id]['sha256']})
    hold={w['id']:{k:v for k,v in w['rig'].items() if k not in ('width','height','pivot','muzzle','recoil')} for w in selected}
    character={'id':'ranger.compact.v1','body':source['body'],'bodyAtlas':'../compact-motion-v1/body-atlas.png',
               'holdByWeapon':hold,'holdByFamily':{family:hold[wid] for family,wid in representatives_by_family.items()},'defaultHands':'ranger-cloth','defaultCuffs':'ranger-coat'}
    data={'schemaVersion':1,'date':'2026-10-27','baseline':'7510e71','assets':assets,'weapons':rows,
          'handSets':hand_sets,'cuffSets':cuff_sets,'characters':{character['id']:character},'defaultCharacter':character['id'],
          'defaultWeapon':'scrap_pistol','defaultHands':'ranger-cloth','defaultCuffs':'ranger-coat',
          'sourceRegionsSha256':digest(region_path),'migration':repairs,'pilot':pilot,
          'visualApprovedForNewHands':False,'mainGameArtIntegrated':False}
    data['sharedBodySha256']=digest((STUDY/character['bodyAtlas']).resolve())
    source_hashes={}
    for a in assets.values():
        editable=(STUDY/a['path']).resolve().with_suffix('.aseprite')
        source_hashes[editable.relative_to(ROOT).as_posix()]=digest(editable)
    data['editableSourceHashes']=source_hashes
    data['migrationSeedSourceHashes']=source_hashes.copy()
    data['migrationSeedConfigHash']=authoring_digest(data)
    (STUDY/'metadata.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    (STUDY/'modular-data.js').write_text('window.MODULAR_GRIP_DATA = '+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
    # Native source inspection, all layers kept separate and editable.
    column_width=max(w['visual']['width'] for w in rows)*10+20
    row_height=max(w['visual']['height'] for w in rows)*10+40
    board=Image.new('RGBA',(column_width*2,len(rows)*row_height),(30,39,44,255));d=ImageDraw.Draw(board)
    for i,row in enumerate(rows):
        wid=row['id'];w,h=row['visual']['width'],row['visual']['height']
        for col,p in enumerate((BASE/next(x['image'] for x in selected if x['id']==wid),WEAPONS/wid/'weapon-base.png')):
            im=Image.open(p).convert('RGBA').resize((w*10,h*10),Image.Resampling.NEAREST)
            board.alpha_composite(im,(col*column_width,i*row_height+24))
        d.text((5,i*row_height+2),wid+' | original / complete weapon',fill='#edc28a')
    board.save(OUTPUT/'weapon-bases.png')
    print(json.dumps({'weapons':len(rows),'sourceLayers':5,'defaultReconstructionExact':True,'handSets':len(hand_sets),'cuffSets':len(cuff_sets)}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--pilot',action='store_true');parser.add_argument('--reseed',action='store_true');args=parser.parse_args();main(args.pilot,args.reseed)
