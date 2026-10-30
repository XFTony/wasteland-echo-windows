class_name WorldView
extends Node2D
## The scene owns presentation; all hit tests remain in the fixed-step simulation.

const DrawLayer = preload("res://scripts/presentation/world_draw_layer.gd")

var map_scene: MapScene
var camera_position: Vector2 = Vector2.ZERO
var zoom: float = 1.0
var visible_world: Rect2
var _model: RunSimulation
var _assets: AssetStore
var _player: CharacterVisual
var _enemy_states: Dictionary = {}
var _last_shot: Dictionary = {}
var _effects: Array[Dictionary] = []
var _shells: Array[Dictionary] = []
var _pending_shells: Array[Dictionary] = []
var _ground_layer: Node2D
var _foreground_layer: Node2D
var _canvas: CanvasItem
var _camera_kick: float = 0.0
var _recoil_aim: Vector2 = Vector2.RIGHT
var _frame: int = 0
var _fonts := UiFonts.new()
var _previous_elapsed: float = 0.0


func configure(model: RunSimulation, assets: AssetStore, scene: MapScene) -> void:
	_model = model
	_assets = assets
	map_scene = scene
	map_scene.z_index = -20
	add_child(map_scene)
	var obstacle_layer: Node2D = map_scene.get_node_or_null("Obstacles") as Node2D
	if obstacle_layer != null:
		obstacle_layer.z_index = 10
	_ground_layer = DrawLayer.new()
	_ground_layer.name = "GroundEffects"
	_ground_layer.z_index = -15
	_ground_layer.paint = _draw_ground
	add_child(_ground_layer)
	_player = CharacterVisual.new()
	_player.name = "PlayerVisual"
	_player.combat_view = true
	_player.z_index = 10
	add_child(_player)
	_player.configure(model.catalog, assets)
	_foreground_layer = DrawLayer.new()
	_foreground_layer.name = "ForegroundEffects"
	_foreground_layer.z_index = 20
	_foreground_layer.paint = _draw_foreground
	add_child(_foreground_layer)


func screen_to_world(point: Vector2) -> Vector2:
	return point / zoom + camera_position


func consume(events: Array[Dictionary]) -> void:
	for event: Dictionary in events:
		if event.type == "shot":
			var weapon: Dictionary = _model.catalog.parameters("weapons", event.weaponId)
			if weapon.get("attackType") in ["slash", "slam"]:
				continue
			_last_shot = event.duplicate()
			var profile: Dictionary = _model.catalog.metadata.weaponFeedback[event.weaponId]
			if str(profile.shell) != "none":
				var delay: float = minf(float(profile.ejectDelay), float(event.interval) * 0.5)
				if delay > 0:
					if _pending_shells.size() >= 16:
						_pending_shells.pop_front()
					_pending_shells.append({"weaponId": event.weaponId, "due": float(event.elapsed) + delay})
				else:
					_spawn_shell(event, profile)
			_camera_kick = minf(2, _camera_kick + float(profile.camera))
			_recoil_aim = Vector2(event.aimX, event.aimY)
		elif event.type in ["hit", "worldHit", "bulletDeflect", "weaponImpact"]:
			if _effects.size() < 128:
				_effects.append({"x": event.x, "y": event.y, "age": 0.0,
					"duration": 0.18, "color": "#dfc68d" if event.type == "worldHit" else "#a6d0ad"})
			if event.type == "weaponImpact" and event.get("kind") == "slam":
				_camera_kick = minf(2, _camera_kick + 0.75)


