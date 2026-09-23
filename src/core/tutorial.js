"use strict";

const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ id: "deployment", title: "行装确认", detail: "人物、武器与四部位护具可在部署页左侧人物入口调整。", target: 1.8 }),
  Object.freeze({ id: "move", title: "穿过街区", detail: "使用 WASD、方向键或左摇杆持续移动。", target: 1.2 }),
  Object.freeze({ id: "fire", title: "锁定与射击", detail: "敌人进入枪械射程后自动锁定；按 Space、左键或扳机射击 3 次。", target: 3 }),
  Object.freeze({ id: "pickup", title: "回收战利品", detail: "靠近经验、废料或医疗包完成拾取。", target: 1 }),
  Object.freeze({ id: "upgrade", title: "战地改造", detail: "升级时从四张卡中选择；满足前置条件后会出现终局进化。", target: 1 }),
  Object.freeze({ id: "pause", title: "暂停与撤离", detail: "按 Esc 或 P 暂停。撤离模式还需在终局进入蓝色信标圈。", target: 1 })
]);

function createTutorialState(enabled) {
  return {
    active: Boolean(enabled),
    completed: false,
    stepIndex: 0,
    progress: 0
  };
}

function currentTutorialStep(tutorial) {
  return tutorial && tutorial.active ? TUTORIAL_STEPS[tutorial.stepIndex] || null : null;
}

function advanceTutorial(tutorial, amount = 1) {
  const step = currentTutorialStep(tutorial);
  if (!step) return false;
  tutorial.progress += Math.max(0, Number(amount) || 0);
  if (tutorial.progress < step.target) return false;
  tutorial.stepIndex += 1;
  tutorial.progress = 0;
  if (tutorial.stepIndex >= TUTORIAL_STEPS.length) {
    tutorial.active = false;
    tutorial.completed = true;
  }
  return true;
}

function tutorialProgressRatio(tutorial) {
  const step = currentTutorialStep(tutorial);
  if (!step) return 1;
  return Math.max(0, Math.min(1, tutorial.progress / step.target));
}

module.exports = {
  TUTORIAL_STEPS,
  createTutorialState,
  currentTutorialStep,
  advanceTutorial,
  tutorialProgressRatio
};
