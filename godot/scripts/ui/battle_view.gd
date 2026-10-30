class_name BattleView
extends Control
## HUD and modal pages use native focusable controls over the live world.

signal action_requested(command: String)

var model: RunSimulation
var assets: AssetStore
var fonts := UiFonts.new()
var _buttons: Array[Control] = []
var _market_cards: Array[Dictionary] = []
var _logical_size: Vector2
var _last_size: Vector2 = Vector2.ZERO
var _market_action: RadioButton
var _tutorial_action: RadioButton
var _using_gamepad: bool = false


static func _time(seconds: float) -> String:
	var whole: int = maxi(0, floori(seconds))
	return "%02d:%02d" % [floori(float(whole) / 60), whole % 60]
func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	get_viewport().size_changed.connect(refresh)
	refresh()


func _process(_delta: float) -> void:
	if model != null and not model.run.is_empty():
		if is_instance_valid(_market_action):
			_market_action.visible = model.screen == GameSession.Screen.RUNNING and (not model.field_market.nearest(model).is_empty() or not model.structures.nearest_recoverable(model).is_empty())
		if is_instance_valid(_tutorial_action):
			_tutorial_action.visible = model.screen == GameSession.Screen.RUNNING and bool(model.run.tutorial.active)
			_tutorial_action.position = _tutorial_rect().position + Vector2(292, 82)
	queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventKey or event is InputEventMouseMotion or event is InputEventMouseButton:
		_using_gamepad = false
	elif event is InputEventJoypadButton or event is InputEventJoypadMotion and absf(event.axis_value) > 0.2:
		_using_gamepad = bool(model.save.settings.gamepadEnabled) if model != null else false


func refresh() -> void:
	if not is_inside_tree() or model == null or model.run.is_empty():
		return
	var previous: String = ""
	var focused: Control = get_viewport().gui_get_focus_owner()
	if focused is RadioButton:
		previous = focused.action_id
	for button: Control in _buttons:
		remove_child(button)
		button.queue_free()
	_buttons.clear()
	_market_cards.clear()
	var dimensions: Vector2 = get_viewport_rect().size
	if dimensions.x <= 0 or dimensions.y <= 0:
		dimensions = Vector2(ProjectSettings.get_setting("display/window/size/viewport_width", 1280),
			ProjectSettings.get_setting("display/window/size/viewport_height", 720))
	var factor: float = 1.0 if model.screen in [GameSession.Screen.PAUSED, GameSession.Screen.RESULT_WIN, GameSession.Screen.RESULT_LOSE] else clampf(minf(dimensions.x / 1280, dimensions.y / 720), 1, 2)
	scale = Vector2.ONE * factor
	size = dimensions / factor
	_logical_size = size
	fonts.ui_scale = float(model.save.settings.get("uiScale", 1))
	if model.screen == GameSession.Screen.RUNNING:
		_button("pause", "Ⅱ", Rect2(size.x - 48, 17, 32, 32))
		_market_action = _button("fieldOpen", "", Rect2(size.x - 314, size.y - 118, 300, 66))
		_market_action.hit_only = true
		_market_action.visible = not model.field_market.nearest(model).is_empty() or not model.structures.nearest_recoverable(model).is_empty()
		if model.run.tutorial.active:
			_tutorial_action = _button("skipTutorial", "跳过教学", Rect2(_tutorial_rect().position + Vector2(292, 82), Vector2(74, 27)))
	elif model.screen == GameSession.Screen.UPGRADE:
		_build_upgrade()
	elif model.screen == GameSession.Screen.FIELD_SHOP:
		_build_market()
	elif model.screen == GameSession.Screen.PAUSED:
		var compact: bool = size.y < 520 or size.x < 760
		var pause_dimensions: Vector2 = Vector2(minf(520, size.x - 30), minf(390, size.y - 24))
		var origin: Vector2 = (size - pause_dimensions) / 2
		var width: float = minf(330, pause_dimensions.x - 64)
		var height: float = 42 if compact else 48
		var gap: float = 9 if compact else 12
		var y: float = origin.y + (98 if compact else 120)
		_button("resume", "继续战斗", Rect2(size.x / 2 - width / 2, y, width, height), true)
		_button("restart", "重新开始", Rect2(size.x / 2 - width / 2, y + height + gap, width, height))
		_button("quit", "结算本局", Rect2(size.x / 2 - width / 2, y + (height + gap) * 2, width, height))
	else:
		var data: Dictionary = _result_layout()
		var action_width: float = minf(146 if data.compact else 168 * float(data.visualScale), (float(data.width) - float(data.inset) * 2 - 12) / 2)
		var gap: float = 10 if data.compact else 14 * float(data.visualScale)
		_button("restart", "再来一局", Rect2(size.x / 2 - action_width - gap / 2, data.buttonY, action_width, data.buttonH), true)
		_button("menu", "返回主页", Rect2(size.x / 2 + gap / 2, data.buttonY, action_width, data.buttonH))
	if model.screen != GameSession.Screen.RUNNING:
		for button: Control in _buttons:
			if button is RadioButton and button.action_id == previous and not previous.is_empty():
				_focus_safe.call_deferred(button)
				return
		if not _buttons.is_empty():
			_focus_safe.call_deferred(_buttons[0])
	queue_redraw()


