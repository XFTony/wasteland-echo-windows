class_name ProgressionSystem
extends RefCounted
## Settlement is separate from result presentation and guarded by the run's result field.


static func _damage_entry_before(a: Dictionary, b: Dictionary) -> bool:
	return float(a.amount) > float(b.amount) if float(a.amount) != float(b.amount) else int(a.order) < int(b.order)
func settle(model: RunSimulation, result: String) -> void:
	var save: Dictionary = model.save
	var run: Dictionary = model.run
	run.advice = _build_advice(model, result)
	var mode: Dictionary = model.catalog.parameters("modes", run.modeId)
	var stage: Dictionary = {} if run.endless else model.catalog.parameters("stages", str(run.stageId))
	var before_maps: Array = save.unlockedMaps.duplicate()
	var before_heroes: Array = save.unlockedHeroes.duplicate()
	var earned: float = float(run.scrap) + floorf(float(run.kills) / 10)
	earned += float(mode.get("winReward", 0)) if result == "win" else 0
	save.scrap += earned
	save.totalScrap += earned
	save.totalKills += run.kills
	save.eliteKills += run.eliteKills
	save.bestTime = maxf(float(save.bestTime), float(run.elapsed))
	if float(run.elapsed) >= 30 or int(run.kills) >= 10:
		save.settledRuns += 1
	save.bossesDefeated += run.bossesDefeated
	var previous: Dictionary = save.survivalRecords.get(run.mapId, {"bestTime": 0, "bestKills": 0, "runs": 0})
	save.survivalRecords[run.mapId] = {"bestTime": maxf(float(previous.bestTime), float(run.elapsed)),
		"bestKills": maxi(int(previous.bestKills), int(run.kills)), "runs": int(previous.runs) + 1}
	save.bestNoHitTime = maxf(float(save.bestNoHitTime), float(run.maxNoHitTime) if float(run.maxNoHitTime) != 0 else float(run.player.noHitTime))
	if result == "win":
		save.wins += 1
	var first_clear: bool = false
	if result == "win" and not stage.is_empty():
		first_clear = str(stage.id) not in save.completedStages
		if first_clear:
			save.completedStages.append(stage.id)
	for id: String in model.catalog.all("maps"):
		if id not in save.unlockedMaps:
			save.unlockedMaps.append(id)
	if "dead_rail" in save.completedStages and "bulwark" not in save.unlockedHeroes:
		save.unlockedHeroes.append("bulwark")
	var payout: Dictionary = EconomyRules.payout(run, stage, mode, result)
	if not first_clear:
		payout.gold = 0
	var money: Dictionary = EconomyRules.wallet(save)
	money.copper += int(payout.copper)
	money.gold += int(payout.gold)
	save.totalCopper += int(payout.copper)
	save.totalGold += int(payout.gold)
	var achievements: Array = []
	for definition: Dictionary in model.catalog.metadata.achievements:
		if bool(save.achievements.get(definition.id, false)) or not _achievement_met(definition.id, save, run):
			continue
		save.achievements[definition.id] = true
		var copper: int = int(definition.reward.get("copper", 0))
		var gold: int = int(definition.reward.get("gold", 0))
		money.copper += copper
		money.gold += gold
		save.totalCopper += copper
		save.totalGold += gold
		achievements.append({"id": definition.id, "name": definition.name, "copper": copper, "gold": gold})
	var mastery_record: Dictionary = _update_mastery(save, run, result, model.catalog)
	var rule_unlocks: Array = UnlockRules.evaluate(save, run, model.catalog)
	run.unlockRewards = rule_unlocks
	var unlocked: Array[String] = []
	for id: String in save.unlockedMaps:
		if id not in before_maps:
			unlocked.append("地图：" + str(model.catalog.parameters("maps", id).name))
	for id: String in save.unlockedHeroes:
		if id not in before_heroes:
			unlocked.append("角色：" + str(model.catalog.parameters("heroes", id).name))
	for achievement: Dictionary in achievements:
		unlocked.append("成就：" + str(achievement.name))
	for rule: Dictionary in rule_unlocks:
		unlocked.append("规则：%s · %s" % [rule.name, rule.reward.name])
	for reward: Dictionary in run.masteryRewards:
		unlocked.append("精通 Lv.%d：%s" % [reward.level, reward.name])
	run.payout = payout
	run.accuracy = clampf(float(run.hits) / float(run.projectilesFired), 0, 1) if int(run.projectilesFired) > 0 else 0.0
	_record_history(save, run, result)
	run["settlement"] = {"earned": earned, "unlocked": unlocked, "payout": payout,
		"achievementUnlocks": achievements, "masteryRecord": mastery_record,
		"masteryRewards": run.masteryRewards, "ruleUnlocks": rule_unlocks}


