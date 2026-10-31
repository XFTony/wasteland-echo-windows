class_name CombatSystem
extends RefCounted
## Collision resolution and damage ordering follow the frozen reference combat loop.

var _contacts: Array[Dictionary] = []
var _collision_candidates: Array = []
var _obstacle_candidates: Array = []
var _separation_candidates: Array = []
var _seen: Dictionary = {}
var _screamers: Array[Dictionary] = []
var _steering: Dictionary = {}
var _environment_source: Dictionary = {"owner": "environment", "vx": 0.0, "vy": 0.0,
	"knockback": 28.0, "critical": false}
var _pickup_merge_cursor: int = 0


func reset_pool_cursors() -> void:
	_pickup_merge_cursor = 0


func fire_weapon(model: RunSimulation, aim_x: float, aim_y: float) -> void:
	if model.run.attack != null:
		return
	var run: Dictionary = model.run
	var player: Dictionary = run.player
	var weapon: Dictionary = model.catalog.parameters("weapons", player.weaponId)
	var refit: Dictionary = EconomyRules.weapon_modifiers(run)
	var target_distance: float = INF
	for enemy: Dictionary in model.enemies:
		if enemy.active and enemy.id == player.aimTargetId:
			target_distance = sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, player.x, player.y))
			break
	var mechanic: Dictionary = model.mechanics.before_shot(run, weapon, target_distance)
	var compact: Dictionary = WeaponRules.compact_shot_pose(player, aim_x, aim_y, model.catalog)
	if weapon.has("attackType"):
		model.weapons.fire(model, weapon, aim_x, aim_y, compact, refit, mechanic)
		return
	var count: int = WeaponRules.projectile_count(weapon, player)
	var base_angle: float = atan2(aim_y, aim_x)
	var attack_id: int = int(run.shotsFired) + 1
	var spawned: int = 0
	for index: int in range(count):
		if model.projectiles.size() >= int(model.limits.projectiles):
			break
		var centered: float = 0.0 if count == 1 else float(index) / (count - 1) - 0.5
		var jitter: float = model.random.range_float(-0.08, 0.08) if float(weapon.spread) > 0 else 0.0
		var angle: float = base_angle + centered * WeaponRules.projectile_spread(weapon, player, count) + jitter
		var dx: float = cos(angle)
		var dy: float = sin(angle)
		var critical: bool = bool(mechanic.forceCritical) or (float(player.criticalChance) > 0 and model.random.next() < float(player.criticalChance))
		var speed: float = float(weapon.projectileSpeed) * float(player.projectileSpeedMultiplier) * float(mechanic.projectileSpeedMultiplier)
		model.projectiles.append(model.projectile_pool.acquire({"id": model.entity_id,
			"x": compact.muzzleX if not compact.is_empty() else float(player.x) + dx * 14,
			"y": compact.muzzleY if not compact.is_empty() else float(player.y) + dy * 14,
			"barrelStartX": float(compact.anchorX) - aim_x * float(player.radius) if not compact.is_empty() else null,
			"barrelStartY": float(compact.anchorY) - aim_y * float(player.radius) if not compact.is_empty() else null,
			"vx": dx * speed, "vy": dy * speed,
			"radius": (3.5 if weapon.id == "needle_rifle" else 2.7) + float(player.projectileRadiusBonus) + float(mechanic.radiusBonus),
			"ttl": float(weapon.ttl) * float(player.projectileRangeMultiplier),
			"damage": float(weapon.damage) * float(refit.damage) * float(player.damageMultiplier) * float(mechanic.damageMultiplier) * (float(player.criticalMultiplier) if critical else 1),
			"pierce": int(weapon.pierce) + int(player.pierceBonus) + int(mechanic.pierceBonus),
			"knockback": float(weapon.knockback) * float(player.knockbackMultiplier) * float(mechanic.knockbackMultiplier),
			"color": weapon.color, "owner": "player", "weaponId": weapon.id,
			"attackId": attack_id, "empowered": bool(mechanic.forceCritical) or (mechanic.procLabel != null and float(mechanic.damageMultiplier) >= 1.25),
			"critical": critical}))
		model.entity_id += 1
		spawned += 1
	commit_attack(model, weapon, aim_x, aim_y, compact, refit, mechanic, spawned)