func _draw() -> void:
	if model == null or model.run.is_empty():
		return
	var pixels: Vector2 = get_viewport_rect().size
	var hud_factor: float = clampf(minf(pixels.x / 1280, pixels.y / 720), 1, 2) / scale.x
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE * hud_factor)
	_draw_hud(size.x / hud_factor)
	draw_set_transform(Vector2.ZERO)
	if model.screen == GameSession.Screen.RUNNING:
		_draw_running_hints()
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.04, 0.06, 0.045, 0.79))
	match model.screen:
		GameSession.Screen.UPGRADE:
			var narrow: bool = size.y < 600
			fonts.text(self, "战地改造 · 装配新改件", Vector2(size.x / 2, 32 if narrow else 48), 28 if narrow else 36, RadioPaint.PAPER_LIGHT, "center", 900)
			fonts.text(self, "生存计时暂停 · 等级 %d · 选择一项立即生效" % model.run.player.level,
				Vector2(size.x / 2, 61 if narrow else 83), 12 if narrow else 15, RadioPaint.MUTED, "center", 700)
		GameSession.Screen.FIELD_SHOP:
			_draw_market()
		GameSession.Screen.PAUSED:
			_draw_pause()
		_:
			_draw_result()


func _button(command: String, caption: String, rect: Rect2, primary: bool = false) -> RadioButton:
	var button := RadioButton.new()
	button.action_id = command
	button.caption = caption
	button.primary = primary
	button.fonts = fonts
	button.position = rect.position
	button.size = rect.size
	button.caption_size = 14 if rect.size.y <= 34 else 17
	button.action_requested.connect(_emit_action)
	add_child(button)
	button.remove_from_group("native_menu_actions")
	button.add_to_group("native_battle_actions")
	_buttons.append(button)
	return button


func _emit_action(command: String) -> void:
	action_requested.emit(command)


func action_regions() -> Array[Dictionary]:
	var regions: Array[Dictionary] = []
	for control: Control in _buttons:
		var command: String = "upgrade:" + str(control.option.id) if control is UpgradeCard else str(control.action_id)
		var bounds: Rect2 = control.get_global_transform() * Rect2(Vector2.ZERO, control.size)
		regions.append({"action": command, "x": bounds.position.x, "y": bounds.position.y,
			"w": bounds.size.x, "h": bounds.size.y})
	return regions


func _focus_safe(control: Control) -> void:
	if is_instance_valid(control) and control.is_inside_tree() and control.is_visible_in_tree():
		control.grab_focus()


func _build_upgrade() -> void:
	var options: Array = model.run.upgradeOptions
	var two_rows: bool = size.x < 780 or size.y < 430
	var columns: int = 2 if two_rows else 4
	var rows: int = ceili(float(options.size()) / columns)
	var narrow: bool = size.y < 600
	var top: float = 48 if two_rows else 82 if narrow else 124
	var footer: float = 40 if two_rows else 55 if narrow else 86
	var gap: float = 8 if two_rows else 14
	var total: float = minf(1340, size.x - (20 if two_rows else 44))
	var width: float = (total - gap * (columns - 1)) / columns
	var height: float = minf(180 if two_rows else 478, (size.y - top - footer - gap * (rows - 1) - 18) / maxi(1, rows))
	for index: int in range(options.size()):
		var card := UpgradeCard.new()
		card.option = options[index]
		card.index = index
		card.level = int(model.run.upgrades.get(card.option.id, 0))
		card.fonts = fonts
		card.catalog = model.catalog
		card.two_rows = two_rows
		card.reduced_motion = bool(model.save.settings.get("reducedMotion", false))
		card.position = Vector2((size.x - total) / 2 + index % columns * (width + gap), top + floori(float(index) / columns) * (height + gap))
		card.size = Vector2(width, height)
		card.action_requested.connect(_emit_action)
		add_child(card)
		_buttons.append(card)
	var salvage: int = mini(18, 4 + floori(float(model.run.player.level) / 2) * 2)
	_button("upgradeSalvage", "拆解本轮 · +%d 拾荒币" % salvage,
		Rect2(size.x / 2 - 125, size.y - 48, 250, 36))


