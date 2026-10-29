extends Node2D
## Native Godot import/control probe. This deliberately is not the complete game.

const WEAPON_IDS: Array[String] = ["scrap_pistol", "prism_laser", "shock_hammer"]
const SCALE: float = 1.5
var catalog: Dictionary = {}
var world: Dictionary = {}
var weapons: Dictionary = {}
var textures: Dictionary = {}
var player: CharacterBody2D
var body: Sprite2D
var held: Node2D
var camera: Camera2D
var actors: Node2D
var hud: Label
var audio: AudioStreamPlayer
var overlay: Node2D
var enemy_nodes: Array[CharacterBody2D] = []
var effects: Array[Dictionary] = []
var bullets: Array[Dictionary] = []
var weapon_id: String = "scrap_pistol"
var aim: Vector2 = Vector2.RIGHT
var travel: float = 0.0
var elapsed: float = 0.0
var cooldown: float = 0.0
var recoil_age: float = 1.0
var attack_age: float = -1.0
var attack_aim: Vector2 = Vector2.RIGHT
var paused: bool = false
var automatic: bool = true
var enemies_move: bool = true
var shots: int = 0
var hits: int = 0
var cash: int = 0
var kills: int = 0
var control: Dictionary = {}
var probe_mode: bool = false
var frame_count: int = 0
var frame_times: Array[float] = []

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	catalog = JSON.parse_string(FileAccess.get_file_as_string("res://imported/catalog.json"))
	world = catalog.world
	for definition: Dictionary in catalog.weapons:
		weapons[definition.id] = definition
	actors = Node2D.new()
	actors.y_sort_enabled = true
	add_child(actors)
	overlay = Node2D.new()
	overlay.name = "Effects"
	overlay.z_index = 3
	add_child(overlay)
	overlay.draw.connect(_draw_effects.bind(overlay))
	_build_collisions()
	player = _actor(10.0)
	player.name = "Player"
	player.position = Vector2(1536, 1536)
	body = _sprite(_texture(catalog.hero.texture), player)
	body.hframes = int(catalog.hero.body.columns)
	body.offset = -Vector2(32, 56)
	body.scale = Vector2.ONE * SCALE
	camera = Camera2D.new()
	camera.position_smoothing_enabled = false
	player.add_child(camera)
	camera.make_current()
	audio = AudioStreamPlayer.new()
	audio.volume_db = -13
	add_child(audio)
	_build_hud()
	_select_weapon(weapon_id)
	_reset_targets(9)
	var args: PackedStringArray = OS.get_cmdline_user_args()
	probe_mode = "--probe" in args or "--capture" in args
	if "--pressure" in args:
		_reset_targets(120)
	if "--probe" in args:
		_run_probe.call_deferred()
	elif "--capture" in args:
		_run_capture.call_deferred()
	queue_redraw()

func _texture(resource_path: String) -> Texture2D:
	if not textures.has(resource_path):
		textures[resource_path] = load(resource_path)
	return textures[resource_path] as Texture2D

func _sprite(texture: Texture2D, parent: Node) -> Sprite2D:
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	parent.add_child(sprite)
	return sprite

func _actor(radius: float) -> CharacterBody2D:
	var actor := CharacterBody2D.new()
	actor.collision_layer = 2
	actor.collision_mask = 1
	var collision := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = radius
	collision.shape = shape
	actor.add_child(collision)
	actors.add_child(actor)
	return actor

