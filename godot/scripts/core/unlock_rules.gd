class_name UnlockRules
extends RefCounted
## Progress queries are pure; rewards are granted once by stable rule identity.


static func condition_value(save: Dictionary, run: Dictionary, condition: Dictionary) -> float:
	match str(condition.get("metric", "")):
		"totalKills", "eliteKills", "wins", "settledRuns":
			return maxf(0, float(save.get(condition.metric, 0)))
		"bestTime":
			return maxf(float(save.get("bestTime", 0)), float(run.get("elapsed", 0)))
		"bossesDefeated", "endlessBossWave":
			return maxf(0, float(run.get(condition.metric, 0)))
		"bestNoHitTime":
			return maxf(float(save.get("bestNoHitTime", 0)), maxf(
				float(run.get("maxNoHitTime", 0)), float(run.get("player", {}).get("noHitTime", 0))))
		"completedStage":
			return 1 if condition.get("id") in save.get("completedStages", []) else 0
		"masteryAny":
			var highest: float = 1
			for record: Dictionary in save.get("weaponMastery", {}).values():
				highest = maxf(highest, float(record.get("level", 1)))
			return highest
	return 0


static func progress(save: Dictionary, run: Dictionary, rule: Dictionary) -> Dictionary:
	var details: Array[Dictionary] = []
	var completed: int = 0
	var ratio: float = 1.0
	for condition: Dictionary in rule.get("conditions", []):
		var current: float = condition_value(save, run, condition)
		var target: float = 1.0 if condition.metric == "completedStage" else maxf(1, float(condition.get("gte", 1)))
		var fraction: float = clampf(current / target, 0.0, 1.0)
		details.append({"metric": condition.metric, "id": condition.get("id"),
			"current": current, "target": target, "ratio": fraction, "completed": current >= target})
		completed += 1 if current >= target else 0
		ratio = minf(ratio, fraction)
	return {"ruleId": rule.get("id"), "completed": not details.is_empty() and completed == details.size(),
		"completedConditions": completed, "totalConditions": details.size(),
		"ratio": ratio if not details.is_empty() else 0.0, "conditions": details}


static func evaluate(save: Dictionary, run: Dictionary, catalog: GameCatalog) -> Array:
	var granted: Array = []
	for id: String in catalog.all("unlockRules"):
		if id in save.completedUnlockRules:
			continue
		var rule: Dictionary = catalog.parameters("unlockRules", id)
		if not progress(save, run, rule).completed:
			continue
		save.completedUnlockRules.append(id)
		var reward: Dictionary = rule.reward
		var list_name: String = {"shopBlueprint": "unlockedBlueprints", "hero": "unlockedHeroes",
			"modifier": "unlockedModifiers"}.get(reward.kind, "")
		if not list_name.is_empty() and reward.id not in save[list_name]:
			save[list_name].append(reward.id)
		granted.append({"id": id, "name": rule.name, "reward": reward})
	return granted
