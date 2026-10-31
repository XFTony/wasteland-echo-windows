class_name MapPropVisual
extends Node2D
## Only upper artwork fades; physical bases and the model collision remain unchanged.

const DrawLayer = preload("res://scripts/presentation/world_draw_layer.gd")

var obstacle: MapObstacle
var profile: MapArtProfile
var base_rect: Rect2
var visual_rect: Rect2
var roof_opacity: float = 1.0
var _texture: Texture2D
var _region: Rect2
var _size: Vector2
var _height: float
var _vertical_vehicle: bool = false
var _fonts := UiFonts.new()


func configure(source: MapObstacle, style: MapArtProfile) -> void:
	obstacle = source
	profile = style
	var data: Dictionary = source.collision_data()
	_size = Vector2(data.w, data.h)
	base_rect = Rect2(data.x, data.y, data.w, data.h)
	position = Vector2(float(data.x) + float(data.w) / 2, float(data.y) + float(data.h))
	_height = profile.height_for(data)
	_vertical_vehicle = data.kind in ["railcar", "container"] and _size.y > _size.x * 1.3
	visual_rect = Rect2(float(data.x), float(data.y) - _height, float(data.w), float(data.h) + _height)
	var key: String = profile.prop_key(data)
	if profile.prop_regions.has(key):
		_texture = profile.prop_texture
		_region = profile.prop_regions[key]
		material = profile.prop_material
	else:
		_texture = source.image
		_region = source.image_region
		if data.kind in ["car", "wreck", "scrap"]:
			_texture = load("res://assets/world/echo-market-v1/salvage-kit.webp") as Texture2D
			_region = {"car": Rect2(264, 36, 240, 120), "wreck": Rect2(8, 243, 240, 89),
				"scrap": Rect2(264, 213, 240, 149)}[data.kind]
		if _texture != null and not _region.has_area():
			_region = Rect2(Vector2.ZERO, _texture.get_size())
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var labels: Node2D = DrawLayer.new()
	labels.name = "PropLabel"
	labels.paint = _paint_label
	add_child(labels)
	queue_redraw()


func update_occlusion(player: Dictionary, enemies: Array[Dictionary], view: Rect2) -> void:
	visible = view.grow(120).intersects(visual_rect)
	if not visible:
		return
	var covered: bool = _covers_actor(player, 24, 80)
	if not covered and _height > 0:
		for enemy: Dictionary in enemies:
			if not enemy.active or GeometryRules.distance_squared(player.x, player.y, enemy.x, enemy.y) > 380 * 380:
				continue
			if _covers_actor(enemy, maxf(20, float(enemy.radius) * 2), 70 if not enemy.boss else 108):
				covered = true
				break
	var opacity: float = profile.roof_fade if covered and _height > 0 else 1.0
	if not is_equal_approx(opacity, roof_opacity):
		roof_opacity = opacity
		queue_redraw()


func _covers_actor(actor: Dictionary, width: float, height: float) -> bool:
	if float(actor.y) >= position.y:
		return false
	var body := Rect2(float(actor.x) - width / 2, float(actor.y) - height, width, height)
	var upper := Rect2(visual_rect.position, Vector2(visual_rect.size.x, visual_rect.size.y * 0.68))
	return upper.intersects(body)


func _draw() -> void:
	if obstacle == null:
		return
	if obstacle.source_data.get("kind") == "fence":
		var rect := Rect2(-_size.x / 2, -_size.y, _size.x, _size.y)
		draw_rect(rect, Color(0.23, 0.27, 0.23, 0.55))
		draw_rect(rect, Color("817e64"), false, 2)
		if _size.x > _size.y:
			for x: int in range(10, int(_size.x), 18):
				draw_line(Vector2(rect.position.x + x, rect.position.y), Vector2(rect.position.x + x, rect.end.y), Color("77775e"), 1)
		else:
			for y: int in range(10, int(_size.y), 18):
				draw_line(Vector2(rect.position.x, rect.position.y + y), Vector2(rect.end.x, rect.position.y + y), Color("77775e"), 1)
		return
	if _texture == null:
		SourceDrawing.paint(self, obstacle.drawing_commands(), _fonts, -_size * Vector2(0.5, 1),
			_size / Vector2(float(obstacle.source_data.w), float(obstacle.source_data.h)))
		return
	var height: float = _size.y + _height
	if _vertical_vehicle:
		draw_set_transform(Vector2(0, -height / 2), PI / 2)
		draw_texture_rect_region(_texture, Rect2(-height / 2, -_size.x / 2, height * 0.68, _size.x),
			Rect2(_region.position, Vector2(_region.size.x * 0.68, _region.size.y)), Color(profile.prop_tint, roof_opacity))
		draw_texture_rect_region(_texture, Rect2(height * 0.18, -_size.x / 2, height * 0.32, _size.x),
			Rect2(_region.position + Vector2(_region.size.x * 0.68, 0), Vector2(_region.size.x * 0.32, _region.size.y)), profile.prop_tint)
		draw_set_transform(Vector2.ZERO)
		return
	var top := Rect2(-_size.x / 2, -height, _size.x, height * 0.68)
	var bottom := Rect2(-_size.x / 2, -height * 0.32, _size.x, height * 0.32)
	var upper_region := Rect2(_region.position, Vector2(_region.size.x, _region.size.y * 0.68))
	var lower_region := Rect2(_region.position + Vector2(0, _region.size.y * 0.68), Vector2(_region.size.x, _region.size.y * 0.32))
	draw_texture_rect_region(_texture, top, upper_region, Color(profile.prop_tint, roof_opacity))
	draw_texture_rect_region(_texture, bottom, lower_region, profile.prop_tint)


func _paint_label(canvas: CanvasItem) -> void:
	if obstacle.source_data.get("kind") == "tradePost":
		_fonts.text(canvas, "余火交易站", Vector2(0, 11), 12, profile.landmark_color, "center", 800)
	elif obstacle.source_data.get("kind") in ["shop", "warehouse", "station"]:
		if obstacle.source_data.get("kind") == "shop":
			var x: float = -_size.x * (0.11 if "药" in str(obstacle.source_data.get("sign", "")) else 0.02)
			var y: float = -(_size.y + _height) * 0.13
			canvas.draw_line(Vector2(x - 18, y - 6), Vector2(x + 18, y + 6), Color("9e7d4f"), 4)
			canvas.draw_line(Vector2(x - 17, y + 6), Vector2(x + 17, y - 6), Color("6d5739"), 4)
		var sign: String = str(obstacle.source_data.get("sign", ""))
		if not sign.is_empty():
			_fonts.fit(canvas, sign, Vector2(0, -9), 10, _size.x - 8, Color("e4d7ac"), "center", 700, 9)