func _build_collisions() -> void:
	for obstacle: Dictionary in world.obstacles:
		var wall := StaticBody2D.new()
		wall.name = "Obstacle_%s" % str(get_child_count())
		wall.position = Vector2(float(obstacle.x), float(obstacle.y))
		var collision := CollisionShape2D.new()
		var shape := RectangleShape2D.new()
		shape.size = Vector2(float(obstacle.w), float(obstacle.h))
		collision.shape = shape
		collision.position = shape.size / 2.0
		wall.add_child(collision)
		add_child(wall)

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := PanelContainer.new()
	panel.position = Vector2(18, 16)
	panel.size = Vector2(800, 112)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("202b24ed")
	style.border_color = Color("a68d5a")
	style.set_border_width_all(1)
	style.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", style)
	layer.add_child(panel)
	hud = Label.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei", "Noto Sans CJK SC"])
	hud.add_theme_font_override("font", font)
	hud.add_theme_font_size_override("font_size", 17)
	hud.add_theme_color_override("font_color", Color("e8d6ad"))
	panel.add_child(hud)

func _select_weapon(id: String) -> void:
	weapon_id = id
	attack_age = -1.0
	cooldown = 0.0
	if is_instance_valid(held):
		held.free()
	held = Node2D.new()
	held.name = "IndependentWeaponHandsCuffs"
	player.add_child(held)
	var definition: Dictionary = weapons[id]
	var visual: Dictionary = definition.visual
	var weapon_texture: Texture2D
	if not str(definition.texture).is_empty():
		weapon_texture = _texture(definition.texture)
	else:
		var image := Image.create_empty(int(visual.width), int(visual.height), false, Image.FORMAT_RGBA8)
		for rectangle: Array in visual.shapes:
			image.fill_rect(Rect2i(int(rectangle[0]), int(rectangle[1]), int(rectangle[2]), int(rectangle[3])), Color(catalog.palette[rectangle[4]]))
		weapon_texture = ImageTexture.create_from_image(image)
	var weapon_sprite := _sprite(weapon_texture, held)
	weapon_sprite.name = "WeaponOnly"
	weapon_sprite.position = -Vector2(float(visual.pivot[0]), float(visual.pivot[1]))
	for part: Dictionary in definition.parts:
		var atlas := AtlasTexture.new()
		atlas.atlas = _texture(part.texture)
		atlas.region = Rect2(float(part.rect[0]), float(part.rect[1]), float(part.rect[2]), float(part.rect[3]))
		var sprite := _sprite(atlas, held)
		sprite.name = "Part_%s" % str(held.get_child_count())
		sprite.position = Vector2(float(part.x), float(part.y)) - Vector2(float(visual.pivot[0]), float(visual.pivot[1]))
		sprite.z_index = 1 if part.depth == "front" else -1
	_update_pose()

func _reset_targets(count: int) -> void:
	for enemy: CharacterBody2D in enemy_nodes:
		enemy.free()
	enemy_nodes.clear()
	for i: int in range(count):
		var definition: Dictionary = catalog.enemies[i % catalog.enemies.size()]
		var enemy := _actor(float(definition.radius))
		enemy.position = player.position + Vector2.from_angle(float(i) * TAU / float(count)) * (150.0 + float(i % 4) * 65.0)
		enemy.set_meta("definition", definition)
		enemy.set_meta("hp", float(definition.hp) * 8.0)
		enemy.set_meta("phase", float(i) * 0.17)
		var sprite := _sprite(_texture(definition.texture), enemy)
		sprite.hframes = int(definition.columns)
		sprite.offset = -Vector2(float(definition.root[0]), float(definition.root[1]))
		sprite.scale = Vector2.ONE * float(definition.pixelScale)
		enemy_nodes.append(enemy)

func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	match event.physical_keycode:
		KEY_1: _select_weapon(WEAPON_IDS[0])
		KEY_2: _select_weapon(WEAPON_IDS[1])
		KEY_3: _select_weapon(WEAPON_IDS[2])
		KEY_SPACE: automatic = not automatic
		KEY_P, KEY_ESCAPE: paused = not paused
		KEY_R: _reset_targets(9)
		KEY_M: enemies_move = not enemies_move
		KEY_E:
			var station: Vector2 = _station_position()
			if player.position.distance_to(station) < 110:
				cash += 1 # An interaction probe, not the migrated economy.

