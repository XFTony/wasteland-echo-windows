class_name StartupView
extends Control
## The original radio sequence is a skippable overlay over the native menu.

signal finished

var assets_ready: bool = true
var _elapsed: float = 0.0
var _finished: bool = false
var _fonts := UiFonts.new()


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed >= 3.2 or _elapsed >= 2.15 and assets_ready:
		skip()
	queue_redraw()


func _input(event: InputEvent) -> void:
	var keyboard: bool = event is InputEventKey and event.pressed and event.physical_keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_ESCAPE, KEY_SPACE]
	var pointer: bool = event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT
	var gamepad: bool = event is InputEventJoypadButton and event.pressed and event.button_index in [JOY_BUTTON_A, JOY_BUTTON_B]
	if keyboard or pointer or gamepad:
		get_viewport().set_input_as_handled()
		skip()


func skip() -> void:
	if _finished:
		return
	_finished = true
	finished.emit()


func _draw() -> void:
	var dimensions: Vector2 = get_viewport_rect().size
	if dimensions.x <= 0 or dimensions.y <= 0:
		dimensions = Vector2(1280, 720)
	var factor: float = clampf(minf(dimensions.x / 1280, dimensions.y / 720), 1, 2)
	var logical: Vector2 = dimensions / factor
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE * factor)
	var progress: float = minf(1, _elapsed / 2.15)
	draw_rect(Rect2(Vector2.ZERO, logical), Color(17.0 / 255, 21.0 / 255, 18.0 / 255, maxf(0.38, 0.96 - progress * 0.48)))
	var center: Vector2 = logical * Vector2(0.5, 0.43)
	var mark_scale: float = clampf(logical.y / 270, 1.2, 2.8)
	var opacity: float = minf(1, progress * 5)
	for index: int in range(3):
		var phase: float = fmod(progress * 1.5 + float(index) / 3, 1)
		draw_arc(center - Vector2(0, 32 * mark_scale), (29 + phase * 22) * mark_scale,
			-0.76, 0.76, 32, Color(RadioPaint.COPPER, opacity * (1 - phase) * 0.2), 1.5)
	RadioPaint.radio_mark(self, center - Vector2(12, 44) * mark_scale,
		Color(RadioPaint.PAPER_LIGHT, opacity), mark_scale)
	var title_size: float = maxf(24, floorf(minf(72, logical.x * 0.1) / 12) * 12)
	_fonts.text(self, "荒原回响", center + Vector2(0, 23 * mark_scale), title_size,
		Color(RadioPaint.PAPER_LIGHT, opacity), "center", 900, "brand")
	_fonts.text(self, "WASTELAND ECHO", center + Vector2(0, 50 * mark_scale), 12,
		Color(RadioPaint.COPPER, opacity), "center", 700, "mono")
	var dial_width: float = minf(340, logical.x * 0.48)
	var dial_y: float = center.y + 81 * mark_scale
	for index: int in range(ceili(dial_width / 10)):
		draw_rect(Rect2(center.x - dial_width / 2 + index * 10, dial_y,
			minf(5, dial_width - index * 10), 1), Color(Color("a89066"), opacity))
	draw_rect(Rect2(center.x - dial_width / 2 + dial_width * (0.08 + progress * 0.84),
		dial_y - 11, 2, 24), Color(Color("d3b681"), opacity))
	_fonts.text(self, "远征电台 · 信号已接通" if assets_ready else "远征电台 · 正在寻找回声",
		Vector2(center.x, dial_y + 39), 13, Color(Color("d8c7a3"), opacity), "center", 700)
	_fonts.text(self, "A / B 跳过" if not Input.get_connected_joypads().is_empty() else "点击或按 Enter 跳过",
		logical - Vector2(30, 30), 12, Color("d5c7aa"), "right", 600)
	draw_set_transform(Vector2.ZERO)
