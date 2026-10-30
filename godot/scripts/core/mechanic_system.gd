class_name MechanicSystem
extends RefCounted
## Reusable modifier/source records avoid allocating per-enemy hot-path dictionaries.

var _modifiers: Dictionary = {"damageMultiplier": 1.0, "projectileSpeedMultiplier": 1.0,
	"knockbackMultiplier": 1.0, "radiusBonus": 0.0, "pierceBonus": 0,
	"forceCritical": false, "procLabel": null}
var _chain_source: Dictionary = {"vx": 0.0, "vy": 0.0, "knockback": 18.0,
	"critical": false, "owner": "mechanic", "mechanicChain": true}
var _reactive_source: Dictionary = {"vx": 0.0, "vy": 0.0, "knockback": 32.0,
	"critical": false, "owner": "mechanic", "mechanicChain": true}


static func create_state() -> Dictionary:
	return {"weaponShotCounter": 0, "lastShotAt": -999.0, "heat": 0.0,
		"overdriveTime": 0.0, "chargedShots": 0, "killCharge": 0,
		"reactiveCooldown": 0.0, "cascadeCooldown": 0.0, "procCount": 0}


func tick(run: Dictionary, delta: float) -> void:
	var state: Dictionary = run.mechanics
	for key: String in ["overdriveTime", "reactiveCooldown", "cascadeCooldown"]:
		state[key] = maxf(0, float(state[key]) - delta)
	if float(run.elapsed) - float(state.lastShotAt) > 0.28:
		state.heat = maxf(0, float(state.heat) - delta * 3.5)


func before_shot(run: Dictionary, weapon: Dictionary, target_distance: float = INF) -> Dictionary:
	var state: Dictionary = run.mechanics
	var upgrades: Dictionary = run.mechanicUpgrades
	_modifiers.damageMultiplier = 1.0
	_modifiers.projectileSpeedMultiplier = 1.0
	_modifiers.knockbackMultiplier = 1.0
	_modifiers.radiusBonus = 0.0
	_modifiers.pierceBonus = 0
	_modifiers.forceCritical = false
	_modifiers.procLabel = null
	state.weaponShotCounter += 1
	match str(weapon.mechanicId):
		"steady_cycle":
			if int(state.weaponShotCounter) % 4 == 0:
				_modifiers.damageMultiplier *= 1.45
				_modifiers.forceCritical = true
				_modifiers.procLabel = "四拍稳压"
		"heat_ramp":
			state.heat = minf(10, float(state.heat) + 1)
			_modifiers.damageMultiplier *= 1 + float(state.heat) * 0.015
			if float(state.heat) >= 8:
				_modifiers.procLabel = "热膛高压"
		"breach_cone":
			if target_distance <= 150:
				_modifiers.damageMultiplier *= 1.35
				_modifiers.knockbackMultiplier *= 1.25
				_modifiers.procLabel = "破门距离"
		"focus_lance":
			if float(run.elapsed) - float(state.lastShotAt) >= 1.1 or float(run.player.noHitTime) >= 4:
				_modifiers.damageMultiplier *= 1.5
				_modifiers.pierceBonus += 2
				_modifiers.procLabel = "静息聚焦"
		"sixth_chamber":
			if int(state.weaponShotCounter) % 6 == 0:
				_modifiers.damageMultiplier *= 1.3
				_modifiers.forceCritical = true
				_modifiers.procLabel = "第六膛室"
		"momentum_feed":
			if pow(float(run.input.moveX), 2) + pow(float(run.input.moveY), 2) >= 0.16:
				_modifiers.damageMultiplier *= 1.12
				_modifiers.projectileSpeedMultiplier *= 1.15
				_modifiers.procLabel = "动量供弹"
		"arc_overload":
			if int(state.weaponShotCounter) % 3 == 0:
				_modifiers.damageMultiplier *= 1.25
				_modifiers.pierceBonus += 2
				_modifiers.radiusBonus += 0.8
				_modifiers.procLabel = "三相过载"
	var rank: int = int(upgrades.get("pointBlankRelay", 0))
	if rank > 0 and target_distance <= 180:
		_modifiers.damageMultiplier *= 1 + rank * 0.12
		_modifiers.knockbackMultiplier *= 1 + rank * 0.08
		_modifiers.procLabel = _modifiers.procLabel if _modifiers.procLabel != null else "近距继电"
	rank = int(upgrades.get("focusProtocol", 0))
	if rank > 0 and float(run.player.noHitTime) >= 4:
		_modifiers.damageMultiplier *= 1 + rank * 0.1
		_modifiers.forceCritical = true
		_modifiers.procLabel = _modifiers.procLabel if _modifiers.procLabel != null else "弱点协议"
	rank = int(upgrades.get("salvageOverdrive", 0))
	if rank > 0 and float(state.overdriveTime) > 0:
		_modifiers.damageMultiplier *= 1 + rank * 0.06
		_modifiers.projectileSpeedMultiplier *= 1 + rank * 0.08
		_modifiers.procLabel = _modifiers.procLabel if _modifiers.procLabel != null else "回收超频"
	rank = int(upgrades.get("executionCapacitor", 0))
	if rank > 0 and int(state.chargedShots) > 0:
		state.chargedShots -= 1
		_modifiers.damageMultiplier *= 1.35 + rank * 0.15
		_modifiers.pierceBonus += rank
		_modifiers.procLabel = "处决电容"
	if _modifiers.procLabel != null:
		state.procCount += 1
	return _modifiers


