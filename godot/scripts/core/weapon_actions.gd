class_name WeaponActions
extends RefCounted
## Special attacks share the simulation's damage and collision authority.


static func attack_progress(attack: Dictionary, elapsed: float) -> float:
	return clampf((elapsed - float(attack.started) - float(attack.windup)) / float(attack.activeTime), 0, 1)


static func attack_motion(attack: Dictionary, elapsed: float) -> float:
	if attack.is_empty():
		return 0
	if attack.get("weapon", {}).get("attackStyle") == "thrust":
		return 0.0
	var age: float = maxf(0, elapsed - float(attack.started))
	var sweep_sign: float = float(attack.get("sweepSign", 1))
	var amount: float = float(attack.arc) / 2 if attack.type == "slash" else 1.35
	if age < float(attack.windup):
		return -amount * clampf(age / float(attack.windup), 0, 1) * sweep_sign
	if age < float(attack.windup) + float(attack.activeTime):
		return (-amount + amount * 2 * attack_progress(attack, elapsed) if attack.type == "slash" else
			-amount * (1 - clampf((age - float(attack.windup)) / minf(0.055, float(attack.activeTime)), 0, 1))) * sweep_sign
	return amount * (1 - clampf((age - float(attack.windup) - float(attack.activeTime)) / float(attack.recovery), 0, 1)) * sweep_sign if attack.type == "slash" else 0.0


static func attack_extension(attack: Variant, elapsed: float) -> float:
	if not attack is Dictionary or attack.get("weapon", {}).get("attackStyle") != "thrust":
		return 0.0
	var age: float = elapsed - float(attack.started)
	if age < float(attack.windup):
		return -5 * clampf(age / float(attack.windup), 0, 1)
	if age <= float(attack.windup) + float(attack.activeTime):
		return maxf(0, float(attack.range) - float(attack.weapon.get("restTipReach", 91.5))) * sin(PI * attack_progress(attack, elapsed))
	return 0.0


static func _sweep_contains(attack: Dictionary, x: float, y: float, start: float,
		end: float, progress: float, target: Dictionary) -> bool:
	if attack.get("weapon", {}).get("attackStyle") == "thrust":
		return GeometryRules.sector_contains(x, y, float(attack.range) * minf(1, progress * 2), attack.angle, attack.arc, target)
	return GeometryRules.sector_contains(x, y, attack.range, (start + end) / 2,
		maxf(0.025, absf(end - start)), target) if attack.type == "slash" else sqrt(
			GeometryRules.distance_squared(target.x, target.y, x, y)) <= float(attack.radius) * progress + float(target.radius)


static func _beam_contact_before(a: Dictionary, b: Dictionary) -> bool:
	if float(a.t) != float(b.t):
		return float(a.t) < float(b.t)
	if bool(a.get("wall", false)) != bool(b.get("wall", false)):
		return bool(a.get("wall", false))
	return int(a.order) < int(b.order)
func effect(model: RunSimulation, kind: String, values: Dictionary) -> void:
	var run: Dictionary = model.run
	var slot: Dictionary = run.attackEffects[int(run.nextAttackEffect) % run.attackEffects.size()]
	run.nextAttackEffect += 1
	slot.merge({"active": true, "kind": kind, "life": 0.14, "maxLife": 0.14}, true)
	slot.merge(values, true)


func source(model: RunSimulation, weapon: Dictionary, attack_id: int,
		aim_x: float, aim_y: float, damage: float, critical: bool,
		owner: String = "player", modifiers: Dictionary = {}) -> Dictionary:
	return {"weaponId": weapon.id, "attackId": attack_id, "owner": owner,
		"damage": damage, "critical": critical,
		"knockback": float(weapon.knockback) * float(model.run.player.knockbackMultiplier) * float(modifiers.get("knockbackMultiplier", 1)),
		"vx": aim_x * 480, "vy": aim_y * 480}


