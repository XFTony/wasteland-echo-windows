class_name InventoryPage
extends RefCounted
## Inventory actions and composed stats retain the reference ownership contract.


static func layout(view: MenuView) -> Dictionary:
	var compact: bool = view.size.y < 600 or view.size.x < 980
	var dimensions := Vector2(minf(1660, view.size.x - (12 if compact else 58)),
		minf(940, view.size.y - (12 if compact else 42)))
	var rect := Rect2((view.size - dimensions) / 2, dimensions)
	var header: float = 52 if compact else 78
	var gap: float = 8 if compact else 16
	var body_y: float = rect.position.y + header
	var body_height: float = dimensions.y - header - (7 if compact else 14)
	var left_width: float = clampf(dimensions.x * (0.43 if compact else 0.4),
		230 if compact else 460, 370 if compact else 570)
	var left := Rect2(rect.position.x + (7 if compact else 14), body_y, left_width, body_height)
	var grid := Rect2(left.end.x + gap, body_y, rect.end.x - left.end.x - gap
		- (7 if compact else 14), body_height)
	var entries: Array[Dictionary] = []
	for spec: Array in [["weapon", "weapons", "unlockedWeapons", "selectWeapon:"],
		["skin", "skins", "unlockedSkins", "selectSkin:"],
		["equipment", "equipment", "ownedEquipment", "equip:"]]:
		for id: String in view.session.catalog.all(spec[1]):
			if id in view.session.save_data[spec[2]]:
				entries.append({"kind": spec[0], "id": id,
					"item": view.session.catalog.parameters(spec[1], id), "action": str(spec[3]) + id})
	var pages: int = maxi(1, ceili(entries.size() / 12.0))
	var page: int = mini(pages - 1, view.session.inventory_page)
	var page_entries: Array = entries.slice(page * 12, page * 12 + 12)
	var grid_header: float = 34 if compact else 52
	var info_height: float = 106 if compact else 150
	var grid_gap: float = 4 if compact else 8
	var inset: float = 7 if compact else 11
	var rows: int = maxi(1, ceili(page_entries.size() / 4.0))
	var cell_width: float = (grid.size.x - inset * 2 - grid_gap * 3) / 4
	var maximum: float = grid.size.y - grid_header - info_height - grid_gap * 3 - inset
	var cell_height: float = maxf(24, minf(82 if compact else 132,
		(maximum - grid_gap * (rows - 1)) / rows))
	var cells: Array[Rect2] = []
	for index: int in range(rows * 4):
		cells.append(Rect2(grid.position + Vector2(inset + index % 4 * (cell_width + grid_gap),
			grid_header + grid_gap + floori(index / 4.0) * (cell_height + grid_gap)),
			Vector2(cell_width, cell_height)))
	return {"rect": rect, "compact": compact, "header": header, "left": left, "grid": grid,
		"entries": entries, "pageEntries": page_entries, "pages": pages, "page": page,
		"cells": cells, "info": Rect2(grid.position + Vector2(inset, grid_header + grid_gap
			+ rows * cell_height + (rows - 1) * grid_gap + grid_gap),
			Vector2(grid.size.x - inset * 2, info_height)), "active": page_entries[0] if not page_entries.is_empty() else {}}


