class_name CharacterVisual
extends Node2D
## Body, gun, hands and cuffs retain independent source textures and draw order.

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
var _catalog: GameCatalog
var _assets: AssetStore
var _native_textures: Dictionary = {}


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
	return global_position + Vector2(pose.muzzle)


func weapon_texture(id: String) -> Texture2D:
	var spec: Dictionary = _catalog.metadata.poses[id].definition.visual
	if not str(spec.asset).begins_with("native."):
		var asset_id: String = _catalog.metadata.actorMetadata.PART_ASSETS[spec.asset]
		return _assets.texture(asset_id)
	if not _native_textures.has(id):
		var image := Image.create_empty(int(spec.width), int(spec.height), false, Image.FORMAT_RGBA8)
		for rectangle: Array in spec.shapes:
			image.fill_rect(Rect2i(int(rectangle[0]), int(rectangle[1]), int(rectangle[2]),
				int(rectangle[3])), Color(_catalog.metadata.nativePalette[rectangle[4]]))
		_native_textures[id] = ImageTexture.create_from_image(image)
	return _native_textures[id] as Texture2D


func _draw() -> void:
	if _catalog == null or _assets == null:
		return
	if hero_id != "ranger" or skin_id != "wanderer":
		_draw_illustrated()
		return
	var body_spec: Dictionary = _catalog.metadata.actorMetadata.HERO
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
	var height: float = 54 * pixel_scale
	var width: float = height * texture.get_width() / float(texture.get_height())
	draw_texture_rect(texture, Rect2(-width / 2, -height * 0.86, width, height), false)