func trace_beam(model: RunSimulation, grip: Dictionary, muzzle: Dictionary,
		dx: float, dy: float, reach: float, hit_source: Dictionary,
		maximum_hits: int, radius: float) -> Dictionary:
	var seen: Dictionary = {}
	# A separate barrel segment preserves split-ray geometry and point-blank hits.
	var segments: Array[Dictionary] = [
		{"x": grip.x, "y": grip.y, "dx": float(muzzle.x) - float(grip.x),
			"dy": float(muzzle.y) - float(grip.y)},
		{"x": muzzle.x, "y": muzzle.y, "dx": dx * reach, "dy": dy * reach}]
	for segment: Dictionary in segments:
		var contacts: Array[Dictionary] = []
		var x: float = float(segment.x)
		var y: float = float(segment.y)
		var sx: float = float(segment.dx)
		var sy: float = float(segment.dy)
		var wall: float = GeometryRules.first_obstacle_time(model.obstacles, x, y, sx, sy,
			1, GeometryRules.InteractiveMode.ALL)
		if is_finite(wall):
			contacts.append({"t": wall, "wall": true, "order": contacts.size()})
		for enemy: Dictionary in model.enemies:
			if not enemy.active or seen.has(enemy.id):
				continue
			var time: float = GeometryRules.segment_circle_time(x, y, sx, sy,
				enemy.x, enemy.y, float(enemy.radius) + radius)
			if is_finite(time):
				contacts.append({"t": time, "enemy": enemy, "order": contacts.size()})
		for item: Dictionary in model.interactives:
			if not item.active or item.type != "explosiveBarrel" and float(item.get("solidRadius", 0)) <= 0:
				continue
			var time: float = GeometryRules.segment_circle_time(x, y, sx, sy,
				item.x, item.y, float(item.radius) + radius)
			if is_finite(time):
				contacts.append({"t": time, "item": item, "order": contacts.size()})
		contacts.sort_custom(_beam_contact_before)
		for contact: Dictionary in contacts:
			if contact.has("enemy") and not contact.enemy.active:
				continue
			if contact.has("item") and not contact.item.active:
				continue
			var end_x: float = x + sx * float(contact.t)
			var end_y: float = y + sy * float(contact.t)
			if contact.has("enemy"):
				seen[contact.enemy.id] = true
				hit_source.hitX = end_x
				hit_source.hitY = end_y
				model.damage_enemy(contact.enemy, hit_source.damage, hit_source)
				if seen.size() < maximum_hits:
					continue
			elif contact.has("item") and contact.item.type == "explosiveBarrel":
				model.combat.trigger_interactive(model, contact.item)
			return {"x": x, "y": y, "endX": end_x, "endY": end_y}
	return {"x": muzzle.x, "y": muzzle.y, "endX": float(muzzle.x) + dx * reach,
		"endY": float(muzzle.y) + dy * reach}


