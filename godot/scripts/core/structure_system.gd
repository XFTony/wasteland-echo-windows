class_name StructureSystem
extends RefCounted
## Deployment validates navigation before mutating inventory or world geometry.

var _enemy_goal: Dictionary = {"x": 0.0, "y": 0.0}


func owned_count(model: RunSimulation) -> int:
	return model.run.structures.size() + int(model.run.turretKits) if not model.run.is_empty() else 0


func preview(model: RunSimulation) -> Dictionary:
	if model.run.is_empty() or model.run.placement == null:
		return {}
	var player: Dictionary = model.run.player
	var input: Dictionary = model.run.input
	var dx: float = float(player.lastAimX) * 90
	var dy: float = float(player.lastAimY) * 90
	if input.aimActive:
		var length: float = sqrt(pow(float(input.aimX), 2) + pow(float(input.aimY), 2))
		length = length if length > 0 else 1
		var factor: float = minf(140, length) / length if length > 1.01 else 90.0 / length
		dx = float(input.aimX) * factor
		dy = float(input.aimY) * factor
	model.run.placement.x = float(player.x) + dx
	model.run.placement.y = float(player.y) + dy
	var result: Dictionary = validate(model, model.run.placement.x, model.run.placement.y)
	model.run.placement.valid = result.ok
	model.run.placement.reason = result.reason
	return model.run.placement


func begin(model: RunSimulation) -> bool:
	if model.run.is_empty() or model.screen != GameSession.Screen.RUNNING:
		return false
	if model.run.placement != null:
		return confirm(model)
	if int(model.run.turretKits) < 1 or model.run.structures.size() >= int(model.catalog.metadata.survival.turret.maxCount):
		return false
	model.run.placement = {"x": model.run.player.x, "y": model.run.player.y,
		"valid": false, "reason": ""}
	preview(model)
	return true


func cancel(model: RunSimulation) -> void:
	if not model.run.is_empty():
		model.run.placement = null


func validate(model: RunSimulation, x: float, y: float, navigation: bool = false) -> Dictionary:
	var run: Dictionary = model.run
	if run.is_empty() or int(run.turretKits) < 1 or run.structures.size() >= int(model.catalog.metadata.survival.turret.maxCount):
		return {"ok": false, "reason": "没有可部署套件"}
	if x < 54 or y < 54 or x > model.world_size - 54 or y > model.world_size - 54:
		return {"ok": false, "reason": "请远离地图边界"}
	var distance: float = sqrt(GeometryRules.distance_squared(x, y, run.player.x, run.player.y))
	if distance < 44 or distance > 142:
		return {"ok": false, "reason": "在身旁空地部署"}
	for obstacle: Dictionary in model.obstacles:
		var nx: float = clampf(x, float(obstacle.x), float(obstacle.x) + float(obstacle.w))
		var ny: float = clampf(y, float(obstacle.y), float(obstacle.y) + float(obstacle.h))
		if pow(x - nx, 2) + pow(y - ny, 2) < 54 * 54:
			return {"ok": false, "reason": "离障碍物太近"}
	for tower: Dictionary in run.structures:
		if GeometryRules.distance_squared(x, y, tower.x, tower.y) < 96 * 96:
			return {"ok": false, "reason": "塔台之间留出通路"}
	for enemy: Dictionary in model.enemies:
		if enemy.active and GeometryRules.distance_squared(x, y, enemy.x, enemy.y) < pow(float(enemy.radius) + 30, 2):
			return {"ok": false, "reason": "先清理部署位置的敌人"}
	if is_finite(GeometryRules.first_obstacle_time(model.obstacles, run.player.x, run.player.y,
		x - float(run.player.x), y - float(run.player.y))):
		return {"ok": false, "reason": "无法隔墙部署"}
	if navigation:
		var proposed: Array = model.obstacles.duplicate()
		var radius: float = float(model.catalog.metadata.survival.turret.radius)
		proposed.append({"x": x - radius, "y": y - radius, "w": radius * 2, "h": radius * 2})
		for size_class: String in model.navigation_clearance:
			var next := FlowNavigation.new({"worldSize": model.world_size, "obstacles": proposed},
				64, float(model.navigation_clearance[size_class]))
			next.rebuild(run.player.x, run.player.y)
			if _reachable_ratio(next) + 1e-8 < _reachable_ratio(model.navigations[size_class]):
				return {"ok": false, "reason": "此处会封住通行路线"}
	return {"ok": true, "reason": "确认部署 · Esc/B取消"}