func synchronize() -> void:
	if _model == null or _model.run.is_empty():
		return
	var run: Dictionary = _model.run
	var player: Dictionary = run.player
	var viewport: Vector2 = get_viewport_rect().size
	if viewport.x <= 0 or viewport.y <= 0:
		viewport = Vector2(1280, 720)
	zoom = clampf(minf(viewport.x / 1280, viewport.y / 720), 1, 2)
	var dimensions: Vector2 = viewport / zoom
	var shake: Vector2 = Vector2.ZERO
	var shake_setting: String = str(_model.save.settings.screenShake)
	if float(player.invulnerable) > 0 and shake_setting != "off":
		var strength: float = 5 if shake_setting == "high" else 2.5
		shake = Vector2(sin(_frame * 2.1), cos(_frame * 1.7)) * strength
	var recoil_scale: float = 0 if shake_setting == "off" else 1 if shake_setting == "high" else 0.58
	var camera_offset: Vector2 = _recoil_aim * _camera_kick * recoil_scale - shake
	camera_position = Vector2(clampf(float(player.x) - dimensions.x / 2 + camera_offset.x, 0, maxf(0, _model.world_size - dimensions.x)),
		clampf(float(player.y) - dimensions.y / 2 + camera_offset.y, 0, maxf(0, _model.world_size - dimensions.y)))
	position = -camera_position * zoom
	scale = Vector2.ONE * zoom
	visible_world = Rect2(camera_position, dimensions)
	map_scene.update_view(visible_world)
	map_scene.animation_frame = _frame
	_player.position = (Vector2(float(player.x), float(player.y)) - camera_position).round() + camera_position
	_player.sample(player, run.elapsed, _last_shot, run.attack, run.input)
	_player.modulate.a = 0.48 if float(player.invulnerable) > 0 and int(float(run.elapsed) * 20) % 2 == 0 and _model.save.settings.flashes != "off" else 1.0
	var delta: float = maxf(0, float(run.elapsed) - _previous_elapsed)
	_previous_elapsed = run.elapsed
	for index: int in range(_effects.size() - 1, -1, -1):
		_effects[index].age += delta
		if float(_effects[index].age) >= float(_effects[index].duration):
			_effects.remove_at(index)
	_update_shells(delta)
	_camera_kick *= exp(-20 * delta)
	if _camera_kick < 0.03:
		_camera_kick = 0
	var active_ids: Dictionary = {}
	for enemy: Dictionary in _model.enemies:
		active_ids[enemy.id] = true
		_sample_enemy(enemy, run.elapsed)
	for id: Variant in _enemy_states.keys():
		if not active_ids.has(id):
			_enemy_states.erase(id)
	_frame += 1
	_ground_layer.queue_redraw()
	_foreground_layer.queue_redraw()
	queue_redraw()


func _draw() -> void:
	if _model == null or _model.run.is_empty():
		return
	_canvas = self
	for pickup: Dictionary in _model.pickups:
		if not pickup.active or not _visible(pickup.x, pickup.y):
			continue
		var point := Vector2(pickup.x, pickup.y)
		var color: Color = Color("9bcab1") if pickup.type == "xp" else Color("d2aa62") if pickup.type == "scrap" else Color("d6c5a2")
		_canvas.draw_circle(point + Vector2(1, 2), float(pickup.radius) + 2, Color("25261e"))
		_canvas.draw_rect(Rect2(point - Vector2(3, 3), Vector2(6, 6)), color)
		if pickup.type == "medkit":
			_canvas.draw_rect(Rect2(point - Vector2(1, 4), Vector2(2, 8)), Color("a45138"))
			_canvas.draw_rect(Rect2(point - Vector2(4, 1), Vector2(8, 2)), Color("a45138"))
	for projectile: Dictionary in _model.projectiles:
		_draw_projectile(projectile)
	for enemy: Dictionary in _model.enemies:
		if enemy.active and _visible(enemy.x, enemy.y, 120):
			_draw_enemy(enemy)
	_draw_structures()
	var player: Dictionary = _model.run.player
	_canvas.draw_set_transform(Vector2(player.x, float(player.y) + 1), 0, Vector2(1, 0.36))
	_canvas.draw_circle(Vector2.ZERO, 15, Color(0.04, 0.05, 0.055, 0.38))
	_canvas.draw_set_transform(Vector2.ZERO)
	_canvas.draw_arc(Vector2(player.x, player.y), float(player.radius) + 3, 0, TAU, 40, Color(0.573, 0.827, 0.761, 0.8), 1.5)


func _draw_ground(canvas: CanvasItem) -> void:
	if _model == null or _model.run.is_empty():
		return
	_canvas = canvas
	_draw_interactives()
	_draw_attack_effects(false)