func fire(model: RunSimulation, weapon: Dictionary, aim_x: float, aim_y: float,
		compact: Dictionary, refit: Dictionary, mechanic: Dictionary) -> void:
	var run: Dictionary = model.run
	var player: Dictionary = run.player
	var attack_id: int = int(run.shotsFired) + 1
	var critical: bool = bool(mechanic.forceCritical) or (float(player.criticalChance) > 0
		and model.random.next() < float(player.criticalChance))
	var damage: float = float(weapon.damage) * float(refit.damage) * float(player.damageMultiplier)
	damage *= float(mechanic.damageMultiplier) * (float(player.criticalMultiplier) if critical else 1)
	if not run.weaponStats.has(weapon.id):
		run.weaponStats[weapon.id] = {"shots": 0, "kills": 0, "damage": 0.0, "eliteKills": 0}
	var count: int = 0
	var interval: float = 0.0
	if weapon.attackType == "beam":
		count = WeaponRules.projectile_count(weapon, player)
		var muzzle: Dictionary = {"x": compact.muzzleX, "y": compact.muzzleY} if not compact.is_empty() else {
			"x": float(player.x) + aim_x * 18, "y": float(player.y) + aim_y * 18}
		var grip: Dictionary = {"x": float(compact.anchorX) - aim_x * float(player.radius),
			"y": float(compact.anchorY) - aim_y * float(player.radius)} if not compact.is_empty() else player
		for index: int in range(count):
			var angle: float = atan2(aim_y, aim_x) + (index - float(count - 1) / 2) * 0.085
			var dx: float = cos(angle)
			var dy: float = sin(angle)
			var hit_source: Dictionary = source(model, weapon, attack_id, dx, dy,
				damage / (1 + (count - 1) * 0.35), critical, "player", mechanic)
			var trace: Dictionary = trace_beam(model, grip, muzzle, dx, dy,
				WeaponRules.target_range(weapon, player), hit_source,
				1 + int(weapon.pierce) + int(player.pierceBonus) + int(mechanic.pierceBonus),
				2 + minf(6, float(player.projectileRadiusBonus) + float(mechanic.radiusBonus)) / 2)
			trace.merge({"color": weapon.color, "width": 4 + minf(6, float(player.projectileRadiusBonus)),
				"life": 0.105, "maxLife": 0.105}, true)
			effect(model, "beam", trace)
	elif weapon.attackType in ["slash", "slam"]:
		if run.attack != null:
			return
		var speed: float = minf(2.4, float(player.fireRateMultiplier) * float(refit.rate))
		var windup: float = float(weapon.windup) / speed
		var active_time: float = float(weapon.activeTime) / speed
		var recovery: float = float(weapon.recovery) / speed
		var scale: float = clampf(float(player.get("meleeRangeMultiplier", 1)), 1, 1.5)
		var sweep_sign: float = float(player.get("compactFacing", 0))
		if sweep_sign == 0:
			sweep_sign = signf(aim_x) if aim_x != 0 else 1
		run.attack = {"weaponId": weapon.id, "type": weapon.attackType, "started": run.elapsed,
			"windup": windup, "activeTime": active_time, "recovery": recovery, "previousAge": -1e-6,
			"angle": atan2(aim_y, aim_x), "aimX": aim_x, "aimY": aim_y, "sweepSign": sweep_sign,
			"range": float(weapon.reach) * scale, "radius": float(weapon.get("blastRadius", 0))
				* scale * minf(1.4, float(player.get("blastRadiusMultiplier", 1))),
			"offset": float(weapon.get("impactOffset", 0)) * scale, "arc": weapon.get("arc", 0),
			"hitIds": {}, "source": source(model, weapon, attack_id, aim_x, aim_y, damage, critical, "melee", mechanic),
			"waveSent": false, "impacted": false, "weapon": weapon}
		interval = maxf(float(weapon.interval) / speed, windup + active_time + recovery + 0.035)
		run.meleeSwings += 1
	else:
		var raw_count: int = WeaponRules.projectile_count(weapon, player)
		var angle: float = atan2(aim_y, aim_x)
		for index: int in range(raw_count):
			if model.projectiles.size() >= int(model.limits.projectiles):
				break
			var direction: float = angle + (index - float(raw_count - 1) / 2) * 0.11
			var dx: float = cos(direction)
			var dy: float = sin(direction)
			model.projectiles.append(model.projectile_pool.acquire({"id": model.entity_id,
				"x": compact.muzzleX if not compact.is_empty() else float(player.x) + aim_x * 18,
				"y": compact.muzzleY if not compact.is_empty() else float(player.y) + aim_y * 18,
				"barrelStartX": float(compact.anchorX) - aim_x * float(player.radius) if not compact.is_empty() else null,
				"barrelStartY": float(compact.anchorY) - aim_y * float(player.radius) if not compact.is_empty() else null,
				"vx": dx * float(weapon.projectileSpeed) * float(player.projectileSpeedMultiplier) * float(mechanic.projectileSpeedMultiplier),
				"vy": dy * float(weapon.projectileSpeed) * float(player.projectileSpeedMultiplier) * float(mechanic.projectileSpeedMultiplier),
				"radius": (8 if weapon.attackType == "disc" else 5) + minf(6, float(player.projectileRadiusBonus) + float(mechanic.radiusBonus)),
				"ttl": float(weapon.ttl) * float(player.projectileRangeMultiplier),
				"damage": damage / (1 + (raw_count - 1) * 0.2), "pierce": 0,
				"knockback": float(weapon.knockback) * float(player.knockbackMultiplier) * float(mechanic.knockbackMultiplier),
				"owner": "player", "weaponId": weapon.id, "attackId": attack_id, "critical": critical,
				"empowered": bool(mechanic.forceCritical) or (mechanic.procLabel != null and float(mechanic.damageMultiplier) >= 1.25),
				"color": weapon.color, "attackKind": weapon.attackType, "bounces": int(weapon.get("bounces", 0)) + int(player.get("bounceBonus", 0)),
				"blastRadius": float(weapon.get("blastRadius", 0)) * minf(1.4, float(player.get("blastRadiusMultiplier", 1)))}))
			model.entity_id += 1
			count += 1
	model.combat.commit_attack(model, weapon, aim_x, aim_y, compact, refit, mechanic, count, interval)


