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
<p>已有样稿已转成可编辑像素密度候选。下方新增八个跑步姿势的连续预览，先检查人物、双腿和握枪，再修整接地、步长、循环与图层。</p>
<h2>一、同尺寸像素密度对照</h2><div class="controls"><label>显示倍率 <select id="densityZoom"><option value="1">游戏参考尺寸</option><option value="4">放大4倍</option></select></label></div>
<div class="cards"><div class="card"><h3>原高分辨率设计参考</h3><canvas id="reference" width="320" height="350"></canvas></div><div class="card"><h3>A · 较粗像素</h3><canvas id="densityA" width="320" height="350"></canvas><div class="info">37px轮廓／38px工作规格，30色，整数2倍</div></div><div class="card"><h3>B · 精细像素工作候选</h3><canvas id="densityB" width="320" height="350"></canvas><div class="info">75px轮廓／76px工作规格，32色，整数1倍</div></div></div>
<p class="note">两候选用于密度与色板选择，尚未做完整逐像素修画和身体／枪械分层。默认沿用B继续制作；原始参考图保留。</p>
<h2>二、八帧跑步姿势候选 <small id="revision"></small></h2><p>八个姿势来自同一组生成参考，使用共享尺度、固定色板和根锚点整理为原生帧。它们仍需核对支撑脚、循环、身份和持握，尚未接入活动游戏。后半步序以及4→5、8→1接缝是当前明确的修整重点。</p>
<div class="viewer"><canvas id="run" width="640" height="470" aria-label="八帧跑步动作候选"></canvas></div>
<div class="controls"><button id="play">暂停</button><button id="previous">上一帧</button><button id="next">下一帧</button>
<label>播放速度 <select id="speed"><option value="1">正常 · 0.4秒循环</option><option value="0.25">慢速 · 0.25倍</option></select></label>
<label>显示倍率 <select id="runZoom"><option value="1">游戏参考尺寸</option><option value="4" selected>放大4倍</option></select></label>
<label><input id="onion" type="checkbox">上一帧对照</label><label><input id="anchor" type="checkbox" checked>根锚点</label>
<input id="timeline" type="range" min="1" max="8" value="1" aria-label="动作帧"><span id="status">加载中</span></div>
<p><a id="gif" download>保存候选GIF</a> · <a id="native" download>保存可编辑动作源</a> · <a id="plan">查看最终计划</a></p>
<p class="note">根锚点是绘制参考，不是地面碰撞线。此候选完成了文件和导出验证；人工动作评分、身体／武器分离、真实位移步相及自由瞄准仍待完成。诊断测试的两帧彩色图不作为人物动画展示。</p>
</main><script>
const data=__DATA__,images={};const atlas=new Image(),ground=new Image();let frame=0,playing=true,carry=0,last=0;
const q=id=>document.getElementById(id),timeline=q('timeline'),status=q('status');
q('gif').href=data.gif;q('native').href=data.native;q('plan').href=data.plan;
q('revision').textContent=data.run.sourceRevision||'v1';
function background(ctx,w,h){ctx.fillStyle='#242b20';ctx.fillRect(0,0,w,h);if(ground.naturalWidth){ctx.imageSmoothingEnabled=true;ctx.globalAlpha=.48;ctx.drawImage(ground,0,0,w,h);ctx.globalAlpha=1}}
function drawDensity(){const z=Number(q('densityZoom').value);for(const key of ['reference','densityA','densityB']){const canvas=q(key),ctx=canvas.getContext('2d');canvas.height=z===4?440:350;background(ctx,320,canvas.height);
 const root=[160,canvas.height-28],entry=data.density[key],im=images[key];ctx.fillStyle='#070a0866';ctx.beginPath();ctx.ellipse(root[0],root[1],14*z,3*z,0,0,Math.PI*2);ctx.fill();if(!im)continue;
 if(key==='reference'){const b=entry.bbox,h=76*z,w=h*(b[2]-b[0])/(b[3]-b[1]);ctx.imageSmoothingEnabled=true;ctx.drawImage(im,b[0],b[1],b[2]-b[0],b[3]-b[1],root[0]-w/2,root[1]-h,w,h)}
 else{const s=entry.worldScale*z;ctx.imageSmoothingEnabled=false;ctx.drawImage(im,root[0]-entry.root[0]*s,root[1]-entry.root[1]*s,entry.canvas[0]*s,entry.canvas[1]*s)}
 }}
