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
var _home: Vector2
var _age: float = 0.0
var _hover: float = 0.0
var _base_rotation: float = 0.0


func _ready() -> void:
	for state: String in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		add_theme_stylebox_override(state, StyleBoxEmpty.new())
	focus_mode = Control.FOCUS_ALL
	pivot_offset = size / 2
	_home = position
	_base_rotation = 0.0 if two_rows or reduced_motion else (index - 1.5) * 0.022
	pressed.connect(func() -> void: action_requested.emit("upgrade:" + str(option.id)))
	mouse_entered.connect(_update_hover)
	mouse_exited.connect(_update_hover)
	focus_entered.connect(_update_hover)
	focus_exited.connect(_update_hover)
	_process(0)


func _process(delta: float) -> void:
	_age += delta
	var active: bool = is_hovered() or has_focus()
	var target: float = 1.0 if active else 0.0
	_hover += (target - _hover) * (1.0 if reduced_motion else 1 - exp(-minf(delta, 0.1) * 19))
	var progress: float = 1.0 if reduced_motion else clampf((_age - index * 0.045) / 0.27, 0, 1)
	var ease: float = 1 - pow(1 - progress, 3)
	position.y = _home.y + (1 - ease) * 16 - _hover * (3 if two_rows else 12)
	scale = Vector2.ONE * (0.94 + ease * 0.06 + _hover * 0.012)
	rotation = _base_rotation * (1 - _hover * 0.85)
	modulate.a = 0.2 + progress * 0.8
	z_index = 1 if active else 0
	queue_redraw()


func _draw() -> void:
	if option.is_empty() or fonts == null:
		return
	var active: bool = is_hovered() or has_focus()
	var tiny: bool = size.y < 170
	var pad: float = clampf(size.x * 0.075, 10, 22)
	var family: String = str(option.get("family", "utility"))
	var styles: Dictionary = catalog.metadata.upgradeStyles
	var family_style: Dictionary = styles.families.get(family, styles.families.utility)
	var color := Color(family_style.fill)
	RadioPaint.surface(self, Rect2(Vector2.ZERO, size), false, true, false, Color("41382a"))
	RadioPaint.surface(self, Rect2(Vector2(4, 4), size - Vector2(8, 8)), true, false, false,
		Color("f0dfb7") if active else Color("ddc69a"))
	draw_rect(Rect2(10, 10, 5, maxf(15, size.y - 20)), Color("766247"))
	draw_rect(Rect2(pad + 2, 13, size.x - pad * 2 - 4, 20 if tiny else 28), color)
	fonts.text(self, str(index + 1), Vector2(pad + 10, 23 if tiny else 27),
		11 if tiny else 15, RadioPaint.WHITE, "left", 900, "mono")
	var rarity: Dictionary = styles.rarities.get(option.get("rarity", "standard"), styles.rarities.standard)
	fonts.fit(self, str(family_style.label) + " / " + str(rarity.label),
		Vector2(size.x - pad - 10, 23 if tiny else 27), 10 if tiny else 12, size.x - pad * 2 - 35,
		RadioPaint.WHITE, "right", 800, 9)
	if not tiny:
		RadioPaint.paper_clip(self, Vector2(size.x / 2 - 12, 3), 24)
		draw_rect(Rect2(pad, size.y * 0.14, size.x - pad * 2, size.y * 0.32), Color(0.51, 0.416, 0.247, 0.10))
		for row: int in range(4):
			draw_rect(Rect2(pad + 6, size.y * 0.19 + row * 15, 18 + row * 4, 1), Color(0.369, 0.294, 0.176, 0.14))
	var center := Vector2(41 if tiny else size.x / 2, size.y * (0.6 if tiny else 0.30))
	var icon_size: float = minf(50, size.y * 0.55) if tiny else minf(minf(size.x * 0.6, size.y * 0.31), 144)
	UpgradeGlyph.paint(self, catalog, option.id, center, icon_size)
	var text_x: float = 77 if tiny else size.x / 2
	var alignment: String = "left" if tiny else "center"
	var available: float = size.x - 88 if tiny else size.x - pad * 2
	fonts.fit(self, option.name, Vector2(text_x, size.y * (0.49 if tiny else 0.51)),
		13 if tiny else minf(24, size.x * 0.092), available, RadioPaint.INK, alignment, 900, 10 if tiny else 16)
	if not tiny:
		fonts.text(self, "装 配 效 果", Vector2(size.x / 2, size.y * 0.60), 10, Color("6b583a"), "center", 800)
	var lines: Array[String] = []
	var maximum: int = 17 if tiny else maxi(10, floori((size.x - pad * 2) / 15))
	for part: String in str(option.detail).split(" · "):
		while not part.is_empty():
			var count: int = maximum - 1 if part.length() == maximum + 1 else maximum
			lines.append(part.left(count))
			part = part.substr(count)
	for row: int in range(mini(3, lines.size())):
		fonts.fit(self, lines[row], Vector2(text_x, size.y * (0.71 if tiny else 0.68) + row * (13 if tiny else 22)),
			10 if tiny else 16, available, Color("3e3424"), alignment, 800, 9 if tiny else 12)
	if not tiny:
		if not str(option.get("flavor", "")).is_empty() and lines.size() < 3:
			fonts.fit(self, option.flavor, Vector2(size.x / 2, size.y * 0.83), 12, size.x - pad * 2, Color("685334"), "center", 600, 10)
		var footer: float = size.y - 43
		draw_rect(Rect2(pad, footer - 5, size.x - pad * 2, 1), Color("aa9064"))
		fonts.text(self, "可重复 · 第%d次" % (level + 1) if option.get("repeatable", false) else "装配 %d/%d" % [mini(level + 1, int(option.max)), option.max],
			Vector2(pad, footer + 13), 12, Color("513f29"), "left", 900)
		var count: int = 0 if option.get("repeatable", false) else mini(8, int(option.max))
		var pip: float = minf(8, (size.x * 0.43 - count * 3) / maxi(1, count))
		for item: int in range(count):
			draw_rect(Rect2(size.x - pad - (count - item) * (pip + 3), footer + 8, pip, 8), color if item <= level else Color("b6a17a"))
	if active:
		RadioPaint.focus_ink(self, Rect2(Vector2(9, 5), size - Vector2(18, 12)), Color(family_style.dark), 3)


func _update_hover() -> void:
	queue_redraw()