func detonate(model: RunSimulation, projectile: Dictionary, x: float, y: float) -> void:
	var radius: float = float(projectile.blastRadius)
	if radius <= 0:
		return
	var hit_source: Dictionary = projectile.duplicate()
	hit_source.hitX = x
	hit_source.hitY = y
	for enemy: Dictionary in model.enemies:
		if not enemy.active:
			continue
		var distance: float = sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, x, y))
		if distance > radius + float(enemy.radius) or is_finite(GeometryRules.first_obstacle_time(
				model.obstacles, x, y, float(enemy.x) - x, float(enemy.y) - y)):
			continue
		hit_source.vx = float(enemy.x) - x
		hit_source.vy = float(enemy.y) - y
		hit_source.hitX = enemy.x
		hit_source.hitY = enemy.y
		model.damage_enemy(enemy, float(projectile.damage) * maxf(0.4, 1 - distance / radius * 0.6), hit_source)
	for item: Dictionary in model.interactives:
		if item.active and item.type == "explosiveBarrel" and GeometryRules.distance_squared(item.x, item.y, x, y) <= radius * radius and is_inf(GeometryRules.first_obstacle_time(
				model.obstacles, x, y, float(item.x) - x, float(item.y) - y, 0, GeometryRules.InteractiveMode.ALL)):
			model.combat.trigger_interactive(model, item)
	effect(model, "explosion", {"x": x, "y": y, "radius": radius, "color": projectile.color,
		"life": 0.32, "maxLife": 0.32})
	model.push_event("weaponImpact", {"kind": "explosion", "x": x, "y": y,
		"radius": radius, "weaponId": projectile.weaponId})
	model.run.explosions += 1


func bounce(model: RunSimulation, projectile: Dictionary, enemy: Dictionary) -> bool:
	if int(projectile.bounces) <= 0:
		return false
	var weapon: Dictionary = model.catalog.parameters("weapons", projectile.weaponId)
	var target: Dictionary = {}
	var best: float = float(weapon.bounceRange)
	for candidate: Dictionary in model.enemies:
		if not candidate.active or projectile.hitIds.has(candidate.id):
			continue
		var distance: float = sqrt(GeometryRules.distance_squared(candidate.x, candidate.y, enemy.x, enemy.y))
		if distance < best and is_inf(GeometryRules.first_obstacle_time(model.obstacles, enemy.x, enemy.y,
				float(candidate.x) - float(enemy.x), float(candidate.y) - float(enemy.y))):
			best = distance
			target = candidate
	if target.is_empty():
		return false
	var dx: float = float(target.x) - float(enemy.x)
	var dy: float = float(target.y) - float(enemy.y)
	var length: float = sqrt(dx * dx + dy * dy)
	length = length if length > 0 else 1
	var speed: float = sqrt(pow(float(projectile.vx), 2) + pow(float(projectile.vy), 2))
	projectile.x = enemy.x
	projectile.y = enemy.y
	projectile.vx = dx / length * speed
	projectile.vy = dy / length * speed
	projectile.damage *= 0.78
	projectile.bounces -= 1
	model.push_event("weaponImpact", {"kind": "ricochet", "x": enemy.x, "y": enemy.y,
		"weaponId": projectile.weaponId})
	return true


func send_wave(model: RunSimulation, attack: Dictionary) -> void:
	if model.projectiles.size() >= int(model.limits.projectiles):
		return
	var player: Dictionary = model.run.player
	model.projectiles.append(model.projectile_pool.acquire({"id": model.entity_id,
		"x": float(player.x) + float(attack.aimX) * 25,
		"y": float(player.y) - 12 + float(attack.aimY) * 25,
		"vx": float(attack.aimX) * float(attack.weapon.projectileSpeed),
		"vy": float(attack.aimY) * float(attack.weapon.projectileSpeed), "radius": 12,
		"ttl": float(attack.weapon.ttl) * minf(1.5, float(player.projectileRangeMultiplier)),
		"damage": float(attack.source.damage) * float(attack.weapon.get("waveDamage", 0.4)), "pierce": 2 + int(player.pierceBonus),
		"knockback": 20 * float(player.knockbackMultiplier), "owner": "player",
		"weaponId": attack.weaponId, "attackId": attack.source.attackId,
		"critical": attack.source.critical, "color": attack.weapon.color, "attackKind": "swordWave"}))
	model.entity_id += 1
	model.run.projectilesFired += 1