func commit_attack(model: RunSimulation, weapon: Dictionary, aim_x: float, aim_y: float,
		compact: Dictionary, refit: Dictionary, mechanic: Dictionary, spawned: int,
		interval: float = 0.0) -> void:
	var run: Dictionary = model.run
	var player: Dictionary = run.player
	run.shotsFired += 1
	if not run.weaponStats.has(weapon.id):
		run.weaponStats[weapon.id] = {"shots": 0, "kills": 0, "damage": 0.0, "eliteKills": 0}
	run.weaponStats[weapon.id].shots += 1
	run.projectilesFired += spawned
	model.progress_tutorial("fire", 1)
	model.mechanics.after_shot(run)
	player.weaponCooldown = interval if interval > 0 else maxf(1.0 / 60, float(weapon.interval)
		/ (float(player.fireRateMultiplier) * float(refit.rate)))
	model.push_event("shot", {"weaponId": weapon.id, "x": player.x, "y": player.y,
		"aimX": aim_x, "aimY": aim_y, "attackId": run.shotsFired,
		"attackType": weapon.get("attackType", "projectile"), "elapsed": run.elapsed,
		"interval": player.weaponCooldown, "empowered": bool(mechanic.forceCritical)
			or (mechanic.procLabel != null and float(mechanic.damageMultiplier) >= 1.25),
		"muzzleX": compact.get("muzzleX"), "muzzleY": compact.get("muzzleY"),
		"gripX": compact.get("anchorX"), "gripY": compact.get("anchorY")})
	if mechanic.procLabel != null:
		model.push_event("mechanicProc", {"mechanicId": weapon.mechanicId,
			"label": mechanic.procLabel, "x": player.x, "y": player.y, "hits": 0})


func spawn_enemy(model: RunSimulation, kind: String, x: float, y: float) -> Dictionary:
	if model.enemies.size() >= int(model.limits.enemies):
		return {}
	var definition: Dictionary = model.catalog.parameters("enemies", kind)
	if definition.is_empty():
		definition = model.catalog.parameters("enemies", model.catalog.defaults.enemy)
	var run: Dictionary = model.run
	var mode: Dictionary = model.catalog.parameters("modes", run.modeId)
	var progress: float = minf(2.5, float(run.elapsed) / 360) if run.endless else clampf(float(run.elapsed) / float(run.duration), 0, 1)
	var pressure: Dictionary = SurvivalRules.pressure(run.elapsed) if run.endless else {}
	var hp_scale: float = (float(pressure.hp) if not pressure.is_empty() else 1 + progress * float(mode.hpGrowth)) * float(run.difficulty)
	var boss_definition: Dictionary = {}
	for id: String in model.catalog.all("bosses"):
		var boss: Dictionary = model.catalog.parameters("bosses", id)
		if boss.enemyId == definition.id:
			boss_definition = boss
			break
	var enemy: Dictionary = model.enemy_pool.acquire({"id": model.entity_id,
		"type": definition.id, "x": x, "y": y, "hp": float(definition.hp) * hp_scale,
		"maxHp": float(definition.hp) * hp_scale,
		"speed": float(definition.speed) * (float(pressure.speed) if not pressure.is_empty() else 1 + progress * float(mode.speedGrowth)) * minf(1.2, sqrt(float(run.difficulty))),
		"damage": float(definition.damage) * (float(pressure.damage) * float(run.difficulty) if not pressure.is_empty() else minf(1.45, float(run.difficulty))),
		"radius": definition.radius, "xp": maxi(1, floori(float(definition.xp) * (float(pressure.xp) if not pressure.is_empty() else 1) + 0.5)),
		"scrapChance": definition.scrapChance, "color": definition.color, "role": definition.role,
		"elite": bool(definition.get("elite", false)),
		"boss": bool(definition.get("boss", false)) or not boss_definition.is_empty(),
		"bossDefinitionId": boss_definition.get("id"),
		"knockbackResistance": definition.get("knockbackResistance", 0.0),
		"actionCooldown": model.random.range_float(0.4, 1.4), "heading": 0.0})
	model.entity_id += 1
	resolve_enemy_world(model, enemy)
	model.enemies.append(enemy)
	if enemy.boss:
		run.activeBosses += 1
	return enemy