function drawRun(){const canvas=q('run'),ctx=canvas.getContext('2d'),z=Number(q('runZoom').value);background(ctx,canvas.width,canvas.height);const root=[canvas.width/2,canvas.height-50];ctx.fillStyle='#06090666';ctx.beginPath();ctx.ellipse(root[0],root[1],15*z,3*z,0,0,Math.PI*2);ctx.fill();
 function pose(index,opacity){if(!atlas.naturalWidth)return;const f=data.run.frames[index],r=f.rect;ctx.globalAlpha=opacity;ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,...r,root[0]-f.root[0]*z,root[1]-f.root[1]*z,r[2]*z,r[3]*z);ctx.globalAlpha=1}
 if(q('onion').checked)pose((frame+7)%8,.27);pose(frame,1);
 if(q('anchor').checked){ctx.strokeStyle='#a5d98c';ctx.beginPath();ctx.moveTo(root[0]-8,root[1]);ctx.lineTo(root[0]+8,root[1]);ctx.moveTo(root[0],root[1]-8);ctx.lineTo(root[0],root[1]+8);ctx.stroke()}
 timeline.value=String(frame+1);status.textContent=`第 ${frame+1} / 8 帧 · 动作候选`;status.dataset.ready=atlas.naturalWidth?'true':'false';}
function pause(){playing=false;q('play').textContent='播放'}function step(d){pause();frame=(frame+d+8)%8;carry=0;drawRun()}
q('previous').onclick=()=>step(-1);q('next').onclick=()=>step(1);q('play').onclick=()=>{playing=!playing;carry=0;q('play').textContent=playing?'暂停':'播放'};
timeline.oninput=()=>{pause();frame=Number(timeline.value)-1;drawRun()};q('onion').onchange=drawRun;q('anchor').onchange=drawRun;q('runZoom').onchange=drawRun;q('densityZoom').onchange=drawDensity;
function tick(t){if(last&&playing&&atlas.naturalWidth){carry+=Math.min(100,t-last)*Number(q('speed').value);while(carry>=data.run.frames[frame].durationMs){carry-=data.run.frames[frame].durationMs;frame=(frame+1)%8;drawRun()}}last=t;requestAnimationFrame(tick)}
const promises=Object.entries(data.density).map(([key,entry])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=()=>reject(new Error('缺少密度图片'));im.src=entry.url}));
promises.push(new Promise((resolve,reject)=>{atlas.onload=resolve;atlas.onerror=()=>reject(new Error('缺少动作图集'));atlas.src=data.atlas}));
ground.onload=()=>{drawDensity();drawRun()};ground.src=data.ground;
Promise.all(promises).then(()=>{drawDensity();drawRun();requestAnimationFrame(tick)}).catch(e=>{status.textContent=e.message;status.dataset.ready='false'});
</script></html>'''


def url(path): return os.path.relpath(ROOT/path,OUT).replace('\\','/')


def main():
    source=json.loads((ROOT/'art/animation/ranger/pixel-source/density-study-v1.json').read_text())
    run_path=ROOT/'art/animation/ranger/pixel-source/run-candidate-v2/metadata.json'
    if not run_path.is_file(): run_path=ROOT/'art/animation/ranger/pixel-source/run-candidate-v1/metadata.json'
    run=json.loads(run_path.read_text())
    if not run.get('exportFilesComplete') or len(run.get('frames',[]))!=8:
        raise ValueError('Run candidate export incomplete; review page cannot be published')
    data={'density':{'reference':{'url':url(source['reference']),'bbox':[358,34,970,1234]}},'run':run,
          'atlas':url(run['atlasPath']),'gif':url(run['gifPath']),'native':url(run['nativePath']),
          'ground':url('web/assets/world/echo-ground-v1.webp'),
          'plan':url('docs/pixel-animation-final-plan-2026-10-02.md')}
    for key,candidate in zip(('densityA','densityB'),source['candidates']):
        data['density'][key]={**candidate,'url':url(candidate['pngPath'])}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'review.html').write_text(HTML.replace('__DATA__',json.dumps(data,ensure_ascii=False)),encoding='utf-8')
    print(OUT/'review.html')


if __name__=='__main__': main()
