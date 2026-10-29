class_name MenuView
extends Control
## Layout arithmetic follows the reference pages; interaction uses native Controls.

var session: GameSession
var assets: AssetStore
var fonts: UiFonts
var page_data: Dictionary = {}
var _buttons: Array[RadioButton] = []
var _portrait: CharacterVisual
var _gradient: GradientTexture2D


func setup(game_session: GameSession, asset_store: AssetStore) -> void:
	session = game_session
	assets = asset_store
	fonts = UiFonts.new()
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	session.changed.connect(_request_refresh)
	resized.connect(_request_refresh)
	get_viewport().size_changed.connect(_resize_viewport)
	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0, 0.28, 0.5, 0.73, 1])
	gradient.colors = PackedColorArray([
		Color(0.063, 0.055, 0.043, 0.98), Color(0.071, 0.059, 0.047, 0.94),
		Color(0.075, 0.063, 0.051, 0.68), Color(0.067, 0.055, 0.043, 0.2),
		Color(0.055, 0.047, 0.039, 0.3),
	])
	_gradient = GradientTexture2D.new()
	_gradient.gradient = gradient
	_gradient.width = 512
	_gradient.height = 1
	_gradient.fill_from = Vector2.ZERO
	_gradient.fill_to = Vector2.RIGHT
	_resize_viewport()
	_refresh()


func _resize_viewport() -> void:
	var pixels: Vector2 = get_viewport_rect().size
	var factor: float = clampf(minf(pixels.x / 1280, pixels.y / 720), 1.0, 2.0)
	scale = Vector2.ONE * factor
	size = pixels / factor


func _draw() -> void:
	if session == null:
		return
	var id: String = "menu.radio.camp.v1" if session.page == GameSession.Page.MAIN else "menu.radio.desk.v1"
	var backdrop: Texture2D = assets.texture(id)
	if backdrop != null:
		var factor: float = maxf(size.x / backdrop.get_width(), size.y / backdrop.get_height())
		var dimensions: Vector2 = backdrop.get_size() * factor
		draw_texture_rect(backdrop, Rect2((size - dimensions) / 2, dimensions), false)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.039, 0.055, 0.039, 0.04)
		if session.page == GameSession.Page.MAIN else Color(0.055, 0.067, 0.047, 0.24))
	match session.page:
		GameSession.Page.MAIN:
			_draw_main()
		GameSession.Page.DEPLOYMENT:
			_draw_deployment()
		GameSession.Page.SHOP:
			_draw_shop()
		GameSession.Page.INVENTORY:
			_draw_inventory()
		GameSession.Page.SETTINGS:
			_draw_settings()
		GameSession.Page.CREDITS:
			_draw_credits()


func _request_refresh() -> void:
	_refresh.call_deferred()


func _refresh() -> void:
	if session == null or not is_inside_tree():
		return
	var previous_focus: String = ""
	var owner: Control = get_viewport().gui_get_focus_owner()
	if owner is RadioButton:
		previous_focus = owner.action_id
	for button: RadioButton in _buttons:
		button.queue_free()
	_buttons.clear()
	if is_instance_valid(_portrait):
		_portrait.queue_free()
		_portrait = null
	fonts.ui_scale = float(session.save_data.settings.uiScale)
	match session.page:
		GameSession.Page.MAIN:
			_build_main()
		GameSession.Page.DEPLOYMENT:
			_build_deployment()
		GameSession.Page.SHOP:
			_build_shop()
		GameSession.Page.INVENTORY:
			_build_inventory()
		GameSession.Page.SETTINGS:
			_build_settings()
		GameSession.Page.CREDITS:
			CreditsPage.build(self)
	for button: RadioButton in _buttons:
		if not previous_focus.is_empty() and button.action_id == previous_focus:
			button.grab_focus()
	queue_redraw()


func action_regions() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for button: RadioButton in _buttons:
		if not button.action_id.is_empty():
			var rect: Rect2 = button.get_global_rect()
			result.append({"action": button.action_id, "x": rect.position.x,
				"y": rect.position.y, "w": rect.size.x, "h": rect.size.y})
	return result