func _station_position() -> Vector2:
	for item: Dictionary in world.interactives:
		if item.type == "tradePost":
			return Vector2(float(item.x), float(item.y))
	return Vector2.ZERO

func _physics_process(delta: float) -> void:
	if paused:
		return
	elapsed += delta
	frame_count += 1
	cooldown -= delta
	recoil_age += delta
	var input_direction := Vector2(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	if control.has("move"):
		input_direction = control.move
	var previous_position: Vector2 = player.position
	player.velocity = input_direction.limit_length() * 156.0
	player.move_and_slide()
	player.position = player.position.clamp(Vector2(10, 10), Vector2.ONE * (float(world.worldSize) - 10))
	travel += previous_position.distance_to(player.position)
	body.frame = 1 + int(fmod(travel / 68.0, 1.0) * 8.0) if previous_position.distance_to(player.position) > 0.001 else 0
	for enemy: CharacterBody2D in enemy_nodes:
		var definition: Dictionary = enemy.get_meta("definition")
		var old_position: Vector2 = enemy.position
		enemy.velocity = enemy.position.direction_to(player.position) * float(definition.speed) if enemies_move else Vector2.ZERO
		enemy.move_and_slide()
		var phase: float = float(enemy.get_meta("phase")) + old_position.distance_to(enemy.position) / float(definition.stride)
		enemy.set_meta("phase", phase)
		var sprite: Sprite2D = enemy.get_child(1) as Sprite2D
		sprite.frame = int(fmod(phase, 1.0) * 8.0) if old_position.distance_to(enemy.position) > 0.001 else int(definition.idleFrame)
		sprite.flip_h = enemy.position.x > player.position.x
	var target: CharacterBody2D = _nearest_target()
	if attack_age < 0:
		if control.has("aim"):
			aim = control.aim
		elif is_instance_valid(target):
			_aim_at(target.position)
		elif not automatic:
			_aim_at(get_global_mouse_position())
	_update_pose()
	if not probe_mode and cooldown <= 0 and attack_age < 0 and ((automatic and is_instance_valid(target)) or (not automatic and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT))):
		_fire()
	_update_attack(delta)
	_update_bullets(delta)
	for effect: Dictionary in effects:
		effect.life -= delta
	effects = effects.filter(func(effect: Dictionary) -> bool: return float(effect.life) > 0)
	hud.text = "Godot原生迁移技术样板 · %s · %.1fs · 命中%d / 开火%d\nWASD移动　1手枪 / 2激光 / 3重锤　空格自动攻击　M固定靶　R重置　Esc暂停\n现有素材与碰撞导入；敌人仅简化追击。交易/升级/存档/完整玩法尚未迁移。" % [weapons[weapon_id].name, elapsed, hits, shots]
	overlay.queue_redraw()
	queue_redraw()

func _nearest_target() -> CharacterBody2D:
	var nearest: CharacterBody2D = null
	var distance: float = float(weapons[weapon_id].lockRange)
	for enemy: CharacterBody2D in enemy_nodes:
		var value: float = player.position.distance_to(enemy.position)
		if value < distance and _ray(player.position, enemy.position).is_empty():
			distance = value
			nearest = enemy
	return nearest

func _aim_at(target: Vector2) -> void:
	var hold: Dictionary = weapons[weapon_id].hold
	var angle: float = (target - player.position - Vector2(0, float(hold.chestY) * SCALE)).angle()
	for i: int in range(12):
		var up: float = maxf(0.0, -sin(angle))
		var anchor: Vector2 = player.position + Vector2(float(hold.aimOffsetX) * cos(angle) + float(hold.upShoulder) * pow(up, 3), float(hold.chestY) - float(hold.upLift) * up) * SCALE
		if target.distance_to(anchor) < 3:
			break
		angle = (target - anchor).angle()
	aim = Vector2.from_angle(angle)