func update_enemies(model: RunSimulation, delta: float) -> void:
	var player: Dictionary = model.run.player
	_screamers.clear()
	for enemy: Dictionary in model.enemies:
		if enemy.active and enemy.role == "buffer":
			_screamers.append(enemy)
	for enemy: Dictionary in model.enemies:
		if not enemy.active:
			continue
		StatusWeaponRules.tick(model, enemy)
		if not enemy.active:
			continue
		enemy.hitFlash = maxf(0, float(enemy.hitFlash) - delta)
		enemy.hitCooldown = maxf(0, float(enemy.hitCooldown) - delta)
		enemy.actionCooldown -= delta
		enemy.navigationTime = maxf(0, float(enemy.navigationTime) - delta)
		var goal: Dictionary = model.structures.target_for(model, enemy, player)
		var navigation: FlowNavigation = null if enemy.targetStructureId != null else model.navigation_for_enemy(enemy)
		EnemyBrain.steer(enemy, goal, navigation, model.catalog.metadata.enemyRoleProfiles,
			model.catalog.metadata.navigationRoleWeights, _steering)
		var profile: Dictionary = model.catalog.metadata.enemyRoleProfiles.get(enemy.role, {})
		var speed: float = float(enemy.speed)
		if float(enemy.get("chillUntil", 0)) > float(model.run.elapsed):
			speed *= float(enemy.get("chillFactor", 1))
		if enemy.role != "buffer" and _has_buff(enemy):
			speed *= 1.18
		for item: Dictionary in model.interactives:
			if item.active and item.type == "electricField" and GeometryRules.distance_squared(enemy.x, enemy.y, item.x, item.y) <= pow(float(item.radius), 2):
				speed *= float(item.get("slow", 0.6))
		if profile.has("dash"):
			if float(enemy.dashTime) > 0:
				enemy.dashTime -= delta
				speed *= float(profile.dash.speedMultiplier)
			elif float(enemy.actionCooldown) <= 0 and float(_steering.distance) < float(profile.dash.triggerDistance):
				enemy.dashTime = profile.dash.duration
				enemy.actionCooldown = profile.dash.cooldown
				model.push_event("enemyAction", {"action": profile.dash.action, "x": enemy.x, "y": enemy.y})
		if profile.has("support") and float(enemy.actionCooldown) <= 0:
			enemy.actionCooldown = profile.support.cooldown
			model.push_event("enemyAction", {"action": profile.support.action, "x": enemy.x, "y": enemy.y})
		if profile.has("projectile") and float(enemy.actionCooldown) <= 0 and float(_steering.distance) < float(profile.projectile.range):
			spawn_enemy_shot(model, enemy, _steering.towardX, _steering.towardY,
				profile.projectile.speed, profile.projectile.damage, profile.projectile.ttl, profile.projectile.color)
			enemy.actionCooldown = profile.projectile.cooldown
		var boss: Dictionary = model.bosses.definition_for(model, enemy)
		if boss.is_empty() and profile.has("radial") and float(enemy.actionCooldown) <= 0:
			radial_attack(model, enemy, profile.radial.count, profile.radial.speed, profile.radial.damage)
			enemy.actionCooldown = profile.radial.cooldown
			model.push_event("enemyAction", {"action": "pulse", "x": enemy.x, "y": enemy.y})
		if not boss.is_empty():
			model.bosses.update(model, enemy, _steering.towardX, _steering.towardY)
		enemy.vx = float(_steering.directionX) * speed
		enemy.vy = float(_steering.directionY) * speed
		enemy.x += float(enemy.vx) * delta
		enemy.y += float(enemy.vy) * delta
		enemy.heading = atan2(float(_steering.directionY), float(_steering.directionX))
		resolve_enemy_world(model, enemy)
		KnockbackRules.advance(enemy, delta, resolve_enemy_world, model)
	_resolve_separation(model)
	model.rebuild_enemy_grid()
	for enemy: Dictionary in model.enemies:
		if not enemy.active:
			continue
		var tower: Dictionary = {}
		for candidate: Dictionary in model.run.structures:
			if candidate.id == enemy.targetStructureId and candidate.active:
				tower = candidate
				break
		if not tower.is_empty() and GeometryRules.distance_squared(enemy.x, enemy.y, tower.x, tower.y) < pow(float(enemy.radius) + float(tower.radius) + 9, 2) and float(enemy.hitCooldown) <= 0:
			enemy.hitCooldown = 0.7
			model.structures.damage(model, tower, enemy.damage)
			continue
		if GeometryRules.distance_squared(enemy.x, enemy.y, player.x, player.y) < pow(float(enemy.radius) + float(player.radius) + 2, 2) and float(enemy.hitCooldown) <= 0:
			enemy.hitCooldown = 0.7
			damage_player(model, enemy.damage, enemy.x, enemy.y, enemy)


