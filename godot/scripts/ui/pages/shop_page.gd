class_name ShopPage
extends RefCounted
## Grid positions, pagination and status messages preserve the source shop contract.

const LABELS: Dictionary = {"weapon": "武器", "outfit": "服饰", "equipment": "四部位护具"}


static func layout(view: MenuView) -> Dictionary:
	var compact: bool = view.size.y < 600 or view.size.x < 900
	var margin: float = 14 if compact else 30
	var top: float = 12 if compact else 24
	var width: float = view.size.x - margin * 2
	var header: float = 55 if compact else 78
	var arrow: float = 30 if compact else 36
	var tabs_y: float = top + header + (7 if compact else 5)
	var items: Array[Dictionary] = []
	for id: String in view.session.catalog.all("shopItems"):
		var item: Dictionary = view.session.catalog.parameters("shopItems", id)
		if item.category == view.session.shop_category:
			items.append(item)
	var page_count: int = maxi(1, ceili(items.size() / 6.0))
	var page: int = mini(page_count - 1, view.session.shop_page)
	items = items.slice(page * 6, page * 6 + 6)
	var rows: int = maxi(1, ceili(items.size() / 2.0))
	var gap: float = 10 if compact else 16
	var grid_y: float = tabs_y + arrow + (9 if compact else 14)
	var card_width: float = (width - gap) / 2
	var card_height: float = (view.size.y - grid_y - margin - gap * (rows - 1)
		- (40 if page_count > 1 else 0)) / rows
	var cards: Array[Dictionary] = []
	for index: int in range(items.size()):
		cards.append({"item": items[index], "rect": Rect2(margin + index % 2 * (card_width + gap),
			grid_y + floori(index / 2.0) * (card_height + gap), card_width, card_height)})
	return {"compact": compact, "margin": margin, "top": top, "width": width,
		"header": header, "tabsY": tabs_y, "arrow": arrow, "cards": cards,
		"pages": page_count, "page": page}


static func build(view: MenuView) -> void:
	var data: Dictionary = layout(view)
	view.page_data = data
	var compact: bool = data.compact
	view.add_action_button("back", "返回营地", Rect2(float(data.margin) + float(data.width)
		- (116 if compact else 142), float(data.top) + 4, 108 if compact else 134, 36 if compact else 44))
	view.add_action_button("shopCategoryPrev", "‹", Rect2(data.margin, data.tabsY, data.arrow, data.arrow))
	view.add_action_button("shopCategoryNext", "›", Rect2(float(data.margin) + (205 if compact else 270),
		data.tabsY, data.arrow, data.arrow))
	for card: Dictionary in data.cards:
		var item: Dictionary = card.item
		var rect: Rect2 = card.rect
		var tiny: bool = rect.size.y < 92
		var state: Dictionary = EconomyRules.shop_state(view.session.save_data, item, 3)
		var action: String = "buy:" + item.id
		if state.owned:
			if item.grantType == "equipment":
				action = "equip:" + item.grantId
			else:
				action = ("selectWeapon:" if item.grantType == "weapon" else "selectSkin:") + item.grantId
		var caption: String = "装备" if state.owned and item.grantType == "equipment" else (
			"整备" if state.owned else "档案未达成" if state.ruleLocked else "未解锁"
			if state.status == "locked" else "余额不足" if state.status == "insufficient" else "购买"
		)
		var width: float = 82 if tiny else 108
		var height: float = 29 if tiny else 36
		view.add_action_button(action, caption, Rect2(rect.end - Vector2(width + 13,
			height + (8 if tiny else 13)), Vector2(width, height)), state.owned or state.status == "available")
	if int(data.pages) > 1:
		view.add_action_button("shopPage:%d" % posmod(int(data.page) - 1, int(data.pages)),
			"‹ 上一页", Rect2(data.margin, view.size.y - float(data.margin) - 33, 116, 32))
		view.add_action_button("shopPage:%d" % posmod(int(data.page) + 1, int(data.pages)),
			"下一页 ›", Rect2(float(data.margin) + float(data.width) - 116,
			view.size.y - float(data.margin) - 33, 116, 32))