func after_shot(run: Dictionary) -> void:
	run.mechanics.lastShotAt = run.elapsed


func on_kill(run: Dictionary, emit: Callable) -> void:
	var rank: int = int(run.mechanicUpgrades.get("executionCapacitor", 0))
	if rank <= 0:
		return
	var state: Dictionary = run.mechanics
	state.killCharge += 1
	if int(state.killCharge) >= maxi(6, 12 - rank * 2):
		state.killCharge = 0
		state.chargedShots = mini(3, int(state.chargedShots) + 1)
		emit.call("mechanicReady", {"mechanicId": "executionCapacitor", "label": "处决电容已充能"})


func on_pickup(run: Dictionary, kind: String) -> void:
	var rank: int = int(run.mechanicUpgrades.get("salvageOverdrive", 0))
	if rank > 0 and kind in ["xp", "scrap"]:
		run.mechanics.overdriveTime = maxf(float(run.mechanics.overdriveTime), 2.5 + rank * 0.75)


func on_player_hit(run: Dictionary, enemies: Array, damage: Callable, emit: Callable,
		source_x: float, source_y: float) -> void:
	var rank: int = int(run.mechanicUpgrades.get("reactivePlating", 0))
	if rank <= 0 or float(run.mechanics.reactiveCooldown) > 0:
		return
	run.mechanics.reactiveCooldown = maxf(0.9, 2.2 - rank * 0.35)
	var player: Dictionary = run.player
	var radius: float = 90 + rank * 24
	var hits: int = 0
	for enemy: Dictionary in enemies:
		if not enemy.active or GeometryRules.distance_squared(player.x, player.y, enemy.x, enemy.y) > radius * radius:
			continue
		var dx: float = float(enemy.x) - float(player.x)
		var dy: float = float(enemy.y) - float(player.y)
		var length: float = sqrt(dx * dx + dy * dy)
		length = length if length > 0 else 1
		_reactive_source.vx = dx / length * 180
		_reactive_source.vy = dy / length * 180
		damage.call(enemy, 10 + rank * 8, _reactive_source)
		hits += 1
	if hits > 0:
		emit.call("mechanicProc", {"mechanicId": "reactivePlating", "label": "反应装甲",
			"x": player.x, "y": player.y, "hits": hits, "sourceX": source_x, "sourceY": source_y})


func on_critical_hit(run: Dictionary, enemy: Dictionary, source: Dictionary,
		amount: float, enemies: Array, damage: Callable, emit: Callable) -> void:
	var rank: int = int(run.mechanicUpgrades.get("cascadeRounds", 0))
	if rank <= 0 or float(run.mechanics.cascadeCooldown) > 0 or bool(source.get("mechanicChain", false)):
		return
	var nearest: Dictionary = {}
	var best: float = pow(110 + rank * 30, 2)
	for candidate: Dictionary in enemies:
		if not candidate.active or candidate.id == enemy.id:
			continue
		var squared: float = GeometryRules.distance_squared(enemy.x, enemy.y, candidate.x, candidate.y)
		if squared < best:
			best = squared
			nearest = candidate
	if nearest.is_empty():
		return
	run.mechanics.cascadeCooldown = maxf(0.18, 0.5 - rank * 0.08)
	var dx: float = float(nearest.x) - float(enemy.x)
	var dy: float = float(nearest.y) - float(enemy.y)
	var length: float = sqrt(dx * dx + dy * dy)
	length = length if length > 0 else 1
	_chain_source.vx = dx / length * 120
	_chain_source.vy = dy / length * 120
	damage.call(nearest, amount * (0.28 + rank * 0.12), _chain_source)
	emit.call("mechanicProc", {"mechanicId": "cascadeRounds", "label": "电弧跳弹",
		"x": nearest.x, "y": nearest.y, "hits": 1})
