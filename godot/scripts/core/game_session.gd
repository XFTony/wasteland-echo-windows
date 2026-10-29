class_name GameSession
extends RefCounted
## The application coordinates transitions; pages request actions without editing saves.

signal changed
signal run_requested
signal fullscreen_requested
signal startup_requested

enum Screen { MENU, RUNNING, PAUSED, UPGRADE, FIELD_SHOP, RESULT_WIN, RESULT_LOSE }
enum Page { MAIN, DEPLOYMENT, INVENTORY, SHOP, SETTINGS, CREDITS }

const SELECTIONS: Dictionary = {
	"Weapon": ["weapons", "unlockedWeapons", "weapon"],
	"Skin": ["skins", "unlockedSkins", "skin"],
	"Hero": ["heroes", "unlockedHeroes", "hero"],
	"Map": ["maps", "unlockedMaps", "map"],
}
const PAGE_ACTIONS: Dictionary = {
	"start": Page.DEPLOYMENT, "deployment": Page.DEPLOYMENT,
	"inventory": Page.INVENTORY, "shop": Page.SHOP, "settings": Page.SETTINGS,
	"credits": Page.CREDITS,
}

var catalog: GameCatalog
var store: SaveStore
var save_data: Dictionary
var screen: Screen = Screen.MENU
var page: Page = Page.MAIN
var settings_section: int = 0
var shop_category: String = "weapon"
var shop_page: int = 0
var inventory_page: int = 0
var message: String = ""
var pending_binding: String = ""


func _init(game_catalog: GameCatalog, storage: RefCounted = null) -> void:
	catalog = game_catalog
	store = SaveStore.new(catalog, storage)
	save_data = store.load_save()
	_reconcile_selections()
	shop_category = save_data.shopCategory


func selected(kind: String) -> String:
	return save_data["selected" + kind]


func available(kind: String) -> Array:
	var spec: Array = SELECTIONS[kind]
	var result: Array = []
	for id: String in catalog.all(spec[0]):
		if id in save_data[spec[1]]:
			result.append(id)
	return result if not result.is_empty() else [catalog.defaults[spec[2]]]


func action(command: String) -> void:
	var pieces: PackedStringArray = command.split(":")
	var type: String = pieces[0]
	var value: String = ":".join(pieces.slice(1))
	if PAGE_ACTIONS.has(type):
		screen = Screen.MENU
		page = PAGE_ACTIONS[type]
		pending_binding = ""
		message = ""
	elif type == "back":
		page = Page.DEPLOYMENT if page == Page.INVENTORY else Page.MAIN
		pending_binding = ""
	elif type == "deploy":
		save_data.selectedMode = "endless"
		store.persist()
		run_requested.emit()
	elif type == "fullscreen":
		fullscreen_requested.emit()
	elif type == "replayStartup":
		startup_requested.emit()
	elif type.begins_with("select"):
		_select(type.trim_prefix("select"), value)
	elif type.ends_with("Prev") or type.ends_with("Next"):
		var direction: int = -1 if type.ends_with("Prev") else 1
		var kind: String = type.trim_suffix("Prev").trim_suffix("Next").capitalize()
		if type.begins_with("shopCategory"):
			var categories: Array = []
			for id: String in catalog.all("shopItems"):
				var item: Dictionary = catalog.parameters("shopItems", id)
				if item.category not in categories:
					categories.append(item.category)
			shop_category = _cycle(categories, shop_category, direction)
			shop_page = 0
		elif SELECTIONS.has(kind):
			_select(kind, _cycle(available(kind), selected(kind), direction))
	elif type == "shopPage":
		shop_page = maxi(0, int(value))
	elif type == "inventoryPage":
		inventory_page = maxi(0, int(value))
	elif type == "settingsSection":
		settings_section = 1 if value == "controls" else 0
		pending_binding = ""
	elif type == "buy":
		_buy(value)
	elif type == "equip":
		_equip(value)
	elif type == "unequip" and value in LoadoutRules.SLOTS:
		save_data.equippedEquipment[value] = null
		store.persist()
	elif type == "toggle":
		_toggle(value)
	elif type == "adjust" and pieces.size() == 3:
		_adjust(pieces[1], int(pieces[2]))
	elif type == "bind" and value in SaveCodec.BINDING_ORDER:
		pending_binding = value
		message = "请按下新的按键"
	elif type == "resetBindings":
		save_data.keyBindings = catalog.default_save.keyBindings.duplicate(true)
		pending_binding = ""
		message = "按键已恢复默认"
		store.persist()
	changed.emit()