func _update_mastery(save: Dictionary, run: Dictionary, result: String, catalog: GameCatalog) -> Dictionary:
	var id: String = run.player.weaponId
	if result == "retire" and run.has("elapsed") and float(run.elapsed) < 10 and int(run.get("shotsFired", 0)) == 0:
		run.masteryGain = 0
		run.masteryRewards = []
		run.masteryLevel = save.weaponMastery.get(id, {}).get("level", 1)
		return save.weaponMastery.get(id, {"kills": 0, "runs": 0, "experience": 0, "level": 1})
	var used: Array[String] = []
	for weapon_id: String in run.get("weaponStats", {}):
		if int(run.weaponStats[weapon_id].shots) > 0:
			used.append(weapon_id)
	if not used.is_empty():
		var total: int = 0
		var rewards: Array = []
		var selected: Dictionary = {}
		for weapon_id: String in used:
			var stats: Dictionary = run.weaponStats[weapon_id]
			var contribution: Dictionary = {"player": {"weaponId": weapon_id},
				"kills": stats.kills, "eliteKills": stats.get("eliteKills", 0), "damageDealt": stats.damage}
			var record: Dictionary = _update_mastery(save, contribution, result, catalog)
			total += int(contribution.masteryGain)
			rewards.append_array(contribution.masteryRewards)
			if weapon_id == id:
				selected = record
		run.masteryGain = total
		run.masteryRewards = rewards
		run.masteryLevel = selected.level if not selected.is_empty() else save.weaponMastery.get(id, {}).get("level", 1)
		return selected if not selected.is_empty() else save.weaponMastery[used[0]]
	var previous: Dictionary = save.weaponMastery.get(id, {"kills": 0, "runs": 0, "experience": 0, "level": 1})
	var previous_level: int = clampi(int(previous.get("level", MasteryRules.level_for_experience(previous.experience))), 1, 10)
	var gain: int = maxi(1, maxi(0, int(run.kills)) + maxi(0, int(run.eliteKills)) * 4
		+ floori(maxf(0, float(run.damageDealt)) / 250) + (20 if result == "win" else 5))
	var record: Dictionary = {"kills": int(previous.kills) + int(run.kills),
		"runs": int(previous.runs) + 1, "experience": int(previous.experience) + gain, "level": 1}
	record.level = MasteryRules.level_for_experience(float(record.experience))
	save.weaponMastery[id] = record
	run.masteryGain = gain
	run.masteryLevel = record.level
	run.masteryRewards = MasteryRules.grant_rewards(save, id, previous_level, int(record.level), catalog)
	return record


func _record_history(save: Dictionary, run: Dictionary, result: String) -> void:
	save.runHistory.push_front({"seed": run.seed, "modeId": run.modeId, "stageId": run.stageId,
		"mapId": run.mapId, "weaponId": run.player.weaponId, "result": result,
		"bossesDefeated": run.bossesDefeated, "elapsed": run.elapsed, "kills": run.kills,
		"damageDealt": run.damageDealt, "accuracy": run.accuracy, "maxNoHitTime": run.maxNoHitTime,
		"masteryGain": run.masteryGain, "masteryLevel": run.masteryLevel,
		"completedAt": floori(Time.get_unix_time_from_system() * 1000)})
	if save.runHistory.size() > 20:
		save.runHistory.resize(20)


func _achievement_met(id: String, save: Dictionary, run: Dictionary) -> bool:
	match id:
		"first_signal":
			return float(save.bestTime) >= 180 or int(save.wins) >= 1
		"steady_hands":
			return float(save.bestNoHitTime) >= 120
		"three_returns":
			return int(save.settledRuns) >= 3 or int(save.wins) >= 3
		"scrap_hundred":
			return int(save.totalKills) >= 100
		"scrap_five_hundred":
			return int(save.totalKills) >= 500
		"elite_breaker":
			return int(save.eliteKills) >= 25
		"endless_three":
			return int(run.bossesDefeated) >= 3
		"field_armory":
			return save.unlockedWeapons.size() >= 5
	return false


func _build_advice(model: RunSimulation, result: String) -> Array[String]:
	var advice: Array[String] = []
	if result != "lose":
		return advice
	var run: Dictionary = model.run
	var entries: Array[Dictionary] = []
	var sum: float = 0.0
	for id: String in run.damageTakenBySource:
		var amount: float = float(run.damageTakenBySource[id])
		sum += amount
		entries.append({"id": id, "amount": amount, "order": entries.size()})
	entries.sort_custom(_damage_entry_before)
	var total: float = maxf(0, float(run.damageTaken) if float(run.damageTaken) != 0 else sum)
	if not entries.is_empty() and total > 0:
		var entry: Dictionary = entries[0]
		var definition: Dictionary = model.catalog.parameters("enemies", entry.id)
		var name: String = str(definition.name) if not definition.is_empty() else "未识别威胁" if entry.id == "unknown" else str(entry.id)
		var share: int = floori(float(entry.amount) / total * 100 + 0.5)
		var tips: Dictionary = model.catalog.metadata.get("runAdviceTips", {})
		var tip: String = str(tips.get(entry.id, "调整路线，减少来自同一方向的连续承伤"))
		advice.append("主要威胁：%s造成 %d%% 承伤；%s" % [name, share, tip])
	if run.rule == "extract" and int(run.player.level) < 3:
		advice.append("撤离节奏：先在安全区收集经验形成构筑，再前往终局信标")
	var accuracy: float = float(run.hits) / float(run.projectilesFired) if int(run.projectilesFired) > 0 else 0.0
	if int(run.projectilesFired) >= 20 and accuracy < 0.58:
		advice.append("射击复盘：弹体命中率仅 %d%%，缩短交火距离或开启辅助锁定" % floori(accuracy * 100 + 0.5))
	if run.upgradeOrder.size() < 2 and float(run.elapsed) >= 45:
		advice.append("构筑进度：升级次数偏少，绕回战利品密集区并避免过早守在地图边缘")
	if advice.size() < 2:
		advice.append("下一局优先保留一条退路，并在最终攻势前补足生命与护甲")
	return advice.slice(0, 3)