func _update_pose() -> void:
	var hold: Dictionary = weapons[weapon_id].hold
	var facing: float = -1.0 if aim.x < -0.15 else 1.0
	var up: float = maxf(0.0, -aim.y)
	body.flip_h = facing < 0
	held.position = Vector2(float(hold.aimOffsetX) * aim.x + float(hold.upShoulder) * pow(up, 3), float(hold.chestY) - float(hold.upLift) * up) * SCALE
	held.position -= aim * exp(-recoil_age * 24.0) * float(weapons[weapon_id].recoil)
	held.rotation = aim.angle()
	held.scale = Vector2(SCALE, SCALE * facing)
	held.z_index = -1 if aim.y < -0.18 else 1
	if attack_age >= 0:
		var windup: float = float(weapons[weapon_id].windup)
		held.rotation += -1.35 * minf(1.0, attack_age / windup) * facing if attack_age < windup else -1.35 * maxf(0, 1 - (attack_age - windup) / 0.055) * facing

func _muzzle() -> Vector2:
	var visual: Dictionary = weapons[weapon_id].visual
	return held.to_global(Vector2(float(visual.muzzle[0]) - float(visual.pivot[0]), float(visual.muzzle[1]) - float(visual.pivot[1])))

func _ray(start: Vector2, end: Vector2) -> Dictionary:
	var query := PhysicsRayQueryParameters2D.create(start, end, 1)
	return get_world_2d().direct_space_state.intersect_ray(query)

func _segment_circle(start: Vector2, end: Vector2, center: Vector2, radius: float) -> float:
	var nearest: Vector2 = Geometry2D.get_closest_point_to_segment(center, start, end)
	return start.distance_to(nearest) if nearest.distance_to(center) <= radius else INF

func _play(id: String) -> void:
	if catalog.sounds.has(id) and not probe_mode:
		audio.stream = load(catalog.sounds[id]) as AudioStream
		audio.play()

func _fire() -> void:
	var definition: Dictionary = weapons[weapon_id]
	shots += 1
	cooldown = float(definition.interval)
	recoil_age = 0
	_play(weapon_id)
	if weapon_id == "shock_hammer":
		attack_age = 0
		attack_aim = aim
		return
	var start: Vector2 = _muzzle()
	var barrel_wall: Dictionary = _ray(held.global_position - aim * 10, start)
	if not barrel_wall.is_empty():
		effects.append({"kind":"beam", "start":held.global_position, "end":barrel_wall.position, "life":0.10})
		return
	if weapon_id == "prism_laser":
		var end: Vector2 = start + aim * float(definition.lockRange)
		var wall: Dictionary = _ray(start, end)
		if not wall.is_empty():
			end = wall.position
		var contacts: Array[Dictionary] = []
		for enemy: CharacterBody2D in enemy_nodes:
			var contact: float = _segment_circle(start, end, enemy.position, float(enemy.get_meta("definition").radius) + 2)
			if is_finite(contact):
				contacts.append({"enemy":enemy, "distance":contact})
		contacts.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.distance) < float(b.distance))
		for i: int in range(mini(4, contacts.size())):
			_damage(contacts[i].enemy, float(definition.damage))
			if i == 3:
				end = start + aim * float(contacts[i].distance)
		effects.append({"kind":"beam", "start":start, "end":end, "life":0.105})
	else:
		bullets.append({"position":start,"velocity":aim * float(definition.projectileSpeed),"life":float(definition.ttl),"damage":float(definition.damage)})

func _update_attack(delta: float) -> void:
	if attack_age < 0:
		return
	var previous: float = attack_age
	attack_age += delta
	var definition: Dictionary = weapons[weapon_id]
	var windup: float = float(definition.windup)
	if previous < windup and attack_age >= windup:
		var center: Vector2 = player.position + attack_aim * float(definition.impactOffset)
		var wall: Dictionary = _ray(player.position, center)
		if not wall.is_empty():
			center = wall.position - attack_aim * 4
		effects.append({"kind":"slam","center":center,"radius":float(definition.blastRadius),"life":0.30})
		_play("hammer_impact")
		for enemy: CharacterBody2D in enemy_nodes.duplicate():
			if enemy.position.distance_to(center) <= float(definition.blastRadius) + float(enemy.get_meta("definition").radius) and _ray(center, enemy.position).is_empty():
				_damage(enemy, float(definition.damage))
	if attack_age >= windup + float(definition.activeTime) + float(definition.recovery):
		attack_age = -1

