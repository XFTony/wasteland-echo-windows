class_name RadioButton
extends Button
## Native focus and activation retain the original custom paper/cloth appearance.

signal action_requested(action_id: String)

@export var action_id: String
@export var caption: String
@export var detail: String
@export var primary: bool = false
@export var menu_choice: bool = false
@export var caption_size: float = 17.0
@export var crew: bool = false
var crew_hero: String = ""
var crew_loadout: String = ""
var item_mode: bool = false
var slot_mode: bool = false
var item_image: Texture2D
var item_number: int = 0
var equipped: bool = false
var fonts: UiFonts


func _ready() -> void:
	text = ""
	focus_mode = Control.FOCUS_ALL
	if not action_id.is_empty():
		add_to_group("native_menu_actions")
	else:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		focus_mode = Control.FOCUS_NONE
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	pressed.connect(_on_pressed)
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	focus_entered.connect(queue_redraw)
	focus_exited.connect(queue_redraw)


func _draw() -> void:
	if fonts == null:
		return
	var active: bool = is_hovered() or has_focus()
	var offset: float = 2 if is_pressed() else -2 if active and menu_choice else -1 if active else 0
	var rect := Rect2(Vector2(0, offset), size)
	var knob: bool = size.x <= 56 and size.y <= 56 and size.x / size.y > 0.65 and size.x / size.y < 1.5
	if knob:
		var radius: float = minf(size.x, size.y) * 0.42
		draw_circle(Vector2(size.x / 2, offset + size.y / 2 + 2), radius, Color("131710"))
		draw_circle(Vector2(size.x / 2, offset + size.y / 2), radius,
			Color("716044") if active else Color("423f30"))
		draw_arc(Vector2(size.x / 2, offset + size.y / 2), radius, 0, TAU, 32, Color("988362"), 1)
	else:
		RadioPaint.surface(self, rect, primary, active or menu_choice, active,
		RadioPaint.PAPER_LIGHT if primary and active else RadioPaint.PAPER if primary else (
			Color("393a2d") if active else Color("23271f") if menu_choice else Color("2b2b22")
		))
	var color: Color = RadioPaint.INK if primary else RadioPaint.WHITE
	if item_mode or slot_mode:
		var compact: bool = size.x < 140
		if item_number > 0:
			fonts.text(self, "%02d" % item_number, Vector2(6, 11 if compact else 14),
				10 if compact else 11, Color("94886e"), "left", 700, "mono")
		if item_image != null:
			var maximum: float = minf(size.x * 0.72, minf(size.y * 0.56, 46 if compact else 70))
			var scale: float = minf(maximum * 0.95 / item_image.get_width(),
				maximum * 0.84 / item_image.get_height())
			var dimensions: Vector2 = item_image.get_size() * scale
			draw_texture_rect(item_image, Rect2(Vector2(size.x / 2, offset + size.y * 0.46)
				- dimensions / 2, dimensions), false)
		if size.y >= 52:
			fonts.fit(self, caption, Vector2(size.x / 2, offset + size.y - (9 if compact else 12)),
				10 if compact else 12, size.x - 9, RadioPaint.WHITE, "center", 900, 10)
		if equipped:
			fonts.text(self, "E", Vector2(size.x - 7, 11 if compact else 13),
				10 if compact else 11, RadioPaint.GOLD, "right", 900, "mono")
	elif crew:
		var compact: bool = size.y < 70
		var pad: float = 12 if compact else 22
		fonts.text(self, "行装档案", Vector2(pad, 13 if compact else 23),
			10 if compact else 12, RadioPaint.ORANGE, "left", 900)
		fonts.fit(self, crew_hero, Vector2(pad, 31 if compact else 50),
			14 if compact else 21, size.x * 0.48, RadioPaint.WHITE, "left", 900, 11)
		fonts.fit(self, crew_loadout, Vector2(size.x - pad, 19 if compact else 37),
			10 if compact else 13, size.x * 0.48, RadioPaint.PAPER, "right", 800, 10)
		fonts.text(self, "打开行装与背包  ›", Vector2(size.x - pad, size.y - (10 if compact else 22)),
			10 if compact else 13, RadioPaint.GOLD if active else RadioPaint.MUTED, "right", 900)
	elif menu_choice:
		var compact: bool = size.y < 70
		var padding: float = 13 if size.x < 150 else 22
		if primary and size.x > 190:
			RadioPaint.radio_mark(self, Vector2(18, offset + size.y / 2 - 15), Color("745733"), 1.25)
			padding += 41
		fonts.fit(self, caption, Vector2(padding, offset + size.y * 0.37),
			17 if compact else 23, size.x - padding - 18, color, "left", 900, 12)
		fonts.fit(self, detail, Vector2(padding, offset + size.y * 0.72),
			10 if compact else 12, size.x - padding - 18,
			Color("5c4b35") if primary else Color("bdb393"), "left", 600, 10)
	else:
		fonts.fit(self, caption, Vector2(size.x / 2, offset + size.y / 2 + 1), caption_size,
			size.x * 0.82, color, "center", 900)
		if size.x > 140 and size.y >= 40:
			RadioPaint.radio_mark(self, Vector2(12, offset + size.y / 2 - 9),
				Color("705639") if primary else RadioPaint.GOLD, 0.7)
	if has_focus():
		RadioPaint.focus_ink(self, Rect2(Vector2(-3, offset - 3), size + Vector2(6, 7)))


func _on_pressed() -> void:
	action_requested.emit(action_id)