static func build(view: MenuView) -> void:
	var data: Dictionary = layout(view)
	view.page_data = data
	var compact: bool = data.compact
	var rect: Rect2 = data.rect
	view.add_action_button("workshop", "战地改件", Rect2(rect.end.x - (216 if compact else 286),
		rect.position.y + (9 if compact else 15), 100 if compact else 134, 34 if compact else 48))
	view.add_action_button("deployment", "返回部署", Rect2(rect.end.x - (108 if compact else 142),
		rect.position.y + (9 if compact else 15), 100 if compact else 134, 34 if compact else 48))
	var left: Rect2 = data.left
	var header: float = 34 if compact else 54
	view.add_action_button("heroPrev", "‹", Rect2(left.position.x + 8,
		left.position.y + (4 if compact else 7), 28 if compact else 40, 26 if compact else 40))
	view.add_action_button("heroNext", "›", Rect2(left.end.x - (36 if compact else 48),
		left.position.y + (4 if compact else 7), 28 if compact else 40, 26 if compact else 40))
	var stats_height: float = minf(90 if compact else 132,
		maxf(67 if compact else 108, left.size.y * (0.27 if compact else 0.24)))
	var work_y: float = left.position.y + header + (4 if compact else 7)
	var stats_y: float = left.end.y - stats_height - (5 if compact else 8)
	var work_height: float = maxf(92, stats_y - work_y - (4 if compact else 7))
	var slot_width: float = clampf(left.size.x * (0.23 if compact else 0.21),
		43 if compact else 74, 60 if compact else 100)
	var slot_x: float = left.position.x + (7 if compact else 11)
	var slot_gap: float = 3 if compact else 6
	var slot_height: float = (work_height - slot_gap * 3) / 4
	for index: int in range(4):
		var slot: String = LoadoutRules.SLOTS[index]
		var id: String = str(view.session.save_data.equippedEquipment.get(slot, ""))
		var item: Dictionary = view.session.catalog.parameters("equipment", id)
		var button: RadioButton = view.add_action_button("unequip:" + slot if not item.is_empty() else "",
			ItemPresentation.SLOT_LABELS[slot], Rect2(slot_x, work_y + index * (slot_height + slot_gap),
			slot_width, slot_height))
		button.slot_mode = true
		button.slot_compact = compact
		button.slot_name = str(item.get("name", ""))
		button.slot_accent = ItemPresentation.accent("equipment", item, view.session.catalog)
		button.item_image = view.assets.item_texture("equipment", id) if not item.is_empty() else null
	var right_x: float = left.end.x - slot_width - (7 if compact else 11)
	var portrait_rect := Rect2(slot_x + slot_width + (5 if compact else 9), work_y,
		right_x - (5 if compact else 9) - slot_x - slot_width - (5 if compact else 9), work_height)
	view.add_portrait(portrait_rect)
	data["portraitRect"] = portrait_rect
	data["statsRect"] = Rect2(left.position.x + (7 if compact else 11), stats_y,
		left.size.x - (14 if compact else 22), stats_height)
	for pair: Array in [["weapon", "Weapon", "主武器"], ["skin", "Skin", "行动服"]]:
		var index: int = 0 if pair[0] == "weapon" else 1
		var side_height: float = (work_height - slot_gap) / 2
		var button: RadioButton = view.add_action_button("", pair[2], Rect2(right_x,
			work_y + index * (side_height + slot_gap), slot_width, side_height))
		button.slot_mode = true
		button.slot_compact = compact
		var definition: Dictionary = view.session.catalog.parameters("weapons" if pair[0] == "weapon" else "skins", view.session.selected(pair[1]))
		button.slot_name = str(definition.name)
		button.slot_accent = ItemPresentation.accent(pair[0], definition, view.session.catalog)
		button.item_image = view.assets.item_texture(pair[0], view.session.selected(pair[1]))
	for index: int in range(data.pageEntries.size()):
		var entry: Dictionary = data.pageEntries[index]
		var button: RadioButton = view.add_action_button(entry.action, entry.item.name, data.cells[index])
		button.item_mode = true
		button.item_number = int(data.page) * 12 + index + 1
		button.slot_accent = ItemPresentation.accent(entry.kind, entry.item, view.session.catalog)
		button.equipped = _equipped(view, entry)
		button.item_image = view.assets.item_texture(entry.kind, entry.id)
		button.mouse_entered.connect(func() -> void:
			view.page_data.active = entry
			view.queue_redraw())
		button.focus_entered.connect(func() -> void:
			view.page_data.active = entry
			view.queue_redraw())
	var grid: Rect2 = data.grid
	if int(data.pages) > 1:
		view.add_action_button("inventoryPage:%d" % posmod(int(data.page) - 1, int(data.pages)), "‹",
			Rect2(grid.end.x - (85 if compact else 112), grid.position.y + (4 if compact else 7),
			28 if compact else 36, 26 if compact else 36))
		view.add_action_button("inventoryPage:%d" % posmod(int(data.page) + 1, int(data.pages)), "›",
			Rect2(grid.end.x - (30 if compact else 42), grid.position.y + (4 if compact else 7),
			26 if compact else 34, 26 if compact else 36))