func add_action_button(
		action: String, caption: String, rect: Rect2, primary: bool = false,
		choice: bool = false, detail: String = ""
) -> RadioButton:
	var button := RadioButton.new()
	button.action_id = action
	button.caption = caption
	button.detail = detail
	button.primary = primary
	button.menu_choice = choice
	button.fonts = fonts
	button.caption_size = clampf(rect.size.y * 0.34, 13, 20)
	button.position = rect.position
	button.size = rect.size
	button.action_requested.connect(session.action)
	add_child(button)
	_buttons.append(button)
	return button


func draw_item_icon(kind: String, id: String, center: Vector2, icon_size: float) -> void:
	var texture: Texture2D = assets.item_texture(kind, id)
	if texture == null:
		return
	var factor: float = minf(icon_size * (0.95 if kind == "weapon" else 0.88) / texture.get_width(),
		icon_size * (0.72 if kind == "weapon" else 0.84) / texture.get_height())
	var dimensions: Vector2 = texture.get_size() * factor
	draw_texture_rect(texture, Rect2(center - dimensions / 2, dimensions), false)


func add_portrait(rect: Rect2) -> void:
	_portrait = CharacterVisual.new()
	_portrait.hero_id = session.selected("Hero")
	_portrait.skin_id = session.selected("Skin")
	_portrait.weapon_id = session.selected("Weapon")
	_portrait.position = rect.position + Vector2(rect.size.x * 0.43, rect.size.y * 0.87)
	_portrait.pixel_scale = maxf(1, floorf(minf(rect.size.x / 55, rect.size.y / 50)))
	_portrait.configure(session.catalog, assets)
	_portrait.update_aim(-0.16)
	add_child(_portrait)


func _main_metrics() -> Dictionary:
	var compact: bool = size.y < 600 or size.x < 980
	var tiny: bool = size.x < 720 or size.y < 420
	return {"compact": compact, "tiny": tiny, "margin": 16 if tiny else 28 if compact else 64,
		"titleY": 48 if tiny else 76 if compact else 118,
		"titleSize": 42 if tiny else 60 if compact else 84,
		"buttonH": 50 if tiny else 72 if compact else 88,
		"buttonY": size.y - (85 if tiny else 126 if compact else 166)}


func _build_main() -> void:
	var metrics: Dictionary = _main_metrics()
	if not metrics.tiny:
		add_portrait(Rect2(size.x * 0.6, size.y * 0.35, size.x * 0.19, size.y * 0.48))
	var gap: float = 8 if metrics.tiny else 14
	var width: float = size.x - float(metrics.margin) * 2
	var primary_width: float = width * (0.31 if metrics.tiny else 0.29)
	var secondary_width: float = (width - primary_width - gap * 3) / 3
	add_action_button("start", "开始游戏", Rect2(metrics.margin, metrics.buttonY,
		primary_width, metrics.buttonH), true, true, "整备行装 · 前往战区")
	var choices: Array[Array] = [
		["shop", "拾荒者商栈", "补给与装备"], ["settings", "设置", "声音与操控"],
		["credits", "行动档案", "记录与制作"],
	]
	for index: int in range(choices.size()):
		var choice: Array = choices[index]
		add_action_button(choice[0], choice[1], Rect2(float(metrics.margin) + primary_width + gap
			+ index * (secondary_width + gap), metrics.buttonY, secondary_width,
			metrics.buttonH), false, true, choice[2])


func _draw_main() -> void:
	var metrics: Dictionary = _main_metrics()
	var margin: float = float(metrics.margin)
	var title_y: float = float(metrics.titleY)
	var title_size: float = float(metrics.titleSize)
	draw_texture_rect(_gradient, Rect2(Vector2.ZERO, size), false, Color(1, 1, 1, 0.65))
	RadioPaint.radio_mark(self, Vector2(margin, title_y - (30 if metrics.tiny else 61)),
		RadioPaint.COPPER, 0.6 if metrics.tiny else 0.9)
	fonts.text(self, "余火未熄，广播仍在。", Vector2(margin + (26 if metrics.tiny else 34),
		title_y - (21 if metrics.tiny else 49)), 10 if metrics.tiny else 12,
		Color("c5b18a"), "left", 600)
	for pair: Array in [["荒原", title_y], ["回响", title_y + title_size * 1.05]]:
		fonts.text(self, pair[0], Vector2(margin + 3, float(pair[1]) + 4), title_size,
			Color("211b17"), "left", 900, "brand")
		fonts.text(self, pair[0], Vector2(margin, pair[1]), title_size,
			Color("eddbb8"), "left", 900, "brand")
	var subtitle_y: float = title_y + title_size * 1.78
	fonts.tracked(self, "WASTELAND ECHO", Vector2(margin + 2, subtitle_y),
		9 if metrics.tiny else 12, 1 if metrics.tiny else 2.3)
	if not metrics.tiny:
		fonts.text(self, "走出营地，把失落的回声带回来。", Vector2(margin + 2, subtitle_y + 31),
			12 if metrics.compact else 14, Color("c7bd9e"), "left", 500)
	var footer_y: float = size.y - (16 if metrics.tiny else 33)
	fonts.text(self, "铜币 %d  ·  金币 %d" % [session.save_data.currencies.copper,
		session.save_data.currencies.gold], Vector2(margin, footer_y), 10 if metrics.tiny else 12,
		Color("c5b18a"), "left", 700, "mono")
	fonts.fit(self, "方向键选择 · Enter 确认 · F 全屏", Vector2(size.x - margin, footer_y),
		10 if metrics.tiny else 12, size.x * 0.5, Color("c7bd9e"), "right", 600, 10)