func _draw_foreground(canvas: CanvasItem) -> void:
	if _model == null or _model.run.is_empty():
		return
	_canvas = canvas
	for shell: Dictionary in _shells:
		var alpha: float = clampf(float(shell.life) / float(shell.maxLife) * 1.4, 0, 1)
		_canvas.draw_set_transform(Vector2(shell.x, float(shell.y) - float(shell.z)), shell.angle)
		_canvas.draw_rect(Rect2(-float(shell.length) / 2 - 1, -float(shell.width) / 2 - 1,
			float(shell.length) + 2, float(shell.width) + 2), Color(0.11, 0.12, 0.1, alpha))
		_canvas.draw_rect(Rect2(-float(shell.length) / 2, -float(shell.width) / 2, shell.length, shell.width),
			Color(Color(shell.color), alpha))
		_canvas.draw_rect(Rect2(-float(shell.length) / 2, -float(shell.width) / 2,
			minf(2, float(shell.length) * 0.3), shell.width), Color(Color("dbc086"), alpha))
		_canvas.draw_set_transform(Vector2.ZERO)
	for fx: Dictionary in _effects:
		var alpha: float = 1 - float(fx.age) / float(fx.duration)
		var point := Vector2(fx.x, fx.y)
		var color := Color(Color(fx.color), alpha)
		_canvas.draw_line(point - Vector2(5, 0), point + Vector2(5, 0), color, 2)
		_canvas.draw_line(point - Vector2(0, 4), point + Vector2(0, 4), color, 2)
	_draw_flash()
	_draw_attack_effects(true)
	for projectile: Dictionary in _model.enemy_shots:
		_draw_projectile(projectile)
	_draw_interaction_labels()


func _visible(x: float, y: float, padding: float = 40) -> bool:
	return visible_world.grow(padding).has_point(Vector2(x, y))


func _sample_enemy(enemy: Dictionary, elapsed: float) -> void:
	var specs: Dictionary = _model.catalog.metadata.actorMetadata.ENEMY_SPRITES
	if not specs.has(enemy.type):
		return
	var config: Dictionary = specs[enemy.type]
	var state: Dictionary = _enemy_states.get(enemy.id, {})
	if state.is_empty():
		state = {"phase": 0.0, "facing": 1.0, "elapsed": elapsed,
			"x": enemy.x, "y": enemy.y, "walking": false}
	elif elapsed > float(state.elapsed):
		var distance: float = sqrt(GeometryRules.distance_squared(enemy.x, enemy.y, state.x, state.y))
		state.walking = distance > 0.001
		if state.walking:
			state.phase = fmod(float(state.phase) + distance / float(config.stride), 1)
	state.x = enemy.x
	state.y = enemy.y
	state.elapsed = elapsed
	if cos(float(enemy.heading)) > 0.12:
		state.facing = 1.0
	elif cos(float(enemy.heading)) < -0.12:
		state.facing = -1.0
	state.frame = config.walkFrames[floori(float(state.phase) * config.walkFrames.size()) % config.walkFrames.size()] if state.walking else config.idleFrame
	_enemy_states[enemy.id] = state


func _draw_enemy(enemy: Dictionary) -> void:
	var specs: Dictionary = _model.catalog.metadata.actorMetadata.ENEMY_SPRITES
	if not specs.has(enemy.type):
		return
	var config: Dictionary = specs[enemy.type]
	var state: Dictionary = _enemy_states[enemy.id]
	var point: Vector2 = (Vector2(enemy.x, enemy.y) - camera_position).round() + camera_position
	_canvas.draw_set_transform(point + Vector2(0, 1), 0, Vector2(1, 0.36))
	_canvas.draw_circle(Vector2.ZERO, float(enemy.radius) + (5 if enemy.boss else 2), Color(0.04, 0.05, 0.055, 0.38))
	_canvas.draw_set_transform(point, 0, Vector2(float(config.pixelScale) * float(state.facing), config.pixelScale))
	var texture: Texture2D = _assets.texture(config.assetId)
	if texture != null:
		_canvas.draw_texture_rect_region(texture, Rect2(-float(config.root[0]), -float(config.root[1]), config.canvas, config.canvas),
			Rect2(int(state.frame) * int(config.canvas), 0, config.canvas, config.canvas),
			Color(1, 1, 1, 0.7 if float(enemy.hitFlash) > 0 and _model.save.settings.flashes != "off" else 1.0))
	_canvas.draw_set_transform(Vector2.ZERO)


