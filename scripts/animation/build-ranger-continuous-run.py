"""Authored periodic joint animation on existing native ranger artwork.

Shared upper-body / boots / garment parts remove identity drift. Continuous
foot trajectories and fixed-length two-bone joints create true intermediate
poses, including the wrap segment. No alpha dissolve or repeated end frame.
"""
from pathlib import Path
import hashlib,importlib.util,json,math
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ps',Path(__file__).with_name('pixel-source-tools.py'))
ps=importlib.util.module_from_spec(spec);spec.loader.exec_module(ps)
OUT=ROOT/'art/animation/ranger/pixel-source/run-candidate-v3'
PREVIEW=ROOT/'output/animation/ranger/pixel-run-candidate-v3'
SOURCE=ROOT/'art/animation/ranger/pixel-source/ranger-density-76-v1.png'
COUNT=20;DURATION=20;PERIOD_MS=400;SIZE=(128,128);ROOT_POINT=(64,110)
REACH=11.0;CONTACT=.4;CYCLE_DISTANCE=2*REACH/CONTACT
L1=15.5;L2=15.0
BOOT_ANCHORS={'far':(55,103),'near':(74,96)}
BOOT_SOLE_OFFSETS={'far':6,'near':7}


def periodic_curve(phase,xs,ys):
    p=phase%1;count=len(xs)
    i=max(j for j,x in enumerate(xs) if x<=p)
    j=(i+1)%count;x0=xs[i];x1=xs[j]+(1 if j==0 else 0)
    previous=(i-1)%count;following=(j+1)%count
    xp=xs[previous]-(1 if previous>=i else 0)
    xn=xs[j]+(1 if j<=i else 0)
    jp=xs[i];jn=xs[following]+(1 if following<=j else 0)
    if j==0: jp-=1
    m0=(ys[j]-ys[previous])/(xn-xp)
    m1=(ys[following]-ys[i])/(jn-jp)
    t=(p-x0)/(x1-x0);span=x1-x0
    return (2*t**3-3*t*t+1)*ys[i]+(t**3-2*t*t+t)*span*m0+(-2*t**3+3*t*t)*ys[j]+(t**3-t*t)*span*m1


def foot_motion(phase):
    u=phase%1
    if u<=CONTACT:
        return {'x':REACH-2*REACH*u/CONTACT,'lift':0.0,'roll':0.0,'contact':True,'phase':u}
    t=(u-CONTACT)/(1-CONTACT);m=-2*REACH/CONTACT*(1-CONTACT)
    x=(2*t**3-3*t*t+1)*-REACH+(t**3-2*t*t+t)*m+(-2*t**3+3*t*t)*REACH+(t**3-t*t)*m
    lift=8.5*math.sin(math.pi*t)**2
    roll=-12*math.sin(math.pi*t)**2+4*math.sin(2*math.pi*t)*math.sin(math.pi*t)**2
    return {'x':x,'lift':lift,'roll':roll,'contact':False,'phase':u}


def solve_knee(hip,ankle):
    dx,dy=ankle[0]-hip[0],ankle[1]-hip[1];d=math.hypot(dx,dy)
    if not abs(L1-L2)+.001<d<L1+L2-.001: raise ValueError(f'Unreachable leg target: {d}')
    along=(L1*L1-L2*L2+d*d)/(2*d);height=math.sqrt(max(0,L1*L1-along*along))
    return (hip[0]+dx/d*along+dy/d*height,hip[1]+dy/d*along-dx/d*height)


def pose(phase):
    p=phase%1
    bob=periodic_curve((p*2)%1,[0,.2,.5,.84],[.5,1.2,0,-.8])
    sway=.45*math.sin(math.tau*p)
    result={'phase':p,'bodyOffset':[sway,bob],'legs':{}}
    for name,offset,hip_x,ankle_x,ground in (('far',.5,60,61,107),('near',0,65,67,110)):
        foot=foot_motion(p+offset);hip=(hip_x+sway,77+bob)
        ankle=(ankle_x+foot['x'],ground-BOOT_SOLE_OFFSETS[name]-foot['lift'])
        knee=solve_knee(hip,ankle)
        result['legs'][name]={'hip':list(hip),'knee':list(knee),'ankle':list(ankle),
                             'soleReference':[ankle[0],ground-foot['lift']],**foot}
    return result