func confirm(model: RunSimulation) -> bool:
	if model.run.placement == null or model.screen != GameSession.Screen.RUNNING:
		return false
	var point: Dictionary = preview(model)
	var state: Dictionary = validate(model, point.x, point.y, true)
	if not state.ok:
		point.reason = state.reason
		point.valid = false
		return false
	var fraction: float = float(model.run.turretKitHealth.pop_front()) if not model.run.turretKitHealth.is_empty() else 1.0
	var turret: Dictionary = model.catalog.metadata.survival.turret
	var maximum: float = float(turret.maxHp) * (1 + int(model.run.engineering) * 0.15)
	var radius: float = float(turret.radius)
	var tower: Dictionary = {"id": model.entity_id, "x": point.x, "y": point.y, "radius": radius,
		"hp": maximum * fraction, "maxHp": maximum, "active": true, "angle": 0.0,
		"cooldown": 0.2, "lastShotAt": -99.0, "lastHitAt": model.run.elapsed, "hitFlash": 0.0}
	model.entity_id += 1
	model.run.structures.append(tower)
	model.run.turretKits -= 1
	model.run.structuresBuilt += 1
	model.run.placement = null
	model.obstacles.append({"structureId": tower.id, "kind": "turretBody",
		"x": float(tower.x) - radius, "y": float(tower.y) - radius, "w": radius * 2, "h": radius * 2})
	_refresh_navigation(model)
	model.push_event("structurePlaced", {"x": tower.x, "y": tower.y, "id": tower.id})
	return true


func nearest_recoverable(model: RunSimulation) -> Dictionary:
	if model.run.is_empty():
		return {}
	var player: Dictionary = model.run.player
	for tower: Dictionary in model.run.structures:
		var distance: float = sqrt(GeometryRules.distance_squared(player.x, player.y, tower.x, tower.y))
		if not tower.active or distance >= 68:
			continue
		var factor: float = maxf(0, distance - float(tower.radius) * 1.5 - 2) / (distance if distance > 0 else 1)
		if is_inf(GeometryRules.first_obstacle_time(model.obstacles, player.x, player.y,
			(float(tower.x) - float(player.x)) * factor, (float(tower.y) - float(player.y)) * factor)):
			return tower
	return {}


func recover(model: RunSimulation) -> bool:
	var tower: Dictionary = nearest_recoverable(model)
	if tower.is_empty() or model.screen != GameSession.Screen.RUNNING:
		return false
	model.run.turretKitHealth.append(maxf(0.01, float(tower.hp) / float(tower.maxHp)))
	model.run.turretKits += 1
	remove(model, tower)
	model.push_event("structureRecovered", {"id": tower.id})
	return true


func remove(model: RunSimulation, tower: Dictionary) -> void:
	tower.active = false
	for index: int in range(model.run.structures.size() - 1, -1, -1):
		if not model.run.structures[index].active:
			model.run.structures.remove_at(index)
	for index: int in range(model.obstacles.size() - 1, -1, -1):
		if model.obstacles[index].get("structureId") == tower.id:
			model.obstacles.remove_at(index)
	_refresh_navigation(model)


func damage(model: RunSimulation, tower: Dictionary, amount: float) -> bool:
	if not tower.active or model.screen != GameSession.Screen.RUNNING:
		return false
	tower.hp -= maxf(0, amount)
	tower.lastHitAt = model.run.elapsed
	tower.hitFlash = 0.12
	if float(tower.hp) <= 0:
		remove(model, tower)
		model.push_event("structureDestroyed", {"x": tower.x, "y": tower.y, "id": tower.id})
	return true


