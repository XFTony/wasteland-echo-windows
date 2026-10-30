class_name RunSimulation
extends RefCounted
## Fixed-step aggregate; child systems receive this context without retaining cycles.

signal state_changed

var catalog: GameCatalog
var save: Dictionary
var run: Dictionary = {}
var screen: GameSession.Screen = GameSession.Screen.MENU
var random: RandomStream
var limits: Dictionary = {"enemies": 128, "projectiles": 180, "enemyShots": 120, "pickups": 140}
var world_size: float = 3072.0
var layout: Dictionary = {}
var obstacles: Array[Dictionary] = []
var interactives: Array[Dictionary] = []
var enemies: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []
var enemy_shots: Array[Dictionary] = []
var pickups: Array[Dictionary] = []
var entity_id: int = 1
var enemy_pool: EntityPool
var projectile_pool: EntityPool
var pickup_pool: EntityPool
var enemy_grid: SpatialGrid
var obstacle_grid: SpatialGrid
var maximum_enemy_radius: float = 1.0
var navigations: Dictionary = {}
var navigation_clearance: Dictionary = {}
var spawner_enabled: bool = true
var mechanics: MechanicSystem = MechanicSystem.new()
var combat: CombatSystem = CombatSystem.new()
var weapons: WeaponActions = WeaponActions.new()
var spawner: SpawnSystem = SpawnSystem.new()
var structures: StructureSystem = StructureSystem.new()
var field_market: FieldMarket = FieldMarket.new()
var arsenal: Arsenal = Arsenal.new()
var bosses: BossSystem = BossSystem.new()
var upgrades: UpgradeDraftSystem = UpgradeDraftSystem.new()
var progression: ProgressionSystem = ProgressionSystem.new()
var _events: Array[Dictionary] = []
var _drained: Array[Dictionary] = []
var _base_navigation: Dictionary = {}
var _base_navigation_key: String = ""
var _base_signature: String = ""
var _navigation_cell: int = -1
var _navigation_cooldown: float = 0.0
var _player_obstacles: Array = []
var _query_seen: Dictionary = {}
var _target_candidates: Array = []
var _grid_count: int = -1
var _grid_first: int = -1
var _grid_last: int = -1


func _init(content: GameCatalog, save_data: Dictionary) -> void:
	catalog = content
	save = save_data
	random = RandomStream.new(1)
	enemy_pool = EntityPool.new(catalog.metadata.entityTemplates.enemy, "enemy", 88)
	projectile_pool = EntityPool.new(catalog.metadata.entityTemplates.projectile, "projectile", 96)
	pickup_pool = EntityPool.new(catalog.metadata.entityTemplates.pickup, "pickup", 140)
	var maximum_world: float = 1
	for id: String in catalog.all("maps"):
		maximum_world = maxf(maximum_world, float(catalog.parameters("maps", id).worldSize))
	var columns: int = ceili(maximum_world / 96) + 2
	enemy_grid = SpatialGrid.new(96, columns)
	obstacle_grid = SpatialGrid.new(96, columns)
	var small: float = 1
	var medium: float = 1
	for id: String in catalog.all("enemies"):
		var radius: float = float(catalog.parameters("enemies", id).radius)
		maximum_enemy_radius = maxf(maximum_enemy_radius, radius)
		if radius <= 10:
			small = maxf(small, radius)
		if radius <= 20:
			medium = maxf(medium, radius)
	navigation_clearance = {"small": small + 4, "medium": maxf(small, medium) + 4,
		"large": maximum_enemy_radius + 4}