def mask_part(source,polygon):
    mask=Image.new('L',SIZE,0);ImageDraw.Draw(mask).polygon(polygon,fill=255)
    out=Image.new('RGBA',SIZE,(0,0,0,0))
    for y in range(128):
        for x in range(128):
            if mask.getpixel((x,y)): out.putpixel((x,y),source.getpixel((x,y)))
    return out


def shift_part(image,offset):
    dx,dy=map(round,offset);out=Image.new('RGBA',SIZE,(0,0,0,0));out.alpha_composite(image,(dx,dy));return out


def rotate_part(image,pivot,angle,offset=(0,0)):
    # Inverse transform in canvas coordinates, nearest sampling preserves palette.
    a=math.radians(angle);c,s=math.cos(a),math.sin(a);px,py=pivot;dx,dy=offset
    inverse=(c,s,px-c*(px+dx)-s*(py+dy),-s,c,py+s*(px+dx)-c*(py+dy))
    return image.transform(SIZE,Image.Transform.AFFINE,inverse,resample=Image.Resampling.NEAREST)


def texture_color(source,point,fallback):
    x,y=map(round,point)
    if 0<=x<128 and 0<=y<128:
        color=source.getpixel((x,y))
        if color[3]: return color
    for radius in (1,2):
        for dy in range(-radius,radius+1):
            for dx in range(-radius,radius+1):
                if 0<=x+dx<128 and 0<=y+dy<128:
                    color=source.getpixel((x+dx,y+dy))
                    if color[3]: return color
    return fallback


def leg_layer(source,leg,name):
    image=Image.new('RGBA',SIZE,(0,0,0,0));h,k,a=map(tuple,(leg['hip'],leg['knee'],leg['ankle']))
    source_bones=((69,79),(72,88),(74,96)) if name=='near' else ((57,80),(56,92),(55,103))
    segments=[(h,k,4.1,3.5,0),(k,a,3.5,2.6,1)]
    xmin=max(0,math.floor(min(h[0],k[0],a[0])-5));xmax=min(128,math.ceil(max(h[0],k[0],a[0])+5))
    ymin=max(0,math.floor(min(h[1],k[1],a[1])-5));ymax=min(128,math.ceil(max(h[1],k[1],a[1])+5))
    for y in range(ymin,ymax):
        for x in range(xmin,xmax):
            candidates=[]
            for start,end,r0,r1,index in segments:
                vx,vy=end[0]-start[0],end[1]-start[1];length=math.hypot(vx,vy)
                t=max(0,min(1,((x+.5-start[0])*vx+(y+.5-start[1])*vy)/(length*length)))
                cx,cy=start[0]+t*vx,start[1]+t*vy
                distance=math.hypot(x+.5-cx,y+.5-cy);radius=r0+(r1-r0)*t
                if distance<=radius:
                    lateral=((x+.5-cx)*vy-(y+.5-cy)*vx)/length
                    candidates.append((distance/radius,index,t,lateral,radius))
            if not candidates: continue
            ratio,index,t,lateral,radius=min(candidates)
            if ratio>.84:
                color=(35,26,22,255)
            else:
                start,end=source_bones[index],source_bones[index+1]
                vx,vy=end[0]-start[0],end[1]-start[1];length=math.hypot(vx,vy)
                point=(start[0]+t*vx+vy/length*lateral*.78,start[1]+t*vy-vx/length*lateral*.78)
                color=texture_color(source,point,(62,59,54,255))
                # Persistent limb identity, not an accessory changing legs per pose.
                if name=='near' and index==1 and .18<=t<=.30:
                    color=(217,108,33,255) if lateral<-1 else (153,58,17,255)
                if name=='far' and index==0 and .60<=t<=.72:
                    color=(130,90,49,255) if lateral<1 else (63,43,31,255)
            image.putpixel((x,y),color)
    return image


