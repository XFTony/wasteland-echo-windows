class_name CharacterVisual
extends Node2D
## Body, gun, hands and cuffs retain independent source textures and draw order.

const ILLUSTRATED_WIDTHS: Dictionary = {"scrap_pistol": 39, "swarm_smg": 49,
	"breaker_shotgun": 56, "needle_rifle": 61, "rust_revolver": 40,
	"ember_carbine": 55, "coil_cannon": 64}

@export var hero_id: String = "ranger"
@export var skin_id: String = "wanderer"
@export var weapon_id: String = "scrap_pistol"
@export var pixel_scale: float = 1.5
@export var aim_angle: float = 0.0
var phase: float = 0.0
var walking: bool = false
var recoil: float = 0.0
var visual_angle: float = 0.0
var facing: float = 1.0
var depth_back: bool = false
var combat_view: bool = false
var _catalog: GameCatalog
var _assets: AssetStore
var _sample_position: Vector2
var _sample_elapsed: float = -1.0
var _illustrated_bob: float = 0.0
var _recoil_offset: float = 0.0


func configure(catalog: GameCatalog, assets: AssetStore) -> void:
	_catalog = catalog
	_assets = assets
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	queue_redraw()


func update_aim(angle: float) -> void:
	aim_angle = angle
	if cos(angle) > 0.15:
		facing = 1.0
	elif cos(angle) < -0.15:
		facing = -1.0
	if sin(angle) < -0.18:
		depth_back = true
	elif sin(angle) > 0.18:
		depth_back = false
	queue_redraw()


func muzzle() -> Vector2:
	var pose: Dictionary = _pose()
	return to_global(Vector2(pose.muzzle))


func weapon_texture(id: String) -> Texture2D:
	return _assets.weapon_texture(id)


func sample(player: Dictionary, elapsed: float, feedback: Dictionary, attack: Variant,
		input: Dictionary = {}) -> void:
	hero_id = player.heroId
	skin_id = player.skinId
	weapon_id = player.weaponId
	var point := Vector2(float(player.x), float(player.y))
	if elapsed > _sample_elapsed and _sample_elapsed >= 0:
		var distance: float = point.distance_to(_sample_position)
		walking = distance > 0.001
		if walking:
			phase = fmod(phase + distance / float(_catalog.metadata.actorMetadata.HERO.stride), 1)
	elif elapsed < _sample_elapsed:
		phase = 0
		walking = false
	_sample_position = point
	_sample_elapsed = elapsed
	facing = float(player.get("compactFacing", facing))
	depth_back = player.get("compactDepth", "back" if depth_back else "front") == "back"
	update_aim(atan2(float(player.lastAimY), float(player.lastAimX)))
	var response: Dictionary = WeaponFeedback.sample(_catalog, feedback, elapsed, weapon_id, facing, aim_angle)
	_recoil_offset = response.offset
	var moving: bool = pow(float(input.get("moveX", 0)), 2) + pow(float(input.get("moveY", 0)), 2) > 0.12 * 0.12
	_illustrated_bob = sin(elapsed * (13 if moving else 2.2)) * (2.1 if moving else 0.7)
	var denominator: float = maxf(0.01, float(_catalog.metadata.poses[weapon_id].hold.recoil) * pixel_scale)
	recoil = float(response.offset) / denominator
	visual_angle = WeaponActions.attack_motion(attack, elapsed) if attack is Dictionary and attack.weaponId == weapon_id else float(response.angle)
	queue_redraw()


func _draw() -> void:
	if _catalog == null or _assets == null:
		return
	if hero_id != "ranger" or skin_id != "wanderer":
		texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		_draw_illustrated()
		return
	var body_spec: Dictionary = _catalog.metadata.actorMetadata.HERO
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var body_texture: Texture2D = _assets.texture(body_spec.assetId)
	var frame: int = int(body_spec.body.walkFrames[floori(fmod(phase, 1.0) * 8)]) if walking else 0
	if depth_back:
		_draw_held()
	_draw_body(body_texture, frame, int(body_spec.body.height))
	if not depth_back:
		_draw_held()
		_draw_body(body_texture, frame, int(body_spec.body.headOcclusionRows))
	draw_set_transform(Vector2.ZERO)