func resolve_enemy_world(model: RunSimulation, enemy: Dictionary) -> void:
	var boundary: float = float(enemy.radius) + 20
	enemy.x = clampf(float(enemy.x), boundary, model.world_size - boundary)
	enemy.y = clampf(float(enemy.y), boundary, model.world_size - boundary)
	model.obstacle_grid.query_unique(enemy.x, enemy.y, enemy.radius, _obstacle_candidates, _seen)
	for obstacle: Dictionary in _obstacle_candidates:
		GeometryRules.circle_rect_push_out(enemy, obstacle)
	enemy.x = clampf(float(enemy.x), boundary, model.world_size - boundary)
	enemy.y = clampf(float(enemy.y), boundary, model.world_size - boundary)


func spawn_enemy_shot(model: RunSimulation, enemy: Dictionary, x: float, y: float,
		speed: float, amount: float, lifetime: float, color: String = "#dc9450") -> void:
	if model.enemy_shots.size() >= int(model.limits.enemyShots):
		return
	var definition: Dictionary = model.catalog.parameters("enemies", enemy.type)
	var base: float = float(definition.get("damage", enemy.damage))
	model.enemy_shots.append(model.projectile_pool.acquire({"id": model.entity_id,
		"x": enemy.x, "y": enemy.y, "vx": x * speed, "vy": y * speed, "radius": 4.0,
		"ttl": lifetime, "damage": amount * float(enemy.damage) / base,
		"pierce": 0, "knockback": 0, "color": color, "owner": "enemy",
		"sourceType": enemy.type, "sourceRole": enemy.role}))
	model.entity_id += 1


func radial_attack(model: RunSimulation, enemy: Dictionary, count: int, speed: float, amount: float) -> void:
	for index: int in range(count):
		var angle: float = float(index) / count * TAU + float(model.run.elapsed) * 0.25
		spawn_enemy_shot(model, enemy, cos(angle), sin(angle), speed, amount, 3.1, "#d87055")