def boot_layer(part,source_anchor,target,angle):
    return rotate_part(part,source_anchor,angle,(target[0]-source_anchor[0],target[1]-source_anchor[1]))


def setup_parts(source):
    upper=mask_part(source,[(0,0),(127,0),(127,79),(0,79)])
    far_coat=mask_part(source,[(49,75),(63,75),(62,83),(59,88),(52,90),(48,84)])
    near_coat=mask_part(source,[(73,75),(80,76),(85,83),(82,88),(76,90),(73,83)])
    # The original combined sprite overlaps its boot band with this crop. That
    # marker belongs to the near shin and must not also cling to the coat.
    for y in range(82,91):
        for x in range(73,86):
            r,g,b,a=near_coat.getpixel((x,y))
            if a and r>100 and g<.53*r: near_coat.putpixel((x,y),(0,0,0,0))
    far_boot=mask_part(source,[(50,98),(62,98),(65,111),(49,111)])
    near_boot=mask_part(source,[(65,92),(86,92),(88,104),(64,104)])
    for name,image in (('far',far_boot),('near',near_boot)):
        offset=image.getchannel('A').getbbox()[3]-1-BOOT_ANCHORS[name][1]
        if offset!=BOOT_SOLE_OFFSETS[name]: raise AssertionError(f'Boot sole calibration {name}: {offset}')
    pelvis=mask_part(source,[(56,74),(70,74),(72,80),(69,85),(60,84),(55,79)])
    return {'far-coat':far_coat,'upper-body':upper,'near-coat':near_coat,'far-boot':far_boot,'near-boot':near_boot,'pelvis':pelvis}


def render(source,parts,phase):
    state=pose(phase);offset=state['bodyOffset'];far=state['legs']['far'];near=state['legs']['near']
    far_layer=leg_layer(source,far,'far');far_layer.alpha_composite(boot_layer(parts['far-boot'],BOOT_ANCHORS['far'],far['ankle'],far['roll']))
    near_layer=leg_layer(source,near,'near');near_layer.alpha_composite(boot_layer(parts['near-boot'],BOOT_ANCHORS['near'],near['ankle'],near['roll']))
    layers={
        'far-leg':far_layer,
        'far-coat':rotate_part(parts['far-coat'],(56,76),4*math.sin(math.tau*phase-.6),offset),
        'near-leg':near_layer,
        'pelvis':shift_part(parts['pelvis'],offset),
        'upper-body':shift_part(parts['upper-body'],offset),
        'near-coat':rotate_part(parts['near-coat'],(76,76),-3*math.sin(math.tau*phase),offset),
    }
    composite=Image.new('RGBA',SIZE,(0,0,0,0))
    for image in layers.values(): composite.alpha_composite(image)
    return composite,layers,state