func _draw_projectile(projectile: Dictionary) -> void:
	if not projectile.active or not _visible(projectile.x, projectile.y):
		return
	var point := Vector2(projectile.x, projectile.y)
	if projectile.owner == "enemy":
		_canvas.draw_circle(point, float(projectile.radius) + 2, Color("361e19"))
		_canvas.draw_circle(point, float(projectile.radius), Color(projectile.color))
		_canvas.draw_rect(Rect2(point - Vector2.ONE, Vector2(2, 2)), Color("ffe6ad"))
		return
	var profile: Dictionary = _model.catalog.metadata.weaponFeedback.get(projectile.weaponId,
		_model.catalog.metadata.weaponFeedback.scrap_pistol)
	_canvas.draw_set_transform(point, atan2(float(projectile.vy), float(projectile.vx)))
	var width: float = float(profile.width) + (1 if projectile.critical or projectile.empowered else 0)
	match str(projectile.attackKind):
		"disc":
			_canvas.draw_set_transform(point, float(projectile.ttl) * 30)
			_canvas.draw_circle(Vector2.ZERO, float(projectile.radius) + 1, Color("29342b"))
			_canvas.draw_rect(Rect2(-6, -6, 12, 12), Color("acb5a0"))
			_canvas.draw_rect(Rect2(-8, -2, 16, 4), Color("acb5a0"))
			_canvas.draw_rect(Rect2(-2, -8, 4, 16), Color("acb5a0"))
			_canvas.draw_rect(Rect2(-3, -3, 6, 6), Color("806a43"))
		"explosive":
			_canvas.draw_rect(Rect2(-9, -5, 17, 10), Color("1e2821"))
			_canvas.draw_rect(Rect2(-7, -3, 12, 6), Color("8d9b68"))
			_canvas.draw_rect(Rect2(4, -3, 3, 6), Color("dec088"))
			_canvas.draw_rect(Rect2(-14, -2, 6, 4), Color("bb8052"))
		"swordWave":
			_canvas.draw_arc(Vector2(-7, 0), 15, -0.8, 0.8, 18, Color("293c30"), 5)
			_canvas.draw_arc(Vector2(-7, 0), 15, -0.8, 0.8, 18, Color(profile.color), 3)
			_canvas.draw_arc(Vector2(-7, 0), 15, -0.8, 0.8, 18, Color(profile.core), 1)
		_:
			if profile.family == "pellet":
				_canvas.draw_rect(Rect2(-3, -3, 6, 6), Color("1d251d"))
				_canvas.draw_rect(Rect2(-2, -2, 4, 4), Color(profile.color))
				_canvas.draw_rect(Rect2(0, -1, 2, 2), Color(profile.core))
			elif profile.family == "coil":
				_canvas.draw_rect(Rect2(-float(profile.trail), -width / 2, profile.trail, width), Color(Color(profile.color), 0.25))
				_canvas.draw_rect(Rect2(-8, -width / 2 - 1, 15, width + 2), Color("254149"))
				_paint_polygon(PackedVector2Array([Vector2(8, 0), Vector2(2, -width / 2),
					Vector2(-8, -width / 2), Vector2(-10, 0), Vector2(-8, width / 2), Vector2(2, width / 2)]), Color(profile.color))
				_canvas.draw_rect(Rect2(-5, -1, 10, 2), Color(profile.core))
				_canvas.draw_rect(Rect2(-16, -5, 4, 1), Color(profile.color))
				_canvas.draw_rect(Rect2(-21, 4, 4, 1), Color(profile.color))
			else:
				_canvas.draw_rect(Rect2(-float(profile.trail), -maxf(1, width / 2 - 1), profile.trail, maxf(1, width - 1)), Color(Color(profile.color), 0.5 if profile.family == "needle" else 0.32))
				_canvas.draw_rect(Rect2(-5, -width / 2 - 1, 11, width + 2), Color("1d251d"))
				_canvas.draw_rect(Rect2(-4, -width / 2, 9, width), Color(profile.color))
				_canvas.draw_rect(Rect2(1, -maxf(1, width / 2 - 1), 9 if profile.family == "needle" else 4, maxf(1, width - 1)), Color(profile.core))
	_canvas.draw_set_transform(Vector2.ZERO)


