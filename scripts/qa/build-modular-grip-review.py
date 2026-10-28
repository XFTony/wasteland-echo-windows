from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'art/characters/ranger/compact-arsenal-v2/review.html'
TARGET=ROOT/'art/characters/ranger/modular-grips-v3/review.html'


def main():
    page=SOURCE.read_text(encoding='utf-8')
    page=page.replace('荒原回响 · 七枪自动战斗','荒原回响 · 可替换手部与袖口')
    page=page.replace('荒原回响 / 主角动作与枪械样板 02','荒原回响 / 材料兼容性试验 03')
    page=page.replace('七把枪 · 自动瞄准与射击','独立手部 · 可替换持握')
    page=page.replace('默认只需移动和走位。武器自动寻找射程内可攻击的敌人；鼠标不控制射击方向。','枪械、手套和袖口独立保存，切换时合成。原手套可与认可版对照；护手为形状变化测试。')
    extra='<div class="panel toolbar"><label>手部 <select id="hands"></select></label><label>袖口 <select id="cuffs"></select></label><label>查看 <select id="assembly"><option value="modular">分层合成</option><option value="legacy">旧图对照（原手套）</option></select></label><span id="cacheNote" class="small"></span></div>'
    page=page.replace('<div class="panel"><span id="weaponNote">',extra+'<div class="panel"><span id="weaponNote">')
    page=page.replace('<footer>','<details class="panel"><summary>查看枪体、双手与袖口分层</summary><canvas id="parts" width="1000" height="220" aria-label="材料分层对照"></canvas></details><footer>')
    page=page.replace('七枪适配与玩法记录','分层与兼容性制作记录').replace('compact-arsenal-2026-10-27/seven-weapons.webm','modular-grips-2026-10-27/hand-switching.webm')
    page=page.replace('href="../compact-motion-v1/review.html"','href="../compact-arsenal-v2/review.html"')
    page=page.replace('主角采用左右身体翻面及独立枪械瞄准。这里展示基础射击和持握适配，完整升级、武器机制和关卡规则由主游戏执行。','默认手套恢复认可版的相同像素。宽护手与钢灰护腕用于检验材料替换，当前身体仍是巡线者；完整新人物需另作身体与挂点验收。')
    page=page.replace('<script src="arsenal-data.js"></script>', '<script src="modular-data.js"></script><script src="../../../../src/shared/modular-grip-compositor.js"></script><script src="appearance-adapter.js"></script>')
    page=page.replace('<script src="review-controller.js"></script>','<script src="../compact-arsenal-v2/review-controller.js"></script>')
    TARGET.write_text(page,encoding='utf-8');print(TARGET)


if __name__=='__main__':main()
