"use strict";

const WEAPON_MECHANICS = Object.freeze({
  beam: Object.freeze({id:"beam",name:"折光脉冲",description:"瞬时射线，有限贯穿，遇墙终止"}),
  explosive: Object.freeze({id:"explosive",name:"接触引信",description:"榴弹接触或到时引爆，范围伤害受墙体阻挡"}),
  disc: Object.freeze({id:"disc",name:"逐跳锯切",description:"向未命中的可见目标弹射，逐跳衰减"}),
  slash: Object.freeze({id:"slash",name:"回响刃波",description:"近身挥扫后释放有限距离剑气"}),
  slam: Object.freeze({id:"slam",name:"震荡落锤",description:"举锤后在前方产生扩散冲击，短时消弹"}),
  steady_cycle: Object.freeze({
    id: "steady_cycle",
    name: "四拍稳压",
    description: "废料手枪每第 4 次扣动扳机获得强化弹"
  }),
  heat_ramp: Object.freeze({
    id: "heat_ramp",
    name: "热膛递增",
    description: "蜂群冲锋枪连续射击会升温并提高单发威力"
  }),
  breach_cone: Object.freeze({
    id: "breach_cone",
    name: "破门距离",
    description: "破门霰弹枪在近距离获得额外伤害与击退"
  }),
  focus_lance: Object.freeze({
    id: "focus_lance",
    name: "静息聚焦",
    description: "针刺步枪停火或长时间无伤后强化下一发贯穿弹"
  }),
  sixth_chamber: Object.freeze({
    id: "sixth_chamber",
    name: "第六膛室",
    description: "锈痕左轮每第 6 发必定暴击"
  }),
  momentum_feed: Object.freeze({
    id: "momentum_feed",
    name: "动量供弹",
    description: "余烬卡宾枪在移动射击时提高弹速与伤害"
  }),
  arc_overload: Object.freeze({
    id: "arc_overload",
    name: "三相过载",
    description: "荒雷线圈炮每第 3 发获得额外伤害与穿透"
  })
});

module.exports = { WEAPON_MECHANICS };