func _draw_interactives() -> void:
	for item: Dictionary in _model.interactives:
		if not _visible(item.x, item.y, float(item.radius) + 20):
			continue
		var point := Vector2(item.x, item.y)
		match str(item.type):
			"tradePost":
				if not item.active:
					continue
				for index: int in range(12):
					var angle: float = float(index) / 12 * TAU
					_canvas.draw_rect(Rect2(point + Vector2(cos(angle) * 26 - 2, sin(angle) * 16 - 1), Vector2(4, 2)), Color("b19c67"))
				_canvas.draw_rect(Rect2(point - Vector2(10, 6), Vector2(20, 12)), Color("6d5b3d"))
				_canvas.draw_rect(Rect2(point - Vector2(6, 3), Vector2(12, 6)), Color("d9bd75"))
			"electricField":
				var pulse: float = 0.28 + sin(float(item.get("pulse", 0)) * TAU) * 0.08
				_canvas.draw_circle(point, item.radius, Color(Color("55a79e"), pulse))
				_canvas.draw_arc(point, float(item.radius) * 0.72, 0, TAU, 64, Color(Color("8fd1c6"), 0.75), 2)
			"explosiveBarrel":
				_canvas.draw_rect(Rect2(point - Vector2(10, 14), Vector2(20, 28)), Color("8f3f2d") if item.active else Color("302d27"))
				var stripe: Color = Color("d8a245") if item.active else Color("554d40")
				_canvas.draw_rect(Rect2(point + Vector2(-10, -8), Vector2(20, 3)), stripe)
				_canvas.draw_rect(Rect2(point + Vector2(-10, 7), Vector2(20, 3)), stripe)
				if item.active:
					_canvas.draw_rect(Rect2(point + Vector2(-2, -4), Vector2(4, 8)), Color("ead9ad"))
			"supplyCache":
				if not item.active:
					continue
				_canvas.draw_rect(Rect2(point - Vector2(18, 12), Vector2(36, 24)), Color("403d31"))
				_canvas.draw_rect(Rect2(point - Vector2(18, 12), Vector2(36, 24)), Color("c8a55c"), false, 2)
				_canvas.draw_rect(Rect2(point - Vector2(3, 8), Vector2(6, 16)), Color("bd5b43"))
				_canvas.draw_rect(Rect2(point - Vector2(8, 3), Vector2(16, 6)), Color("bd5b43"))
	var extraction: Dictionary = _model.run.extraction
	if extraction.active:
		_canvas.draw_arc(Vector2(extraction.x, extraction.y), float(extraction.radius), 0, TAU, 64, Color("84cfc3"), 3)


