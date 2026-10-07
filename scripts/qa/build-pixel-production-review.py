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
<p>新版采用连续关节步相补足20帧，沿用角色细节并保持约0.4秒的跑步周期。可与原八帧对照，重点检查双腿衔接与循环接缝。</p>
<h2>一、同尺寸像素密度对照</h2><div class="controls"><label>显示倍率 <select id="densityZoom"><option value="1">游戏参考尺寸</option><option value="4">放大4倍</option></select></label></div>
<div class="cards"><div class="card"><h3>原高分辨率设计参考</h3><canvas id="reference" width="320" height="350"></canvas></div><div class="card"><h3>A · 较粗像素</h3><canvas id="densityA" width="320" height="350"></canvas><div class="info">37px轮廓／38px工作规格，30色，整数2倍</div></div><div class="card"><h3>B · 精细像素工作候选</h3><canvas id="densityB" width="320" height="350"></canvas><div class="info">75px轮廓／76px工作规格，32色，整数1倍</div></div></div>
<p class="note">两候选用于密度与色板选择，尚未做完整逐像素修画和身体／枪械分层。默认沿用B继续制作；原始参考图保留。</p>
<h2>二、跑步循环对照 <small id="revision"></small></h2><p>新版共用上身和服饰部件，固定两条腿的身份，按髋、膝、踝连续轨迹生成中间姿势。周期端点与速度衔接已验证；这里仍是人物动作评审，不代表正式游戏已替换。</p>
<div class="viewer"><canvas id="run" width="640" height="470" aria-label="跑步循环动作预览"></canvas></div>
<div class="controls"><label>版本 <select id="version"><option value="v3">新版 · 20帧连续关节</option><option value="v2">原版 · 8帧</option></select></label><button id="play">暂停</button><button id="previous">上一帧</button><button id="next">下一帧</button>
<label>播放速度 <select id="speed"><option value="1">正常 · 0.4秒循环</option><option value="0.25">慢速 · 0.25倍</option></select></label>
<label>显示倍率 <select id="runZoom"><option value="1">游戏参考尺寸</option><option value="4" selected>放大4倍</option></select></label>
<label><input id="onion" type="checkbox">上一帧对照</label><label><input id="anchor" type="checkbox" checked>根锚点</label>
<button id="seam">只看末尾→开头</button><input id="timeline" type="range" min="1" max="20" value="1" aria-label="动作帧"><span id="status">加载中</span></div>
<p><a id="gif" download>保存候选GIF</a> · <a id="native" download>保存可编辑动作源</a> · <a id="plan">查看最终计划</a></p>
<p class="note">新版通过首尾闭合、支撑轨迹和固定骨长检查，末尾不重复第一帧。衣物关节细节、武器独立与其他朝向仍待完善。根锚点是绘制参考，不是地面碰撞线；角色手中的枪尚在上身素材中。</p>
</main><script>
const data=__DATA__,images={};const atlas=new Image(),ground=new Image();let runData=data.versions[data.initialVersion],frame=0,playing=true,carry=0,last=0,seamOnly=false,loadId=0;
const q=id=>document.getElementById(id),timeline=q('timeline'),status=q('status');
q('plan').href=data.plan;q('version').value=data.initialVersion;
function setLinks(){q('gif').href=runData.gifUrl;q('native').href=runData.nativeUrl;q('revision').textContent=`${runData.sourceRevision} · ${runData.frames.length}帧`;timeline.max=String(runData.frames.length)}
function background(ctx,w,h){ctx.fillStyle='#242b20';ctx.fillRect(0,0,w,h);if(ground.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.globalAlpha=.48;ctx.drawImage(ground,0,0,w,h);ctx.globalAlpha=1}}
function drawDensity(){const z=Number(q('densityZoom').value);for(const key of ['reference','densityA','densityB']){const canvas=q(key),ctx=canvas.getContext('2d');canvas.height=z===4?440:350;background(ctx,320,canvas.height);
 const root=[160,canvas.height-28],entry=data.density[key],im=images[key];ctx.fillStyle='#070a0866';ctx.beginPath();ctx.ellipse(root[0],root[1],14*z,3*z,0,0,Math.PI*2);ctx.fill();if(!im)continue;
 if(key==='reference'){const b=entry.bbox,h=76*z,w=h*(b[2]-b[0])/(b[3]-b[1]);ctx.imageSmoothingEnabled=true;ctx.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],root[0]-w/2,root[1]-h,w,h)}
 else{const s=entry.worldScale*z;ctx.imageSmoothingEnabled=false;ctx.drawImage(im,root[0]-entry.root[0]*s,root[1]-entry.root[1]*s,entry.canvas[0]*s,entry.canvas[1]*s)}
 }}