func _draw_hud(view_width: float) -> void:
	var run: Dictionary = model.run
	var player: Dictionary = run.player
	RadioPaint.surface(self, Rect2(14, 14, 270, 82), false, true, false, Color("211f1a"))
	fonts.text(self, "LV %d" % player.level, Vector2(27, 31), 13, RadioPaint.GOLD, "left", 900)
	var weapon: Dictionary = model.catalog.parameters("weapons", player.weaponId)
	var entry: Dictionary = run.arsenal[player.weaponId]
	var weapon_name: String = str(weapon.name) + (" %d阶" % entry.tier if int(entry.tier) > 1 else "") + (" +%d" % entry.calibration if int(entry.calibration) > 0 else "")
	var mechanic: Dictionary = _mechanic_status(weapon)
	if not mechanic.is_empty():
		weapon_name += " · %s %d%%" % [mechanic.label, roundi(float(mechanic.value) * 100)]
	fonts.fit(self, weapon_name, Vector2(86, 31), 13, 186, RadioPaint.WHITE, "left", 900, 9)
	draw_rect(Rect2(26, 45, 246, 13), Color("312521"))
	draw_rect(Rect2(26, 45, 246 * clampf(float(player.hp) / float(player.maxHp), 0, 1), 13), Color("b65a3e"))
	fonts.text(self, "%d/%d" % [maxi(0, ceili(float(player.hp))), player.maxHp], Vector2(149, 52), 10, RadioPaint.WHITE, "center", 900)
	draw_rect(Rect2(26, 64, 246, 8), Color("24332e"))
	draw_rect(Rect2(26, 64, 246 * clampf(float(player.xp) / float(player.xpNext), 0, 1), 8), Color("91c4aa"))
	fonts.fit(self, "%s · 威胁%d" % [model.catalog.parameters("maps", run.mapId).name, run.threatLevel], Vector2(26, 83), 10, 246, RadioPaint.MUTED, "left", 800, 9)
	RadioPaint.surface(self, Rect2(view_width / 2 - 86, 12, 172, 58), false, true)
	var timer: String = "∞ " + _time(run.elapsed) if run.endless else "加时 " + _time(run.overtime) if float(run.elapsed) >= float(run.duration) else _time(float(run.duration) - float(run.elapsed))
	fonts.text(self, timer, Vector2(view_width / 2, 33), 23, RadioPaint.WHITE, "center", 900)
	var objective: String = "连续生存 · 首领击败 %d" % run.bossesDefeated if run.endless else "前往撤离区" if run.extraction.active else "最终攻势" if run.get("finalWaveAnnounced", false) else str(model.catalog.parameters("modes", run.modeId).objective)
	fonts.text(self, objective, Vector2(view_width / 2, 55), 11, RadioPaint.MUTED, "center", 900)
	RadioPaint.surface(self, Rect2(view_width - 184, 14, 170, 54), false, true)
	fonts.text(self, "击败 %d" % run.kills, Vector2(view_width - 170, 31), 13, RadioPaint.WHITE, "left", 900)
	fonts.text(self, "拾荒币 %d" % run.scrap, Vector2(view_width - 170, 52), 12, RadioPaint.GOLD, "left", 900)
	for enemy: Dictionary in model.enemies:
		if not enemy.active or not enemy.boss:
			continue
		var width: float = minf(430, view_width * 0.42)
		var definition: Dictionary = model.bosses.definition_for(model, enemy)
		RadioPaint.surface(self, Rect2(view_width / 2 - width / 2, 76, width, 42), false, true, false, Color("211815"))
		var phase_index: int = maxi(0, int(enemy.bossPhase) - 1)
		var phase_label: String = str(definition.phases[mini(phase_index, definition.phases.size() - 1)].label) if not definition.is_empty() else "阶段 %d" % (phase_index + 1)
		fonts.text(self, "%s · %s" % [definition.get("name", enemy.type), phase_label], Vector2(view_width / 2, 89), 12, RadioPaint.PAPER_LIGHT, "center", 900)
		draw_rect(Rect2(view_width / 2 - width / 2 + 12, 100, width - 24, 8), Color("321b18"))
		draw_rect(Rect2(view_width / 2 - width / 2 + 12, 100, (width - 24) * clampf(float(enemy.hp) / float(enemy.maxHp), 0, 1), 8), Color("b65a3e"))
		break