func _draw_attack_effects(over: bool) -> void:
	for fx: Dictionary in _model.run.attackEffects:
		if not fx.active:
			continue
		var alpha: float = clampf(float(fx.life) / float(fx.maxLife), 0, 1)
		if fx.kind == "beam" and over:
			var from := Vector2(fx.x, fx.y)
			var to := Vector2(fx.endX, fx.endY)
			var glow: float = 0.06 if _model.save.settings.flashes == "off" else 0.28
			_canvas.draw_line(from, to, Color(Color(fx.color), alpha * glow), float(fx.width) + 5)
			_canvas.draw_line(from, to, Color(Color(fx.color), alpha), fx.width)
			_canvas.draw_line(from, to, Color(Color("e6ffe0"), alpha), 1.5)
			_canvas.draw_rect(Rect2(to - Vector2(2, 2), Vector2(4, 4)), Color("c1e8be"))
		elif fx.kind == "explosion" and not over:
			var center := Vector2(fx.x, fx.y)
			var radius: float = float(fx.radius) * (0.3 + (1 - alpha) * 0.7)
			_draw_ring(center, radius, Color(Color(fx.color), alpha * 0.8), 3)
			if _model.save.settings.flashes != "off":
				_paint_polygon(_radial_path(center, radius), Color(0.945, 0.808, 0.545, alpha * 0.12))
			for index: int in range(8):
				var point: Vector2 = _visible_point(center, index * PI / 4, radius)
				_canvas.draw_rect(Rect2(point - Vector2(2, 2), Vector2(4, 3)), Color(Color("bda16e"), alpha))
	if over:
		return
	var attack: Variant = _model.run.attack
	if not attack is Dictionary:
		return
	var age: float = float(_model.run.elapsed) - float(attack.started)
	var progress: float = WeaponActions.attack_progress(attack, _model.run.elapsed)
	var active: bool = age >= float(attack.windup) and age <= float(attack.windup) + float(attack.activeTime)
	if attack.type == "slash" and active:
		var center := Vector2(_model.run.player.x, float(_model.run.player.y) - 12)
		var start: float = float(attack.angle) - float(attack.arc) / 2 * float(attack.sweepSign)
		var end: float = start + float(attack.arc) * progress * float(attack.sweepSign)
		var path: PackedVector2Array = _slash_path(center, attack.range, start, end)
		var fill: PackedVector2Array = PackedVector2Array([center])
		fill.append_array(path)
		_paint_polygon(fill, Color(0.639, 0.804, 0.69, 0.2))
		if path.size() > 1:
			_canvas.draw_polyline(path, Color(0.718, 0.894, 0.773, 0.9), 3)
		var leading: PackedVector2Array = _slash_path(center, float(attack.range) - 4,
			end - 0.15 * float(attack.sweepSign), end)
		_canvas.draw_polyline(leading, Color("edffdc"), 1)
	elif attack.type == "slam":
		var player: Dictionary = _model.run.player
		var center := Vector2(float(player.x), float(player.y))
		if attack.get("impacted", false):
			center = Vector2(attack.x, attack.y)
		else:
			var time: float = GeometryRules.first_obstacle_time(_model.obstacles, player.x,
				player.y, float(attack.aimX) * float(attack.offset), float(attack.aimY) * float(attack.offset))
			var reach: float = maxf(0, float(attack.offset) * time - 4) if is_finite(time) else float(attack.offset)
			center += Vector2(attack.aimX, attack.aimY) * reach
		if age < float(attack.windup):
			_draw_ring(center, attack.radius, Color(0.698, 0.616, 0.427, 0.35), 1)
		else:
			var life: float = 1 - clampf((age - float(attack.windup)) / (0.32 + float(attack.activeTime)), 0, 1)
			var radius: float = float(attack.radius) * progress
			_draw_ring(center, radius, Color(Color("d7c28e"), life), 3)
			_draw_ring(center, maxf(1, radius - 8), Color(Color("a58f63"), life * 0.6), 2)
			for index: int in range(7):
				var angle: float = index * TAU / 7 + 0.2
				var middle: Vector2 = _visible_point(center, angle, radius * 0.48)
				var tip: Vector2 = _visible_point(center, angle + 0.14, radius * 0.8)
				_canvas.draw_polyline(PackedVector2Array([center, middle, tip]), Color(Color("64523b"), life), 2)


func _visible_point(center: Vector2, angle: float, radius: float) -> Vector2:
	var delta := Vector2(cos(angle), sin(angle)) * radius
	var time: float = minf(1, GeometryRules.first_obstacle_time(_model.obstacles,
		center.x, center.y, delta.x, delta.y))
	return center + delta * time


func _radial_path(center: Vector2, radius: float) -> PackedVector2Array:
	var result := PackedVector2Array()
	for index: int in range(33):
		result.append(_visible_point(center, index * PI / 16, maxf(1, radius)))
	return result


func _slash_path(center: Vector2, radius: float, start: float, end: float) -> PackedVector2Array:
	var result := PackedVector2Array()
	var steps: int = maxi(1, ceili(absf(end - start) * 12))
	for index: int in range(steps + 1):
		result.append(_visible_point(center, lerpf(start, end, float(index) / steps), radius))
	return result


func _draw_ring(center: Vector2, radius: float, color: Color, width: float) -> void:
	_canvas.draw_polyline(_radial_path(center, radius), color, width)


func _paint_polygon(points: PackedVector2Array, color: Color) -> void:
	# Clipping at a wall can collapse neighbouring vertices or the entire sweep.
	var polygon := PackedVector2Array()
	for point: Vector2 in points:
		if polygon.is_empty() or polygon[polygon.size() - 1].distance_squared_to(point) > 1e-8:
			polygon.append(point)
	if polygon.size() > 1 and polygon[0].distance_squared_to(polygon[polygon.size() - 1]) < 1e-8:
		polygon.resize(polygon.size() - 1)
	if polygon.size() < 3:
		return
	if Geometry2D.triangulate_polygon(polygon).is_empty():
		return
	_canvas.draw_colored_polygon(polygon, color)


