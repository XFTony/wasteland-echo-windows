class_name WorkshopRules
extends RefCounted
## Existing best-time records carry permanent wave progress without a second save format.

const WAVE_SECONDS: float = 45.0


static func completed_waves(save: Dictionary, run: Dictionary = {}) -> int:
	var seconds: float = float(save.get("bestTime", 0))
	if bool(run.get("endless", false)):
		seconds = maxf(seconds, float(run.get("elapsed", 0)))
	return maxi(0, floori(seconds / WAVE_SECONDS))


static func unlocked(upgrade: Dictionary, save: Dictionary, run: Dictionary = {}) -> bool:
	if bool(upgrade.get("requires", {}).get("masteryUnlock", false)) and upgrade.id not in save.get("unlockedEvolutions", []):
		return false
	return completed_waves(save, run) >= int(upgrade.get("unlockWave", 0))


static func detail(upgrade: Dictionary, weapon: Dictionary = {}) -> String:
	match str(upgrade.id):
		"armor":
			return "护甲减伤 +8个百分点"
		"critical":
			return "暴击率 +7个百分点"
		"recovery":
			return "4秒未受击后每秒回复0.4"
		"scavenger":
			return "掉率 +8个百分点 · 收益 +20%（小数累计）"
		"velocity":
			if weapon.get("attackType") == "beam":
				return "射线范围 +8%"
		"focusProtocol":
			return "4秒未受击后攻击必暴击 · 伤害每级+10%"
	return str(upgrade.detail)


static func applicability(upgrade: Dictionary, catalog: GameCatalog) -> String:
	var required: Dictionary = upgrade.get("requires", {})
	if required.has("weaponIds") and not required.weaponIds.is_empty():
		return str(catalog.parameters("weapons", required.weaponIds[0]).name)
	if bool(required.get("structures", false)):
		return "拥有塔台"
	if required.has("attackTypes"):
		var labels: Dictionary = {"slash": "近战", "slam": "砸地", "disc": "弹射", "explosive": "爆破", "projectile": "投射武器"}
		var names: Array[String] = []
		for kind: String in required.attackTypes:
			names.append(labels.get(kind, kind))
		return "/".join(names)
	if upgrade.id in ["projectile", "velocity", "caliber"]:
		return "远程攻击"
	if upgrade.id in ["pierce", "penetratorDoctrine"]:
		return "普通弹丸/射线"
	return "指定武器及前置" if required.has("weaponClasses") else "通用"


static func update_progress(model: RunSimulation) -> void:
	var wave: int = floori(float(model.run.elapsed) / WAVE_SECONDS)
	if wave <= int(model.run.get("completedWaves", 0)):
		return
	var before: int = completed_waves(model.save)
	model.run["completedWaves"] = wave
	model.save.bestTime = maxf(float(model.save.bestTime), wave * WAVE_SECONDS)
	var names: Array[String] = []
	for id: String in model.catalog.all("upgrades"):
		var upgrade: Dictionary = model.catalog.parameters("upgrades", id)
		if int(upgrade.get("unlockWave", 0)) > before and int(upgrade.unlockWave) <= wave:
			names.append(upgrade.name)
	model.run["waveNotice"] = {"at": model.run.elapsed, "completed": wave, "names": names}
	model.push_event("survivalWave", {"completed": wave, "unlocked": names})


static func preview(id: String, player: Dictionary, run: Dictionary, weapon: Dictionary) -> String:
	var after: Dictionary = player.duplicate(true)
	var copied_run: Dictionary = run.duplicate(true)
	if not UpgradeRules.apply(id, after, copied_run):
		return ""
	SurvivalRules.clamp_stats(after)
	if id == "projectile" or id == "swarmProtocol":
		return "本次弹数 %d → %d" % [WeaponRules.projectile_count(weapon, player), WeaponRules.projectile_count(weapon, after)]
	if id == "velocity" and weapon.get("attackType") == "beam":
		return "射线范围 %d → %d" % [WeaponRules.target_range(weapon, player), WeaponRules.target_range(weapon, after)]
	var labels: Dictionary = {"damageMultiplier": "伤害倍率", "fireRateMultiplier": "攻速倍率", "speed": "移动速度",
		"pickupRadius": "拾取范围", "criticalChance": "暴击率", "criticalMultiplier": "暴伤倍率",
		"armor": "减伤比例", "regenPerSecond": "每秒回复", "maxHp": "最大生命",
		"scrapChanceBonus": "额外掉率", "scrapMultiplier": "拾荒币收益倍率", "knockbackMultiplier": "击退倍率",
		"pierceBonus": "额外穿透", "projectileSpeedMultiplier": "弹速倍率", "projectileRadiusBonus": "弹体增量",
		"invulnerabilityDuration": "受击保护", "meleeRangeMultiplier": "近战范围倍率",
		"blastRadiusMultiplier": "爆炸范围倍率", "bounceBonus": "额外弹射", "chillDurationBonus": "减速延长"}
	labels["projectileRangeMultiplier"] = "射程倍率"
	labels["spreadMultiplier"] = "散布倍率"
	for key: String in labels:
		if not is_equal_approx(float(player.get(key, 0)), float(after.get(key, 0))):
			if key in ["criticalChance", "armor", "scrapChanceBonus"]:
				return "%s %.0f%% → %.0f%%" % [labels[key], float(player.get(key, 0)) * 100, float(after.get(key, 0)) * 100]
			return "%s %s → %s" % [labels[key], _number(player.get(key, 0)), _number(after.get(key, 0))]
	var rank: int = int(run.upgrades.get(id, 0)) + 1
	if id == "executionCapacitor":
		return "每%d击败：储存+%d%%伤害" % [maxi(6, 12 - rank * 2), roundi((0.35 + rank * 0.15) * 100)]
	if id == "killMend":
		return "每12次击败回复 %d 生命" % rank
	if id == "engineering":
		return "塔台伤害 +25%基础值 · 耐久 +15%"
	if id == "turretRepair":
		return "8秒未受击后每秒修复 %d%%" % rank
	return "装配等级 %d → %d" % [rank - 1, rank]


static func _number(value: Variant) -> String:
	return "%.2f" % float(value) if not is_equal_approx(float(value), roundf(float(value))) else str(roundi(float(value)))
