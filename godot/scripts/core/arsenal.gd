class_name Arsenal
extends RefCounted
## Per-weapon refits remain local to the run while mastery perks follow the active ID.


func state(model: RunSimulation, id: String) -> Dictionary:
	if model.run.is_empty() or model.catalog.find("weapons", id) == null:
		return {"status": "missing"}
	var entry: Dictionary = model.run.arsenal.get(id, {})
	var inflation: float = float(SurvivalRules.pressure(model.run.elapsed).price) if model.run.endless else 1.0
	var base: float = float(model.catalog.metadata.survival.gunPrices.get(id, 20))
	var price: int = floori(base * inflation + 0.5)
	var upgrade_price: int = floori(base * (float(entry.tier) + 0.5) * inflation + 0.5) if not entry.is_empty() else 0
	return {"status": ("available" if float(model.run.scrap) >= price else "insufficient")
		if entry.is_empty() else "equipped" if model.run.player.weaponId == id else "owned",
		"price": price, "upgradePrice": upgrade_price, "tier": entry.get("tier", 0),
		"calibration": entry.get("calibration", 0), "canUpgrade": not entry.is_empty()
			and int(entry.tier) < 4 and float(model.run.scrap) >= upgrade_price}


func apply_mastery(model: RunSimulation, id: String) -> void:
	var previous: Dictionary = model.run.activeMasteryPerks if model.run.activeMasteryPerks is Dictionary else {
		"damageMultiplier": 1.0, "copperMultiplier": 1.0, "scrapMultiplier": 1.0, "criticalChance": 0.0}
	var next: Dictionary = {"damageMultiplier": 1.0, "copperMultiplier": 1.0,
		"scrapMultiplier": 1.0, "criticalChance": 0.0}
	MasteryRules.apply_perks(next, model.save, id, model.catalog)
	for key: String in ["damageMultiplier", "copperMultiplier", "scrapMultiplier"]:
		model.run.player[key] = float(model.run.player[key]) / float(previous[key]) * float(next[key])
	model.run.player.criticalChance = clampf(float(model.run.player.criticalChance)
		- float(previous.criticalChance) + float(next.criticalChance), 0, 0.75)
	model.run.activeMasteryPerks = next


func accessible(model: RunSimulation) -> bool:
	if model.run.is_empty() or model.screen != GameSession.Screen.FIELD_SHOP:
		return false
	var station: Dictionary = model.field_market.nearest(model)
	return not station.is_empty() and station.id == model.run.fieldMarket.stationId


func buy(model: RunSimulation, id: String) -> bool:
	if not accessible(model):
		return false
	var current: Dictionary = state(model, id)
	if current.status != "available":
		model.run.fieldMarket.message = "还差 %d 拾荒币" % (int(current.get("price", 0)) - int(model.run.scrap)) if current.status == "insufficient" else "这件武器已在本局武器库中"
		return false
	model.run.scrap -= int(current.price)
	model.run.fieldMarket.spent += int(current.price)
	model.run.arsenal[id] = {"tier": 1, "calibration": 0}
	equip(model, id)
	var name: String = model.catalog.parameters("weapons", id).name
	model.run.fieldMarket.message = "已购买并装备 %s · 本局保留" % name
	model.push_event("fieldPurchase", {"id": id, "name": name, "price": current.price})
	return true


func equip(model: RunSimulation, id: String) -> bool:
	if not accessible(model) or not model.run.arsenal.has(id) or model.catalog.find("weapons", id) == null:
		return false
	model.run.attack = null
	apply_mastery(model, id)
	model.run.player.weaponId = id
	model.run.player.aimTargetId = null
	model.run.player.weaponCooldown = maxf(float(model.run.player.weaponCooldown), 0.12)
	model.run.mechanics = MechanicSystem.create_state()
	model.run.fieldMarket.message = "已装备 %s · 升阶与校准按枪保留" % model.catalog.parameters("weapons", id).name
	model.push_event("weaponChanged", {"weaponId": id})
	return true


func improve(model: RunSimulation, id: String) -> bool:
	if not accessible(model):
		return false
	var current: Dictionary = state(model, id)
	if current.status == "missing":
		return false
	if not current.canUpgrade:
		model.run.fieldMarket.message = "此武器已达到4阶" if int(current.tier) >= 4 else "升阶还差 %d 拾荒币" % maxi(0, int(current.upgradePrice) - int(model.run.scrap))
		return false
	model.run.scrap -= int(current.upgradePrice)
	model.run.fieldMarket.spent += int(current.upgradePrice)
	model.run.arsenal[id].tier += 1
	model.run.fieldMarket.message = "%s 已升至 %d 阶" % [model.catalog.parameters("weapons", id).name, model.run.arsenal[id].tier]
	model.push_event("fieldPurchase", {"id": id, "name": "武器升阶", "price": current.upgradePrice})
	return true
