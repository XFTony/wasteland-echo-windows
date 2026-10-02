"""Build density/color drafts in the selected 2D source workflow.

These are deliberate reference conversions for C03, not finished hand-retouched
character art, separated clothing layers or animated poses. Resize is performed
by the pixel editor; source palette mapping is explicit and reproducible.
"""
from pathlib import Path
import hashlib,importlib.util,json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pixel_source_tools',Path(__file__).with_name('pixel-source-tools.py'))
tools=importlib.util.module_from_spec(spec);spec.loader.exec_module(tools)
SOURCE=ROOT/'art/animation/ranger/pixel-lookdev/ranger-pixel-sidearm-v1.png'
DEST=ROOT/'art/animation/ranger/pixel-source'
TEMP=ROOT/'output/animation/ranger/pixel-density-v1'
PALETTE=[
    '#17110e','#231a16','#2f231b','#3f2b1f','#4f3420','#5e3e23','#6f4a29',
    '#825a31','#95683d','#ab7d4d','#c39867','#d6b281','#e6c799','#f7dcab',
    '#3e180e','#581f0e','#792c10','#993a11','#b84c16','#d96c21','#f39539',
    '#201f1f','#2e2c2a','#3e3b36','#514c44','#665f53','#827968','#9c917d',
    '#b6ac97','#d2cab2','#eee7d0','#b96c36',
]
RGB=[tuple(bytes.fromhex(c[1:])) for c in PALETTE]


def main():
    DEST.mkdir(parents=True,exist_ok=True);TEMP.mkdir(parents=True,exist_ok=True)
    reference=Image.open(SOURCE).convert('RGBA')
    box=reference.getchannel('A').point(lambda a:255 if a>=16 else 0).getbbox()
    if not box: raise ValueError('Empty source')
    width,height=box[2]-box[0],box[3]-box[1]
    crop=','.join(map(str,[box[0],box[1],width,height]))
    cropped=TEMP/'editor-reference-cropped.png'
    # LibreSprite crop is an export operation; resize in a second editor pass so
    # it uses the cropped document rather than the original full-canvas bounds.
    tools.run_editor([SOURCE,'--crop',crop,'--save-as',cropped])
    metadata={'date':'2026-10-01','reference':SOURCE.relative_to(ROOT).as_posix(),
              'referenceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper(),
              'role':'density and palette studies, not finished actor source',
              'paletteOpaqueColors':len(PALETTE),'palette':PALETTE,'runtimeIntegrated':False,
              'visualApproved':False,'handRetouched':False,'bakedWeapon':True,'candidates':[]}
    for requested,canvas_size,base_y in ((38,(64,96),84),(76,(128,128),110)):
        resized=TEMP/f'editor-resized-{requested}.png'
        factor=requested/height+0.000001
        tools.run_editor([cropped,'--scale',str(factor),'--save-as',resized])
        image=Image.open(resized).convert('RGBA')
        if image.height!=requested: raise AssertionError(f'Editor resize: expected {requested}, got {image.size}')
        native=Image.new('RGBA',canvas_size,(0,0,0,0))
        left=(canvas_size[0]-image.width)//2;top=base_y-image.height
        color_cache={}
        for y in range(image.height):
            for x in range(image.width):
                r,g,b,a=image.getpixel((x,y))
                if a<128: continue
                color=(r,g,b)
                if color not in color_cache:
                    color_cache[color]=min(RGB,key=lambda p:sum((v-q)**2 for v,q in zip(color,p)))
                native.putpixel((left+x,top+y),(*color_cache[color],255))
        token=f'ranger-density-{requested}-v1'
        editable=DEST/(token+'.aseprite');target=DEST/(token+'.png')
        tools.write_source(editable,[native],[1000],'reference-draft')
        tools.run_editor([editable,'--save-as',target])
        output=Image.open(target).convert('RGBA')
        if output.tobytes()!=native.tobytes(): raise AssertionError('Native editor round-trip changed pixels')
        actual_bbox=output.getchannel('A').getbbox()
        opaque={p[:3] for p in output.getdata() if p[3]}
        if not opaque.issubset(set(RGB)): raise AssertionError('Palette mismatch')
        if set(output.getchannel('A').getdata())!={0,255}: raise AssertionError('Unexpected alpha')
        metadata['candidates'].append({
            'id':f'study.ranger.pixel-density-{requested}.v1','nativePath':editable.relative_to(ROOT).as_posix(),
            'pngPath':target.relative_to(ROOT).as_posix(),'canvas':list(canvas_size),'bbox':list(actual_bbox),
            'bodyPixels':actual_bbox[3]-actual_bbox[1],'root':[canvas_size[0]//2,base_y],
            'workingBodyPixels':requested,'referenceBodyWorldUnits':76,'worldScale':76/requested,
            'usedOpaqueColors':len(opaque),'layerNames':['reference-draft'],'sourceFrames':1,
            'pngBytes':target.stat().st_size,'pngSha256':hashlib.sha256(target.read_bytes()).hexdigest().upper(),
            'nativeSha256':hashlib.sha256(editable.read_bytes()).hexdigest().upper(),
            'example200FramesRGBABytes':200*canvas_size[0]*canvas_size[1]*4,
            'editorRoundtripExact':True,
        })
    (DEST/'density-study-v1.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(json.dumps({'candidates':metadata['candidates'],'opaquePaletteColors':len(PALETTE),'role':metadata['role']}))


if __name__=='__main__': main()