func start_run(options: Dictionary = {}) -> void:
	release_entities()
	catalog.clear_runtime_cache()
	var seed_value: int = int(options.get("seed", floori(Time.get_unix_time_from_system() * 1000)))
	random = RandomStream.new(seed_value)
	var map_id: String = _selection(options, "Map", "maps")
	var map: MapDefinition = catalog.find("maps", map_id) as MapDefinition
	layout = options.get("layout", map.layout).duplicate(true)
	var requested_world: float = SaveCodec.number(options.get("worldSize", map.world_size))
	world_size = requested_world if requested_world > 0 else map.world_size
	obstacles.clear()
	for obstacle: Dictionary in layout.obstacles:
		if float(obstacle.x) < world_size and float(obstacle.y) < world_size:
			obstacles.append(obstacle.duplicate(true))
	interactives.clear()
	for original: Dictionary in layout.get("interactives", []):
		if float(original.x) < 0 or float(original.y) < 0 or float(original.x) > world_size or float(original.y) > world_size:
			continue
		var item: Dictionary = original.duplicate(true)
		item.active = true
		item.pulse = 0.0
		interactives.append(item)
		var radius: float = float(item.get("solidRadius", 0))
		if radius > 0 and float(item.x) < world_size and float(item.y) < world_size:
			obstacles.append({"interactiveId": item.id, "kind": "interactiveBody",
				"blocksAim": item.type == "supplyCache", "x": float(item.x) - radius,
				"y": float(item.y) - radius, "w": radius * 2, "h": radius * 2})
	_base_signature = _obstacle_signature()
	rebuild_obstacle_grid()
	var mode_id: String = _selection(options, "Mode", "modes")
	var weapon_id: String = _selection(options, "Weapon", "weapons")
	var hero_id: String = _selection(options, "Hero", "heroes")
	var skin_id: String = _selection(options, "Skin", "skins")
	var stage_id: String = _selection(options, "Stage", "stages")
	var mode: Dictionary = catalog.parameters("modes", mode_id)
	var stage: Dictionary = catalog.parameters("stages", stage_id)
	run = catalog.metadata.runTemplate.duplicate(true)
	run.merge({"modeId": mode_id, "heroId": hero_id, "mapId": map_id,
		"stageId": null if mode.rule == "endless" else stage_id,
		"seed": seed_value, "rule": mode.rule, "endless": mode.rule == "endless",
		"spawnProfile": mode.spawnProfile, "duration": SaveCodec.number(options.get("duration")) if SaveCodec.number(options.get("duration", 0)) > 0 else stage.duration,
		"difficulty": (1.0 if mode.rule == "endless" else float(stage.difficulty))
			* float(map.source_data.get("threat", 1)),
		"arsenal": {weapon_id: {"tier": 1, "calibration": 0}}}, true)
	var player: Dictionary = run.player
	player.merge(LoadoutRules.base_stats(mode), true)
	player.merge({"x": world_size / 2, "y": world_size / 2, "weaponId": weapon_id,
		"heroId": hero_id, "skinId": skin_id,
		"invulnerabilityDuration": mode.get("playerInvulnerability", 0.72)}, true)
	player.merge(LoadoutRules.calculate(player, catalog.parameters("heroes", hero_id), save, catalog), true)
	player.hp = player.maxHp
	run.equipmentIds = []
	run.equipmentLoadout = {}
	for slot: String in LoadoutRules.SLOTS:
		var id: String = str(save.equippedEquipment.get(slot, ""))
		var equipment: Dictionary = catalog.parameters("equipment", id)
		if not equipment.is_empty() and id in save.ownedEquipment and equipment.slot == slot:
			run.equipmentIds.append(id)
			run.equipmentLoadout[slot] = equipment
	arsenal.apply_mastery(self, weapon_id)
	run.tutorial = {"active": bool(options.get("tutorial", not save.tutorialCompleted and not save.tutorialSkipped)),
		"completed": false, "stepIndex": 0, "progress": 0.0}
	setup_navigation()
	set_screen(GameSession.Screen.RUNNING)
	var radio: Dictionary = catalog.metadata.survival.maps.get(map_id,
		catalog.metadata.survival.maps.echo_district) if run.endless else stage
	push_event("runStart", {"seed": seed_value, "weaponId": weapon_id, "skinId": skin_id,
		"heroId": hero_id, "mapId": map_id, "modeId": mode_id, "stageId": run.stageId,
		"radioTitle": radio.radioTitle, "radioDetail": radio.radioDetail})
	spawn_enemy("drifter", float(player.x) + 220, float(player.y))
	if mode.rule == "extract":
		spawn_enemy("drifter", float(player.x) - 210, float(player.y) + 80)
	rebuild_enemy_grid()