static func paint(view: MenuView) -> void:
	var data: Dictionary = view.page_data
	if not data.has("entries"):
		return
	var compact: bool = data.compact
	var rect: Rect2 = data.rect
	view.draw_rect(Rect2(rect.position, Vector2(minf(rect.size.x * (0.65 if compact else 0.54),
		440 if compact else 720), data.header)), Color(0.055, 0.051, 0.039, 0.91))
	RadioPaint.radio_mark(view, rect.position + Vector2(16 if compact else 25, 12 if compact else 17),
		RadioPaint.GOLD, 0.7 if compact else 0.95)
	view.fonts.title(view, "行装与背包", rect.position + Vector2(56 if compact else 78,
		float(data.header) / 2 + 2), 25 if compact else 40)
	if not compact or rect.size.x > 760:
		view.fonts.text(view, "人物、武器与四部位护具共用一套实战参数", rect.position
			+ Vector2(220 if compact else 330, float(data.header) / 2 + 4), 11 if compact else 14,
			RadioPaint.PAPER, "left", 700)
	var left: Rect2 = data.left
	RadioPaint.surface(view, Rect2(left.position, Vector2(left.size.x, 34 if compact else 54)), false, false, true)
	var hero: Dictionary = view.session.catalog.parameters("heroes", view.session.selected("Hero"))
	var portrait: Rect2 = data.portraitRect
	view.draw_rect(portrait, Color(0.059, 0.055, 0.043, 0.48))
	view.draw_rect(Rect2(portrait.position + Vector2(7, portrait.size.y - (12 if compact else 18)), Vector2(portrait.size.x - 14, 4 if compact else 6)), Color("594a34"))
	if not compact and portrait.size.x > 110:
		view.fonts.text(view, hero.callsign, Vector2(portrait.get_center().x, portrait.position.y + 17), 11,
			Color(hero.accent), "center", 900, "mono")
		view.fonts.text(view, "实战像素外观" if view.session.selected("Hero") == "ranger" and view.session.selected("Skin") == "wanderer" else "荒原行动员", Vector2(portrait.get_center().x, portrait.end.y - 11), 11, RadioPaint.MUTED, "center", 700)
	view.fonts.text(view, hero.name, left.position + Vector2(left.size.x / 2, 13 if compact else 19),
		13 if compact else 18, RadioPaint.WHITE, "center", 900)
	view.fonts.fit(view, hero.passive, left.position + Vector2(left.size.x / 2,
		27 if compact else 39), 10 if compact else 12, left.size.x - (84 if compact else 110),
		RadioPaint.MUTED, "center", 700, 10)
	var grid: Rect2 = data.grid
	view.draw_rect(Rect2(grid.position, Vector2(grid.size.x, 34 if compact else 52)),
		Color(0.055, 0.051, 0.039, 0.9))
	view.fonts.text(view, "战利品格", grid.position + Vector2(14, 17 if compact else 26),
		15 if compact else 21, RadioPaint.PAPER, "left", 900)
	view.fonts.text(view, "%d / %d" % [data.entries.size(), int(data.pages) * 12],
		Vector2(grid.end.x - 18, grid.position.y + (17 if compact else 26)),
		11, RadioPaint.MUTED, "right", 700)
	for index: int in range(data.pageEntries.size(), data.cells.size()):
		var cell: Rect2 = data.cells[index]
		RadioPaint.surface(view, cell, false, false, false, Color(0.1, 0.1, 0.08, 0.26))
		var inset: float = 5 if compact else 8
		view.draw_rect(cell.grow(-inset), Color(0.063, 0.059, 0.047, 0.7))
		view.draw_rect(Rect2(cell.position + cell.size * Vector2(0.37, 0.5), Vector2(cell.size.x * 0.26, 1)), Color("37342c"))
		view.draw_rect(Rect2(cell.position + cell.size * Vector2(0.5, 0.37), Vector2(1, cell.size.y * 0.26)), Color("37342c"))
		view.fonts.text(view, "%02d" % (index + 1), cell.position + Vector2(5, 9 if compact else 12),
			7 if compact else 8, Color("5d594f"), "left", 700, "mono")
	if data.has("statsRect"):
		_paint_stats(view, data.statsRect, compact)
	_paint_info(view, data.active, data.info, compact)


