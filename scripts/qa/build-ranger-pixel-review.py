"""Create a static style-review page; draw existing images without changing them."""

from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/animation/ranger/pixel-lookdev'
OUT = ROOT / 'output/animation/ranger/pixel-lookdev-v1'

HTML = r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>巡线者 · 精细像素风格试作</title><style>
:root{color-scheme:dark;font-family:system-ui,'Microsoft YaHei',sans-serif;background:#171a18;color:#eadfc7}
body{margin:0}main{max-width:1050px;margin:auto;padding:24px}h1{font-size:26px;margin:0 0 12px}
p{line-height:1.75;color:#c7bcaa}h2{font-size:16px;font-weight:600;margin:0;padding:12px 16px;background:#252a25}
.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0}select,a{font:inherit;color:inherit}
select{background:#29302a;border:1px solid #788268;border-radius:5px;padding:8px}
.views{display:grid;grid-template-columns:1fr 1fr;gap:18px}.panel{border:1px solid #56604c;border-radius:7px;overflow:hidden;background:#1e231f}
canvas{display:block;width:480px;max-width:100%;height:auto;margin:auto;image-rendering:pixelated}a{color:#d5ad60}:focus-visible{outline:3px solid #d5ad60}
.note{border-left:3px solid #b98a45;padding-left:14px}.details{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
.detail{height:430px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#252b25 0% 25%,#1e231e 0% 50%) 0 0/24px 24px;border:1px solid #56604c}
.detail img{max-height:410px;max-width:95%;image-rendering:pixelated}
@media(max-width:700px){.views,.details{grid-template-columns:1fr}main{padding:16px}}
</style><main><h1>巡线者 · 精细像素风格试作</h1>
<p>保留兜帽、面罩、橙色镜片、围巾与废土外套，试验清晰轮廓和双手持枪的二维像素表现。</p>
<div class="controls"><label>人物显示高度 <select id="size"><option value="76">76px · 游戏参考尺寸</option><option value="152">152px · 放大检查</option><option value="304">304px · 细节检查</option></select></label>
<label>背景 <select id="background"><option value="map">当前地图</option><option value="plain">深色背景</option></select></label><span id="status">正在加载</span></div>
<div class="views"><section class="panel"><h2>已有插画 · 静态角色</h2><canvas id="painting" width="480" height="380" aria-label="已有插画角色在地图上的显示"></canvas></section>
<section class="panel"><h2>新像素风样稿 · 静态持枪</h2><canvas id="pixel" width="480" height="380" aria-label="新像素风角色在地图上的显示"></canvas></section></div>
<p class="note">这是风格与小尺寸可读性对照。新图由 ImageGen 生成，尚未人工整理成固定像素网格、受控调色板或连续动作；小尺寸预览采用最近邻取样。现有活动游戏仍使用已接入的插画。</p>
<h2>原始样稿细节与透明边缘</h2><div class="details"><div class="detail"><img id="source" alt="新像素风格巡线者完整样稿"></div><div><p>后续可以完全采用二维制作：固定低分辨率画布 → 关键姿势 → 连续帧 → 动作图集 → 游戏播放。</p><p>Blender 可作为姿势或透视参考，本路线不要求继续精细建模。自然跑步、侧步、后退、双手握枪和近战动作仍需要逐项设计。</p>
<p><a id="download" download="ranger-pixel-sidearm-v1.png">查看／保存原始透明 PNG</a></p><p>下一步优先制作同一角色的二维跑步与持枪关键帧，再进入实际游戏核对。</p></div></div>
</main><script>
const data=__DATA__,loaded={};const size=document.getElementById('size'),background=document.getElementById('background'),status=document.getElementById('status');
document.getElementById('source').src=data.images.pixel.url;
document.getElementById('download').href=data.images.pixel.url;
function draw(){if(!loaded.map||!loaded.pixel||!loaded.painting)return;const height=Number(size.value);
 for(const key of ['painting','pixel']){const canvas=document.getElementById(key),ctx=canvas.getContext('2d');canvas.height=height===304?480:380;
  ctx.fillStyle='#242b25';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(background.value==='map'){ctx.imageSmoothingEnabled=true;
   if(data.images.map.kind==='ground'){ctx.fillStyle=ctx.createPattern(loaded.map,'repeat');ctx.fillRect(0,0,canvas.width,canvas.height)}
   else ctx.drawImage(loaded.map,8,355,280,300,0,0,canvas.width,canvas.height);
  }
  const foot=canvas.height-40,x=canvas.width/2;
  ctx.fillStyle='#070b0870';ctx.beginPath();ctx.ellipse(x,foot,Math.max(13,height*.15),Math.max(4,height*.035),0,0,Math.PI*2);ctx.fill();
  const box=data.images[key].bbox,width=height*(box[2]-box[0])/(box[3]-box[1]);
  ctx.imageSmoothingEnabled=key==='painting';ctx.drawImage(loaded[key],box[0],box[1],box[2]-box[0],box[3]-box[1],Math.round(x-width/2),foot-height,Math.round(width),height);
 }
 status.textContent='已加载 · 静态样稿';status.dataset.ready='true';
}
size.onchange=draw;background.onchange=draw;
Promise.all(Object.entries(data.images).map(([key,entry])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{loaded[key]=image;resolve()};image.onerror=()=>reject(new Error('图片加载失败：'+key));image.src=entry.url}))).then(draw).catch(error=>{status.textContent=error.message;status.dataset.ready='false'});
</script></html>'''


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    metadata=json.loads((SOURCE/'ranger-pixel-sidearm-v1.metadata.json').read_text(encoding='utf-8'))
    if not (ROOT/metadata['images']['map']['path']).is_file():
        metadata['images']['map']={'path':'web/assets/world/echo-ground-v1.webp','kind':'ground'}
    for image in metadata['images'].values():
        path=ROOT/image['path']
        if not path.is_file(): raise FileNotFoundError(path)
        image['url']=os.path.relpath(path,OUT).replace('\\','/')
    target=OUT/'review.html'
    target.write_text(HTML.replace('__DATA__',json.dumps(metadata,ensure_ascii=False)),encoding='utf-8')
    print(target)


if __name__=='__main__': main()
