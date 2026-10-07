"""Export gate for the current native review assets; never visual approval."""
from pathlib import Path
import hashlib,json
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]


def verify_candidate(data):
    sheet=Image.open(ROOT/data['atlasPath']).convert('RGBA')
    assert list(sheet.size)==data['atlasSize']
    for key,path_key in (('atlasSha256','atlasPath'),('nativeSha256','nativePath'),('gifSha256','gifPath')):
        assert hashlib.sha256((ROOT/data[path_key]).read_bytes()).hexdigest().upper()==data[key]
    palette={tuple(bytes.fromhex(c[1:])) for c in data['opaquePalette']}
    seen=set()
    for row in data['frames']:
        x,y,w,h=row['rect'];assert x>=0 and y>=0 and w>0 and h>0 and x+w<=sheet.width and y+h<=sheet.height
        assert len(row['root'])==2 and 0<=row['root'][0]<=w and 0<=row['root'][1]<=h
        assert isinstance(row['durationMs'],int) and 0<row['durationMs']<=1000
        frame=sheet.crop((x,y,x+w,y+h));assert frame.getchannel('A').getbbox()
        assert set(frame.getchannel('A').getdata()).issubset({0,255})
        assert {p[:3] for p in frame.getdata() if p[3]}.issubset(palette)
        seen.add(hashlib.sha256(frame.tobytes()).hexdigest())
    count=data.get('sourceFrames',8)
    assert 1<=count<=128 and len(seen)==len(data['frames'])==count
    gif=Image.open(ROOT/data['gifPath']);assert gif.n_frames==count
    for index,row in enumerate(data['frames']):
        gif.seek(index);assert gif.info['duration']==row['durationMs']
    assert data['exportFilesComplete'] and data['nativeRoundtripExact']
    assert not data['visualApproved'] and not data['runtimeIntegrated'] and not data['complete']
    return {'frames':count,'distinctFrames':count,'binaryAlpha':True,'paletteValid':True,'hashesValid':True,
            'gifTimingValid':True,'nativeRoundtripExact':True,'visualApproved':False,'runtimeIntegrated':False}


def main():
    density=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())
    for c in density['candidates']:
        p=ROOT/c['pngPath'];image=Image.open(p).convert('RGBA')
        assert list(image.size)==c['canvas'] and c['worldScale'] in (1,2)
        assert c['workingBodyPixels']*c['worldScale']==76
        assert hashlib.sha256(p.read_bytes()).hexdigest().upper()==c['pngSha256']
        assert c['editorRoundtripExact']
    versions={}
    for version in ('v1','v2','v3'):
        path=ROOT/f'art/animation/ranger/pixel-source/run-candidate-{version}/metadata.json'
        if path.is_file(): versions[version]=verify_candidate(json.loads(path.read_text()))
    assert 'v1' in versions
    proof={'date':'2026-10-07' if 'v3' in versions else '2026-10-02','densityCandidates':2,'runVersions':versions,
           'role':'file/source gate only; contact/gait/identity review pending'}
    (ROOT/f"docs/qa/native-pixel-review-assets-{proof['date']}.json").write_text(json.dumps(proof,indent=2),encoding='utf-8')
    print(json.dumps(proof))


if __name__=='__main__': main()