static func _paint_stats(view: MenuView, rect: Rect2, compact: bool) -> void:
	var catalog: GameCatalog = view.session.catalog
	var stats: Dictionary = LoadoutRules.calculate(LoadoutRules.base_stats(
		catalog.parameters("modes", "endless")), catalog.parameters("heroes",
		view.session.selected("Hero")), view.session.save_data, catalog)
	RadioPaint.surface(view, rect)
	view.fonts.text(view, "生存参数", rect.position + Vector2(12, 14 if compact else 19),
		11 if compact else 14, RadioPaint.PAPER, "left", 900)
	view.fonts.fit(view, str(catalog.parameters("modes", "endless").name) + "基准",
		Vector2(rect.end.x - 12, rect.position.y + (14 if compact else 19)), 10 if compact else 12,
		rect.size.x * 0.4, RadioPaint.MUTED, "right", 700, 10)
	var values: Array[String] = [str(int(stats.maxHp)), "%d%%" % roundi(float(stats.armor) * 100),
		str(roundi(float(stats.speed))), "%d%%" % roundi(float(stats.damageMultiplier) * 100)]
	var gap: float = 3 if compact else 6
	var inset: float = 8 if compact else 12
	var title_height: float = 27 if compact else 36
	var width: float = (rect.size.x - inset * 2 - gap * 3) / 4
	var height: float = rect.size.y - title_height - (18 if compact else 27)
	for index: int in range(4):
		var point: Vector2 = rect.position + Vector2(inset + index * (width + gap), title_height)
		RadioPaint.surface(view, Rect2(point, Vector2(width, height)), false, false, false, Color("393528"))
		var color: Color = [Color("c97857"), Color("a5a08e"), Color("879468"), RadioPaint.GOLD][index]
		view.fonts.text(view, ["生命", "护甲", "移动", "增伤"][index], point + Vector2(12, 17),
			10 if compact else 12, RadioPaint.MUTED, "left", 700)
		view.fonts.text(view, values[index], point + Vector2(12, height - 24),
			14 if compact else 22, color, "left", 900)
	view.fonts.fit(view, "射速 %d%%  ·  拾取 %d  ·  锁定 %d%%" % [
		roundi(float(stats.fireRateMultiplier) * 100), roundi(float(stats.pickupRadius)),
		roundi(float(stats.lockRangeMultiplier) * 100)], Vector2(rect.position.x + 12,
		rect.end.y - (9 if compact else 13)), 10 if compact else 14, rect.size.x - 24,
		RadioPaint.PAPER, "left", 700, 10, "mono")


static func _paint_info(view: MenuView, entry: Dictionary, rect: Rect2, compact: bool) -> void:
	RadioPaint.surface(view, rect, false, false, not entry.is_empty())
	if entry.is_empty():
		return
	var item: Dictionary = entry.item
	var accent: Color = ItemPresentation.accent(entry.kind, item, view.session.catalog)
	view.fonts.text(view, {"weapon": "枪械", "skin": "服饰", "equipment": "护具"}[entry.kind],
		rect.position + Vector2(14, 15 if compact else 23), 10 if compact else 12, accent, "left", 900)
	view.fonts.fit(view, item.name, rect.position + Vector2(65 if compact else 92,
		15 if compact else 23), 13 if compact else 21, rect.size.x - (78 if compact else 108),
		RadioPaint.WHITE, "left", 900, 11)
	view.fonts.fit(view, ItemPresentation.meta(entry.kind, item, view.session.catalog),
		rect.position + Vector2(14, 36 if compact else 51), 10 if compact else 14,
		rect.size.x - 28, RadioPaint.PAPER, "left", 800, 10)
	view.fonts.fit(view, ItemPresentation.stats(entry.kind, item).replace("  ·  ", " · "),
		rect.position + Vector2(14, 57 if compact else 79), 11 if compact else 15,
		rect.size.x - 28, RadioPaint.PAPER, "left", 700, 10)
	if entry.kind == "weapon":
		var record: Dictionary = view.session.save_data.weaponMastery.get(entry.id, {})
		var level: int = clampi(int(record.get("level", 1)), 1, 10)
		var mastery: String = "精通 Lv.%d · 已获得精通铭牌" % level
		for reward: Dictionary in view.session.catalog.metadata.masteryRewards:
			if int(reward.level) > level:
				mastery = "精通 Lv.%d · 下一奖励 Lv.%d：%s" % [level, reward.level, reward.name]
				break
		if not compact or rect.size.y >= 98:
			view.fonts.fit(view, mastery, Vector2(rect.position.x + 14, rect.end.y - 15 if compact else rect.position.y + 104),
				11 if compact else 14, rect.size.x - 28, accent, "left", 700 if compact else 900, 10 if compact else 11)
	if not compact:
		view.fonts.fit(view, item.description, Vector2(rect.position.x + 14, rect.end.y - 18),
			13, rect.size.x - 28, RadioPaint.MUTED, "left", 700, 11)


static func _equipped(view: MenuView, entry: Dictionary) -> bool:
	if entry.kind == "weapon":
		return entry.id == view.session.selected("Weapon")
	if entry.kind == "skin":
		return entry.id == view.session.selected("Skin")
	return view.session.save_data.equippedEquipment.get(entry.item.slot) == entry.id