func update_projectiles(model: RunSimulation, delta: float) -> void:
	for projectile: Dictionary in model.projectiles:
		if not projectile.active:
			continue
		var lifetime: float = maxf(0, minf(delta, float(projectile.ttl)))
		var x: float = float(projectile.barrelStartX) if projectile.barrelStartX != null else float(projectile.x)
		var y: float = float(projectile.barrelStartY) if projectile.barrelStartY != null else float(projectile.y)
		projectile.barrelStartX = null
		projectile.barrelStartY = null
		var end_x: float = float(projectile.x) + float(projectile.vx) * lifetime
		var end_y: float = float(projectile.y) + float(projectile.vy) * lifetime
		var dx: float = end_x - x
		var dy: float = end_y - y
		projectile.x = end_x
		projectile.y = end_y
		projectile.ttl -= delta
		_contacts.clear()
		var wall_time: float = GeometryRules.first_obstacle_time(model.obstacles, x, y, dx, dy,
			projectile.radius, GeometryRules.InteractiveMode.ALL) if model.layout.get("blocksProjectiles", false) else INF
		if is_finite(wall_time):
			_contacts.append({"wall": true, "time": wall_time, "order": 0})
		model.enemy_grid.query_circle((x + end_x) / 2, (y + end_y) / 2,
			sqrt(dx * dx + dy * dy) / 2 + model.maximum_enemy_radius + float(projectile.radius), _collision_candidates)
		for enemy: Dictionary in _collision_candidates:
			if not enemy.active or projectile.hitIds.has(enemy.id):
				continue
			var contact: float = GeometryRules.segment_circle_time(x, y, dx, dy, enemy.x, enemy.y,
				float(enemy.radius) + float(projectile.radius))
			if is_finite(contact):
				_contacts.append({"enemy": enemy, "time": contact, "order": _contacts.size()})
		for item: Dictionary in model.interactives:
			if not item.active or item.type != "explosiveBarrel" and float(item.get("solidRadius", 0)) <= 0:
				continue
			var contact: float = GeometryRules.segment_circle_time(x, y, dx, dy, item.x, item.y,
				float(item.radius) + float(projectile.radius))
			if is_finite(contact):
				_contacts.append({"interactive": item, "time": contact, "order": _contacts.size()})
		_contacts.sort_custom(_contact_before)
		for contact: Dictionary in _contacts:
			if not projectile.active:
				break
			var hx: float = x + dx * float(contact.time)
			var hy: float = y + dy * float(contact.time)
			if bool(contact.get("wall", false)):
				if projectile.attackKind == "explosive":
					model.weapons.detonate(model, projectile, hx, hy)
				model.push_event("worldHit", {"x": hx, "y": hy})
				model.projectile_pool.release(projectile)
				break
			if contact.has("interactive"):
				if not contact.interactive.active:
					continue
				if projectile.attackKind == "explosive":
					model.weapons.detonate(model, projectile, hx, hy)
				if contact.interactive.type == "explosiveBarrel":
					trigger_interactive(model, contact.interactive)
				model.projectile_pool.release(projectile)
				break
			var enemy: Dictionary = contact.enemy
			if not enemy.active or projectile.hitIds.has(enemy.id):
				continue
			if projectile.attackKind == "explosive":
				model.weapons.detonate(model, projectile, hx, hy)
				model.projectile_pool.release(projectile)
				break
			projectile.hitIds[enemy.id] = true
			projectile.hitX = hx
			projectile.hitY = hy
			damage_enemy(model, enemy, projectile.damage, projectile)
			if projectile.attackKind == "disc" and model.weapons.bounce(model, projectile, enemy):
				break
			if int(projectile.pierce) <= 0:
				model.projectile_pool.release(projectile)
				break
			projectile.pierce -= 1
		if projectile.active and float(projectile.ttl) <= 0:
			if projectile.attackKind == "explosive":
				model.weapons.detonate(model, projectile, projectile.x, projectile.y)
			model.projectile_pool.release(projectile)
	_update_enemy_shots(model, delta)


func damage_enemy(model: RunSimulation, enemy: Dictionary, amount: float, source: Dictionary) -> void:
	var requested: float = maxf(0, amount)
	var applied: float = minf(maxf(0, float(enemy.hp)), requested)
	enemy.hp -= requested
	enemy.hitFlash = 0.09
	var push: float = KnockbackRules.add(enemy, source)
	model.run.damageDealt += applied
	var owner: String = str(source.get("owner", "environment"))
	if owner in ["player", "melee", "status"]:
		if owner == "melee":
			model.run.meleeHits += 1
		elif owner == "player":
			model.run.hits += 1
		if bool(source.get("critical", false)):
			model.run.criticalHits += 1
		if source.get("weaponId") != null and model.run.weaponStats.has(source.weaponId):
			model.run.weaponStats[source.weaponId].damage += applied
	if owner == "turret":
		model.run.turretDamage += applied
	var vx: float = float(source.get("vx", 0))
	var vy: float = float(source.get("vy", 0))
	var length: float = sqrt(vx * vx + vy * vy)
	length = length if length > 0 else 1
	model.push_event("hit", {"x": source.hitX if source.get("hitX") != null else enemy.x,
		"y": source.hitY if source.get("hitY") != null else enemy.y, "damage": applied,
		"elite": enemy.elite, "critical": bool(source.get("critical", false)),
		"weaponId": source.get("weaponId"), "attackId": source.get("attackId", 0),
		"enemyId": enemy.id, "aimX": vx / length, "aimY": vy / length, "appliedKnockback": push})
	if owner in ["player", "melee"] and bool(source.get("critical", false)):
		model.mechanics.on_critical_hit(model.run, enemy, source, applied, model.enemies,
			model.damage_enemy, model.push_event)
	if owner in ["player", "melee"] and source.get("weaponId") != null:
		var weapon: Dictionary = model.catalog.parameters("weapons", str(source.weaponId))
		if float(weapon.get("slowDuration", 0)) > 0:
			enemy["chillUntil"] = float(model.run.elapsed) + (float(weapon.slowDuration) + float(model.run.player.get("chillDurationBonus", 0))) * (0.5 if enemy.boss else 1.0)
			enemy["chillFactor"] = maxf(0.9, float(weapon.slowFactor)) if enemy.boss else float(weapon.slowFactor)
	StatusWeaponRules.on_hit(model, enemy, source, requested)
	if float(enemy.hp) <= 0:
		kill_enemy(model, enemy, source)


