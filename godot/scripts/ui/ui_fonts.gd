class_name UiFonts
extends RefCounted
## Font roles and fitted-size arithmetic preserve the source interface hierarchy.

var ui_scale: float = 1.0
var regular: SystemFont
var bold: SystemFont
var mono: SystemFont
var brand: Font


func _init() -> void:
	regular = SystemFont.new()
	regular.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"])
	bold = SystemFont.new()
	bold.font_names = regular.font_names
	bold.font_weight = 900
	mono = SystemFont.new()
	mono.font_names = PackedStringArray(["Cascadia Mono", "Consolas"])
	mono.font_weight = 700
	brand = load("res://assets/fonts/wasteland-fusion-pixel-12-subset.woff2") as Font


func font_for(role: String, weight: int = 400) -> Font:
	if role == "brand" and brand != null:
		return brand
	if role == "mono":
		return mono
	return bold if weight >= 600 else regular


func text(
		canvas: CanvasItem, value: String, position: Vector2, size: float,
		color: Color = RadioPaint.WHITE, align: String = "left", weight: int = 400,
		role: String = "ui"
) -> void:
	var font: Font = font_for(role, weight)
	var minimum: float = 16 if role == "display" else 10 if role == "mono" else 11
	var pixels: int = roundi(maxf(minimum, size * ui_scale))
	var width: float = font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels).x
	var point: Vector2 = position
	point.x -= width / 2 if align == "center" else width if align == "right" else 0.0
	point.y += (font.get_ascent(pixels) - font.get_descent(pixels)) / 2
	# Browser middle baselines use different metrics from Godot's string baseline.
	point.y -= pixels * (3.0 / 28.0 if role == "brand" else 0.12)
	canvas.draw_string(font, point, value, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels, color)


func tracked(canvas: CanvasItem, value: String, position: Vector2, size: float, tracking: float) -> void:
	var font: Font = font_for("mono", 700)
	var pixels: int = roundi(maxf(9, size * ui_scale))
	var cursor: float = position.x
	for character: String in value:
		text(canvas, character, Vector2(cursor, position.y), size, RadioPaint.COPPER,
			"left", 700, "mono")
		cursor += font.get_string_size(character, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels).x + tracking


func fit(
		canvas: CanvasItem, value: String, position: Vector2, size: float, max_width: float,
		color: Color = RadioPaint.WHITE, align: String = "left", weight: int = 400,
		minimum: float = 11, role: String = "ui"
) -> void:
	var estimated: float = value.length() * size * ui_scale * (0.66 if role == "mono" else 0.92)
	var fitted: float = maxf(minimum, size * max_width / estimated) if estimated > max_width else size
	text(canvas, value, position, fitted, color, align, weight, role)


func title(canvas: CanvasItem, value: String, position: Vector2, size: float) -> void:
	var shadow: float = maxf(2, size * ui_scale * 0.065)
	text(canvas, value, position + Vector2.ONE * shadow, size, Color(0.067, 0.059, 0.051, 0.72),
		"left", 900)
	text(canvas, value, position, size, RadioPaint.WHITE, "left", 900)