func _draw_running_hints() -> void:
	var run: Dictionary = model.run
	var settings: Dictionary = model.save.settings
	if settings.showControlHints:
		var hint_width: float = minf(530 if _using_gamepad else 570, size.x - 28)
		RadioPaint.surface(self, Rect2(14, size.y - 35, hint_width, 23))
		var aim: String = "自动锁敌" if settings.autoAim else "RS 瞄准" if _using_gamepad else "鼠标瞄准"
		var fire: String = "自动射击" if settings.autoFire else "RT / RB 射击" if _using_gamepad else "左键 / 空格射击"
		fonts.fit(self, ("手柄  LS 移动" if _using_gamepad else "键鼠  WASD 移动") + "  ·  " + aim + "  ·  " + fire + ("  ·  Menu 暂停" if _using_gamepad else "  ·  Esc 暂停"),
			Vector2(24, size.y - 23), 10, hint_width - 20, RadioPaint.MUTED, "left", 700, 8)
	var primary: Dictionary = {}
	for item: Dictionary in model.interactives:
		if item.active and item.type == "tradePost":
			primary = item
			break
	var station: Dictionary = model.field_market.nearest(model)
	if not primary.is_empty():
		RadioPaint.surface(self, Rect2(size.x - 314, size.y - 118, 300, 66), true, true)
		var key: String = "A" if _using_gamepad else SettingsPage.key_label(str(model.save.keyBindings.get("interact", "Enter")))
		var angle: float = atan2(float(primary.y) - float(run.player.y), float(primary.x) - float(run.player.x))
		var direction: String = ["东侧", "东南", "南侧", "西南", "西侧", "西北", "北侧", "东北"][posmod(floori(angle / (PI / 4) + 0.5), 8)]
		var label: String = "余火交易站 · " + direction
		if run.placement != null:
			label = "确认部署 · Esc/B取消" if run.placement.valid else str(run.placement.reason)
		elif not station.is_empty():
			label = key + " · 进入交易站"
		elif not model.structures.nearest_recoverable(model).is_empty():
			label = key + " · 回收附近塔台"
		fonts.fit(self, label, Vector2(size.x - 279, size.y - 100), 14, 256, RadioPaint.INK, "left", 900, 11)
		var deploy_key: String = "Y" if _using_gamepad else SettingsPage.key_label(str(model.save.keyBindings.get("deployTurret", "KeyT")))
		fonts.text(self, "塔台 %d/4 · 库存 %d · %s 部署" % [run.structures.size(), run.turretKits, deploy_key], Vector2(size.x - 302, size.y - 75), 12, Color("625238"), "left", 700)
	if run.tutorial.active:
		var steps: Array = model.catalog.metadata.tutorialSteps
		var step: Dictionary = steps[int(run.tutorial.stepIndex)]
		var rect: Rect2 = _tutorial_rect()
		RadioPaint.surface(self, rect, false, true)
		fonts.text(self, "荒原手册  %d/%d" % [int(run.tutorial.stepIndex) + 1, steps.size()], rect.position + Vector2(14, 17), 11, RadioPaint.GOLD, "left", 800)
		fonts.text(self, step.title, rect.position + Vector2(14, 40), 20, RadioPaint.PAPER_LIGHT, "left", 900)
		var detail: String = step.detail
		if step.id == "fire":
			detail = ("射程内自动锁敌" if settings.autoAim else "使用鼠标或右摇杆瞄准") + "；" + ("武器自动射击" if settings.autoFire else "使用射击键开火") + "，完成3次攻击。"
		fonts.fit(self, detail, rect.position + Vector2(14, 66), 11, rect.size.x - 28, RadioPaint.MUTED, "left", 700, 9)
		draw_rect(Rect2(rect.position + Vector2(14, 88), Vector2(rect.size.x - 112, 8)), Color("161512"))
		draw_rect(Rect2(rect.position + Vector2(14, 88), Vector2((rect.size.x - 112) * clampf(float(run.tutorial.progress) / float(step.target), 0, 1), 8)), RadioPaint.GOLD)
		fonts.text(self, ("%.1f / %.1f" if float(step.target) < 3 else "%d / %d") % [minf(float(step.target), float(run.tutorial.progress)), step.target], rect.position + Vector2(14, 105), 9, RadioPaint.MUTED, "left", 700)
	if settings.showFps:
		var rect := Rect2(size.x - 202, 72, 188, 72)
		RadioPaint.surface(self, rect)
		fonts.text(self, "FPS %d" % Engine.get_frames_per_second(), rect.position + Vector2(10, 14), 10, Color("91c4aa"), "left", 700)
		fonts.text(self, "敌人 %d  弹体 %d  拾取 %d" % [model.enemies.size(), model.projectiles.size() + model.enemy_shots.size(), model.pickups.size()], rect.position + Vector2(10, 33), 9, RadioPaint.PAPER, "left", 600)
		fonts.text(self, "输入 " + ("手柄" if _using_gamepad else "键鼠"), rect.position + Vector2(10, 53), 9, RadioPaint.MUTED, "left", 600)


func _tutorial_rect() -> Rect2:
	var boss: bool = false
	for enemy: Dictionary in model.enemies:
		if enemy.active and enemy.boss:
			boss = true
			break
	return Rect2(size.x - minf(380, size.x - 28) - 14, 126 if boss else 78, minf(380, size.x - 28), 116)