func _draw_structures() -> void:
	for tower: Dictionary in _model.run.structures:
		var point := Vector2(tower.x, tower.y)
		RadioPaint.surface(_canvas, Rect2(point - Vector2(19, 8), Vector2(38, 20)), false, true)
		_canvas.draw_set_transform(point - Vector2(0, 20), tower.angle)
		_canvas.draw_rect(Rect2(-13, -7, 34, 14), Color("5b6651"))
		_canvas.draw_rect(Rect2(15, -3, 24, 6), Color("c5b78d"))
		_canvas.draw_set_transform(Vector2.ZERO)
		_canvas.draw_rect(Rect2(point + Vector2(-18, 15), Vector2(36, 4)), Color("292a21"))
		_canvas.draw_rect(Rect2(point + Vector2(-18, 15), Vector2(36 * clampf(float(tower.hp) / float(tower.maxHp), 0, 1), 4)), Color("9eb67e"))
	if _model.run.placement != null:
		var placement: Dictionary = _model.run.placement
		_canvas.draw_arc(Vector2(placement.x, placement.y), 30, 0, TAU, 32,
			Color("9fcf9b") if placement.valid else Color("d57955"), 3)


func _draw_flash() -> void:
	if _last_shot.is_empty() or _model.save.settings.flashes == "off":
		return
	var age: float = float(_model.run.elapsed) - float(_last_shot.elapsed)
	var profile: Dictionary = _model.catalog.metadata.weaponFeedback[_last_shot.weaponId]
	var weapon: Dictionary = _model.catalog.parameters("weapons", _last_shot.weaponId)
	var maximum: float = minf(float(weapon.muzzleFlashLife), 0.095 if weapon.id == "coil_cannon" else 0.065)
	if age < 0 or age >= maximum or profile.flash == "none":
		return
	var alpha: float = 1 - age / maximum
	var point := Vector2(float(_last_shot.x) + float(_last_shot.aimX) * float(weapon.muzzleLength),
		float(_last_shot.y) + float(_last_shot.aimY) * float(weapon.muzzleLength))
	var angle: float = atan2(float(_last_shot.aimY), float(_last_shot.aimX))
	if _model.run.player.weaponId == weapon.id and WeaponRules.uses_compact(_model.run.player, _model.catalog):
		point = to_local(_player.muzzle())
		angle = _player.aim_angle + _player.visual_angle
	elif _last_shot.get("muzzleX") != null and _last_shot.get("muzzleY") != null:
		point = Vector2(_last_shot.muzzleX, _last_shot.muzzleY)
	_canvas.draw_set_transform(point, angle)
	var length: float = minf(float(weapon.muzzleFlashLength), 8 if profile.flash == "short" else 17 if profile.flash == "coil" else 22)
	var color := Color(Color(profile.color), alpha)
	var core := Color(Color(profile.core), alpha)
	if profile.flash == "coil":
		_canvas.draw_arc(Vector2(3, 0), 4 + (1 - alpha) * 4, -0.8, 0.8, 20, color, 2)
		_canvas.draw_rect(Rect2(0, -2, length, 4), color)
		_canvas.draw_rect(Rect2(0, -1, length * 0.7, 2), core)
	elif profile.flash in ["wide", "heavy"]:
		_paint_polygon(PackedVector2Array([Vector2(-1, 0), Vector2(length * 0.8, -6 * alpha),
			Vector2(length * 0.58, -1), Vector2(length, 0), Vector2(length * 0.58, 2),
			Vector2(length * 0.8, 6 * alpha)]), color)
		_canvas.draw_rect(Rect2(-1, -2, length * 0.5, 4), core)
	else:
		var half: float = 2.5 if profile.flash == "needle" else 3 if profile.flash == "short" else 4
		_paint_polygon(PackedVector2Array([Vector2(-1, 0), Vector2(3, -half),
			Vector2(length * 0.45, -half * 0.5), Vector2(length, -1),
			Vector2(length * 0.65, 1), Vector2(length * 0.4, half), Vector2(1, half * 0.55)]), color)
		_paint_polygon(PackedVector2Array([Vector2(0, -1.5), Vector2(length * 0.65, 0), Vector2(2, 2)]), core)
	_canvas.draw_set_transform(Vector2.ZERO)