func damage_player(model: RunSimulation, amount: float, x: float, y: float, source: Dictionary) -> void:
	var player: Dictionary = model.run.player
	if float(player.invulnerable) > 0 or model.screen != GameSession.Screen.RUNNING:
		return
	var reduced: float = maxf(1, amount * (1 - float(player.armor)))
	player.hp -= reduced
	model.run.damageTaken += reduced
	var key: String = "unknown"
	for field: String in ["sourceType", "type", "sourceRole", "role"]:
		if source.get(field) != null and not str(source[field]).is_empty():
			key = str(source[field])
			break
	model.run.damageTakenBySource[key] = float(model.run.damageTakenBySource.get(key, 0)) + reduced
	player.invulnerable = player.invulnerabilityDuration
	player.noHitTime = 0
	model.run.hitCount += 1
	var dx: float = float(player.x) - x
	var dy: float = float(player.y) - y
	var squared: float = dx * dx + dy * dy
	if squared > 1e-8:
		var factor: float = 18 / sqrt(squared)
		player.x += dx * factor
		player.y += dy * factor
	else:
		player.x += 18
	model.push_event("playerHit", {"damage": reduced, "sourceType": key})
	model.mechanics.on_player_hit(model.run, model.enemies, model.damage_enemy, model.push_event, x, y)
	if float(player.hp) <= 0:
		model.finish_run("lose")


func kill_enemy(model: RunSimulation, enemy: Dictionary, source: Dictionary) -> void:
	if not enemy.active:
		return
	model.run.kills += 1
	if int(model.run.player.get("killMend", 0)) > 0 and int(model.run.kills) % 12 == 0:
		model.run.player.hp = minf(float(model.run.player.maxHp), float(model.run.player.hp) + int(model.run.player.killMend))
	var owner: String = str(source.get("owner", "environment"))
	if owner in ["player", "melee", "status"] and source.get("weaponId") != null and model.run.weaponStats.has(source.weaponId):
		model.run.weaponStats[source.weaponId].kills += 1
		if enemy.elite:
			model.run.weaponStats[source.weaponId].eliteKills += 1
	if owner == "turret":
		model.run.turretKills += 1
	if enemy.boss:
		model.run.bossesDefeated += 1
		model.run.activeBosses = maxi(0, int(model.run.activeBosses) - 1)
	if enemy.elite:
		model.run.eliteKills += 1
	if owner != "turret":
		model.mechanics.on_kill(model.run, model.push_event)
	spawn_pickup(model, "xp", enemy.x, enemy.y, enemy.xp)
	if enemy.bossDefinitionId != null:
		model.bosses.drop(model, enemy)
	var chance: float = maxf(float(enemy.scrapChance), 0.22 if model.run.endless else float(model.layout.get("scrapChanceFloor", 0)))
	if model.random.next() < minf(1, chance + float(model.run.player.scrapChanceBonus)):
		var base: int = 8 if enemy.elite else 1
		var reward: float = float(SurvivalRules.pressure(model.run.elapsed).reward) if model.run.endless else 1.0
		var value: float = maxf(1, base * float(model.run.player.scrapMultiplier) * reward)
		spawn_pickup(model, "scrap", float(enemy.x) + model.random.range_float(-8, 8),
			float(enemy.y) + model.random.range_float(-8, 8), value)
	if enemy.elite and model.random.next() < 0.55:
		spawn_pickup(model, "medkit", float(enemy.x) + 12, float(enemy.y) - 10, 22)
	model.push_event("kill", {"enemyId": enemy.id, "enemyType": enemy.type,
		"x": enemy.x, "y": enemy.y, "elite": enemy.elite, "boss": enemy.boss})
	model.enemy_pool.release(enemy)