func _mechanic_status(weapon: Dictionary) -> Dictionary:
	var state: Dictionary = model.run.mechanics
	match str(weapon.get("mechanicId", "")):
		"heat_ramp":
			return {"label": "热量", "value": float(state.heat) / 10}
		"steady_cycle":
			return {"label": "稳压", "value": float(int(state.weaponShotCounter) % 4) / 4}
		"sixth_chamber":
			return {"label": "膛室", "value": float(int(state.weaponShotCounter) % 6) / 6}
		"arc_overload":
			return {"label": "过载", "value": float(int(state.weaponShotCounter) % 3) / 3}
	if int(state.chargedShots) > 0:
		return {"label": "充能", "value": 1.0}
	return {}


func _build_market() -> void:
	var compact: bool = size.x < 1100 or size.y < 630
	var width: float = minf(1140, size.x - 32)
	var height: float = minf(660, size.y - 24)
	var origin := Vector2((size.x - width) / 2, (size.y - height) / 2)
	var pad: float = 16 if compact else 26
	var market: Dictionary = model.run.fieldMarket
	var tab: String = str(market.get("tab", "supplies"))
	var tabs: Array = [["supplies", "改件补给"], ["arsenal", "武器库"], ["support", "塔台支援"]]
	var tab_width: float = minf(180, (width - pad * 2 - 20) / 3)
	for index: int in range(tabs.size()):
		_button("fieldTab:" + str(tabs[index][0]), tabs[index][1], Rect2(origin + Vector2(pad + index * (tab_width + 10), 77), Vector2(tab_width, 34)), tab == tabs[index][0])
	var all: Array = []
	for id: String in model.catalog.all("weapons" if tab == "arsenal" else "fieldGoods"):
		if tab == "arsenal" or model.catalog.parameters("fieldGoods", id).get("tab", "supplies") == tab:
			all.append(id)
	var pages: int = maxi(1, ceili(float(all.size()) / 6))
	var page: int = mini(pages - 1, int(market.get("page", 0)))
	var ids: Array = all.slice(page * 6, page * 6 + 6)
	var columns: int = 2 if size.x < 780 else 3
	var rows: int = maxi(2, ceili(float(ids.size()) / columns))
	var gap: float = 10 if compact else 14
	var card_width: float = (width - pad * 2 - gap * (columns - 1)) / columns
	var card_height: float = (height - 125 - 98 - gap * (rows - 1)) / rows
	for index: int in range(ids.size()):
		var id: String = ids[index]
		var gun: bool = tab == "arsenal"
		var item: Dictionary = model.catalog.parameters("weapons" if gun else "fieldGoods", id)
		var state: Dictionary = model.arsenal.state(model, id) if gun else model.field_market.state(model, id)
		var point: Vector2 = origin + Vector2(pad + index % columns * (card_width + gap), 125 + floori(float(index) / columns) * (card_height + gap))
		var rect := Rect2(point, Vector2(card_width, card_height))
		_market_cards.append({"rect": rect, "item": item, "state": state, "gun": gun, "compact": compact})
		var button_width: float = minf(145, (card_width - 30) * (0.49 if gun and int(state.tier) > 0 else 0.65))
		var by: float = point.y + card_height - 40
		if gun:
			if int(state.tier) == 0:
				var label: String = "还差%d币" % (int(state.price) - int(model.run.scrap)) if state.status == "insufficient" else "%d币 · 购入" % state.price
				_button("arsenalBuy:" + id, label, Rect2(point.x + card_width - button_width - 10, by, button_width, 30), state.status == "available")
			else:
				_button("arsenalEquip:" + id, "已装备" if state.status == "equipped" else "切换此武器", Rect2(point.x + 10, by, button_width, 30), state.status == "equipped")
				if int(state.tier) < 4:
					_button("arsenalImprove:" + id, "%d币 · 升阶" % state.upgradePrice, Rect2(point.x + card_width - button_width - 10, by, button_width, 30), state.canUpgrade)
		else:
			var labels: Dictionary = {"fullHealth": "生命已满", "capacity": "已达4座", "capped": "属性已满", "soldOut": "本局已满", "cooldown": "%d秒补货" % ceili(float(state.get("remaining", 0))), "insufficient": "还差%d币" % int(state.get("difference", 0))}
			_button("fieldBuy:" + id, "%d币 · 购买" % state.price if state.affordable else labels.get(state.status, "不可用"), Rect2(point.x + card_width - button_width - 10, by, button_width, 30), state.affordable)
	if pages > 1:
		_button("fieldPage:%d" % ((page + 1) % pages), "更多武器 %d/%d ›" % [page + 1, pages], Rect2(origin.x + pad, origin.y + height - 88, 166, 29))
	_button("fieldClose", "返回战斗", Rect2(origin.x + width - pad - 180, origin.y + height - 65, 180, 40), true)


