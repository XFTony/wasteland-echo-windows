"use strict";

const SOURCE_TIPS = Object.freeze({
  spitter: "保持横向移动，并优先处理远程腐蚀弹幕",
  runner: "突袭者贴近前预留移动空间，不要在障碍角落停留",
  brute: "重甲者冲锋前拉开直线距离，利用掩体改变其路径",
  screecher: "警报者会强化尸群，应优先击破",
  crawler: "爬行群数量多，保留穿透或范围火力",
  iron_colossus: "观察巨像阶段预警，第三阶段避免停在正前方",
  warden: "看守的环形冲击需要提前穿过弹幕空隙",
  drifter: "基础感染者承伤过高，说明走位路线被尸群封死"
});

function buildRunAdvice(run, result, content) {
  if (!run || result !== "lose") return [];
  const advice = [];
  const damageEntries = Object.entries(run.damageTakenBySource || {}).sort((a, b) => b[1] - a[1]);
  const totalDamage = Math.max(0, Number(run.damageTaken) || damageEntries.reduce((sum, entry) => sum + Number(entry[1] || 0), 0));
  if (damageEntries.length && totalDamage > 0) {
    const [sourceId, sourceDamage] = damageEntries[0];
    const definition = content && content.get ? content.get("enemies", sourceId, null) : null;
    const sourceName = definition ? definition.name : sourceId === "unknown" ? "未识别威胁" : sourceId;
    const share = Math.round(Number(sourceDamage) / totalDamage * 100);
    const tip = SOURCE_TIPS[sourceId] || "调整路线，减少来自同一方向的连续承伤";
    advice.push(`主要威胁：${sourceName}造成 ${share}% 承伤；${tip}`);
  }
  if (run.rule === "extract" && Number(run.player && run.player.level) < 3) {
    advice.push("撤离节奏：先在安全区收集经验形成构筑，再前往终局信标");
  }
  const accuracy = run.projectilesFired > 0 ? run.hits / run.projectilesFired : 0;
  if (run.projectilesFired >= 20 && accuracy < 0.58) {
    advice.push(`射击复盘：弹体命中率仅 ${Math.round(accuracy * 100)}%，缩短交火距离或开启辅助锁定`);
  }
  if ((run.upgradeOrder || []).length < 2 && Number(run.elapsed) >= 45) {
    advice.push("构筑进度：升级次数偏少，绕回战利品密集区并避免过早守在地图边缘");
  }
  if (advice.length < 2) advice.push("下一局优先保留一条退路，并在最终攻势前补足生命与护甲");
  return advice.slice(0, 3);
}

module.exports = { SOURCE_TIPS, buildRunAdvice };