function drawRun(){const canvas=q('run'),ctx=canvas.getContext('2d'),z=Number(q('runZoom').value);background(ctx,canvas.width,canvas.height);const root=[canvas.width/2,canvas.height-50];ctx.fillStyle='#06090666';ctx.beginPath();ctx.ellipse(root[0],root[1],15*z,3*z,0,0,Math.PI*2);ctx.fill();
 function pose(index,opacity){if(!atlas.naturalWidth)return;const f=runData.frames[index],r=f.rect;ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,...r,root[0]-f.root[0]*z,root[1]-f.root[1]*z,r[2]*z,r[3]*z);ctx.globalAlpha=1}
 if(q('onion').checked)pose((frame+runData.frames.length-1)%runData.frames.length,.27);pose(frame,1);
 if(q('anchor').checked){ctx.strokeStyle='#a5d98c';ctx.beginPath();ctx.moveTo(root[0]-8,root[1]);ctx.lineTo(root[0]+8,root[1]);ctx.moveTo(root[0],root[1]-8);ctx.lineTo(root[0],root[1]+8);ctx.stroke()}
 timeline.value=String(frame+1);status.textContent=`第 ${frame+1} / ${runData.frames.length} 帧 · ${seamOnly?'接缝检查':'动作候选'}`;status.dataset.ready=atlas.naturalWidth?'true':'false';}
function pause(){playing=false;q('play').textContent='播放'}function resetSeam(){seamOnly=false;q('seam').textContent='只看末尾→开头'}function step(d){pause();resetSeam();frame=(frame+d+runData.frames.length)%runData.frames.length;carry=0;drawRun()}
q('previous').onclick=()=>step(-1);q('next').onclick=()=>step(1);q('play').onclick=()=>{if(seamOnly&&frame===1)frame=runData.frames.length-2;playing=!playing;carry=0;q('play').textContent=playing?'暂停':'播放'};
timeline.oninput=()=>{pause();resetSeam();frame=Number(timeline.value)-1;drawRun()};q('onion').onchange=drawRun;q('anchor').onchange=drawRun;q('runZoom').onchange=drawRun;q('densityZoom').onchange=drawDensity;
q('seam').onclick=()=>{if(seamOnly){resetSeam();drawRun();return}seamOnly=true;frame=runData.frames.length-2;carry=0;playing=true;q('play').textContent='暂停';q('seam').textContent='恢复完整循环';drawRun()};
function advance(){if(!seamOnly){frame=(frame+1)%runData.frames.length;return}const order=[runData.frames.length-2,runData.frames.length-1,0,1];if(frame===1){pause();carry=0;return}frame=order[(order.indexOf(frame)+1)%order.length]}
function tick(t){if(last&&playing&&atlas.naturalWidth){carry+=Math.min(100,t-last)*Number(q('speed').value);while(carry>=runData.frames[frame].durationMs){carry-=runData.frames[frame].durationMs;advance();drawRun()}}last=t;requestAnimationFrame(tick)}
q('version').onchange=()=>{const id=++loadId;pause();runData=data.versions[q('version').value];frame=0;carry=0;resetSeam();setLinks();status.dataset.ready='false';atlas.onload=()=>{if(id===loadId){drawRun();playing=true;q('play').textContent='暂停'}};atlas.src=runData.atlasUrl};
const promises=Object.entries(data.density).map(([key,entry])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=()=>reject(new Error('缺少密度图片'));im.src=entry.url}));
setLinks();promises.push(new Promise((resolve,reject)=>{atlas.onload=resolve;atlas.onerror=()=>reject(new Error('缺少动作图集'));atlas.src=runData.atlasUrl}));
ground.onload=()=>{drawDensity();drawRun()};ground.src=data.ground;
Promise.all(promises).then(()=>{drawDensity();drawRun();requestAnimationFrame(tick)}).catch(e=>{status.textContent=e.message;status.dataset.ready='false'});
</script></html>'''


def url(path): return os.path.relpath(ROOT/path,OUT).replace('\\','/')


def main():
    source=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())
    versions={}
    for version in ('v2','v3'):
        path=ROOT/f'art/animation/ranger/pixel-source/run-candidate-{version}/metadata.json'
        if not path.is_file(): continue
        run=json.loads(path.read_text())
        if not run.get('exportFilesComplete') or len(run.get('frames',[]))!=run.get('sourceFrames',8):
            raise ValueError('Run candidate export incomplete; review page cannot be published')
        versions[version]={**run,'atlasUrl':url(run['atlasPath']),'gifUrl':url(run['gifPath']),'nativeUrl':url(run['nativePath'])}
    initial='v3' if 'v3' in versions else 'v2'
    data={'density':{'reference':{'url':url(source['reference']),'bbox':[358,34,970,1234]}},'versions':versions,'initialVersion':initial,
          'ground':url('web/assets/world/echo-ground-v1.webp'),
          'plan':url('docs/pixel-animation-final-plan-2026-10-02.md')}
    for key,candidate in zip(('densityA','densityB'),source['candidates']):
        data['density'][key]={**candidate,'url':url(candidate['pngPath'])}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'review.html').write_text(HTML.replace('__DATA__',json.dumps(data,ensure_ascii=False)),encoding='utf-8')
    print(OUT/'review.html')


if __name__=='__main__': main()