func target_for(model: RunSimulation, enemy: Dictionary, player: Dictionary) -> Dictionary:
	enemy.targetStructureId = null
	if enemy.boss:
		return player
	var best: float = minf(210, sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, player.x, player.y)) * 1.12)
	var target: Dictionary = {}
	for tower: Dictionary in model.run.structures:
		var distance: float = sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, tower.x, tower.y))
		if distance >= best or not tower.active:
			continue
		var length: float = distance if distance > 0 else 1
		var dx: float = (float(enemy.x) - float(tower.x)) / length
		var dy: float = (float(enemy.y) - float(tower.y)) / length
		var x: float = float(tower.x) + dx * (float(tower.radius) + float(enemy.radius) + 3)
		var y: float = float(tower.y) + dy * (float(tower.radius) + float(enemy.radius) + 3)
		if is_inf(GeometryRules.first_obstacle_time(model.obstacles, enemy.x, enemy.y,
			x - float(enemy.x), y - float(enemy.y))):
			best = distance
			target = tower
			_enemy_goal.x = x
			_enemy_goal.y = y
	if not target.is_empty():
		enemy.targetStructureId = target.id
		return _enemy_goal
	return player


func update(model: RunSimulation, delta: float) -> void:
	var turret: Dictionary = model.catalog.metadata.survival.turret
	if model.run.placement != null:
		preview(model)
	for tower: Dictionary in model.run.structures:
		var maximum: float = float(turret.maxHp) * (1 + int(model.run.engineering) * 0.15)
		if float(tower.maxHp) != maximum:
			tower.hp *= maximum / float(tower.maxHp)
			tower.maxHp = maximum
		tower.hitFlash = maxf(0, float(tower.hitFlash) - delta)
		tower.cooldown -= delta
		if int(model.run.turretRegen) > 0 and float(model.run.elapsed) - float(tower.lastHitAt) > 8:
			tower.hp = minf(maximum, float(tower.hp) + maximum * int(model.run.turretRegen) * 0.01 * delta)
		var target: Dictionary = {}
		var nearest: float = float(turret.range)
		for enemy: Dictionary in model.enemies:
			var distance: float = sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, tower.x, float(tower.y) - 20))
			if not enemy.active or distance >= nearest:
				continue
			var angle: float = atan2(float(enemy.y) - float(tower.y) + 20, float(enemy.x) - float(tower.x))
			var mx: float = float(tower.x) + cos(angle) * 38
			var my: float = float(tower.y) - 20 + sin(angle) * 38
			if is_finite(GeometryRules.first_obstacle_time(model.obstacles, mx, my, float(enemy.x) - mx, float(enemy.y) - my)):
				continue
			target = enemy
			nearest = distance
			tower.angle = angle
		if target.is_empty() or float(tower.cooldown) > 0 or model.projectiles.size() >= int(model.limits.projectiles):
			continue
		var dx: float = cos(float(tower.angle))
		var dy: float = sin(float(tower.angle))
		var x: float = float(tower.x) + dx * 38
		var y: float = float(tower.y) - 20 + dy * 38
		var blocked_barrel: bool = false
		for obstacle: Dictionary in model.obstacles:
			if obstacle.get("structureId") == tower.id or obstacle.get("interactiveId") != null:
				continue
			if is_finite(GeometryRules.segment_rect_time(tower.x, float(tower.y) - 20,
					x - float(tower.x), y - float(tower.y) + 20, obstacle, 2.4)):
				blocked_barrel = true
				break
		if blocked_barrel:
			continue
		model.projectiles.append(model.projectile_pool.acquire({"id": model.entity_id,
			"x": x, "y": y, "vx": dx * float(turret.projectileSpeed), "vy": dy * float(turret.projectileSpeed), "radius": 2.4, "ttl": 0.8,
			"damage": float(turret.damage) * (1 + int(model.run.engineering) * 0.25), "pierce": 0, "knockback": 8,
			"owner": "turret", "weaponId": "support_turret", "color": "#d5bd83"}))
		model.entity_id += 1
		tower.cooldown = turret.interval
		tower.lastShotAt = model.run.elapsed
		model.push_event("turretShot", {"x": x, "y": y, "aimX": dx, "aimY": dy, "structureId": tower.id})


func _refresh_navigation(model: RunSimulation) -> void:
	model.rebuild_obstacle_grid()
	model.setup_navigation()


func _reachable_ratio(navigation: FlowNavigation) -> float:
	var free: int = 0
	var reached: int = 0
	for index: int in range(navigation.walkable.size()):
		if navigation.walkable[index] == 1:
			free += 1
			reached += 1 if navigation.distances[index] >= 0 else 0
	return float(reached) / maxi(1, free)
