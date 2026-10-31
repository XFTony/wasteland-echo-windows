class_name UpgradeCard
extends Button
## Native controls preserve card focus while reveal and hover use visual transforms.

signal action_requested(command: String)

var option: Dictionary
var index: int = 0
var level: int = 0
var fonts: UiFonts
var catalog: GameCatalog
var reduced_motion: bool = false
var two_rows: bool = false
var navigation_focus_enabled: bool = false
var visual_transform: Transform2D = Transform2D.IDENTITY
var _age: float = 0.0
var _hover: float = 0.0
var _base_rotation: float = 0.0


func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	focus_mode = Control.FOCUS_ALL
	pivot_offset = size / 2
	_base_rotation = 0.0 if two_rows or reduced_motion else (index - 1.5) * 0.022
	pressed.connect(func() -> void: action_requested.emit("upgrade:" + str(option.id)))
	mouse_entered.connect(_update_hover)
	mouse_exited.connect(_update_hover)
	focus_entered.connect(_update_hover)
	focus_exited.connect(_update_hover)
	_process(0)


func _process(delta: float) -> void:
	_age += delta
	var active: bool = interaction_active()
	var target: float = 1.0 if active else 0.0
	_hover += (target - _hover) * (1.0 if reduced_motion else 1 - exp(-minf(delta, 0.1) * 19))
	var progress: float = 1.0 if reduced_motion else clampf((_age - index * 0.045) / 0.27, 0, 1)
	var ease: float = 1 - pow(1 - progress, 3)
	var lift: float = 0.0 if reduced_motion else (1 - ease) * 16 - _hover * (3 if two_rows else 12)
	var zoom: float = 1.0 if reduced_motion else 0.94 + ease * 0.06 + _hover * 0.012
	var tilt: float = 0.0 if reduced_motion else _base_rotation * (1 - _hover * 0.85)
	visual_transform = Transform2D(tilt, Vector2.ONE * zoom, 0, size / 2 + Vector2(0, lift)).translated_local(-size / 2)
	modulate.a = 0.2 + progress * 0.8
	z_index = 1 if active else 0
	queue_redraw()