func spawn_pickup(model: RunSimulation, kind: String, x: float, y: float, value: float) -> Dictionary:
	if model.pickups.size() >= int(model.limits.pickups):
		for offset: int in range(model.pickups.size()):
			var index: int = (_pickup_merge_cursor + offset) % model.pickups.size()
			var existing: Dictionary = model.pickups[index]
			if existing.active and existing.type == kind:
				existing.value += value
				existing.x = x
				existing.y = y
				existing.age = 0
				_pickup_merge_cursor = (index + 1) % model.pickups.size()
				return existing
		return {}
	var pickup: Dictionary = model.pickup_pool.acquire({"id": model.entity_id,
		"type": kind, "x": x, "y": y, "value": value, "radius": 7 if kind == "medkit" else 5})
	model.entity_id += 1
	model.pickups.append(pickup)
	return pickup


func update_pickups(model: RunSimulation, delta: float) -> void:
	var player: Dictionary = model.run.player
	for pickup: Dictionary in model.pickups:
		if not pickup.active:
			continue
		pickup.age += delta
		var dx: float = float(player.x) - float(pickup.x)
		var dy: float = float(player.y) - float(pickup.y)
		var squared: float = dx * dx + dy * dy
		if squared < pow(float(player.pickupRadius), 2) and model.has_line_of_sight(pickup.x, pickup.y, player.x, player.y):
			var distance: float = sqrt(squared)
			if distance > 0:
				var factor: float = (150 + (float(player.pickupRadius) - distance) * 5) * delta / distance
				pickup.x += dx * factor
				pickup.y += dy * factor
			if squared <= pow(float(player.radius) + float(pickup.radius) + 3, 2):
				if pickup.type == "xp":
					player.xp += pickup.value
					model.check_level_up()
				elif pickup.type == "scrap":
					model.run.scrap += pickup.value
				elif pickup.type == "medkit":
					player.hp = minf(float(player.maxHp), float(player.hp) + float(pickup.value))
				model.progress_tutorial("pickup", 1)
				model.mechanics.on_pickup(model.run, pickup.type)
				model.push_event("pickup", {"pickupType": pickup.type})
				model.pickup_pool.release(pickup)


func trigger_interactive(model: RunSimulation, item: Dictionary) -> bool:
	if not item.active:
		return false
	if item.type == "explosiveBarrel":
		item.active = false
		model.remove_interactive_obstacle(item.id)
		var radius: float = float(item.get("effectRadius", 120))
		for enemy: Dictionary in model.enemies:
			if not enemy.active or GeometryRules.distance_squared(enemy.x, enemy.y, item.x, item.y) > radius * radius:
				continue
			var dx: float = float(enemy.x) - float(item.x)
			var dy: float = float(enemy.y) - float(item.y)
			if is_finite(GeometryRules.first_obstacle_time(model.obstacles, item.x, item.y, dx, dy,
				0, GeometryRules.InteractiveMode.ALL)):
				continue
			var length: float = sqrt(dx * dx + dy * dy)
			length = length if length > 0 else 1
			_environment_source.vx = dx / length * 220
			_environment_source.vy = dy / length * 220
			damage_enemy(model, enemy, float(item.get("damage", 60)), _environment_source)
		model.push_event("environment", {"action": "explode", "x": item.x, "y": item.y, "radius": radius})
		return true
	if item.type == "supplyCache":
		item.active = false
		model.remove_interactive_obstacle(item.id)
		spawn_pickup(model, "scrap", float(item.x) - 8, item.y, float(item.get("scrap", 6)))
		spawn_pickup(model, "medkit", float(item.x) + 10, item.y, float(item.get("healing", 24)))
		model.push_event("environment", {"action": "supply", "x": item.x, "y": item.y})
		return true
	return false


func update_interactives(model: RunSimulation, delta: float) -> void:
	for item: Dictionary in model.interactives:
		if not item.active:
			continue
		item.pulse = fmod(float(item.pulse) + delta, 1.0)
		if item.type == "supplyCache" and GeometryRules.distance_squared(model.run.player.x,
			model.run.player.y, item.x, item.y) <= pow(float(item.radius) + float(model.run.player.radius) + 8, 2):
			trigger_interactive(model, item)


