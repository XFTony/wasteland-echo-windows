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
	reconcile_owned(save, catalog)
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
		var changed: bool = not list_name.is_empty() and reward.id not in save[list_name]
		if changed:
			save[list_name].append(reward.id)
		var reward_name: String = str(reward.id)
		if reward.kind == "shopBlueprint":
			reward_name = str(catalog.parameters("shopItems", reward.id).get("name", reward.id)) + "蓝图"
		elif reward.kind == "hero":
			reward_name = "角色：" + str(catalog.parameters("heroes", reward.id).get("name", reward.id))
		elif reward.kind == "modifier":
			reward_name = "协议：" + str(catalog.parameters("modifiers", reward.id).get("name", reward.id))
		granted.append({"ruleId": id, "name": rule.name, "description": rule.description,
			"reward": {"changed": changed, "kind": reward.kind, "id": reward.id, "name": reward_name},
			"progress": progress(save, run, rule)})
	return granted


static func reconcile_owned(save: Dictionary, catalog: GameCatalog) -> void:
	for id: String in catalog.all("unlockRules"):
		var rule: Dictionary = catalog.parameters("unlockRules", id)
		var reward: Dictionary = rule.reward
		var owned: bool = false
		if reward.kind == "shopBlueprint":
			var item: Dictionary = catalog.parameters("shopItems", reward.id)
			var list_name: String = EconomyRules.GRANT_LISTS.get(item.get("grantType", ""), "")
			owned = not list_name.is_empty() and item.grantId in save.get(list_name, [])
			if owned and reward.id not in save.unlockedBlueprints:
				save.unlockedBlueprints.append(reward.id)
		elif reward.kind == "hero":
			owned = reward.id in save.unlockedHeroes
		elif reward.kind == "modifier":
			owned = reward.id in save.unlockedModifiers
		if owned and id not in save.completedUnlockRules:
			save.completedUnlockRules.append(id)