static func paint(view: MenuView) -> void:
	var data: Dictionary = view.page_data
	if not data.has("cards"):
		return
	var compact: bool = data.compact
	var x: float = float(data.margin)
	var y: float = float(data.top)
	var width: float = float(data.width)
	view.draw_rect(Rect2(x, y, minf(width * 0.62, 620), data.header), Color(0.094, 0.106, 0.078, 0.94))
	RadioPaint.radio_mark(view, Vector2(x + 14, y + 12), Color("b87343"), 0.8 if compact else 1.0)
	view.fonts.title(view, "拾荒者商栈", Vector2(x + 55, y + (24 if compact else 31)), 28 if compact else 38)
	if not compact:
		view.fonts.text(view, "按用途挑选，带上真正用得着的东西。", Vector2(x + 57, y + 62),
			12, RadioPaint.MUTED, "left", 500)
	view.fonts.fit(view, "铜币 %d   金币 %d" % [view.session.save_data.currencies.copper,
		view.session.save_data.currencies.gold], Vector2(x + width if compact else x + width - 300,
		y + (57 if compact else 64)), 12, 230 if compact else 270, RadioPaint.GOLD,
		"right" if compact else "left", 800, 10, "mono")
	view.fonts.text(view, LABELS[view.session.shop_category], Vector2(x + float(data.arrow) + 18,
		float(data.tabsY) + float(data.arrow) / 2), 16 if compact else 20, RadioPaint.PAPER, "left", 800)
	if not view.session.message.is_empty():
		view.fonts.fit(view, view.session.message, Vector2(x + width,
			float(data.tabsY) + float(data.arrow) / 2), 12, width * 0.48, RadioPaint.GOLD, "right", 700, 10)
	for card: Dictionary in data.cards:
		_paint_card(view, card.item, card.rect, compact)
	if int(data.pages) > 1:
		view.fonts.text(view, "%d/%d" % [int(data.page) + 1, data.pages],
			Vector2(x + width / 2, view.size.y - float(data.margin) - 17), 13,
			RadioPaint.PAPER, "center", 800)


static func _paint_card(view: MenuView, item: Dictionary, rect: Rect2, compact: bool) -> void:
	var tiny: bool = rect.size.y < 92
	var state: Dictionary = EconomyRules.shop_state(view.session.save_data, item, 3)
	RadioPaint.surface(view, rect, false, false, false, Color("272921"))
	var icon: float = 38 if tiny else 65 if compact else 80
	view.draw_item_icon(item.grantType, item.grantId, rect.position + Vector2(14 + icon / 2,
		rect.size.y / 2 if tiny else 18 + icon / 2), icon)
	var text_x: float = rect.position.x + icon + 29
	view.fonts.fit(view, item.name, Vector2(text_x, rect.position.y + (16 if tiny else 25)),
		13 if tiny else 17 if compact else 20, maxf(75, rect.size.x - icon - 155),
		RadioPaint.WHITE, "left", 900, 11)
	if not tiny:
		view.fonts.fit(view, item.description, Vector2(text_x, rect.position.y + 48),
			11, rect.size.x - icon - 47, RadioPaint.COPPER, "left", 700, 10)
		if not compact:
			view.fonts.fit(view, item.description, Vector2(text_x, rect.position.y + 72),
				14, rect.size.x - icon - 47, RadioPaint.MUTED, "left", 500, 12)
		view.fonts.text(view, ("金币 " if item.currency == "gold" else "铜币 ") + str(item.price),
			rect.position + Vector2(rect.size.x - 16, 25), 12 if compact else 13,
			RadioPaint.GOLD, "right", 800, "mono")
	var status: String = "已收入背包" if state.owned else "可整备" if state.status == "available" else (
		"先完成档案规则" if state.ruleLocked else "余额不足"
	)
	view.fonts.fit(view, status, Vector2(text_x if tiny else rect.position.x + 15,
		rect.end.y - (13 if tiny else 23)), 10 if tiny else 11,
		rect.size.x - (icon + 136 if tiny else 147), RadioPaint.MUTED, "left", 600, 10)