func _update_bullets(delta: float) -> void:
	for bullet: Dictionary in bullets:
		var start: Vector2 = bullet.position
		var end: Vector2 = start + Vector2(bullet.velocity) * minf(delta, float(bullet.life))
		var wall: Dictionary = _ray(start, end)
		if not wall.is_empty():
			end = wall.position
			bullet.life = 0
		var nearest: CharacterBody2D = null
		var distance: float = INF
		for enemy: CharacterBody2D in enemy_nodes:
			var contact: float = _segment_circle(start, end, enemy.position, float(enemy.get_meta("definition").radius) + 3)
			if contact < distance:
				distance = contact
				nearest = enemy
		if is_instance_valid(nearest):
			_damage(nearest, float(bullet.damage))
			bullet.life = 0
		bullet.position = end
		bullet.life -= delta
	bullets = bullets.filter(func(bullet: Dictionary) -> bool: return float(bullet.life) > 0)

func _damage(enemy: CharacterBody2D, amount: float) -> void:
	hits += 1
	var hp: float = float(enemy.get_meta("hp")) - amount
	enemy.set_meta("hp", hp)
	enemy.modulate = Color("d5c2a5")
	if hp <= 0:
		kills += 1
		enemy_nodes.erase(enemy)
		enemy.queue_free()

func _draw() -> void:
	if catalog.is_empty():
		return
	draw_texture_rect(_texture(catalog.worldTextures.ground), Rect2(Vector2.ZERO, Vector2.ONE * float(world.worldSize)), true, Color(0.8,0.8,0.8))
	for road: Dictionary in world.roads:
		var rect := Rect2(float(road.x),float(road.y),float(road.w),float(road.h))
		draw_rect(rect, Color("45483f"))
		if road.orientation == "horizontal":
			for x: int in range(int(rect.position.x), int(rect.end.x), 90):
				draw_rect(Rect2(float(x),rect.get_center().y,34,2),Color("9e8a58"))
		else:
			for y: int in range(int(rect.position.y), int(rect.end.y), 90):
				draw_rect(Rect2(rect.get_center().x,float(y),2,34),Color("9e8a58"))
	for obstacle: Dictionary in world.obstacles:
		var rect := Rect2(float(obstacle.x),float(obstacle.y),float(obstacle.w),float(obstacle.h))
		if catalog.worldTextures.has(obstacle.kind):
			draw_texture_rect(_texture(catalog.worldTextures[obstacle.kind]), rect.grow(6), false)
		else:
			draw_rect(rect, Color("675e46"))
			draw_rect(rect.grow(-4), Color("444b3e"))
	var station: Vector2 = _station_position()
	draw_arc(station, 78, 0, TAU, 40, Color("ab9e65"), 1)

func _draw_effects(overlay: Node2D) -> void:
	for bullet: Dictionary in bullets:
		var direction: Vector2 = Vector2(bullet.velocity).normalized()
		overlay.draw_line(bullet.position - direction * 8, bullet.position, Color("e6c57f"), 3)
	for effect: Dictionary in effects:
		if effect.kind == "beam":
			overlay.draw_line(effect.start, effect.end, Color("6ec5b9"), 4)
			overlay.draw_line(effect.start, effect.end, Color("e6ffe2"), 1)
		elif effect.kind == "slam":
			var radius: float = float(effect.radius) * (1 - float(effect.life) / 0.30)
			overlay.draw_arc(effect.center, radius, 0, TAU, 32, Color("c9b783"), 3)