func bind_code(code: String) -> void:
	if pending_binding.is_empty():
		return
	if code in SaveCodec.RESERVED_CODES:
		message = "该按键保留给菜单导航，请选择其他按键"
		changed.emit()
		return
	var previous: String = save_data.keyBindings[pending_binding]
	var conflict: String = ""
	for id: String in SaveCodec.BINDING_ORDER:
		if id != pending_binding and save_data.keyBindings[id] == code:
			conflict = id
			break
	save_data.keyBindings[pending_binding] = code
	if not conflict.is_empty():
		save_data.keyBindings[conflict] = previous
	pending_binding = ""
	message = "按键已保存" if conflict.is_empty() else "按键冲突已自动交换"
	store.persist()
	changed.emit()


func _select(kind: String, id: String) -> void:
	if not SELECTIONS.has(kind) or id not in available(kind):
		return
	save_data["selected" + kind] = id
	store.persist()


func _cycle(ids: Array, current: String, direction: int) -> String:
	var index: int = maxi(0, ids.find(current))
	return ids[posmod(index + direction, ids.size())]


func _buy(id: String) -> void:
	var item: Dictionary = catalog.parameters("shopItems", id)
	var result: Dictionary = EconomyRules.buy_shop(save_data, item, 3)
	var messages: Dictionary = {
		"purchased": "已购入：" + str(item.get("name", "物品")),
		"owned": "该物品已经拥有", "ruleLocked": "先完成对应档案规则取得蓝图",
		"locked": "先完成前置关卡才能购买", "insufficient": "货币不足",
		"missing": "物品数据不存在",
	}
	message = messages.get(result.status, "购买失败")
	if result.ok:
		if item.grantType == "equipment":
			_equip(item.grantId)
		store.persist()


func _equip(id: String) -> void:
	var item: Dictionary = catalog.parameters("equipment", id)
	if not item.is_empty() and id in save_data.ownedEquipment:
		save_data.equippedEquipment[item.slot] = id
		store.persist()


func _toggle(key: String) -> void:
	var settings: Dictionary = save_data.settings
	if key in ["screenShake", "flashes"]:
		settings[key] = _cycle(["off", "low", "high"], settings[key], 1)
	elif key == "gamepadDeadzone":
		var value: float = float(settings.gamepadDeadzone)
		settings.gamepadDeadzone = 0.18 if value < 0.15 else 0.28 if value < 0.23 else 0.12
	elif settings.get(key) is bool:
		settings[key] = not settings[key]
	store.persist()


func _adjust(key: String, direction: int) -> void:
	if key not in ["music", "sfx", "uiScale"] or direction == 0:
		return
	var minimum: float = 0.8 if key == "uiScale" else 0.0
	var maximum: float = 1.2 if key == "uiScale" else 1.0
	var value: float = floorf((float(save_data.settings[key]) + signi(direction) * 0.1) * 10 + 0.5) / 10
	save_data.settings[key] = clampf(value, minimum, maximum)
	if key in ["music", "sfx"] and value > 0:
		save_data.settings[key + "Muted"] = false
	store.persist()


func _reconcile_selections() -> void:
	for kind: String in SELECTIONS:
		var ids: Array = available(kind)
		if selected(kind) not in ids:
			save_data["selected" + kind] = ids[0]
	save_data.unlockedMaps = catalog.all("maps").keys()