func tick(delta: float) -> void:
	if screen != GameSession.Screen.RUNNING or run.is_empty():
		return
	var step: float = clampf(delta, 0, 0.05)
	var player: Dictionary = run.player
	run.elapsed += step
	if run.endless:
		run.threatLevel = SurvivalRules.pressure(run.elapsed).level
	player.noHitTime += step
	run.maxNoHitTime = maxf(float(run.maxNoHitTime), float(player.noHitTime))
	player.invulnerable = maxf(0, float(player.invulnerable) - step)
	player.weaponCooldown -= step
	mechanics.tick(run, step)
	progress_tutorial("deployment", step)
	if float(player.regenPerSecond) > 0 and float(player.noHitTime) >= 4:
		player.hp = minf(float(player.maxHp), float(player.hp) + float(player.regenPerSecond) * step)
	_update_player(step)
	weapons.update(self, step)
	if pow(float(run.input.moveX), 2) + pow(float(run.input.moveY), 2) > 0.04:
		progress_tutorial("move", step)
	update_navigation(step)
	if run.rule == "extract" and bool(run.extraction.active):
		var extraction: Dictionary = run.extraction
		var inside: bool = GeometryRules.distance_squared(player.x, player.y,
			extraction.x, extraction.y) <= pow(float(extraction.radius), 2)
		extraction.hold = minf(float(extraction.required), float(extraction.hold) + step) if inside else maxf(0, float(extraction.hold) - step * 0.65)
	if spawner_enabled:
		spawner.update(self, step)
	combat.update_enemies(self, step)
	if screen != GameSession.Screen.RUNNING:
		compact_entities()
		return
	structures.update(self, step)
	combat.update_projectiles(self, step)
	combat.update_interactives(self, step)
	combat.update_pickups(self, step)
	compact_entities()
	if not run.endless and float(run.elapsed) >= float(run.duration):
		if run.rule == "survive" or float(run.extraction.hold) >= float(run.extraction.required):
			finish_run("win")
		else:
			run.overtime += step
			if float(run.overtime) >= 15:
				finish_run("lose")


func set_input(values: Dictionary) -> void:
	if run.is_empty():
		return
	for key: String in ["moveX", "moveY"]:
		var value: Variant = values.get(key, 0)
		run.input[key] = clampf(float(value), -1, 1) if (value is float or value is int) and is_finite(float(value)) else 0.0
	for key: String in ["aimX", "aimY"]:
		var value: Variant = values.get(key)
		var previous: float = float(run.input[key])
		var fallback: float = previous if previous != 0 else (1.0 if key == "aimX" else 0.0)
		run.input[key] = float(value) if (value is float or value is int) and is_finite(float(value)) else fallback
	run.input.aimActive = bool(values.get("aimActive", false))
	run.input.firing = bool(values.get("firing", false))


func set_screen(value: GameSession.Screen) -> void:
	screen = value
	state_changed.emit()


func toggle_pause() -> void:
	structures.cancel(self)
	if screen == GameSession.Screen.RUNNING:
		progress_tutorial("pause", 1)
		set_screen(GameSession.Screen.PAUSED)
		push_event("pause")
	elif screen == GameSession.Screen.PAUSED:
		set_screen(GameSession.Screen.RUNNING)
		push_event("resume")


func push_event(kind: String, values: Dictionary = {}) -> void:
	var event: Dictionary = {"type": kind}
	event.merge(values, true)
	_events.append(event)


func drain_events() -> Array[Dictionary]:
	var previous: Array[Dictionary] = _events
	_events = _drained
	_drained = previous
	_events.clear()
	return _drained


func release_entities() -> void:
	if not run.is_empty():
		run.activeBosses = 0
	for collection: Array in [projectiles, enemy_shots]:
		for item: Dictionary in collection:
			projectile_pool.release(item)
	for item: Dictionary in enemies:
		enemy_pool.release(item)
	for item: Dictionary in pickups:
		pickup_pool.release(item)
	for collection: Array in [projectiles, enemy_shots, enemies, pickups]:
		collection.clear()
	combat.reset_pool_cursors()


func compact_entities() -> void:
	for collection: Array in [projectiles, enemy_shots, enemies, pickups]:
		var write: int = 0
		for item: Dictionary in collection:
			if item.active:
				collection[write] = item
				write += 1
		collection.resize(write)


func rebuild_obstacle_grid() -> void:
	obstacle_grid.clear()
	for obstacle: Dictionary in obstacles:
		obstacle_grid.insert_bounds(obstacle, Vector2(obstacle.x, obstacle.y),
			Vector2(float(obstacle.x) + float(obstacle.w), float(obstacle.y) + float(obstacle.h)))


func rebuild_enemy_grid() -> void:
	enemy_grid.clear()
	for enemy: Dictionary in enemies:
		if enemy.active:
			enemy_grid.insert(enemy)
	_grid_count = enemies.size()
	_grid_first = int(enemies[0].id) if not enemies.is_empty() else -1
	_grid_last = int(enemies.back().id) if not enemies.is_empty() else -1