func _update_enemy_shots(model: RunSimulation, delta: float) -> void:
	var player: Dictionary = model.run.player
	for shot: Dictionary in model.enemy_shots:
		if not shot.active:
			continue
		var lifetime: float = maxf(0, minf(delta, float(shot.ttl)))
		var x: float = float(shot.x)
		var y: float = float(shot.y)
		var dx: float = float(shot.vx) * lifetime
		var dy: float = float(shot.vy) * lifetime
		shot.x += dx
		shot.y += dy
		shot.ttl -= delta
		var time: float = GeometryRules.segment_circle_time(x, y, dx, dy, player.x, player.y,
			float(shot.radius) + float(player.radius))
		var wall_time: float = GeometryRules.first_obstacle_time(model.obstacles, x, y, dx, dy,
			shot.radius) if bool(model.layout.get("blocksProjectiles", false)) else INF
		var tower: Dictionary = {}
		var tower_time: float = INF
		for candidate: Dictionary in model.run.structures:
			var contact: float = GeometryRules.segment_rect_time(x, y, dx, dy,
				{"x": float(candidate.x) - float(candidate.radius), "y": float(candidate.y) - float(candidate.radius),
				"w": float(candidate.radius) * 2, "h": float(candidate.radius) * 2}, shot.radius)
			if contact < tower_time:
				tower = candidate
				tower_time = contact
		var block: float = model.weapons.block_time(model, shot, x, y, dx, dy)
		if is_finite(block) and block <= minf(time, minf(tower_time, wall_time)):
			model.projectile_pool.release(shot)
			model.push_event("bulletDeflect", {"x": x + dx * block, "y": y + dy * block})
		elif not tower.is_empty() and tower_time <= time and tower_time <= wall_time + 1e-8:
			model.projectile_pool.release(shot)
			model.structures.damage(model, tower, shot.damage)
		elif is_finite(wall_time) and wall_time <= time:
			model.push_event("worldHit", {"x": x + dx * wall_time, "y": y + dy * wall_time})
			model.projectile_pool.release(shot)
		elif is_finite(time):
			model.projectile_pool.release(shot)
			damage_player(model, shot.damage, x + dx * time, y + dy * time, shot)
		elif float(shot.ttl) <= 0:
			model.projectile_pool.release(shot)


func _resolve_separation(model: RunSimulation) -> void:
	for iteration: int in range(2):
		model.rebuild_enemy_grid()
		var separated: bool = false
		for enemy: Dictionary in model.enemies:
			if not enemy.active:
				continue
			model.enemy_grid.query_circle(enemy.x, enemy.y, float(enemy.radius) + model.maximum_enemy_radius + 0.5, _separation_candidates)
			for other: Dictionary in _separation_candidates:
				if not other.active or int(other.id) <= int(enemy.id):
					continue
				var minimum: float = float(enemy.radius) + float(other.radius) + 0.5
				var dx: float = float(other.x) - float(enemy.x)
				var dy: float = float(other.y) - float(enemy.y)
				var squared: float = dx * dx + dy * dy
				if squared >= minimum * minimum:
					continue
				var distance: float = 0
				if squared > 1e-8:
					distance = sqrt(squared)
					dx /= distance
					dy /= distance
				else:
					var angle: float = fmod(int(enemy.id) * 0.754877666 + int(other.id) * 0.569840291, 1.0) * TAU
					dx = cos(angle)
					dy = sin(angle)
				var mobility: float = maxf(0.04, 1 - float(enemy.knockbackResistance))
				var other_mobility: float = maxf(0.04, 1 - float(other.knockbackResistance))
				var overlap: float = minimum - distance
				enemy.x -= dx * overlap * mobility / (mobility + other_mobility)
				enemy.y -= dy * overlap * mobility / (mobility + other_mobility)
				other.x += dx * overlap * other_mobility / (mobility + other_mobility)
				other.y += dy * overlap * other_mobility / (mobility + other_mobility)
				separated = true
		for enemy: Dictionary in model.enemies:
			if enemy.active:
				resolve_enemy_world(model, enemy)
		if not separated:
			break


func _has_buff(enemy: Dictionary) -> bool:
	for candidate: Dictionary in _screamers:
		if candidate.id != enemy.id and GeometryRules.distance_squared(enemy.x, enemy.y,
			candidate.x, candidate.y) < 145 * 145:
			return true
	return false


func _contact_before(a: Dictionary, b: Dictionary) -> bool:
	if float(a.time) != float(b.time):
		return float(a.time) < float(b.time)
	var a_id: int = int(a.get("enemy", {}).get("id", 0))
	var b_id: int = int(b.get("enemy", {}).get("id", 0))
	return int(a.order) < int(b.order) if a_id == b_id else a_id < b_id
