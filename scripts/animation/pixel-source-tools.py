"""Small native-source bridge and portable editor probe, not an animation editor.

Writes one-layer RGBA Aseprite drafts and validates them with LibreSprite. Only
known project-local tool paths are used; editor configuration is redirected for
this child process alone. Diagnostic pixels are never registered as game art.
"""
from pathlib import Path
import os, struct, subprocess, zlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / 'output/tooling/libresprite-v1.1/portable/libresprite.exe'
TOOL_DATA = ROOT / 'output/tooling/libresprite-v1.1/userdata'


def chunk(kind, payload):
    return struct.pack('<IH',len(payload)+6,kind)+payload


def write_source(path, frames, durations, layer_name='draft'):
    """Minimal documented RGBA Aseprite source with one editable raster layer.

    More complex source layers should be authored in the selected editor. This
    bridge only covers import / exact export and doesn't invent human poses.
    """
    if not frames or len(frames)!=len(durations):
        raise ValueError('Every frame needs one duration')
    size=frames[0].size
    if any(im.size!=size for im in frames): raise ValueError('Shared canvas required')
    if any(not 1<=duration<=65535 for duration in durations): raise ValueError('Invalid duration')
    name=layer_name.encode('utf-8')
    layer=chunk(0x2004,struct.pack('<6HB3sH',1,0,0,0,0,0,255,b'\0'*3,len(name))+name)
    bodies=[]
    for i,(image,duration) in enumerate(zip(frames,durations)):
        pixels=image.convert('RGBA').tobytes()
        cel_payload=struct.pack('<HhhBHh5sHH',0,0,0,255,2,0,b'\0'*5,*size)+zlib.compress(pixels)
        chunks=([layer] if i==0 else [])+[chunk(0x2005,cel_payload)]
        payload=b''.join(chunks)
        bodies.append(struct.pack('<IHHH2sI',16+len(payload),0xF1FA,len(chunks),duration,b'\0\0',len(chunks))+payload)
    header=bytearray(128)
    struct.pack_into('<IHHHHHI',header,0,128+sum(map(len,bodies)),0xA5E0,len(frames),*size,32,1)
    struct.pack_into('<H',header,18,durations[0])
    struct.pack_into('<HBBhhHH',header,32,0,1,1,0,0,16,16)
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(bytes(header)+b''.join(bodies))


def write_layered_source(path, layers, durations):
    """Write visible, separately editable layers with identical frame canvases."""
    if not layers or not durations: raise ValueError('Layers and durations required')
    count=len(durations);size=layers[0]['frames'][0].size
    if any(len(layer['frames'])!=count for layer in layers): raise ValueError('Layer frame count mismatch')
    if any(image.size!=size for layer in layers for image in layer['frames']): raise ValueError('Layer canvas mismatch')
    if any(not 1<=duration<=65535 for duration in durations): raise ValueError('Invalid duration')
    names=[layer['name'] for layer in layers]
    if len(names)!=len(set(names)): raise ValueError('Duplicate layer name')
    layer_chunks=[]
    for name in names:
        encoded=name.encode('utf-8')
        layer_chunks.append(chunk(0x2004,struct.pack('<6HB3sH',1,0,0,0,0,0,255,b'\0'*3,len(encoded))+encoded))
    bodies=[]
    for i,duration in enumerate(durations):
        pieces=list(layer_chunks) if i==0 else []
        for index,layer in enumerate(layers):
            rgba=layer['frames'][i].convert('RGBA').tobytes()
            payload=struct.pack('<HhhBHh5sHH',index,0,0,255,2,0,b'\0'*5,*size)+zlib.compress(rgba)
            pieces.append(chunk(0x2005,payload))
        payload=b''.join(pieces)
        bodies.append(struct.pack('<IHHH2sI',16+len(payload),0xF1FA,len(pieces),duration,b'\0\0',len(pieces))+payload)
    header=bytearray(128)
    struct.pack_into('<IHHHHHI',header,0,128+sum(map(len,bodies)),0xA5E0,count,*size,32,1)
    struct.pack_into('<H',header,18,durations[0]);struct.pack_into('<HBBhhHH',header,32,0,1,1,0,0,16,16)
    target=Path(path);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(bytes(header)+b''.join(bodies))


def run_editor(arguments):
    if not TOOL.is_file(): raise FileNotFoundError(f'Project-local LibreSprite missing: {TOOL}')
    TOOL_DATA.mkdir(parents=True,exist_ok=True)
    env=os.environ.copy()
    for key in list(env):
        if key.lower()=='appdata': del env[key]
    env['AppData']=str(TOOL_DATA)
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    result=subprocess.run([str(TOOL),'--batch',*map(str,arguments)],cwd=ROOT,env=env,
                          stdin=subprocess.DEVNULL,capture_output=True,timeout=45,creationflags=flags)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8',errors='replace') or result.stdout.decode('utf-8',errors='replace'))
    return result.stdout.decode('utf-8',errors='replace').strip()


if __name__=='__main__':
    import hashlib,json
    output=ROOT/'output/animation/ranger/pixel-source-probe'
    output.mkdir(parents=True,exist_ok=True)
    frames=[]
    for x,color in ((1,(240,72,48,255)),(5,(48,152,240,255))):
        image=Image.new('RGBA',(8,8),(0,0,0,0))
        for y in range(2,6):
            for dx in range(2): image.putpixel((x+dx,y),color)
        frames.append(image)
    source=output/'two-frame-probe.aseprite'
    sheet=output/'two-frame-probe.png'
    data=output/'two-frame-probe.json'
    write_source(source,frames,[80,120],'diagnostic')
    version=run_editor(['--version'])
    run_editor([source,'--sheet',sheet,'--sheet-type','horizontal','--data',data,'--format','json-array'])
    exported=json.loads(data.read_text(encoding='utf-8'))
    assert len(exported['frames'])==2
    atlas=Image.open(sheet).convert('RGBA')
    for expected,frame,duration in zip(frames,exported['frames'],[80,120]):
        rect=frame['frame']
        actual=atlas.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']))
        assert actual.size==expected.size and actual.tobytes()==expected.tobytes()
        assert frame['duration']==duration
    proof={'date':'2026-10-01','toolVersion':version,'nativeFormat':'Aseprite RGBA',
           'sourceFrames':2,'durationsMs':[80,120],'pixelsExact':True,'alphaExact':True,
           'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest().upper(),
           'toolBinarySha256':hashlib.sha256(TOOL.read_bytes()).hexdigest().upper(),
           'configurationPath':TOOL_DATA.relative_to(ROOT).as_posix(),
           'role':'tool diagnostic only, not character animation','runtimeIntegrated':False}
    (ROOT/'docs/qa/pixel-source-tool-verification-2026-10-01.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
    print(json.dumps(proof))
