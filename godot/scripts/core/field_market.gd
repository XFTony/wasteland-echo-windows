class_name FieldMarket
extends RefCounted
## Combat time, not UI time, controls replenishment and inflation.


func nearest(model: RunSimulation) -> Dictionary:
	if model.run.is_empty():
		return {}
	var player: Dictionary = model.run.player
	var result: Dictionary = {}
	var best: float = INF
	for item: Dictionary in model.interactives:
		if not item.active or item.type != "tradePost":
			continue
		var squared: float = GeometryRules.distance_squared(player.x, player.y, item.x, item.y)
		if squared > pow(float(item.radius), 2) or squared >= best:
			continue
		if is_inf(GeometryRules.first_obstacle_time(model.obstacles, player.x, player.y,
			float(item.x) - float(player.x), float(item.y) - float(player.y))):
			result = item
			best = squared
	return result


func open(model: RunSimulation) -> bool:
	var station: Dictionary = nearest(model)
	if model.screen != GameSession.Screen.RUNNING or station.is_empty():
		return false
	model.run.fieldMarket.stationId = station.id
	model.structures.cancel(model)
	model.run.attack = null
	model.run.fieldMarket.message = "改件仅本局生效 · 交易期间战斗与计时暂停"
	model.set_screen(GameSession.Screen.FIELD_SHOP)
	model.push_event("fieldMarketOpen", {"stationId": station.id})
	return true


func close(model: RunSimulation) -> bool:
	if model.screen != GameSession.Screen.FIELD_SHOP:
		return false
	model.run.fieldMarket.stationId = null
	model.set_screen(GameSession.Screen.RUNNING)
	model.push_event("resume")
	return true


func state(model: RunSimulation, id: String) -> Dictionary:
	var item: Dictionary = model.catalog.parameters("fieldGoods", id)
	if model.run.is_empty() or item.is_empty():
		return {"status": "missing", "affordable": false}
	var run: Dictionary = model.run
	var entry: Dictionary = run.arsenal[run.player.weaponId]
	var count: int = int(entry.calibration) if item.effect == "weapon" else int(run.fieldMarket.purchases.get(id, 0))
	var maximum: float = float(item.get("cap", INF if bool(item.get("repeat", false)) else item.prices.size()))
	var base: float = float(item.prices[mini(count, item.prices.size() - 1)])
	var inflation: float = float(SurvivalRules.pressure(run.elapsed).price) if run.endless else 1.0
	var price: int = floori(base * (1 + maxi(0, count - item.prices.size() + 1) * 0.22) * inflation + 0.5)
	var remaining: float = maxf(0, float(run.fieldMarket.lastPurchased.get(id, -INF))
		+ float(item.get("cooldown", 0)) - float(run.elapsed))
	var balance: int = maxi(0, floori(float(run.scrap)))
	var status: String = "available"
	if count >= maximum:
		status = "soldOut"
	elif item.effect == "turret" and model.structures.owned_count(model) >= int(model.catalog.metadata.survival.turret.maxCount):
		status = "capacity"
	elif remaining > 0.001:
		status = "cooldown"
	elif item.effect == "heal" and float(run.player.hp) >= float(run.player.maxHp):
		status = "fullHealth"
	elif item.effect == "armor" and float(run.player.armor) >= 0.55:
		status = "capped"
	elif item.effect == "speed" and float(run.player.speed) >= 360 or item.effect == "magnet" and float(run.player.pickupRadius) >= 440:
		status = "capped"
	elif balance < price:
		status = "insufficient"
	return {"status": status, "count": count, "price": price, "balance": balance,
		"max": maximum, "remaining": remaining, "affordable": status == "available",
		"difference": maxi(0, price - balance)}


func purchase(model: RunSimulation, id: String) -> Dictionary:
	var station: Dictionary = nearest(model)
	if model.screen != GameSession.Screen.FIELD_SHOP or station.is_empty() or station.id != model.run.fieldMarket.stationId:
		return {"ok": false, "status": "closed"}
	var item: Dictionary = model.catalog.parameters("fieldGoods", id)
	var current: Dictionary = state(model, id)
	if item.is_empty() or current.status != "available":
		model.run.fieldMarket.message = {"soldOut": "该改件已达到本局上限",
			"fullHealth": "生命已满，无需购买急救包", "capped": "属性已达到上限",
			"capacity": "场上与库存合计最多4座塔台", "cooldown": "还需战斗 %d 秒补货" % ceili(float(current.get("remaining", 0))),
			"insufficient": "还差 %d 拾荒币" % int(current.get("difference", 0))}.get(current.status, "货品不可用")
		current["ok"] = false
		return current
	var player: Dictionary = model.run.player
	match str(item.effect):
		"weapon":
			model.run.arsenal[player.weaponId].calibration += 1
		"heal":
			player.hp = minf(float(player.maxHp), float(player.hp) + float(player.maxHp) * 0.3)
		"speed":
			player.speed *= 1.06
		"armor":
			player.armor = minf(0.55, float(player.armor) + 0.04)
		"magnet":
			player.pickupRadius *= 1.15
		"turret":
			model.run.turretKits += 1
			model.run.turretKitHealth.append(1.0)
		"engineering":
			model.run.engineering += 1
		_:
			return {"ok": false, "status": "missingEffect"}
	model.run.scrap -= int(current.price)
	model.run.fieldMarket.spent += int(current.price)
	model.run.fieldMarket.purchases[id] = int(current.count) + 1
	model.run.fieldMarket.lastPurchased[id] = model.run.elapsed
	SurvivalRules.clamp_stats(player)
	model.run.fieldMarket.message = "已装配 %s · 本局生效" % item.name
	model.push_event("fieldPurchase", {"id": id, "name": item.name, "price": current.price,
		"icon": item.icon})
	return {"ok": true, "status": "purchased", "balance": model.run.scrap, "price": current.price}