func _draw() -> void:
	if option.is_empty() or fonts == null:
		return
	draw_set_transform_matrix(visual_transform)
	var active: bool = interaction_active()
	var tiny: bool = size.y < 170
	var family: String = str(option.get("family", "utility"))
	var styles: Dictionary = catalog.metadata.upgradeStyles
	var family_style: Dictionary = styles.families.get(family, styles.families.utility)
	var rarity: Dictionary = styles.rarities.get(option.get("rarity", "standard"), styles.rarities.standard)
	var frame: Texture2D = CombatArt.frame(catalog, family, str(option.get("rarity", "standard")))
	var art_layout: UpgradeCardArtLayout = CombatArt.card_layout(family, str(option.get("rarity", "standard")))
	var lower_template: bool = family == "utility" or option.get("rarity") in ["prototype", "evolution"]
	if frame != null and not tiny:
		draw_texture_rect(frame, Rect2(Vector2.ZERO, size), false, Color(1.07, 1.04, 0.97) if active else Color.WHITE)
	else:
		RadioPaint.surface(self, Rect2(Vector2.ZERO, size), false, true, false, Color("41382a"))
		RadioPaint.surface(self, Rect2(Vector2(4, 4), size - Vector2(8, 8)), true, false, false, Color("ddc69a"))
	var broad_binding: bool = family == "utility" and option.get("rarity") not in ["prototype", "evolution"]
	var content_x: float = 41 if tiny else size.x * (0.59 if broad_binding else 0.58)
	var content_width: float = size.x - 88 if tiny else size.x * (0.56 if broad_binding else 0.58)
	var header_rect: Rect2 = Rect2(8, 12, size.x - 16, 22) if tiny else art_layout.header_for(size)
	var header_y: float = header_rect.get_center().y
	var number_point := Vector2(header_rect.position.x + 10, header_y)
	if active:
		draw_circle(number_point, 10 if not tiny else 8, Color("a07840"))
		draw_circle(number_point, 7 if not tiny else 6, Color("e6c781"))
	fonts.text(self, str(index + 1), number_point,
		11 if tiny else 14, RadioPaint.INK, "center", 900, "mono")
	fonts.fit(self, str(family_style.label) + " / " + str(rarity.label),
		Vector2(header_rect.end.x - 3, header_y), 10 if tiny else 12, header_rect.size.x - 30,
		RadioPaint.INK, "right", 800, 9)
	if tiny:
		UpgradeGlyph.paint(self, catalog, option.id, Vector2(41, size.y * 0.6), minf(50, size.y * 0.55))
	else:
		UpgradeGlyph.paint_in_region(self, catalog, option.id, art_layout.illustration_for(size))
	var text_x: float = 77 if tiny else content_x
	var alignment: String = "left" if tiny else "center"
	var available: float = content_width
	fonts.fit(self, option.name, Vector2(text_x, size.y * (0.49 if tiny or lower_template else 0.525)),
		13 if tiny else minf(23, size.x * 0.086), available, RadioPaint.INK, alignment, 900, 10 if tiny else 15)
	if not tiny:
		fonts.text(self, "装配效果", Vector2(content_x, size.y * (0.59 if lower_template else 0.625)), 10, Color("6b583a"), "center", 800)
	var detail_size: int = 10 if tiny else 14 if size.x < 260 else 16
	var lines: Array[String] = _wrap_text(str(option.detail), available, detail_size, 800)
	while not tiny and lines.size() > 3 and detail_size > 12:
		detail_size -= 1
		lines = _wrap_text(str(option.detail), available, detail_size, 800)
	for row: int in range(mini(3, lines.size())):
		fonts.text(self, lines[row], Vector2(text_x, size.y * (0.71 if tiny else 0.65 if lower_template else 0.68) + row * (13 if tiny else ceili(detail_size * fonts.ui_scale) + 4)),
			detail_size, Color("3e3424"), alignment, 800)
	if not tiny:
		var note: String = str(option.get("preview", option.get("flavor", "")))
		if not note.is_empty() and lines.size() < 3:
			var notes: Array[String] = _wrap_text(note, content_width, 12, 700)
			for row: int in range(mini(2, notes.size())):
				fonts.text(self, notes[row], Vector2(content_x, size.y * (0.76 if lower_template else 0.78) + row * 14), 12, Color("685334"), "center", 700)
		var footer: float = size.y * (0.865 if lower_template else 0.89)
		var pale_footer: bool = option.get("rarity") == "prototype"
		fonts.text(self, "可重复 · 第%d次" % (level + 1) if option.get("repeatable", false) else "装配 %d/%d" % [mini(level + 1, int(option.max)), option.max],
			Vector2(size.x * 0.36, footer), 11, RadioPaint.INK if pale_footer else Color("f0ddae"), "left", 900)
		var count: int = 0 if option.get("repeatable", false) else mini(8, int(option.max))
		var pip: float = minf(8, (size.x * 0.43 - count * 3) / maxi(1, count))
		for item: int in range(count):
			draw_rect(Rect2(size.x * 0.88 - (count - item) * (pip + 3), footer - 3, pip, 6), (Color("9d743b") if pale_footer else Color("eac67e")) if item <= level else Color("796d53"))
	draw_set_transform_matrix(Transform2D.IDENTITY)


func _wrap_text(value: String, width: float, font_size: int, weight: int) -> Array[String]:
	var result: Array[String] = []
	var font: Font = fonts.font_for("ui", weight)
	var pixels: int = roundi(maxf(11, font_size * fonts.ui_scale))
	for part: String in value.split(" · "):
		var line: String = ""
		for character: String in part:
			if not line.is_empty() and font.get_string_size(line + character, HORIZONTAL_ALIGNMENT_LEFT, -1, pixels).x > width:
				result.append(line)
				line = ""
			line += character
		if not line.is_empty():
			result.append(line)
	for row: int in range(1, result.size()):
		if result[row].left(1) in [")", "）", "，", "。", "；", "、", ":", "：", "%"] and result[row - 1].length() > 1:
			var carried: String = result[row - 1].right(1)
			result[row - 1] = result[row - 1].left(result[row - 1].length() - 1)
			result[row] = carried + result[row]
	return result


func interaction_active() -> bool:
	return has_focus() if navigation_focus_enabled else is_hovered()


func _update_hover() -> void:
	queue_redraw()
