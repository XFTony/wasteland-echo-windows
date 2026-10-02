"""Convert a generated key-pose study to a native-grid review candidate.

One shared scale, declared head alignment, fixed palette and root are applied.
This does NOT prove gait physics, hand-retouch or runtime readiness. All eight
frames originate from distinct drawings; no translated static pose is looped.
"""
from pathlib import Path
import importlib.util,json,hashlib,statistics
import argparse
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ps',Path(__file__).with_name('pixel-source-tools.py'))
ps=importlib.util.module_from_spec(spec);spec.loader.exec_module(ps)
SOURCE=ROOT/'art/animation/ranger/pixel-source/ranger-run-keyposes-study-v1.png'
OUT=ROOT/'art/animation/ranger/pixel-source/run-candidate-v1'
PREVIEW=ROOT/'output/animation/ranger/pixel-run-candidate-v1'


def main(version='v1'):
    global SOURCE,OUT,PREVIEW
    SOURCE=ROOT/f'art/animation/ranger/pixel-source/ranger-run-keyposes-study-{version}.png'
    OUT=ROOT/f'art/animation/ranger/pixel-source/run-candidate-{version}'
    PREVIEW=ROOT/f'output/animation/ranger/pixel-run-candidate-{version}'
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'metadata.json').write_text(json.dumps({'date':'2026-10-02','sourceRevision':version,
        'exportFilesComplete':False,'complete':False,'visualApproved':False,'runtimeIntegrated':False,
        'rebuildStatus':'building'},indent=2),encoding='utf-8')
    review=ROOT/'output/animation/ranger/pixel-production-review/review.html'
    if review.is_file() and (version=='v2' or not (ROOT/'art/animation/ranger/pixel-source/run-candidate-v2/metadata.json').is_file()):
        review.write_text('<!doctype html><meta charset="utf-8"><p>动作候选正在重建。完整导出检查通过后重新生成评审页。</p>',encoding='utf-8')
    source=Image.open(SOURCE).convert('RGBA')
    if source.size!=(1536,1024): raise ValueError('Expected 4x2 layout, 1536x1024')
    palette=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())['palette']
    colors=[tuple(bytes.fromhex(c[1:])) for c in palette]
    cells=[];hood_centers=[];boxes=[]
    for index in range(8):
        col,row=index%4,index//4
        cell=source.crop((col*384,row*512,(col+1)*384,(row+1)*512))
        box=cell.getchannel('A').point(lambda a:255 if a>=200 else 0).getbbox()
        if not box or box[0]<=5 or box[2]>=379 or box[1]<=5 or box[3]>=507:
            raise ValueError(f'Empty or clipped study cell {index+1}: {box}')
        hood=[]
        for y in range(box[1],min(box[1]+75,cell.height)):
            for x in range(box[0],box[2]):
                r,g,b,a=cell.getpixel((x,y))
                if a>=200 and r>80 and .5*r<g<.95*r and .15*r<b<.85*r:
                    hood.append(x)
        if not hood: raise ValueError(f'Hood alignment unavailable for {index+1}')
        cells.append(cell);boxes.append(box);hood_centers.append(statistics.mean(hood))
    # Shared scale across all poses; never scale every bounding box to 76px.
    scale=76/statistics.median(b[3]-b[1] for b in boxes)
    source_root_y=476
    reference_hood=statistics.median(hood_centers)
    source_root_x=reference_hood-22
    root=(64,110);native_size=(128,128)
    frames=[];rows=[];color_cache={}
    for index,cell in enumerate(cells):
        frame=Image.new('RGBA',native_size,(0,0,0,0))
        shift=hood_centers[index]-reference_hood
        for y in range(native_size[1]):
            sy=round((y-root[1])/scale+source_root_y)
            if not 0<=sy<512: continue
            for x in range(native_size[0]):
                sx=round((x-root[0])/scale+source_root_x+shift)
                if not 0<=sx<384: continue
                r,g,b,a=cell.getpixel((sx,sy))
                if a<200: continue
                color=(r,g,b)
                if color not in color_cache:
                    color_cache[color]=min(colors,key=lambda c:sum((p-q)**2 for p,q in zip(color,c)))
                frame.putpixel((x,y),(*color_cache[color],255))
        frames.append(frame)
        rows.append({'index':index,'durationMs':50,'root':list(root),
                     'sourceCell':[index%4*384,index//4*512,384,512],
                     'sourceOpaqueBox':list(boxes[index]),'sourceHoodCenterX':round(hood_centers[index],3),
                     'alignmentShiftSourcePixels':round(shift,3),'opaqueBox':list(frame.getchannel('A').getbbox())})
    if len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})!=8:
        raise ValueError('Eight distinct native poses required')
    OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
    native=OUT/f'ranger-run-candidate-{version}.aseprite'
    atlas=OUT/f'ranger-run-candidate-{version}.png'
    export=PREVIEW/'editor-export.json'
    ps.write_source(native,frames,[50]*8,'generated-pose-candidate')
    ps.run_editor([native,'--sheet',atlas,'--sheet-type','horizontal','--data',export,'--format','json-array'])
    exported=json.loads(export.read_text());sheet=Image.open(atlas).convert('RGBA')
    if len(exported['frames'])!=8: raise ValueError('Editor exported wrong frame count')
    for expected,row,native_row in zip(frames,exported['frames'],rows):
        rect=row['frame'];actual=sheet.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']))
        if actual.tobytes()!=expected.tobytes() or row['duration']!=50: raise ValueError('Editor export mismatch')
        native_row['rect']=[rect[k] for k in ('x','y','w','h')]
    gif_palette=[0,0,0]+[channel for c in colors for channel in c]
    gif_palette+= [0]*(768-len(gif_palette))
    color_ids={c:i+1 for i,c in enumerate(colors)}
    gifs=[]
    for image in frames:
        p=Image.new('P',native_size,0);p.putpalette(gif_palette)
        p.putdata([color_ids[pixel[:3]] if pixel[3] else 0 for pixel in image.getdata()])
        p.info['transparency']=0;gifs.append(p)
    gif=OUT/f'ranger-run-candidate-{version}.gif'
    gifs[0].save(gif,save_all=True,append_images=gifs[1:],duration=[50]*8,loop=0,transparency=0,disposal=2,optimize=False)
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
    metadata={'date':'2026-10-02','sourceRevision':version,'role':'generated key-pose native review candidate',
              'source':SOURCE.relative_to(ROOT).as_posix(),'sourceSha256':sha(SOURCE),
              'nativePath':native.relative_to(ROOT).as_posix(),'atlasPath':atlas.relative_to(ROOT).as_posix(),
              'gifPath':gif.relative_to(ROOT).as_posix(),'canvas':list(native_size),'atlasSize':list(sheet.size),
              'opaquePalette':palette,'paletteColors':len(palette),'frames':rows,'root':list(root),
              'referenceWorkingBodyPixels':76,'worldScale':1,'sharedStudyScale':scale,
              'alphaThreshold':200,'headAlignmentMethod':'upper warm hood centroid, shared scale and fixed root',
              'sourceFrames':8,'totalDurationMs':400,'nativeRoundtripExact':True,
              'atlasSha256':sha(atlas),'nativeSha256':sha(native),'gifSha256':sha(gif),
              'assetBytes':atlas.stat().st_size,'decodedRGBABytes':sheet.width*sheet.height*4,
              'handRetouched':False,'bakedWeapon':True,'visualApproved':False,'runtimeIntegrated':False,
              'complete':False,'exportFilesComplete':True,'rebuildStatus':'exported-review-only',
              'pending':['human leg support and phase review','loop seam and identity consistency',
                         'foot contact and stride measurement','editable body/weapon layers','continuous aim']}
    (OUT/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(json.dumps({'frames':len(frames),'nativeRoundtripExact':True,'durationMs':400,
                      'atlasSize':sheet.size,'bytes':atlas.stat().st_size,'decodedRGBABytes':metadata['decodedRGBABytes'],
                      'visualApproved':False,'runtimeIntegrated':False}))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--version',choices=['v1','v2'],default='v1')
    main(parser.parse_args().version)
