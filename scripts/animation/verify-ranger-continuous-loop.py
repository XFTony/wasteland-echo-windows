"""Check periodic joints, stance movement, pixel seam and layered export."""
from pathlib import Path
import importlib.util,json,math,hashlib,statistics
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('motion',Path(__file__).with_name('build-ranger-continuous-run.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def vector(phase):
    state=m.pose(phase);out=list(state['bodyOffset'])
    for name in ('far','near'):
        leg=state['legs'][name]
        for key in ('hip','knee','ankle'): out.extend(leg[key])
        out.append(leg['roll'])
    return out


def pixel_change(a,b):
    changed=union=0
    for p,q in zip(a.getdata(),b.getdata()):
        if p[3] or q[3]:
            union+=1;changed+=p!=q
    return changed/max(1,union)


def main():
    meta=json.loads((m.OUT/'metadata.json').read_text())
    source=Image.open(m.SOURCE).convert('RGBA');parts=m.setup_parts(source)
    a=m.render(source,parts,0)[0];b=m.render(source,parts,1)[0]
    if a.tobytes()!=b.tobytes(): raise AssertionError('Endpoint pixel mismatch')
    epsilon=1e-6;v0=vector(0);v_before=vector(-epsilon);v_after=vector(epsilon)
    left=[(c-p)/epsilon for p,c in zip(v_before,v0)]
    right=[(n-c)/epsilon for c,n in zip(v0,v_after)]
    velocity_gap=max(abs(l-r) for l,r in zip(left,right))
    if velocity_gap>.02: raise AssertionError(f'Loop tangent gap {velocity_gap}')
    max_length_error=0;max_support_error=0;max_quantized_support_error=0;minimum_bend=180
    contact_origins={}
    for i in range(1001):
        phase=i/1000;state=m.pose(phase)
        for name,leg in state['legs'].items():
            h,k,a=leg['hip'],leg['knee'],leg['ankle']
            lengths=[math.dist(h,k),math.dist(k,a)]
            max_length_error=max(max_length_error,abs(lengths[0]-m.L1),abs(lengths[1]-m.L2))
            d=math.dist(h,a);bend=math.degrees(math.acos(max(-1,min(1,(d*d-m.L1*m.L1-m.L2*m.L2)/(2*m.L1*m.L2)))))
            minimum_bend=min(minimum_bend,bend)
            if leg['contact']:
                cycle=math.floor(phase+(.5 if name=='far' else 0))
                key=(name,cycle);world_x=a[0]+phase*m.CYCLE_DISTANCE
                first=contact_origins.setdefault(key,world_x)
                max_support_error=max(max_support_error,abs(world_x-first))
                quantized=round(a[0])+phase*m.CYCLE_DISTANCE
                max_quantized_support_error=max(max_quantized_support_error,abs(quantized-first))
    if max_length_error>1e-8 or max_support_error>1e-8 or max_quantized_support_error>.501:
        raise AssertionError('Joint length / planted foot drift')
    if minimum_bend<10: raise AssertionError('Overextended knee')
    atlas=Image.open(ROOT/meta['atlasPath']).convert('RGBA');frames=[]
    for row in meta['frames']:
        x,y,w,h=row['rect'];frames.append(atlas.crop((x,y,x+w,y+h)))
    transitions=[pixel_change(frame,frames[(i+1)%len(frames)]) for i,frame in enumerate(frames)]
    seam=transitions[-1];interior=transitions[:-1]
    if seam>statistics.median(interior)+.10: raise AssertionError('Seam is an abnormal transition spike')
    if m.render(source,parts,.95)[0].tobytes()==frames[0].tobytes(): raise AssertionError('Duplicated closing frame')
    old=json.loads((ROOT/'art/animation/ranger/pixel-source/run-candidate-v2/metadata.json').read_text())
    old_atlas=Image.open(ROOT/old['atlasPath']).convert('RGBA');old_frames=[]
    for row in old['frames']:
        x,y,w,h=row['rect'];old_frames.append(old_atlas.crop((x,y,x+w,y+h)))
    result={'date':'2026-10-07','frames':len(frames),'totalDurationMs':sum(f['durationMs'] for f in meta['frames']),
            'uniqueRasterFrames':len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}),
            'loopEndpointPixelsExact':True,'duplicateEndpointPlayed':False,
            'maxLoopVelocityGapPixelsPerCycle':velocity_gap,'maxBoneLengthErrorPixels':max_length_error,
            'minimumKneeBendDegrees':minimum_bend,'maxPlantedWorldFootErrorPixels':max_support_error,
            'maxQuantizedFootErrorPixels':max_quantized_support_error,
            'seamChangedForegroundFraction':seam,'medianInteriorChangedForegroundFraction':statistics.median(interior),
            'maxInteriorChangedForegroundFraction':max(interior),
            'oldEightFrameSeamChangedForegroundFraction':pixel_change(old_frames[-1],old_frames[0]),
            'renderedLayers':meta['layerNames'],'visualApproved':False,'runtimeIntegrated':False}
    (ROOT/'docs/qa/ranger-continuous-loop-2026-10-07.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__': main()
