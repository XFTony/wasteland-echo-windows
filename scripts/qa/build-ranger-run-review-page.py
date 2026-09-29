"""Build a local, pauseable 76px/152px preview of the ranger graybox loop."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/animation/ranger/run-ik-v2"
LOOP = OUTPUT / "loop"
FRAMES = OUTPUT / "review-frames"
SCREENSHOT = ROOT / "output/playwright/v15-painted/echo-combat-1280x720.png"


def main() -> None:
    images = [
        Image.open(LOOP / f"frame_{frame:02d}.png").convert("RGBA")
        for frame in range(1, 25)
    ]
    bounds = [image.getchannel("A").getbbox() for image in images]
    if any(box is None for box in bounds):
        raise ValueError("An animation frame is empty")
    crop = (
        min(box[0] for box in bounds),
        min(box[1] for box in bounds),
        max(box[2] for box in bounds),
        max(box[3] for box in bounds),
    )
    FRAMES.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(images, 1):
        image.crop(crop).save(FRAMES / f"frame_{index:02d}.png")
    screenshot = Image.open(SCREENSHOT).convert("RGB")
    screenshot.crop((8, 355, 288, 655)).save(OUTPUT / "review-ground.jpg", quality=88)
    (OUTPUT / "review.html").write_text(HTML, encoding="utf-8")
    print(OUTPUT / "review.html")


HTML = r"""<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>巡线者跑步灰模评审</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, 'Microsoft YaHei', sans-serif; }
  body { margin: 0; background: #181818; color: #eee5d4; }
  main { max-width: 820px; margin: 0 auto; padding: 28px 20px 50px; }
  h1 { font-size: 24px; margin: 0 0 10px; }
  p { color: #c8bcaa; line-height: 1.7; }
  .stage-wrap { min-height: 370px; display: grid; place-items: center; }
  .stage { width: 220px; height: 220px; position: relative; overflow: hidden;
    border: 1px solid #8c7a62; background: #3c3831; }
  .stage.large { width: 320px; height: 350px; }
  .ground { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .shadow { position: absolute; width: 32px; height: 8px; left: calc(50% - 16px);
    bottom: 28px; background: #0d0c0b99; border-radius: 50%; }
  .actor { position: absolute; height: 76px; width: auto; left: 50%; bottom: 32px;
    transform: translateX(-50%); image-rendering: auto; }
  .large .actor { height: 152px; }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  button, select { color: inherit; background: #38332e; border: 1px solid #8c7a62;
    border-radius: 6px; padding: 9px 14px; font: inherit; cursor: pointer; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #d9a55d; }
  input[type=range] { flex: 1; min-width: 180px; accent-color: #d9a55d; }
  .status { font-variant-numeric: tabular-nums; min-width: 120px; }
  .note { border-left: 3px solid #bb8750; padding-left: 12px; margin-top: 22px; }
</style>
<main>
  <h1>巡线者 · 跑步灰模评审</h1>
  <p>只看动作、落脚和人物比例。此样板尚未上色，也未进入游戏。</p>
  <div class="stage-wrap"><div id="stage" class="stage">
    <img class="ground" src="review-ground.jpg" alt="现有战斗地图背景">
    <div class="shadow"></div>
    <img id="actor" class="actor" src="review-frames/frame_01.png" alt="巡线者灰模动作">
  </div></div>
  <div class="controls">
    <button id="play" type="button">暂停</button>
    <button id="back" type="button" aria-label="上一帧">上一帧</button>
    <button id="next" type="button" aria-label="下一帧">下一帧</button>
    <select id="size" aria-label="显示尺寸"><option value="76">游戏尺寸 76px</option>
      <option value="152">放大检查 152px</option></select>
    <select id="fps" aria-label="播放速度"><option value="60">60 帧/秒</option>
      <option value="30">半速 30 帧/秒</option><option value="15">慢速 15 帧/秒</option></select>
    <span id="status" class="status">第 1 / 24 帧</span>
    <input id="timeline" type="range" min="1" max="24" value="1" aria-label="逐帧查看">
  </div>
  <p class="note">左脚主要接地：第 1–7 帧；右脚主要接地：第 13–19 帧。第 10、22 帧为短暂离地。请重点看是否仍有滑步、脚底悬空或头肩过重。</p>
</main>
<script>
  const actor = document.getElementById('actor');
  const stage = document.getElementById('stage');
  const play = document.getElementById('play');
  const timeline = document.getElementById('timeline');
  const status = document.getElementById('status');
  const fps = document.getElementById('fps');
  const names = Array.from({length: 24}, (_, i) =>
    `review-frames/frame_${String(i + 1).padStart(2, '0')}.png`);
  names.forEach(src => { const image = new Image(); image.src = src; });
  let frame = 0, playing = true, last = 0, carry = 0;
  function show(index) {
    frame = (index + 24) % 24;
    actor.src = names[frame];
    timeline.value = String(frame + 1);
    status.textContent = `第 ${frame + 1} / 24 帧`;
  }
  function pause() { playing = false; play.textContent = '播放'; }
  play.addEventListener('click', () => {
    playing = !playing; play.textContent = playing ? '暂停' : '播放';
    carry = 0;
  });
  document.getElementById('back').addEventListener('click', () => { pause(); show(frame - 1); });
  document.getElementById('next').addEventListener('click', () => { pause(); show(frame + 1); });
  timeline.addEventListener('input', () => { pause(); show(Number(timeline.value) - 1); });
  document.getElementById('size').addEventListener('change', event =>
    stage.classList.toggle('large', event.target.value === '152'));
  function tick(time) {
    if (last && playing) {
      carry += Math.min(time - last, 100);
      const interval = 1000 / Number(fps.value);
      while (carry >= interval) { show(frame + 1); carry -= interval; }
    }
    last = time;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
</script>
</html>
"""


if __name__ == "__main__":
    main()