func _deployment_metrics() -> Dictionary:
	var compact: bool = size.y < 620 or size.x < 1000
	var margin := Vector2(8, 7) if compact else Vector2(maxf(28, size.x * 0.035), maxf(22, size.y * 0.03))
	var header: float = 38 if compact else 78
	var gap: float = 8 if compact else maxf(18, size.x * 0.016)
	var body_y: float = margin.y + header + (4 if compact else 12)
	var body_height: float = size.y - body_y - margin.y
	var left_width: float = (size.x - margin.x * 2) * (0.38 if compact else 0.36)
	var right_x: float = margin.x + left_width + gap
	return {"compact": compact, "margin": margin, "header": header,
		"left": Rect2(margin.x, body_y, left_width, body_height),
		"right": Rect2(right_x, body_y, size.x - margin.x - right_x, body_height)}


func _build_deployment() -> void:
	var layout: Dictionary = _deployment_metrics()
	var compact: bool = layout.compact
	var margin: Vector2 = layout.margin
	add_action_button("back", "返回营地", Rect2(size.x - margin.x - (94 if compact else 142),
		margin.y + (3 if compact else 9), 94 if compact else 142, 31 if compact else 48))
	var left: Rect2 = layout.left
	var caption: float = 52 if compact else 98
	var portrait_y: float = left.position.y + (30 if compact else 48)
	add_portrait(Rect2(left.position.x + 12, portrait_y, left.size.x - 24,
		maxf(52, left.size.y - caption - (37 if compact else 65))))
	var crew: RadioButton = add_action_button("inventory", "行装档案",
		Rect2(left.position.x, left.end.y - caption, left.size.x, caption))
	crew.crew = true
	crew.crew_hero = session.catalog.parameters("heroes", session.selected("Hero")).name
	crew.crew_loadout = session.catalog.parameters("weapons", session.selected("Weapon")).name
	crew.crew_loadout += " · " + str(session.catalog.parameters("skins", session.selected("Skin")).name)
	var right: Rect2 = layout.right
	var content_height: float = minf(right.size.y, right.size.y if compact else 720)
	var content_y: float = right.position.y + maxf(0, (right.size.y - content_height) * 0.46)
	var gap: float = 3 if compact else 10
	var selector_area: float = content_height - (34 if compact else 76) - (42 if compact else 68)
	selector_area -= (14 if compact else 25) + gap * 5
	var selector_height: float = selector_area * 0.44
	var arrow: float = maxf(27 if compact else 38, minf(34 if compact else 48, selector_height * 0.34))
	var arrow_y: float = content_y + (selector_height - arrow) / 2 + (3 if compact else 7)
	var pad: float = 12 if compact else 22
	var previous: RadioButton = add_action_button("mapPrev", "‹", Rect2(right.position.x + pad, arrow_y, arrow, arrow))
	var next: RadioButton = add_action_button("mapNext", "›", Rect2(right.end.x - pad - arrow, arrow_y, arrow, arrow))
	previous.caption_size = maxf(18, arrow * 0.62)
	next.caption_size = previous.caption_size
	var readout_y: float = content_y + selector_area + gap * 3
	add_action_button("deploy", "进入地图 · 连续生存", Rect2(right.position.x,
		readout_y + (34 if compact else 76) + gap, right.size.x, 42 if compact else 68), true)


