class_name UpgradeDraftSystem
extends RefCounted
## Candidate order and random consumption match the existing four-card draft.

var _pool: Array[Dictionary] = []
var _evolutions: Array[Dictionary] = []
var _fallback: Array[Dictionary] = []


func requirements_met(model: RunSimulation, upgrade: Dictionary) -> bool:
	if not WorkshopRules.unlocked(upgrade, model.save, model.run):
		return false
	var weapon: Dictionary = model.catalog.parameters("weapons", model.run.player.weaponId)
	var kind: String = str(weapon.get("attackType", "projectile"))
	if upgrade.id == "armor" and float(model.run.player.armor) >= 0.45:
		return false
	if upgrade.id == "critical" and float(model.run.player.criticalChance) >= 0.42:
		return false
	if upgrade.id == "fireRate" and kind in ["slash", "slam"] and float(model.run.player.fireRateMultiplier) * float(EconomyRules.weapon_modifiers(model.run).rate) >= 2.4:
		return false
	if upgrade.id == "projectile" and WeaponRules.projectile_count(weapon, model.run.player) >= (3 if kind == "beam" else 6 if kind in ["disc", "explosive"] else 16):
		return false
	if kind in ["disc", "explosive"] and upgrade.id in ["pierce", "penetratorDoctrine"]:
		return false
	if kind in ["slash", "slam"] and upgrade.id in ["projectile", "pierce", "velocity", "caliber"]:
		return false
	var required: Dictionary = upgrade.get("requires", {})
	if required.is_empty():
		return true
	if required.has("attackTypes") and kind not in required.attackTypes:
		return false
	if bool(required.get("structures", false)) and model.structures.owned_count(model) == 0:
		return false
	for id: String in required.get("upgrades", {}):
		if int(model.run.upgrades.get(id, 0)) < int(required.upgrades[id]):
			return false
	if bool(required.get("masteryUnlock", false)) and upgrade.id not in model.save.unlockedEvolutions:
		return false
	for pair: Array in [["weaponClasses", "weaponClass"], ["rangeBands", "rangeBand"]]:
		if required.has(pair[0]) and not required[pair[0]].is_empty() and weapon[pair[1]] not in required[pair[0]]:
			return false
	if required.has("weaponIds") and not required.weaponIds.is_empty() and weapon.id not in required.weaponIds:
		return false
	return true


func create_options(model: RunSimulation) -> Array[Dictionary]:
	_pool.clear()
	_evolutions.clear()
	_fallback.clear()
	for id: String in model.catalog.all("upgrades"):
		var upgrade: Dictionary = model.catalog.parameters("upgrades", id)
		if int(model.run.upgrades.get(id, 0)) >= int(upgrade.max) or not requirements_met(model, upgrade):
			continue
		if bool(upgrade.get("fallback", false)):
			_fallback.append(upgrade)
		elif bool(upgrade.get("evolution", false)):
			_evolutions.append(upgrade)
		else:
			_pool.append(upgrade)
	var choices: Array[Dictionary] = []
	while choices.size() < 4 and not _evolutions.is_empty():
		var index: int = model.random.range_int(0, _evolutions.size() - 1)
		choices.append(_evolutions[index])
		_evolutions[index] = _evolutions.back()
		_evolutions.pop_back()
	while choices.size() < 4 and not _pool.is_empty():
		var total: float = 0
		for upgrade: Dictionary in _pool:
			total += _weight(model, upgrade)
		var cursor: float = model.random.next() * total
		var selected: int = _pool.size() - 1
		for index: int in range(_pool.size()):
			cursor -= _weight(model, _pool[index])
			if cursor <= 0:
				selected = index
				break
		choices.append(_pool[selected])
		_pool[selected] = _pool.back()
		_pool.pop_back()
	while choices.size() < 4 and not _fallback.is_empty():
		var index: int = model.random.range_int(0, _fallback.size() - 1)
		choices.append(_fallback[index])
		_fallback.remove_at(index)
	var presented: Array[Dictionary] = []
	var weapon: Dictionary = model.catalog.parameters("weapons", model.run.player.weaponId)
	for original: Dictionary in choices:
		var option: Dictionary = original.duplicate(true)
		option["preview"] = WorkshopRules.preview(option.id, model.run.player, model.run, weapon)
		option.detail = WorkshopRules.detail(option, weapon)
		presented.append(option)
	return presented


func choose(model: RunSimulation, id: String) -> bool:
	if model.screen != GameSession.Screen.UPGRADE:
		return false
	var upgrade: Dictionary = {}
	for candidate: Dictionary in model.run.upgradeOptions:
		if candidate.id == id:
			upgrade = candidate
			break
	if upgrade.is_empty() or int(model.run.upgrades.get(id, 0)) >= int(upgrade.max):
		return false
	if not UpgradeRules.apply(id, model.run.player, model.run):
		return false
	SurvivalRules.clamp_stats(model.run.player)
	var level: int = int(model.run.upgrades.get(id, 0)) + 1
	model.run.upgrades[id] = level
	model.run.upgradeOrder.append({"id": id, "level": level, "elapsed": model.run.elapsed})
	_trim_order(model)
	model.run.upgradeOptions = []
	model.set_screen(GameSession.Screen.RUNNING)
	model.progress_tutorial("upgrade", 1)
	model.push_event("upgrade", {"id": id})
	return true


func salvage(model: RunSimulation) -> bool:
	if model.screen != GameSession.Screen.UPGRADE or model.run.upgradeOptions.is_empty():
		return false
	var value: int = mini(18, 4 + floori(float(model.run.player.level) / 2) * 2)
	model.run.scrap += value
	model.run.upgradeOrder.append({"id": "salvage", "level": 1, "elapsed": model.run.elapsed, "value": value})
	_trim_order(model)
	model.run.upgradeOptions = []
	model.set_screen(GameSession.Screen.RUNNING)
	model.progress_tutorial("upgrade", 1)
	model.push_event("upgradeSalvage", {"value": value})
	return true


func _weight(model: RunSimulation, upgrade: Dictionary) -> float:
	return (1.0 + (0.7 if int(model.run.upgrades.get(upgrade.id, 0)) > 0 else 0)
		+ (0.25 if int(model.run.mechanicUpgrades.get(upgrade.id, 0)) > 0 else 0))


func _trim_order(model: RunSimulation) -> void:
	if model.run.upgradeOrder.size() > 128:
		model.run.upgradeOrder.pop_front()