func setup_navigation() -> void:
	navigations.clear()
	var signature: String = _obstacle_signature()
	var base: bool = signature == _base_signature
	var key: String = str(layout.id) + ":" + str(world_size) + ":" + signature
	if base and key != _base_navigation_key:
		_base_navigation.clear()
		_base_navigation_key = key
	for size_class: String in navigation_clearance:
		var navigation: FlowNavigation = _base_navigation.get(size_class) if base else null
		if navigation == null:
			navigation = FlowNavigation.new({"worldSize": world_size, "obstacles": obstacles},
				64, float(navigation_clearance[size_class]))
			if base:
				_base_navigation[size_class] = navigation
		navigations[size_class] = navigation
	_navigation_cell = -1
	_navigation_cooldown = 0
	update_navigation(0, true)


func update_navigation(delta: float, force: bool = false) -> void:
	if navigations.is_empty() or run.is_empty():
		return
	_navigation_cooldown = maxf(0, _navigation_cooldown - delta)
	var small: FlowNavigation = navigations.small
	var cell: int = small.world_index(run.player.x, run.player.y)
	if not force and (cell == _navigation_cell or _navigation_cooldown > 0):
		return
	var rebuilt: bool = false
	for navigation: FlowNavigation in navigations.values():
		rebuilt = navigation.rebuild(run.player.x, run.player.y) or rebuilt
	if rebuilt:
		_navigation_cell = cell
		_navigation_cooldown = 0.35


func navigation_for_enemy(enemy: Dictionary) -> FlowNavigation:
	return navigations.small if float(enemy.radius) <= 10 else navigations.medium if float(enemy.radius) <= 20 else navigations.large


func has_line_of_sight(ax: float, ay: float, bx: float, by: float) -> bool:
	return not bool(layout.get("blocksProjectiles", false)) or is_inf(GeometryRules.first_obstacle_time(
		obstacles, ax, ay, bx - ax, by - ay, 0, GeometryRules.InteractiveMode.AIM))


func nearest_enemy(x: float, y: float, radius: float) -> Dictionary:
	var first: int = int(enemies[0].id) if not enemies.is_empty() else -1
	var last: int = int(enemies.back().id) if not enemies.is_empty() else -1
	if enemies.size() != _grid_count or first != _grid_first or last != _grid_last:
		rebuild_enemy_grid()
	var nearest: Dictionary = {}
	var best: float = radius * radius
	enemy_grid.query_circle(x, y, radius, _target_candidates)
	for enemy: Dictionary in _target_candidates:
		if not enemy.active or float(enemy.hp) <= 0:
			continue
		var squared: float = GeometryRules.distance_squared(x, y, enemy.x, enemy.y)
		if squared < best and has_line_of_sight(x, y, enemy.x, enemy.y):
			nearest = enemy
			best = squared
	return nearest


func remove_interactive_obstacle(id: String) -> void:
	for index: int in range(obstacles.size()):
		if obstacles[index].get("interactiveId") == id:
			obstacles.remove_at(index)
			rebuild_obstacle_grid()
			setup_navigation()
			return


func spawn_enemy(kind: String, x: float, y: float) -> Dictionary:
	return combat.spawn_enemy(self, kind, x, y)


func fire_weapon(x: float, y: float) -> void:
	combat.fire_weapon(self, x, y)


func damage_enemy(enemy: Dictionary, amount: float, source: Dictionary) -> void:
	combat.damage_enemy(self, enemy, amount, source)


func spawn_pickup(kind: String, x: float, y: float, amount: float) -> Dictionary:
	return combat.spawn_pickup(self, kind, x, y, amount)


func check_level_up() -> void:
	if screen != GameSession.Screen.RUNNING or float(run.player.xp) < float(run.player.xpNext):
		return
	run.player.xp -= run.player.xpNext
	run.player.level += 1
	run.player.xpNext = 10 + int(run.player.level) * 8
	run.upgradeOptions = upgrades.create_options(self)
	structures.cancel(self)
	set_screen(GameSession.Screen.UPGRADE)
	push_event("levelup", {"level": run.player.level})


func finish_run(result: String) -> void:
	if run.is_empty() or run.result != null:
		return
	structures.cancel(self)
	run.result = result
	progression.settle(self, result)
	set_screen(GameSession.Screen.RESULT_WIN if result == "win" else GameSession.Screen.RESULT_LOSE)
	push_event("result", {"result": result, "earned": run.settlement.earned,
		"unlocked": run.settlement.unlocked, "payout": run.settlement.payout})


