"""Build an eight-direction offline review page with fixed ground projection."""

from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/animation/ranger/aim-v2"


def main():
    metadata = json.loads((OUT / "metadata.json").read_text())
    if not metadata.get("complete") or metadata.get("renderedFrames") != 296:
        raise ValueError(
            "Directional render is incomplete; rebuild without --stills-only"
        )
    metadata["projection"] = json.loads((OUT / "projection.json").read_text())
    for mode, count in metadata["frames"].items():
        for degrees in metadata["directions"]:
            for frame in range(1, count + 1):
                path = OUT / mode / f"yaw{degrees:+04d}" / f"frame_{frame:02d}.png"
                if not path.exists():
                    raise ValueError(f"Missing review frame: {path}")
    screenshot = Image.open(
        ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png"
    ).convert("RGB")
    ground = screenshot.crop((8, 355, 288, 655))
    ground.save(OUT / "map-patch.jpg", quality=88)
    (OUT / "review.html").write_text(
        HTML.replace("__DATA__", json.dumps(metadata)), encoding="utf-8"
    )
    projection = metadata["projection"]
    for size, pw, ph in ((76, 240, 240), (152, 340, 350)):
        board = Image.new("RGBA", (pw * 4, ph * 2), (20, 20, 19, 255))
        draw = ImageDraw.Draw(board)
        background = ground.resize((pw, ph - 30), Image.Resampling.LANCZOS).convert(
            "RGBA"
        )
        scale = size / projection["referenceHeightPixels"]
        root_x, root_y = projection["rootPixels"]
        for index, degrees in enumerate(metadata["directions"]):
            x, y = (index % 4) * pw, (index // 4) * ph
            board.alpha_composite(background, (x, y + 30))
            draw.text((x + 8, y + 8), f"AIM {degrees:+04d}", fill=(235, 223, 202))
            center, foot = x + pw // 2, y + ph - 30
            draw.ellipse(
                (center - 15, foot - 4, center + 15, foot + 4), fill=(12, 11, 10, 100)
            )
            im = Image.open(
                OUT / "stand" / f"yaw{degrees:+04d}" / "frame_01.png"
            ).convert("RGBA")
            im = im.resize(
                (round(im.width * scale), round(im.height * scale)),
                Image.Resampling.LANCZOS,
            )
            board.alpha_composite(
                im, (round(center - root_x * scale), round(foot - root_y * scale))
            )
        board.save(OUT / f"direction-board-{size}px.png")
    print(OUT / "review.html")


HTML = r"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>巡线者八方向握枪核对</title><style>
:root{color-scheme:dark;font-family:system-ui,'Microsoft YaHei',sans-serif}
body{margin:0;background:#191918;color:#e9e0cf}main{max-width:940px;margin:auto;padding:24px}
h1{font-size:24px;margin:0 0 10px}p{color:#c4b9a6;line-height:1.7}
.viewer{display:flex;justify-content:center;min-height:380px;align-items:center}
canvas{border:1px solid #877a62;max-width:100%;height:auto}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
button,select{background:#37332d;color:inherit;border:1px solid #82735d;padding:9px 12px;font:inherit;border-radius:5px}
button{cursor:pointer}input{accent-color:#d7a352}input[type=range]{flex:1;min-width:200px}
:focus-visible{outline:3px solid #d7a352}.note{border-left:3px solid #b7804b;padding-left:12px}
</style><main><h1>巡线者 · 八方向握枪核对</h1>
<p>检查身体朝向、肩肘、双手握点与枪口。这里仍是基础骨架；精细人物、布料和手部另按目标原画制作。</p>
<div class="viewer"><canvas id="canvas" width="360" height="300" aria-label="人物方向动画预览"></canvas></div>
<div class="controls"><select id="aim" aria-label="瞄准方向">
<option value="0">正前方</option><option value="45">右前方</option><option value="90">右方</option>
<option value="135">右后方</option><option value="-180">正后方</option><option value="-135">左后方</option>
<option value="-90">左方</option><option value="-45">左前方</option></select>
<select id="mode" aria-label="动作"><option value="run">移动持枪</option><option value="stand">站立瞄准</option><option value="fire">射击机制演示</option></select>
<select id="size" aria-label="人物尺寸"><option value="76">标称身高 76px</option><option value="152">放大 152px</option></select>
<select id="fps" aria-label="播放速度"><option value="60">正常播放</option><option value="15">慢速播放</option></select>
<button id="play">暂停</button><button id="prev">上一帧</button><button id="next">下一帧</button>
<label><input type="checkbox" id="grid">接地参考网格</label><input type="range" id="timeline" min="1" max="24" value="1" aria-label="帧进度">
<span id="status">加载中</span></div>
<p class="note">方向以原前进方向为基准。腰部转角不超过 45°，髋部与头部一起调整朝向；横移采用更宽站距和较短步幅。射击演示只核对后坐、套筒、握点和抛壳，不代表最终枪械画面或游戏射速。</p>
</main><script>
const data=__DATA__;const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const aim=document.getElementById('aim'),mode=document.getElementById('mode'),size=document.getElementById('size');
const fps=document.getElementById('fps'),play=document.getElementById('play'),timeline=document.getElementById('timeline');
const status=document.getElementById('status'),grid=document.getElementById('grid');
let images=[],frame=0,playing=true,last=0,carry=0,advances=0,loadId=0;
const bg=new Image();bg.src='map-patch.jpg';bg.onload=draw;
function token(){return `yaw${Number(aim.value)>=0?'+':'-'}${String(Math.abs(Number(aim.value))).padStart(3,'0')}`}
async function load(){const id=++loadId;playing=false;images=[];frame=0;advances=0;carry=0;
 const count=data.frames[mode.value];timeline.max=String(count);status.textContent='正在加载';
 const loaded=await Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{
  const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('缺少预览图片'));
  im.src=`${mode.value}/${token()}/frame_${String(i+1).padStart(2,'0')}.png`;
 }))).catch(e=>{status.textContent=e.message;return []});if(id!==loadId)return;
 images=loaded;playing=mode.value!=='stand';play.textContent=playing?'暂停':'播放';draw();}
function draw(){ctx.fillStyle='#24231e';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(bg.complete&&bg.naturalWidth)ctx.drawImage(bg,0,0,canvas.width,canvas.height);
 const p=data.projection,s=Number(size.value)/p.referenceHeightPixels;
 const root=[canvas.width/2,canvas.height-40];
 if(grid.checked){ctx.strokeStyle='#dbcca347';ctx.lineWidth=1;
  const bx=p.floorBasisPixels[0].map(v=>v*s),by=p.floorBasisPixels[1].map(v=>v*s);
  const step=data.clips[token()].supportStepWorld;
  const shift=mode.value==='run'?(advances*step)%0.5:0;
  function point(x,y){return [root[0]+bx[0]*x+by[0]*(y+shift),root[1]+bx[1]*x+by[1]*(y+shift)]}
  for(let i=-16;i<=16;i++){for(const segment of [[point(i*.5,-8),point(i*.5,8)],[point(-8,i*.5),point(8,i*.5)]]){
   ctx.beginPath();ctx.moveTo(...segment[0]);ctx.lineTo(...segment[1]);ctx.stroke();}}
 }
 ctx.fillStyle='#09090870';ctx.beginPath();ctx.ellipse(root[0],root[1],15,4,0,0,Math.PI*2);ctx.fill();
 if(images[frame])ctx.drawImage(images[frame],root[0]-p.rootPixels[0]*s,root[1]-p.rootPixels[1]*s,p.width*s,p.height*s);
 timeline.value=String(frame+1);status.textContent=`${frame+1} / ${Math.max(1,images.length)} 帧`;
}
function pause(){playing=false;play.textContent='播放'}
function step(amount){pause();if(images.length){frame=(frame+amount+images.length)%images.length;advances=frame;draw()}}
play.onclick=()=>{if(mode.value==='fire'&&frame===images.length-1)frame=0;playing=!playing;carry=0;play.textContent=playing?'暂停':'播放';draw()};
document.getElementById('prev').onclick=()=>step(-1);document.getElementById('next').onclick=()=>step(1);
timeline.oninput=()=>{pause();frame=Number(timeline.value)-1;advances=frame;draw()};aim.onchange=load;mode.onchange=load;
size.onchange=()=>{canvas.width=Number(size.value)===152?440:360;canvas.height=Number(size.value)===152?400:300;draw()};grid.onchange=draw;
function tick(time){if(last&&playing&&images.length){carry+=Math.min(100,time-last);const dt=1000/Number(fps.value);
 while(carry>=dt){carry-=dt;advances++;if(mode.value==='fire'&&frame===images.length-1){pause();break;}frame=(frame+1)%images.length;draw();}}
 last=time;requestAnimationFrame(tick)}load();requestAnimationFrame(tick);
</script></html>"""

if __name__ == "__main__":
    main()
