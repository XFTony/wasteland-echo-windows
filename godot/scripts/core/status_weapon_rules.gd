class_name StatusWeaponRules
extends RefCounted
## New weapon-only effects never consume cosmetic randomness or recurse into their own procs.


static func on_hit(model: RunSimulation, enemy: Dictionary, source: Dictionary, amount: float) -> void:
	if source.get("owner") not in ["player", "melee"] or source.get("weaponId") == null:
		return
	var weapon: Dictionary = model.catalog.parameters("weapons", str(source.weaponId))
	if float(weapon.get("burnDuration", 0)) > 0 and float(enemy.hp) > 0:
		var active: bool = float(enemy.get("burnUntil", 0)) > float(model.run.elapsed)
		if not active:
			enemy["burnNext"] = float(model.run.elapsed) + float(weapon.burnInterval)
			enemy["burnDamage"] = 0.0
		enemy["burnUntil"] = float(model.run.elapsed) + float(weapon.burnDuration)
		var power: float = float(weapon.burnDamage) * float(model.run.player.damageMultiplier) * float(EconomyRules.weapon_modifiers(model.run).damage)
		enemy["burnDamage"] = maxf(float(enemy.burnDamage), power)
		enemy["burnWeapon"] = str(weapon.id)
		enemy["burnInterval"] = float(weapon.burnInterval)
	if int(weapon.get("chainJumps", 0)) > 0 and not bool(source.get("arcTriggered", false)):
		source["arcTriggered"] = true
		_chain(model, enemy, weapon, amount)


static func tick(model: RunSimulation, enemy: Dictionary) -> void:
	if not enemy.has("burnUntil"):
		return
	var elapsed: float = float(model.run.elapsed)
	for index: int in range(3):
		if elapsed + 1e-7 < float(enemy.burnNext) or float(enemy.burnNext) > float(enemy.burnUntil) + 1e-7:
			break
		enemy.burnNext += float(enemy.burnInterval)
		model.damage_enemy(enemy, float(enemy.burnDamage), {"owner": "status", "weaponId": enemy.burnWeapon,
			"vx": 0.0, "vy": -1.0, "knockback": 0.0, "critical": false, "statusTick": true})
		if not enemy.active:
			return
	if elapsed > float(enemy.burnUntil):
		for key: String in ["burnUntil", "burnNext", "burnDamage", "burnWeapon", "burnInterval"]:
			enemy.erase(key)


static func _chain(model: RunSimulation, initial: Dictionary, weapon: Dictionary, amount: float) -> void:
	var seen: Dictionary = {initial.id: true}
	var point := Vector2(initial.x, initial.y)
	var damage: float = amount
	for index: int in range(mini(4, int(weapon.chainJumps))):
		var target: Dictionary = {}
		var distance: float = float(weapon.chainRange) * float(weapon.chainRange)
		for candidate: Dictionary in model.enemies:
			if not candidate.active or seen.has(candidate.id):
				continue
			var delta := Vector2(candidate.x, candidate.y) - point
			if delta.length_squared() < distance and is_inf(GeometryRules.first_obstacle_time(model.obstacles, point.x, point.y, delta.x, delta.y)):
				target = candidate
				distance = delta.length_squared()
		if target.is_empty():
			break
		seen[target.id] = true
		damage *= float(weapon.chainRetention)
		var end := Vector2(target.x, target.y)
		model.push_event("weaponArc", {"x": end.x, "y": end.y, "fromX": point.x, "fromY": point.y, "weaponId": weapon.id})
		model.damage_enemy(target, damage, {"owner": "status", "weaponId": weapon.id,
			"vx": end.x - point.x, "vy": end.y - point.y, "knockback": 8.0,
			"critical": false, "statusTick": true, "arcTriggered": true, "mechanicChain": true})
		point = end