func progress_tutorial(id: String, amount: float) -> void:
	var tutorial: Dictionary = run.get("tutorial", {})
	if tutorial.is_empty() or not tutorial.active:
		return
	var steps: Array = catalog.metadata.tutorialSteps
	if int(tutorial.stepIndex) >= steps.size() or steps[int(tutorial.stepIndex)].id != id:
		return
	tutorial.progress += maxf(0, amount)
	if float(tutorial.progress) < float(steps[int(tutorial.stepIndex)].target):
		return
	tutorial.stepIndex += 1
	tutorial.progress = 0
	if int(tutorial.stepIndex) >= steps.size():
		tutorial.active = false
		tutorial.completed = true
		save.tutorialCompleted = true
		save.tutorialSkipped = false
		push_event("tutorialComplete")
	else:
		push_event("tutorialStep", {"stepId": steps[int(tutorial.stepIndex)].id})


func _obstacle_signature() -> String:
	var values: Array = []
	for obstacle: Dictionary in obstacles:
		values.append([obstacle.x, obstacle.y, obstacle.w, obstacle.h])
	return JSON.stringify(values)


func _selection(options: Dictionary, kind: String, category: String) -> String:
	var requested: String = str(options.get(kind.to_lower() + "Id", ""))
	return requested if catalog.find(category, requested) != null else str(save["selected" + kind])


func _update_player(delta: float) -> void:
	var player: Dictionary = run.player
	var input: Dictionary = run.input
	var x: float = float(input.moveX)
	var y: float = float(input.moveY)
	var squared: float = x * x + y * y
	if squared > 1:
		var length: float = sqrt(squared)
		x /= length
		y /= length
	player.x = clampf(float(player.x) + x * float(player.speed) * delta,
		float(player.radius) + 24, world_size - float(player.radius) - 24)
	player.y = clampf(float(player.y) + y * float(player.speed) * delta,
		float(player.radius) + 24, world_size - float(player.radius) - 24)
	obstacle_grid.query_unique(player.x, player.y, player.radius, _player_obstacles, _query_seen)
	for obstacle: Dictionary in _player_obstacles:
		GeometryRules.circle_rect_push_out(player, obstacle)
	if run.attack != null:
		player.lastAimX = run.attack.aimX
		player.lastAimY = run.attack.aimY
		return
	var weapon: Dictionary = catalog.parameters("weapons", player.weaponId)
	var target: Dictionary = {}
	x = float(input.aimX)
	y = float(input.aimY)
	squared = x * x + y * y
	var has_aim: bool = squared > 1e-8
	if save.settings.autoAim:
		var radius: float = WeaponRules.target_range(weapon, player)
		target = nearest_enemy(player.x, player.y, radius)
		if not target.is_empty() and player.aimTargetId != null:
			for enemy: Dictionary in enemies:
				if enemy.id == player.aimTargetId and enemy.active and float(enemy.hp) > 0:
					var retained: float = GeometryRules.distance_squared(player.x, player.y, enemy.x, enemy.y)
					var closest: float = GeometryRules.distance_squared(player.x, player.y, target.x, target.y)
					if retained <= radius * radius and retained <= closest * 1.12 * 1.12 and has_line_of_sight(player.x, player.y, enemy.x, enemy.y):
						target = enemy
					break
		if not target.is_empty():
			x = float(target.x) - float(player.x)
			y = float(target.y) - float(player.y)
			squared = x * x + y * y
			has_aim = squared > 1e-8
		else:
			has_aim = false
	if has_aim:
		var length: float = sqrt(squared)
		x /= length
		y /= length
	else:
		x = float(player.lastAimX)
		y = float(player.lastAimY)
	player.aimTargetId = null if target.is_empty() else target.id
	var corrected: Dictionary = {}
	if has_aim and not target.is_empty():
		corrected = WeaponRules.correct_aim(player, target, catalog)
	elif not save.settings.autoAim and has_aim and input.aimActive and squared > 1.0001:
		corrected = WeaponRules.correct_aim(player,
			{"x": float(player.x) + float(input.aimX), "y": float(player.y) + float(input.aimY)}, catalog)
	if not corrected.is_empty():
		x = float(corrected.x)
		y = float(corrected.y)
	if has_aim:
		player.lastAimX = x
		player.lastAimY = y
	if (save.settings.autoFire or input.firing) and float(player.weaponCooldown) <= 0:
		var can_fire: bool = not target.is_empty() if save.settings.autoAim else has_aim
		if can_fire:
			fire_weapon(x, y)