func _draw_market() -> void:
	var width: float = minf(1140, size.x - 32)
	var height: float = minf(660, size.y - 24)
	var point := Vector2((size.x - width) / 2, (size.y - height) / 2)
	var compact: bool = size.x < 1100 or size.y < 630
	var pad: float = 16 if compact else 26
	RadioPaint.surface(self, Rect2(point, Vector2(width, height)), false, true, false, Color("272b22"))
	fonts.text(self, "余火交易站", point + Vector2(pad, 29), 24 if compact else 32, RadioPaint.PAPER_LIGHT, "left", 900)
	fonts.text(self, "购枪、改装与支援 · 所购物品仅本局保留", point + Vector2(pad, 57), 12 if compact else 15, Color("c6b990"), "left", 700)
	fonts.text(self, "%d 拾荒币" % model.run.scrap, point + Vector2(width - pad, 30), 18 if compact else 23, Color("f0d298"), "right", 900)
	for card: Dictionary in _market_cards:
		var rect: Rect2 = card.rect
		RadioPaint.surface(self, rect, true, true, false, Color("ddc9a0"))
		var icon: float = minf(48 if compact else 62, rect.size.y * 0.5)
		var icon_center: Vector2 = rect.position + Vector2(icon / 2 + 10, minf(42, rect.size.y * 0.35))
		var text_x: float = rect.position.x + icon + 15
		var text_width: float = rect.size.x - icon - 26
		fonts.fit(self, card.item.name, Vector2(text_x, rect.position.y + 21), 16 if compact else 19, text_width, RadioPaint.INK, "left", 900, 11)
		var lines: Array[String] = []
		if card.gun:
			var texture: Texture2D = assets.weapon_texture(card.item.id)
			if texture != null:
				var scale: float = minf(icon * 0.95 / texture.get_width(), icon * 0.72 / texture.get_height())
				var dimensions: Vector2 = texture.get_size() * scale
				draw_texture_rect(texture, Rect2(icon_center - dimensions / 2, dimensions), false)
			if int(card.state.tier) > 0:
				lines.append("%d阶 / 调校%d" % [card.state.tier, card.state.calibration])
			lines.append_array(ItemPresentation.weapon_summary(card.item))
			if int(card.state.tier) >= 4:
				fonts.text(self, "已达4阶", rect.end - Vector2(15, 25), 11, Color("5c472d"), "right", 900)
		else:
			var icon_id: String = str(card.item.id) if model.run.fieldMarket.get("tab", "supplies") == "support" else str(card.item.icon)
			UpgradeGlyph.paint(self, model.catalog, icon_id, icon_center, icon)
			lines.assign(str(card.item.detail).split(" · "))
			var count_label: String = "%d/%d 已装配" % [card.state.count, card.state.max] if is_finite(float(card.state.max)) else "可持续补给"
			var button_width: float = minf(145, (rect.size.x - 30) * 0.65)
			fonts.fit(self, count_label, Vector2(rect.position.x + 10, rect.end.y - 25), 11,
				rect.size.x - button_width - 25, Color("5c472d"), "left", 800, 10)
		var characters: int = maxi(10, floori(text_width / (11 if compact else 12)))
		for index: int in range(mini(3, lines.size())):
			var label: String = lines[index].left(characters - 1) + "…" if lines[index].length() > characters else lines[index]
			fonts.text(self, label, Vector2(text_x, rect.position.y + 43 + index * 15), 11 if compact else 12, Color("54452f"), "left", 700)
	if model.run.fieldMarket.get("tab", "supplies") == "support" and size.x >= 780:
		var gap: float = 10 if compact else 14
		var card_width: float = (width - pad * 2 - gap * 2) / 3
		var card_height: float = (height - 125 - 98 - gap) / 2
		var manual: Vector2 = point + Vector2(pad + 2 * (card_width + gap), 125)
		RadioPaint.surface(self, Rect2(manual, Vector2(card_width, card_height)), true, false, false, Color("c6b48d"))
		fonts.text(self, "部署手册", manual + Vector2(14, 20), 16 if compact else 20, RadioPaint.INK, "left", 900)
		var lines: Array[String] = ["T / Y 开始部署", "空地确认 · Esc / B取消", "E / A靠近回收，保留耐久", "受敌攻击会损毁", "工程与维护技能强化塔台"]
		for index: int in range(lines.size()):
			fonts.fit(self, lines[index], manual + Vector2(14, 43 + index * (16 if compact else 22)), 11 if compact else 14, card_width - 28, Color("54452f"), "left", 700, 10)
	fonts.fit(self, model.run.fieldMarket.message, point + Vector2(pad, height - 43), 13, width - pad * 2 - 220, RadioPaint.PAPER_LIGHT, "left", 700, 10)
	fonts.text(self, "购物暂停计时 · 返回战斗后才会补货", point + Vector2(pad, height - 22), 12, RadioPaint.MUTED, "left", 700)