func _draw_deployment() -> void:
	var layout: Dictionary = _deployment_metrics()
	var compact: bool = layout.compact
	var margin: Vector2 = layout.margin
	draw_rect(Rect2(margin, Vector2(minf(275 if compact else 520, size.x * 0.48), layout.header)),
		Color(0.055, 0.051, 0.039, 0.9))
	fonts.title(self, "作战部署", margin + Vector2(14 if compact else 24,
		float(layout.header) * 0.42), 25 if compact else 43)
	fonts.text(self, "把行装准备好，再走进荒原。", margin + Vector2(15 if compact else 26,
		float(layout.header) * 0.8), 10 if compact else 12, RadioPaint.MUTED, "left", 600)
	var left: Rect2 = layout.left
	var right: Rect2 = layout.right
	draw_rect(left, Color(0.106, 0.114, 0.086, 0.88))
	draw_rect(right, Color(0.106, 0.114, 0.086, 0.92))
	fonts.text(self, "出征行装", left.position + Vector2(18, 12 if compact else 20),
		12 if compact else 16, RadioPaint.PAPER, "left", 800)
	var content_height: float = minf(right.size.y, right.size.y if compact else 720)
	var y: float = right.position.y + maxf(0, (right.size.y - content_height) * 0.46)
	var gap: float = 3 if compact else 10
	var selector_area: float = content_height - (34 if compact else 76) - (42 if compact else 68)
	selector_area -= (14 if compact else 25) + gap * 5
	var selector_height: float = selector_area * 0.44
	var map: Dictionary = session.catalog.parameters("maps", session.selected("Map"))
	fonts.text(self, "战区地图", Vector2(right.position.x + (12 if compact else 22),
		y + (13 if compact else 22)), 11 if compact else 13, Color("a0a671"), "left", 900)
	fonts.fit(self, map.name, Vector2(right.get_center().x, y + selector_height * (0.48 if compact else 0.46)),
		16 if compact else 24, right.size.x - 160, RadioPaint.WHITE, "center", 900, 12)
	fonts.fit(self, map.description, Vector2(right.get_center().x, y + selector_height * 0.72),
		10 if compact else 13, right.size.x - 145, RadioPaint.PAPER, "center", 700, 10)
	var detail_y: float = y + selector_height + gap
	var text_x: float = right.position.x + (18 if compact else 30)
	fonts.title(self, "连续生存", Vector2(text_x, detail_y + 18), 19 if compact else 27)
	var lines: Array[String] = ["移动躲避 · 自动瞄准射击", "捡拾经验与金币 · 升级技能",
		"返回交易站购枪改装 · 部署塔台", "威胁随时间增强 · 暂停可结算本局"]
	for index: int in range(lines.size()):
		fonts.fit(self, lines[index], Vector2(text_x, detail_y + (46 if compact else 60)
			+ index * (20 if compact else 28)), 12 if compact else 16, right.size.x - 45,
			RadioPaint.PAPER, "left", 700, 10)
	var readout_y: float = y + selector_area + gap * 3
	draw_rect(Rect2(right.position.x, readout_y, right.size.x, 34 if compact else 76),
		Color(0.063, 0.059, 0.047, 0.92))
	var values: Array[String] = ["持续计时", "%d%%" % roundi(float(map.threat) * 100), "地图交易站"]
	for index: int in range(3):
		var x: float = right.position.x + index * right.size.x / 3 + (9 if compact else 15)
		fonts.text(self, ["生存", "威胁", "补给"][index], Vector2(x, readout_y + (11 if compact else 24)),
			10 if compact else 12, RadioPaint.MUTED, "left", 900)
		fonts.text(self, values[index], Vector2(x, readout_y + (24 if compact else 52)),
			13 if compact else 18, RadioPaint.PAPER, "left", 900)


func _build_shop() -> void:
	ShopPage.build(self)


func _draw_shop() -> void:
	ShopPage.paint(self)


func _build_inventory() -> void:
	InventoryPage.build(self)


func _draw_inventory() -> void:
	InventoryPage.paint(self)


func _build_settings() -> void:
	SettingsPage.build(self)


func _draw_settings() -> void:
	SettingsPage.paint(self)


func _draw_credits() -> void:
	CreditsPage.paint(self)