func update(model: RunSimulation, delta: float = 1.0 / 60) -> void:
	var run: Dictionary = model.run
	var player: Dictionary = run.player
	for fx: Dictionary in run.attackEffects:
		if fx.active:
			fx.life -= delta
			if float(fx.life) <= 0:
				fx.active = false
	if run.attack == null:
		return
	var attack: Dictionary = run.attack
	var age: float = float(run.elapsed) - float(attack.started)
	var progress: float = attack_progress(attack, run.elapsed)
	if age >= float(attack.windup) and float(attack.previousAge) < float(attack.windup) + float(attack.activeTime):
		if attack.type == "slam" and not attack.impacted:
			attack.impacted = true
			var wall: float = GeometryRules.first_obstacle_time(model.obstacles, player.x, player.y,
				float(attack.aimX) * float(attack.offset), float(attack.aimY) * float(attack.offset))
			var reach: float = maxf(0, float(attack.offset) * wall - 4) if is_finite(wall) else float(attack.offset)
			attack.x = float(player.x) + float(attack.aimX) * reach
			attack.y = float(player.y) + float(attack.aimY) * reach
			model.push_event("weaponImpact", {"kind": "slam", "x": attack.x, "y": attack.y,
				"radius": attack.radius, "weaponId": attack.weaponId})
		var previous: float = clampf((float(attack.previousAge) - float(attack.windup)) / float(attack.activeTime), 0, 1)
		var start: float = float(attack.angle) - float(attack.arc) / 2 * float(attack.sweepSign) + float(attack.arc) * previous * float(attack.sweepSign)
		var end: float = float(attack.angle) - float(attack.arc) / 2 * float(attack.sweepSign) + float(attack.arc) * progress * float(attack.sweepSign)
		var x: float = float(player.x) if attack.type == "slash" else float(attack.x)
		var y: float = float(player.y) - 12 if attack.type == "slash" else float(attack.y)
		for enemy: Dictionary in model.enemies:
			if not enemy.active or attack.hitIds.has(enemy.id):
				continue
			if not _sweep_contains(attack, x, y, start, end, progress, enemy) or is_finite(GeometryRules.first_obstacle_time(
					model.obstacles, x, y, float(enemy.x) - x, float(enemy.y) - y)):
				continue
			attack.hitIds[enemy.id] = true
			attack.source.hitX = enemy.x
			attack.source.hitY = enemy.y
			if attack.type == "slam":
				attack.source.vx = float(enemy.x) - x
				attack.source.vy = float(enemy.y) - y
			model.damage_enemy(enemy, attack.source.damage, attack.source)
		for item: Dictionary in model.interactives:
			if not item.active or item.type != "explosiveBarrel":
				continue
			if _sweep_contains(attack, x, y, start, end, progress, item) and is_inf(GeometryRules.first_obstacle_time(
					model.obstacles, x, y, float(item.x) - x, float(item.y) - y, 0, GeometryRules.InteractiveMode.ALL)):
				model.combat.trigger_interactive(model, item)
	if attack.type == "slash" and not attack.waveSent and age >= float(attack.windup) + float(attack.activeTime):
		attack.waveSent = true
		if float(attack.weapon.get("waveDamage", 0.4)) > 0:
			send_wave(model, attack)
	attack.previousAge = age
	if age >= float(attack.windup) + float(attack.activeTime) + float(attack.recovery):
		run.attack = null


func block_time(model: RunSimulation, shot: Dictionary, x: float, y: float,
		dx: float, dy: float) -> float:
	var run: Dictionary = model.run
	if run.attack == null:
		return INF
	var attack: Dictionary = run.attack
	if not bool(attack.get("weapon", {}).get("blocksProjectiles", true)):
		return INF
	var age: float = float(run.elapsed) - float(attack.started)
	if age < float(attack.windup) or age > float(attack.windup) + float(attack.activeTime):
		return INF
	var progress: float = attack_progress(attack, run.elapsed)
	var arc: float = maxf(0.025, float(attack.arc) * progress)
	var angle: float = float(attack.angle) - float(attack.arc) / 2 * float(attack.sweepSign) + arc / 2 * float(attack.sweepSign)
	var x_center: float = float(run.player.x) if attack.type == "slash" else float(attack.x)
	var y_center: float = float(run.player.y) - 12 if attack.type == "slash" else float(attack.y)
	var time: float = GeometryRules.segment_sector_time(x, y, dx, dy, x_center, y_center,
		attack.range, angle, arc, shot.radius) if attack.type == "slash" else GeometryRules.segment_circle_time(
			x, y, dx, dy, x_center, y_center, float(attack.radius) * progress + float(shot.radius))
	if not is_finite(time):
		return INF
	return INF if is_finite(GeometryRules.first_obstacle_time(model.obstacles, x_center, y_center,
		x + dx * time - x_center, y + dy * time - y_center)) else time