func _draw_pause() -> void:
	var compact: bool = size.y < 520 or size.x < 760
	var dimensions: Vector2 = Vector2(minf(520, size.x - 30), minf(390, size.y - 24))
	var point: Vector2 = (size - dimensions) / 2
	RadioPaint.surface(self, Rect2(point, dimensions), false, true, false, Color("232820"))
	RadioPaint.paper_clip(self, point + Vector2(dimensions.x / 2 - 13, 6))
	RadioPaint.radio_mark(self, point + Vector2(22, 18), RadioPaint.GOLD, 0.7 if compact else 0.9)
	fonts.title(self, "行动暂停", point + Vector2(61, 34 if compact else 43), 26 if compact else 34)
	fonts.text(self, "战场时间已冻结", point + Vector2(24, 66 if compact else 80), 11 if compact else 14, RadioPaint.MUTED, "left", 700)
	draw_rect(Rect2(point + Vector2(24, 82 if compact else 102), Vector2(dimensions.x - 48, 1)), Color(0.769, 0.698, 0.553, 0.3))
	fonts.fit(self, "手柄 Menu / B 继续 · A 确认" if _using_gamepad else "P / Esc 继续 · Q 退出 · R 重开",
		Vector2(size.x / 2, point.y + dimensions.y - 20), 10 if compact else 12, dimensions.x - 36,
		RadioPaint.MUTED, "center", 700, 9)


func _result_layout() -> Dictionary:
	var compact: bool = size.y < 600 or size.x < 860
	var visual: float = 1.0 if compact else clampf(size.y / 720, 1, 1.32)
	var width: float = minf(960 * visual, size.x - 34)
	var height: float = minf(600 * visual, size.y - 28)
	var point: Vector2 = (size - Vector2(width, height)) / 2
	var inset: float = 18 if compact else 28 * visual
	var top: float = point.y + (91 if compact else 111 * visual)
	var gap: float = 7 if compact else 12 * visual
	var primary_width: float = (width - inset * 2 - gap * 2) / 3
	var primary_height: float = 70 if compact else 88 * visual
	var body_y: float = top + primary_height + (12 if compact else 18 * visual)
	var button_height: float = 39 if compact else 46 * visual
	var button_y: float = point.y + height - button_height - (13 if compact else 19 * visual)
	var body_height: float = button_y - body_y - (13 if compact else 18 * visual)
	var body_gap: float = 8 if compact else 16 * visual
	var left_width: float = (width - inset * 2 - body_gap) * 0.56
	return {"compact": compact, "visualScale": visual, "width": width, "height": height,
		"point": point, "inset": inset, "top": top, "gap": gap, "primaryW": primary_width,
		"primaryH": primary_height, "bodyY": body_y, "bodyH": body_height, "leftW": left_width,
		"rightX": point.x + inset + left_width + body_gap,
		"rightW": width - inset * 2 - left_width - body_gap,
		"buttonY": button_y, "buttonH": button_height}