func _run_probe() -> void:
	# This native test is intentionally bounded and writes only into the workspace.
	automatic = false
	enemies_move = false
	control.move = Vector2.RIGHT
	for i: int in range(15):
		await get_tree().physics_frame
	var moved: bool = travel > 10
	control.move = Vector2.ZERO
	var samples: Array[Dictionary] = []
	for id: String in WEAPON_IDS:
		_select_weapon(id)
		_reset_targets(1)
		enemy_nodes[0].position = player.position + Vector2(75 if id == "shock_hammer" else 160, -12)
		_aim_at(enemy_nodes[0].position)
		_update_pose()
		var before: int = hits
		_fire()
		for i: int in range(40):
			await get_tree().physics_frame
		samples.append({"id":id,"nativeHits":hits - before,"independentPartNodes":held.get_child_count()})
	var query := PhysicsRayQueryParameters2D.create(Vector2(1480,1190), Vector2(1480,1360), 1)
	var collision: bool = not get_world_2d().direct_space_state.intersect_ray(query).is_empty()
	var pose_error: float = 0
	player.position = Vector2(100,100)
	for sample: Dictionary in catalog.poseCases:
		_select_weapon(sample.weaponId)
		recoil_age = 10
		aim = Vector2.from_angle(float(sample.angle))
		_update_pose()
		pose_error = maxf(pose_error, held.global_position.distance_to(Vector2(float(sample.anchor[0]),float(sample.anchor[1]))))
		pose_error = maxf(pose_error, _muzzle().distance_to(Vector2(float(sample.muzzle[0]),float(sample.muzzle[1]))))
	var proof: Dictionary = {"engine":Engine.get_version_info().string,"renderer":RenderingServer.get_current_rendering_method(),"nativePlayerMoved":moved,"originalObstacleRayHit":collision,"weapons":samples,"originalPoseCases":catalog.poseCases.size(),"maximumPoseError":pose_error,"enemyAtlasTypes":catalog.enemies.size(),"mapObstacles":world.obstacles.size(),"saveIsolation":"WastelandEcho-Godot-Pilot-Isolated","completeGamePort":false}
	var proof_file := FileAccess.open("res://../../output/godot-evaluation-2026-10-29/native-probe.json", FileAccess.WRITE)
	if proof_file != null:
		proof_file.store_string(JSON.stringify(proof,"  "))
	print("GODOT_NATIVE_PROBE " + JSON.stringify(proof))
	get_tree().quit(0 if moved and collision and pose_error < 0.01 and samples.all(func(sample: Dictionary) -> bool: return int(sample.nativeHits) > 0) else 1)

func _run_capture() -> void:
	set_physics_process(false)
	probe_mode = true
	audio.stop()
	audio.stream = null
	automatic = false
	enemies_move = false
	control.move = Vector2.ZERO
	for id: String in WEAPON_IDS:
		_select_weapon(id)
		_reset_targets(3)
		for i: int in range(enemy_nodes.size()):
			enemy_nodes[i].position = player.position + Vector2(80 + i * 85, -22 + i * 10)
			enemy_nodes[i].set_meta("hp", 100000.0)
		_aim_at(enemy_nodes[0].position)
		_update_pose()
		_fire()
		for i: int in range(19 if id == "shock_hammer" else 1):
			_physics_process(1.0 / 60.0)
		for i: int in range(2):
			await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var image: Image = get_viewport().get_texture().get_image()
		var filename: String = ProjectSettings.globalize_path("res://../../output/godot-evaluation-2026-10-29/native-" + id + ".png")
		var result: Error = image.save_png(filename)
		if result != OK:
			push_error("Failed native capture: " + filename)
			get_tree().quit(1)
			return
		image = null
	print("GODOT_NATIVE_CAPTURE " + RenderingServer.get_video_adapter_name())
	get_tree().quit.call_deferred()
