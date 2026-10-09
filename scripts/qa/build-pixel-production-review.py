"""Review native density studies and the first generated run-pose candidate."""
from pathlib import Path
import os,json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/animation/ranger/pixel-production-review'

HTML=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>巡线者 · 像素动作制作试验</title><style>
:root{font-family:system-ui,'Microsoft YaHei',sans-serif;color-scheme:dark;background:#171a17;color:#eadfc7}
body{margin:0}main{max-width:1080px;margin:auto;padding:24px}h1{font-size:26px;margin:0 0 12px}h2{font-size:20px;margin-top:30px}p{line-height:1.8;color:#c4bba7}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{border:1px solid #647052;background:#222820;border-radius:6px;overflow:hidden}
h3{font-size:15px;margin:0;padding:12px;background:#2e352a}canvas{display:block;margin:auto;max-width:100%;height:auto;image-rendering:pixelated}
.controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:14px 0}button,select{font:inherit;color:inherit;background:#30372b;border:1px solid #798461;padding:8px 12px;border-radius:4px}button{cursor:pointer}:focus-visible{outline:3px solid #d8ad60}
input{accent-color:#d8ad60}a{color:#d8ad60}.note{border-left:3px solid #be8d4a;padding-left:12px}
.viewer{display:flex;justify-content:center;background:#20261e;border:1px solid #647052;padding:10px}.info{color:#cdbd99;font-size:14px;padding:8px 12px}
@media(max-width:850px){.cards{grid-template-columns:1fr}main{padding:16px}}
</style><main><h1>巡线者 · 原生像素与动作制作试验</h1>
<p>新版保留原八帧，在每对相邻关键帧之间补绘两张完整人物，形成24帧序列。第8→1帧也有两张专门的过渡画面，预览保持约0.4秒的原有节奏。</p>
<h2>一、同尺寸像素密度对照</h2><div class="controls"><label>显示倍率 <select id="densityZoom"><option value="1">游戏参考尺寸</option><option value="4">放大4倍</option></select></label></div>
<div class="cards"><div class="card"><h3>原高分辨率设计参考</h3><canvas id="reference" width="320" height="350"></canvas></div><div class="card"><h3>A · 较粗像素</h3><canvas id="densityA" width="320" height="350"></canvas><div class="info">37px轮廓／38px工作规格，30色，整数2倍</div></div><div class="card"><h3>B · 精细像素工作候选</h3><canvas id="densityB" width="320" height="350"></canvas><div class="info">75px轮廓／76px工作规格，32色，整数1倍</div></div></div>
<p class="note">两候选用于密度与色板选择，尚未做完整逐像素修画和身体／枪械分层。默认沿用B继续制作；原始参考图保留。</p>
<h2>二、逐帧补绘与原版对照 <small id="revision"></small></h2><p>新版中间帧来自完整人物补绘图，包含衣褶、靴子与遮挡关系。可查看原画细节或游戏像素尺寸；上一版关节生成试验保留为历史对照。这仍是离线评审，尚未替换游戏。</p>
<div class="viewer"><canvas id="run" width="640" height="470" aria-label="跑步循环动作预览"></canvas></div>
<div class="controls"><label>版本 <select id="version"><option value="v4">新版 · 24帧逐帧补绘</option><option value="v2">原版 · 8帧</option><option value="v3">历史关节试验 · 20帧</option></select></label><label>画面 <select id="detail"><option value="art" selected>原画细节</option><option value="native">游戏像素尺寸</option></select></label><button id="play">暂停</button><button id="previous">上一帧</button><button id="next">下一帧</button>
<label>播放速度 <select id="speed"><option value="1">正常 · 0.4秒循环</option><option value="0.25">慢速 · 0.25倍</option></select></label>
<label>显示倍率 <select id="runZoom"><option value="1">游戏参考尺寸</option><option value="4" selected>放大4倍</option></select></label>
<label><input id="onion" type="checkbox">上一帧对照</label><label><input id="anchor" type="checkbox" checked>根锚点</label>
<button id="seam">只看末尾→开头</button><input id="timeline" type="range" min="1" max="24" value="1" aria-label="动作帧"><span id="status">加载中</span></div>
<p><a id="video" download>保存循环视频</a> · <a id="webp" download>保存动画WebP</a> · <a id="gif" download>保存兼容GIF</a> · <a id="native" download>保存可编辑动作源</a> · <a id="contact" download>查看全部24帧</a> · <a id="plan">查看最终计划</a></p>
<p class="note">原八帧像素保持不变；新增16帧由ImageGen补绘，未采用关节变形或透明叠化。预览／视频／WebP约0.4秒一轮；GIF为兼容常用查看器使用0.48秒一轮。衣物纹理、腿部身份与具体帧的连续性仍需视觉评审，不能仅凭帧数宣布完成。</p>
</main><script>
const data=__DATA__,images={};const atlas=new Image(),artAtlas=new Image(),ground=new Image();let runData=data.versions[data.initialVersion],frame=0,playing=true,carry=0,last=0,seamOnly=false,loadId=0,versionReady=false;
const q=id=>document.getElementById(id),timeline=q('timeline'),status=q('status');
q('plan').href=data.plan;q('version').value=data.initialVersion;
function setLinks(){q('gif').href=runData.gifUrl;q('native').href=runData.nativeUrl;q('revision').textContent=`${runData.sourceRevision} · ${runData.frames.length}帧`;timeline.max=String(runData.frames.length);for(const [id,key] of [['video','videoUrl'],['webp','webpUrl'],['contact','contactUrl']]){q(id).hidden=!runData[key];if(runData[key])q(id).href=runData[key]}q('detail').options[0].disabled=!runData.artAtlasUrl;if(!runData.artAtlasUrl)q('detail').value='native'}
function background(ctx,w,h){ctx.fillStyle='#242b20';ctx.fillRect(0,0,w,h);if(ground.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.globalAlpha=.48;ctx.drawImage(ground,0,0,w,h);ctx.globalAlpha=1}}
function drawDensity(){const z=Number(q('densityZoom').value);for(const key of ['reference','densityA','densityB']){const canvas=q(key),ctx=canvas.getContext('2d');canvas.height=z===4?440:350;background(ctx,320,canvas.height);
 const root=[160,canvas.height-28],entry=data.density[key],im=images[key];ctx.fillStyle='#070a0866';ctx.beginPath();ctx.ellipse(root[0],root[1],14*z,3*z,0,0,Math.PI*2);ctx.fill();if(!im)continue;
 if(key==='reference'){const b=entry.bbox,h=76*z,w=h*(b[2]-b[0])/(b[3]-b[1]);ctx.imageSmoothingEnabled=true;ctx.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],root[0]-w/2,root[1]-h,w,h)}
 else{const s=entry.worldScale*z;ctx.imageSmoothingEnabled=false;ctx.drawImage(im,root[0]-entry.root[0]*s,root[1]-entry.root[1]*s,entry.canvas[0]*s,entry.canvas[1]*s)}
 }}
function drawRun(){const canvas=q('run'),ctx=canvas.getContext('2d'),z=Number(q('runZoom').value);background(ctx,canvas.width,canvas.height);const root=[canvas.width/2,canvas.height-50];ctx.fillStyle='#06090666';ctx.beginPath();ctx.ellipse(root[0],root[1],15*z,3*z,0,0,Math.PI*2);ctx.fill();
 const artMode=q('detail').value==='art'&&runData.artAtlasUrl;const ready=versionReady&&(!artMode||artAtlas.naturalWidth>0);
 function pose(index,opacity){if(!ready)return;const f=runData.frames[index],r=artMode?f.artRect:f.rect,pivot=artMode?f.artRoot:f.root,s=artMode?runData.artWorldScale*z:z;ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=false;ctx.drawImage(artMode?artAtlas:atlas,...r,root[0]-pivot[0]*s,root[1]-pivot[1]*s,r[2]*s,r[3]*s);ctx.globalAlpha=1}
 if(q('onion').checked)pose((frame+runData.frames.length-1)%runData.frames.length,.27);pose(frame,1);
 if(q('anchor').checked){ctx.strokeStyle='#a5d98c';ctx.beginPath();ctx.moveTo(root[0]-8,root[1]);ctx.lineTo(root[0]+8,root[1]);ctx.moveTo(root[0],root[1]-8);ctx.lineTo(root[0],root[1]+8);ctx.stroke()}
 const f=runData.frames[frame],kind=f.kind==='original-key'?`原关键帧 ${f.originalKey}`:f.kind==='drawn-inbetween'?`补绘 ${f.fromKey}→${f.toKey} 第${Math.round(f.transitionFraction*3)}/2张`:'历史动作';timeline.value=String(frame+1);status.textContent=ready?`第 ${frame+1} / ${runData.frames.length} 帧 · ${kind}${seamOnly?' · 接缝检查':''}`:'加载画面中';status.dataset.ready=ready?'true':'false';}
function pause(){playing=false;q('play').textContent='播放'}function resetSeam(){seamOnly=false;q('seam').textContent='只看末尾→开头'}function step(d){pause();resetSeam();frame=(frame+d+runData.frames.length)%runData.frames.length;carry=0;drawRun()}
q('previous').onclick=()=>step(-1);q('next').onclick=()=>step(1);q('play').onclick=()=>{if(seamOnly&&frame===1)frame=runData.frames.length-2;playing=!playing;carry=0;q('play').textContent=playing?'暂停':'播放'};
timeline.oninput=()=>{pause();resetSeam();frame=Number(timeline.value)-1;drawRun()};q('onion').onchange=drawRun;q('anchor').onchange=drawRun;q('runZoom').onchange=drawRun;q('detail').onchange=drawRun;q('densityZoom').onchange=drawDensity;
q('seam').onclick=()=>{if(seamOnly){resetSeam();drawRun();return}seamOnly=true;frame=runData.frames.length-2;carry=0;playing=true;q('play').textContent='暂停';q('seam').textContent='恢复完整循环';drawRun()};
function advance(){if(!seamOnly){frame=(frame+1)%runData.frames.length;return}const order=[runData.frames.length-2,runData.frames.length-1,0,1];if(frame===1){pause();carry=0;return}frame=order[(order.indexOf(frame)+1)%order.length]}
function tick(t){if(last&&playing&&versionReady){carry+=Math.min(100,t-last)*Number(q('speed').value);while(carry>=runData.frames[frame].durationMs){carry-=runData.frames[frame].durationMs;advance();drawRun()}}last=t;requestAnimationFrame(tick)}
q('version').onchange=()=>{const id=++loadId;pause();versionReady=false;runData=data.versions[q('version').value];frame=0;carry=0;resetSeam();setLinks();status.dataset.ready='false';atlas.onload=()=>{if(id===loadId){versionReady=true;drawRun();playing=true;q('play').textContent='暂停'}};atlas.src=runData.atlasUrl};
const promises=Object.entries(data.density).map(([key,entry])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=()=>reject(new Error('缺少密度图片'));im.src=entry.url}));
setLinks();promises.push(new Promise((resolve,reject)=>{atlas.onload=()=>{versionReady=true;resolve()};atlas.onerror=()=>reject(new Error('缺少动作图集'));atlas.src=runData.atlasUrl}));
if(data.versions.v4?.artAtlasUrl)promises.push(new Promise((resolve,reject)=>{artAtlas.onload=()=>{drawRun();resolve()};artAtlas.onerror=()=>reject(new Error('缺少补绘原画'));artAtlas.src=data.versions.v4.artAtlasUrl}));
ground.onload=()=>{drawDensity();drawRun()};ground.src=data.ground;
Promise.all(promises).then(()=>{drawDensity();drawRun();requestAnimationFrame(tick)}).catch(e=>{status.textContent=e.message;status.dataset.ready='false'});
</script></html>'''


def url(path): return os.path.relpath(ROOT/path,OUT).replace('\\','/')


def main():
    source=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())
    versions={}
    for version in ('v2','v3','v4'):
        path=ROOT/f'art/animation/ranger/pixel-source/run-candidate-{version}/metadata.json'
        if not path.is_file(): continue
        run=json.loads(path.read_text())
        if not run.get('exportFilesComplete') or len(run.get('frames',[]))!=run.get('sourceFrames',8):
            raise ValueError('Run candidate export incomplete; review page cannot be published')
        versions[version]={**run,'atlasUrl':url(run['atlasPath']),'gifUrl':url(run['gifPath']),'nativeUrl':url(run['nativePath'])}
        for key, target in [('artAtlasPath','artAtlasUrl'),('videoPath','videoUrl'),('webpPath','webpUrl'),('contactSheetPath','contactUrl')]:
            if run.get(key): versions[version][target]=url(run[key])
    initial='v4' if 'v4' in versions else 'v3' if 'v3' in versions else 'v2'
    data={'density':{'reference':{'url':url(source['reference']),'bbox':[358,34,970,1234]}},'versions':versions,'initialVersion':initial,
          'ground':url('web/assets/world/echo-ground-v1.webp'),
          'plan':url('docs/pixel-animation-final-plan-2026-10-02.md')}
    for key,candidate in zip(('densityA','densityB'),source['candidates']):
        data['density'][key]={**candidate,'url':url(candidate['pngPath'])}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'review.html').write_text(HTML.replace('__DATA__',json.dumps(data,ensure_ascii=False)),encoding='utf-8')
    print(OUT/'review.html')


if __name__=='__main__': main()