func _spawn_shell(shot: Dictionary, profile: Dictionary) -> void:
	if _shells.size() >= 64:
		_shells.pop_front()
	var casing: Dictionary = _model.catalog.metadata.casings[profile.shell]
	var weapon: Dictionary = _model.catalog.parameters("weapons", shot.weaponId)
	var x: float = float(shot.gripX) if shot.get("gripX") != null else float(shot.x)
	var y: float = float(shot.gripY) if shot.get("gripY") != null else float(shot.y)
	var aim := Vector2(shot.aimX, shot.aimY)
	var side := Vector2(-aim.y, aim.x)
	var seed: int = MapScene.render_hash(_frame + floori(x * 7 + 0.5), floori(y * 11 + 0.5))
	var speed: float = float(casing.speed) + seed % 19
	var backwards: float = 14 + ((seed >> 7) % 18)
	var lifetime: float = maxf(0.9, float(weapon.get("shellLife", 0.9)))
	_shells.append({"x": x + aim.x * 8 + side.x * 5,
		"y": y + aim.y * 8 + side.y * 5 + 28, "z": 28.0, "vz": casing.lift,
		"vx": side.x * speed - aim.x * backwards, "vy": side.y * speed - aim.y * backwards - 22,
		"angle": float(seed % 628) / 100, "spin": float(casing.spin) + ((seed >> 13) % 5),
		"bounce": casing.bounce, "bounced": false, "life": lifetime, "maxLife": lifetime,
		"length": casing.length, "width": casing.width, "color": casing.color})


func _update_shells(delta: float) -> void:
	if _model.screen != GameSession.Screen.RUNNING:
		return
	var player: Dictionary = _model.run.player
	for index: int in range(_pending_shells.size() - 1, -1, -1):
		var queued: Dictionary = _pending_shells[index]
		if float(_model.run.elapsed) < float(queued.due):
			continue
		if player.weaponId == queued.weaponId:
			var pose: Dictionary = WeaponRules.compact_shot_pose(player, player.lastAimX, player.lastAimY, _model.catalog)
			_spawn_shell({"weaponId": player.weaponId, "x": player.x, "y": player.y,
				"gripX": pose.get("anchorX"), "gripY": pose.get("anchorY"),
				"aimX": player.lastAimX, "aimY": player.lastAimY}, _model.catalog.metadata.weaponFeedback[player.weaponId])
		_pending_shells.remove_at(index)
	for index: int in range(_shells.size() - 1, -1, -1):
		var shell: Dictionary = _shells[index]
		shell.life -= delta
		if float(shell.life) <= 0:
			_shells.remove_at(index)
			continue
		shell.x += float(shell.vx) * delta
		shell.y += float(shell.vy) * delta
		var landed: bool = float(shell.z) == 0 and float(shell.vz) == 0
		shell.vx *= maxf(0, 1 - delta * (9 if landed else 1.8))
		shell.vy *= maxf(0, 1 - delta * (9 if landed else 1.8))
		if not landed:
			shell.z += float(shell.vz) * delta - 250 * delta * delta
			shell.vz -= 500 * delta
			if float(shell.z) <= 0:
				shell.z = 0.0
				if not shell.bounced and absf(float(shell.vz)) > 15:
					shell.vz = -float(shell.vz) * float(shell.bounce)
					shell.bounced = true
					shell.spin *= 0.5
				else:
					shell.vz = 0.0
					shell.spin = 0.0
		shell.angle += float(shell.spin) * delta


func _draw_interaction_labels() -> void:
	var player: Dictionary = _model.run.player
	for item: Dictionary in _model.interactives:
		if not item.active or item.type == "tradePost" or GeometryRules.distance_squared(
				player.x, player.y, item.x, item.y) > 300 * 300:
			continue
		var label: String = "靠近拾取补给" if item.type == "supplyCache" else "爆桶 · 可射击引爆" if item.type == "explosiveBarrel" else "电磁区 · 减速感染者"
		var width: float = label.length() * 9 + 14
		var y: float = float(item.y) - (float(item.radius) + 22 if item.type == "electricField" else 48)
		_canvas.draw_rect(Rect2(float(item.x) - width / 2, y, width, 20), Color(0.122, 0.122, 0.094, 0.88))
		_fonts.text(_canvas, label, Vector2(item.x, y + 10), 10,
			Color("e3b47e") if item.type == "explosiveBarrel" else Color("e1d5ad"), "center", 700)
