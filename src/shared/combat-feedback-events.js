"use strict";

// Merge only presentation events in the current batch; gameplay hit counts stay exact.
function mergeFeedbackHits(events) {
  const result = [], groups = new Map();
  for (const event of events) {
    if (event.type !== "hit" || !(event.attackId > 0) || !event.enemyId) { result.push(event); continue; }
    const key = event.attackId + ":" + event.enemyId;
    const prior = groups.get(key);
    if (!prior) {
      const copy = { ...event, hitCount: 1 };
      groups.set(key, copy);result.push(copy);
    } else {
      prior.x = (prior.x * prior.hitCount + event.x) / (prior.hitCount + 1);
      prior.y = (prior.y * prior.hitCount + event.y) / (prior.hitCount + 1);
      prior.damage += event.damage;prior.hitCount += 1;prior.critical = prior.critical || event.critical;
    }
  }
  return result;
}

module.exports = { mergeFeedbackHits };