func _draw_result() -> void:
	var run: Dictionary = model.run
	var data: Dictionary = _result_layout()
	var compact: bool = data.compact
	var visual: float = data.visualScale
	var point: Vector2 = data.point
	var inset: float = data.inset
	var won: bool = model.screen == GameSession.Screen.RESULT_WIN
	var accent: Color = Color(model.catalog.metadata.palette.cyan if won else model.catalog.metadata.palette.rust)
	RadioPaint.surface(self, Rect2(point, Vector2(data.width, data.height)), false, true, false, Color("232820"))
	RadioPaint.paper_clip(self, point + Vector2(float(data.width) / 2 - 13, 6))
	RadioPaint.radio_mark(self, point + Vector2(inset, 15 if compact else 18 * visual), accent, 0.72 if compact else 0.9 * visual)
	var title: String = "生存记录已归档" if run.result == "retire" else "撤离成功" if won and run.rule == "extract" else "坚守成功" if won else "尸潮压境" if run.endless else "信号中断"
	fonts.text(self, title, point + Vector2(inset + (40 if compact else 54 * visual), 35 if compact else 44 * visual),
		27 if compact else 37 * visual, accent, "left", 900, "display")
	fonts.text(self, "SEED %s" % run.seed, point + Vector2(float(data.width) - inset, 31 if compact else 34 * visual),
		9 if compact else 11 * visual, RadioPaint.MUTED, "right", 800, "mono")
	var summary: String = "你把废土的回声带了回来" if won and run.rule == "extract" else "信号穿过了最后一轮沙暴" if won else "本局战利品已结算；下面记录关键战况"
	fonts.fit(self, summary, point + Vector2(inset, 70 if compact else 83 * visual), 11 if compact else 14 * visual,
		float(data.width) - inset * 2, RadioPaint.PAPER, "left", 700, 10)
	var primary: Array[Array] = [["存活时间", _time(float(run.elapsed) if run.endless else minf(float(run.elapsed), float(run.duration))), RadioPaint.WHITE],
		["击败感染者", str(int(run.kills)), RadioPaint.WHITE], ["获得铜币", "+%d" % run.payout.copper, Color("dfaa67")]]
	for index: int in range(primary.size()):
		var at: Vector2 = Vector2(point.x + inset + index * (float(data.primaryW) + float(data.gap)), data.top)
		RadioPaint.surface(self, Rect2(at, Vector2(data.primaryW, data.primaryH)), false, false, false, Color("2e2b24"))
		fonts.text(self, primary[index][0], at + Vector2(13, 20 if compact else 24 * visual), 10 if compact else 13 * visual, RadioPaint.MUTED, "left", 800)
		fonts.fit(self, primary[index][1], at + Vector2(13, 49 if compact else 58 * visual), 24 if compact else 31 * visual,
			float(data.primaryW) - 25, primary[index][2], "left", 900, 16, "display")
	draw_rect(Rect2(point.x + inset, data.bodyY, data.leftW, data.bodyH), Color("24231e"))
	draw_rect(Rect2(data.rightX, data.bodyY, data.rightW, data.bodyH), Color("24231e"))
	fonts.text(self, "战况记录", Vector2(point.x + inset + 14, float(data.bodyY) + (19 if compact else 23 * visual)), 13 if compact else 16 * visual, RadioPaint.PAPER, "left", 900)
	var secondary: Array[Array] = [["精英", str(int(run.eliteKills))], ["造成伤害", str(roundi(float(run.damageDealt)))],
		["命中率", "%d%%" % roundi(float(run.accuracy) * 100)], ["最长无伤", _time(run.maxNoHitTime)],
		["武器熟练", "Lv.%d  +%d" % [run.masteryLevel, run.masteryGain]], ["获得金币", "+%d" % run.payout.gold]]
	var row_start: float = float(data.bodyY) + (39 if compact else 49 * visual)
	var row_height: float = (float(data.bodyH) - (46 if compact else 56 * visual)) / secondary.size()
	for index: int in range(secondary.size()):
		var y: float = row_start + index * row_height
		if index > 0:
			draw_rect(Rect2(point.x + inset + 13, y - row_height * 0.48, float(data.leftW) - 27, 1), Color(0.769, 0.698, 0.553, 0.18))
		fonts.text(self, secondary[index][0], Vector2(point.x + inset + 14, y), 10 if compact else 12 * visual, RadioPaint.MUTED, "left", 700)
		fonts.fit(self, secondary[index][1], Vector2(point.x + inset + float(data.leftW) - 15, y), 12 if compact else 15 * visual,
			float(data.leftW) * 0.52, RadioPaint.GOLD if index == 5 else RadioPaint.WHITE, "right", 900, 10)
	fonts.text(self, "本局新增", Vector2(float(data.rightX) + 14, float(data.bodyY) + (19 if compact else 23 * visual)), 13 if compact else 16 * visual, accent, "left", 900)
	var progression: Array[String] = []
	for reward: Dictionary in run.get("masteryRewards", []):
		progression.append("精通 Lv.%d「%s」" % [reward.level, reward.name])
	for unlock: Dictionary in run.get("unlockRewards", []):
		progression.append("规则「%s」" % unlock.name)
	var reward_y: float = float(data.bodyY) + (43 if compact else 53 * visual)
	if progression.is_empty():
		fonts.fit(self, "本局无新增解锁", Vector2(float(data.rightX) + 14, reward_y), 10 if compact else 13 * visual,
			float(data.rightW) - 28, RadioPaint.MUTED, "left", 700, 9)
	else:
		for index: int in range(mini(3, progression.size())):
			fonts.fit(self, progression[index], Vector2(float(data.rightX) + 14, reward_y + index * (20 if compact else 24 * visual)),
				10 if compact else 13 * visual, float(data.rightW) - 28, RadioPaint.PAPER, "left", 700, 9)
	if not won:
		var advice_y: float = float(data.bodyY) + float(data.bodyH) * 0.56
		fonts.text(self, "复盘建议", Vector2(float(data.rightX) + 14, advice_y), 12 if compact else 15 * visual, RadioPaint.GOLD, "left", 900)
		var advice: Array = run.advice if not run.advice.is_empty() else ["调整站位与装备，再次尝试。"]
		var note_y: float = advice_y + (21 if compact else 27 * visual)
		var characters: int = 20 if compact else 26
		for index: int in range(mini(2, advice.size())):
			var note: String = advice[index]
			while not note.is_empty():
				fonts.fit(self, note.left(characters), Vector2(float(data.rightX) + 14, note_y), 10 if compact else 12 * visual,
					float(data.rightW) - 28, RadioPaint.PAPER, "left", 700, 10)
				note_y += 16 if compact else 19 * visual
				note = note.substr(characters)
			note_y += 4 if compact else 6 * visual
	else:
		fonts.fit(self, "行动记录已归档，战利品已入账。", Vector2(float(data.rightX) + 14, float(data.bodyY) + float(data.bodyH) - (22 if compact else 27 * visual)),
			10 if compact else 12 * visual, float(data.rightW) - 28, RadioPaint.MUTED, "left", 700, 9)
