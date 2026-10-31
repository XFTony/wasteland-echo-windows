class_name WeaponRules
extends RefCounted
## Scalar aim and barrel coordinates keep visual transforms out of damage calculations.


static func uses_compact(player: Dictionary, catalog: GameCatalog) -> bool:
	return player.heroId == "ranger" and player.skinId == "wanderer" and catalog.metadata.poses.has(player.weaponId)


static func target_range(weapon: Dictionary, player: Dictionary) -> float:
	var kind: String = str(weapon.get("attackType", "projectile"))
	var multiplier: float = float(player.projectileRangeMultiplier)
	var melee: float = clampf(float(player.get("meleeRangeMultiplier", 1)), 1, 1.5)
	if kind == "slam":
		return (float(weapon.impactOffset) + float(weapon.blastRadius)
			* minf(1.4, float(player.blastRadiusMultiplier))) * melee
	if kind == "slash":
		if float(weapon.get("waveDamage", 0.4)) <= 0:
			return float(weapon.reach) * melee
		return minf(240, float(weapon.lockRange) * (1 + (multiplier - 1) * 0.5))
	var range: float = float(weapon.lockRange) * multiplier * float(player.lockRangeMultiplier)
	return minf(1100, range) if kind == "beam" else range


static func projectile_count(weapon: Dictionary, player: Dictionary) -> int:
	var kind: String = str(weapon.get("attackType", "projectile"))
	if kind in ["slash", "slam"]:
		return 0
	var maximum: int = 3 if kind == "beam" else 6 if kind in ["disc", "explosive"] else 16
	return mini(maximum, int(weapon.get("projectileCount", 1)) + int(player.projectileBonus))


static func projectile_spread(weapon: Dictionary, player: Dictionary, count: int) -> float:
	var spread: float = deg_to_rad(float(weapon.get("spread", 0)))
	if count > 1:
		spread = maxf(spread, minf(0.65, (count - 1) * 0.10))
	return spread * float(player.get("spreadMultiplier", 1))


static func compact_shot_pose(player: Dictionary, x: float, y: float, catalog: GameCatalog) -> Dictionary:
	if not uses_compact(player, catalog):
		return {}
	var hold: Dictionary = catalog.metadata.poses[player.weaponId].hold
	var angle: float = atan2(y, x)
	var facing: float = float(player.get("compactFacing", 1))
	if cos(angle) > 0.15:
		facing = 1
	elif cos(angle) < -0.15:
		facing = -1
	var up: float = maxf(0, -sin(angle))
	var anchor_x: float = float(player.x) + (float(hold.aimOffsetX) * cos(angle)
		+ float(hold.upShoulder) * pow(up, 3)) * 1.5
	var anchor_y: float = float(player.y) + (float(hold.chestY) - float(hold.upLift) * up) * 1.5
	var local_x: float = (float(hold.muzzle[0]) - float(hold.pivot[0])) * 1.5
	var local_y: float = (float(hold.muzzle[1]) - float(hold.pivot[1])) * 1.5 * facing
	return {"anchorX": anchor_x, "anchorY": anchor_y,
		"muzzleX": anchor_x + cos(angle) * local_x - sin(angle) * local_y,
		"muzzleY": anchor_y + sin(angle) * local_x + cos(angle) * local_y}


static func correct_aim(player: Dictionary, target: Dictionary, catalog: GameCatalog) -> Dictionary:
	if not uses_compact(player, catalog):
		return {}
	if catalog.parameters("weapons", player.weaponId).get("attackStyle") == "thrust":
		var direction: Vector2 = Vector2(float(target.x) - float(player.x), float(target.y) - float(player.y) + 12).normalized()
		if absf(direction.x) > 0.15:
			player.compactFacing = signf(direction.x)
		if absf(direction.y) > 0.18:
			player.compactDepth = "back" if direction.y < 0 else "front"
		return {"x": direction.x, "y": direction.y}
	var hold: Dictionary = catalog.metadata.poses[player.weaponId].hold
	var angle: float = atan2(float(target.y) - float(player.y) - float(hold.chestY) * 1.5,
		float(target.x) - float(player.x))
	player.compactFacing = player.get("compactFacing", 1)
	player.compactDepth = player.get("compactDepth", "front")
	for index: int in range(12):
		var up: float = maxf(0, -sin(angle))
		var x: float = float(player.x) + (float(hold.aimOffsetX) * cos(angle)
			+ float(hold.upShoulder) * pow(up, 3)) * 1.5
		var y: float = float(player.y) + (float(hold.chestY) - float(hold.upLift) * up) * 1.5
		if GeometryRules.distance_squared(float(target.x), float(target.y), x, y) < 9:
			break
		angle = atan2(float(target.y) - y, float(target.x) - x)
	if cos(angle) > 0.15:
		player.compactFacing = 1
	elif cos(angle) < -0.15:
		player.compactFacing = -1
	if sin(angle) < -0.18:
		player.compactDepth = "back"
	elif sin(angle) > 0.18:
		player.compactDepth = "front"
	return {"x": cos(angle), "y": sin(angle)}