func _pose() -> Dictionary:
	return CompactPose.sample(_catalog.metadata.poses[weapon_id].hold, aim_angle,
		pixel_scale, facing, recoil, visual_angle)


func _draw_body(texture: Texture2D, frame: int, rows: int) -> void:
	if texture == null:
		return
	draw_set_transform(Vector2.ZERO, 0, Vector2(pixel_scale * facing, pixel_scale))
	draw_texture_rect_region(texture, Rect2(-32, -56, 64, rows), Rect2(frame * 64, 0, 64, rows))


func _draw_held() -> void:
	var pose: Dictionary = _pose()
	var definition: Dictionary = _catalog.metadata.poses[weapon_id].definition
	var layout: Dictionary = _catalog.metadata.poses[weapon_id].layout
	var pivot := Vector2(float(definition.visual.pivot[0]), float(definition.visual.pivot[1]))
	draw_set_transform(pose.anchor, float(pose.angle), Vector2(pixel_scale, pixel_scale * facing))
	for part: Dictionary in layout.layers:
		if part.depth == "back":
			_draw_part(part, pivot)
	var texture: Texture2D = weapon_texture(weapon_id)
	draw_texture(texture, -pivot)
	for part: Dictionary in layout.layers:
		if part.depth == "front":
			_draw_part(part, pivot)


func _draw_part(part: Dictionary, pivot: Vector2) -> void:
	var id: String = _catalog.metadata.actorMetadata.PART_ASSETS[part.asset]
	var texture: Texture2D = _assets.texture(id)
	var source := Rect2(float(part.rect[0]), float(part.rect[1]),
		float(part.rect[2]), float(part.rect[3]))
	draw_texture_rect_region(texture, Rect2(Vector2(float(part.x), float(part.y)) - pivot,
		source.size), source)


func _draw_illustrated() -> void:
	var id: String = _catalog.metadata.illustrated.heroes.get(hero_id, {}).get(skin_id, "")
	var texture: Texture2D = _assets.texture(id)
	if texture == null:
		return
	var height: float = 76 if combat_view else 54 * pixel_scale
	var width: float = height * texture.get_width() / float(texture.get_height())
	var bob: float = _illustrated_bob if combat_view else 0.0
	draw_set_transform(Vector2.ZERO, 0, Vector2(-1 if combat_view and cos(aim_angle) < -0.2 else 1, 1))
	draw_texture_rect(texture, Rect2(-width / 2, -height * 0.86 + bob, width, height), false)
	draw_set_transform(Vector2.ZERO)
	if not combat_view:
		return
	var aim := Vector2(cos(aim_angle), sin(aim_angle))
	var side: float = 16 if hero_id == "bulwark" else 11 if hero_id == "mechanic" else 0
	var anchor := Vector2(-side if aim.x < 0 else side, -30 if hero_id == "ranger" else -23)
	anchor += Vector2(0, bob) - aim * _recoil_offset
	draw_set_transform(anchor, aim_angle + visual_angle, Vector2(1, -1 if aim.x < 0 else 1))
	var weapon_art: String = _catalog.metadata.illustrated.weapons.get(weapon_id, "")
	var gun: Texture2D = _assets.texture(weapon_art) if not weapon_art.is_empty() else _assets.weapon_texture(weapon_id)
	if gun != null:
		var gun_width: float = float(ILLUSTRATED_WIDTHS.get(weapon_id, gun.get_width() * 1.5))
		var gun_height: float = gun_width * gun.get_height() / float(gun.get_width())
		var grip: float = 0.29 if weapon_id in ["scrap_pistol", "rust_revolver"] else 0.39
		draw_texture_rect(gun, Rect2(-gun_width * grip, -gun_height * 0.43, gun_width, gun_height), false)
	draw_set_transform(Vector2.ZERO)
