@tool
class_name MapObstacle
extends Node2D
## Scene position and footprint produce both the visual and exported collision bounds.

const DrawLayer = preload("res://scripts/presentation/world_draw_layer.gd")

@export var source_data: Dictionary = {}
@export var footprint: Vector2 = Vector2(64, 64):
	set(value):
		footprint = Vector2(maxf(1, value.x), maxf(1, value.y))
		_refresh_visual()
@export var image: Texture2D:
	set(value):
		image = value
		_refresh_visual()
@export var image_region: Rect2:
	set(value):
		image_region = value
		_refresh_visual()
@export var pixelated: bool = false:
	set(value):
		pixelated = value
		_refresh_visual()

var _drawing: Array = []
var _map_id: String = ""
var _fonts := UiFonts.new()


func _ready() -> void:
	_refresh_visual()
	var labels: Node2D = get_node_or_null("Labels") as Node2D
	if labels == null:
		labels = DrawLayer.new()
		labels.name = "Labels"
		labels.z_index = 1
		labels.paint = _paint_labels
		add_child(labels)
	queue_redraw()


func set_drawing(commands: Array, map_id: String) -> void:
	_drawing = commands
	_map_id = map_id
	_refresh_visual()
	queue_redraw()
	var labels: Node2D = get_node_or_null("Labels") as Node2D
	if labels != null:
		labels.queue_redraw()


func _refresh_visual() -> void:
	if not is_inside_tree():
		return
	var sprite: Sprite2D = get_node_or_null("Visual") as Sprite2D
	if sprite == null:
		sprite = Sprite2D.new()
		sprite.name = "Visual"
		sprite.centered = false
		add_child(sprite)
	sprite.visible = image != null
	if image != null:
		sprite.texture = image
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST if pixelated else CanvasItem.TEXTURE_FILTER_LINEAR
		var dimensions: Vector2 = image.get_size()
		sprite.region_enabled = image_region.size.x > 0 and image_region.size.y > 0
		if sprite.region_enabled:
			sprite.region_rect = image_region
			dimensions = image_region.size
		sprite.rotation = 0
		sprite.position = Vector2.ZERO
		sprite.flip_h = false
		if source_data.get("kind") == "railcar" and footprint.y > footprint.x:
			sprite.position.x = footprint.x
			sprite.rotation = PI / 2
			sprite.scale = Vector2(footprint.y, footprint.x) / dimensions
		else:
			sprite.scale = footprint / dimensions
			if _map_id == "echo_district" and source_data.get("kind") == "shop" and "药房" not in str(source_data.get("sign", "")):
				sprite.flip_h = MapScene.render_hash(int(source_data.x), int(source_data.y)) % 3 == 1
	queue_redraw()


func collision_data() -> Dictionary:
	var result: Dictionary = source_data.duplicate(true)
	# Preserve source doubles while an imported transform remains unedited.
	var original_position := Vector2(float(source_data.x), float(source_data.y))
	var original_size := Vector2(float(source_data.w), float(source_data.h))
	result.x = source_data.x if position.x == original_position.x and scale.x >= 0 else position.x + minf(0, footprint.x * scale.x)
	result.y = source_data.y if position.y == original_position.y and scale.y >= 0 else position.y + minf(0, footprint.y * scale.y)
	result.w = source_data.w if footprint.x == original_size.x and scale.x == 1 else footprint.x * absf(scale.x)
	result.h = source_data.h if footprint.y == original_size.y and scale.y == 1 else footprint.y * absf(scale.y)
	return result


func _draw() -> void:
	if image == null:
		if not _drawing.is_empty():
			SourceDrawing.paint(self, _drawing, _fonts, Vector2.ZERO,
				footprint / Vector2(float(source_data.get("w", footprint.x)), float(source_data.get("h", footprint.y))))
		else:
			draw_rect(Rect2(Vector2(8, 9), footprint), Color(0.078, 0.071, 0.059, 0.28))
			draw_rect(Rect2(Vector2.ZERO, footprint), Color("504c3c"))
			draw_rect(Rect2(Vector2(4, 4), footprint - Vector2(8, 8)), Color("6d644a"))
	else:
		draw_rect(Rect2(Vector2(8, 9), footprint), Color(0.078, 0.071, 0.059, 0.28))
	if Engine.is_editor_hint():
		draw_rect(Rect2(Vector2.ZERO, footprint), Color(0.5, 0.8, 0.7, 0.7), false, 1)


func _paint_labels(canvas: CanvasItem) -> void:
	if image == null:
		return
	if source_data.get("kind") == "tradePost":
		_fonts.text(canvas, "余火交易站", Vector2(footprint.x / 2, footprint.y + 11), 12, Color("e9d39e"), "center", 700)
	elif _map_id == "echo_district" and source_data.get("kind") in ["shop", "warehouse"]:
		_fonts.text(canvas, str(source_data.get("sign", "DEPOT")), Vector2(footprint.x / 2, footprint.y - 13), 10, Color("f1dfae"), "center", 700)