def main():
    OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
    (OUT/'metadata.json').write_text(json.dumps({'exportFilesComplete':False,'complete':False,'sourceRevision':'v3'}),encoding='utf-8')
    source=Image.open(SOURCE).convert('RGBA');parts=setup_parts(source)
    for name,image in parts.items(): image.save(OUT/(name+'.png'))
    frames=[];states=[];layer_frames={}
    for i in range(COUNT):
        frame,layers,state=render(source,parts,i/COUNT)
        frames.append(frame);states.append(state)
        for name,image in layers.items(): layer_frames.setdefault(name,[]).append(image)
    endpoint=render(source,parts,1)[0]
    if endpoint.tobytes()!=frames[0].tobytes(): raise AssertionError('Period endpoint mismatch')
    native=OUT/'ranger-run-candidate-v3.aseprite';atlas=OUT/'ranger-run-candidate-v3.png';export=PREVIEW/'editor-export.json'
    ps.write_layered_source(native,[{'name':name,'frames':images} for name,images in layer_frames.items()],[DURATION]*COUNT)
    ps.run_editor([native,'--sheet',atlas,'--sheet-type','horizontal','--data',export,'--format','json-array','--list-layers'])
    output=json.loads(export.read_text());sheet=Image.open(atlas).convert('RGBA');rows=[]
    if len(output['frames'])!=COUNT: raise AssertionError('Export frame count mismatch')
    for i,(expected,row,state) in enumerate(zip(frames,output['frames'],states)):
        r=row['frame'];actual=sheet.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
        if actual.tobytes()!=expected.tobytes() or row['duration']!=DURATION: raise AssertionError('Layered export mismatch')
        rows.append({'index':i,'durationMs':DURATION,'root':list(ROOT_POINT),'rect':[r[k] for k in ('x','y','w','h')],
                     'bodyOffset':state['bodyOffset'],'legs':state['legs'],'opaqueBox':list(expected.getchannel('A').getbbox())})
    palette=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())['palette']
    colors=[tuple(bytes.fromhex(c[1:])) for c in palette];ids={c:i+1 for i,c in enumerate(colors)}
    gif_palette=[0,0,0]+[v for color in colors for v in color];gif_palette+=[0]*(768-len(gif_palette));gifs=[]
    for image in frames:
        p=Image.new('P',SIZE,0);p.putpalette(gif_palette);p.putdata([ids[pixel[:3]] if pixel[3] else 0 for pixel in image.getdata()]);p.info['transparency']=0;gifs.append(p)
    gif=OUT/'ranger-run-candidate-v3.gif';gifs[0].save(gif,save_all=True,append_images=gifs[1:],duration=[DURATION]*COUNT,loop=0,transparency=0,disposal=2,optimize=False)
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest().upper()
    data={'date':'2026-10-07','sourceRevision':'v3','role':'authored periodic joint-motion native review candidate',
          'source':SOURCE.relative_to(ROOT).as_posix(),'sourceSha256':sha(SOURCE),'nativePath':native.relative_to(ROOT).as_posix(),
          'atlasPath':atlas.relative_to(ROOT).as_posix(),'gifPath':gif.relative_to(ROOT).as_posix(),'canvas':list(SIZE),
          'atlasSize':list(sheet.size),'opaquePalette':palette,'paletteColors':len(palette),'frames':rows,'root':list(ROOT_POINT),
          'sourceFrames':COUNT,'totalDurationMs':PERIOD_MS,'cycleDistanceWorld':CYCLE_DISTANCE,'contactFraction':CONTACT,
          'referenceWorkingBodyPixels':76,'worldScale':1,'layerNames':list(layer_frames),'fixedBoneLengths':[L1,L2],
          'nativeRoundtripExact':True,'atlasSha256':sha(atlas),'nativeSha256':sha(native),'gifSha256':sha(gif),
          'assetBytes':atlas.stat().st_size,'decodedRGBABytes':sheet.width*sheet.height*4,
          'authoredMotion':True,'handRetouched':False,'bakedWeapon':True,'visualApproved':False,'runtimeIntegrated':False,
          'endpointPixelsExact':True,'duplicateEndpointExported':False,'complete':False,'exportFilesComplete':True,
          'pending':['user visual review','native garment/joint shading polish','independent weapon layer','runtime distance-driven playback']}
    (OUT/'rig-source.json').write_text(json.dumps({'source':data['source'],'fixedBoneLengths':[L1,L2],
        'reach':REACH,'contactFraction':CONTACT,'cycleDistanceWorld':CYCLE_DISTANCE,'poseAuthoring':'C1 periodic foot recovery and body knots',
        'partPolygonsDeclaredIn':'scripts/animation/build-ranger-continuous-run.py','nearLegIdentity':'orange band',
        'farLegIdentity':'leather thigh strap'},indent=2),encoding='utf-8')
    (OUT/'metadata.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps({'frames':COUNT,'durationMs':PERIOD_MS,'layers':len(layer_frames),'endpointPixelsExact':True,
                      'bytes':data['assetBytes'],'decodedRGBABytes':data['decodedRGBABytes']}))


if __name__=='__main__': main()
