class_name SettingsPage
extends RefCounted
## Settings retain native focus, original values and transactional rebinding behavior.

const LABELS: Array[String] = [
	"向上移动", "向下移动", "向左移动", "向右移动", "射击", "暂停", "全屏",
	"重新开始", "退出本局", "升级选项 1", "升级选项 2", "升级选项 3",
	"升级选项 4", "交易／交互", "部署塔台",
]
const SETTINGS: Array[Array] = [
	["music", "背景音乐", "range"], ["sfx", "战斗音效", "range"],
	["uiScale", "界面缩放", "range"], ["autoAim", "自动瞄准", "toggle"],
	["autoFire", "自动开火", "toggle"], ["screenShake", "屏幕抖动", "toggle"],
	["flashes", "闪光强度", "toggle"], ["gamepadEnabled", "手柄输入", "toggle"],
	["gamepadVibration", "手柄震动", "toggle"], ["gamepadDeadzone", "摇杆死区", "toggle"],
	["showControlHints", "控制提示", "toggle"], ["showFps", "性能信息", "toggle"],
	["introAnimation", "启动动画", "toggle"], ["replayStartup", "启动画面", "action"],
]


static func layout(view: MenuView) -> Dictionary:
	var compact: bool = view.size.y < 600 or view.size.x < 900
	var dimensions := Vector2(minf(1240, view.size.x - (16 if compact else 58)),
		minf(760, view.size.y - (16 if compact else 42)))
	var rect := Rect2((view.size - dimensions) / 2, dimensions)
	var header: float = 50 if compact else 76
	var controls: bool = view.session.settings_section == 1
	var columns: int = 3 if controls else 2
	var rows: int = 5 if controls else 7
	var footer: float = 74 if compact else 92
	if not controls:
		footer = 86 if compact else 112
	var top: float = rect.position.y + header + ((3 if compact else 8) if controls else 20)
	var width: float = dimensions.x - ((18 if compact else 36) if controls else (24 if compact else 40))
	var row_height: float = minf((42 if compact else 62) if controls else (52 if compact else 72),
		(dimensions.y - header - footer - (0 if controls else 20)) / rows)
	return {"rect": rect, "compact": compact, "controls": controls, "header": header,
		"top": top, "columnW": width / columns, "rowH": row_height, "columns": columns,
		"rows": rows, "footerY": rect.end.y - ((39 if compact else 52) if controls else (43 if compact else 54))}


static func build(view: MenuView) -> void:
	var data: Dictionary = layout(view)
	view.page_data = data
	var rect: Rect2 = data.rect
	var compact: bool = data.compact
	var tab_width: float = 88 if compact else 118
	var tab_height: float = 30 if compact else 38
	var tab_y: float = rect.position.y + (float(data.header) - tab_height) / 2
	view.add_action_button("settingsSection:general", "常规与音频", Rect2(rect.end.x
		- tab_width * 2 - (10 if compact else 18), tab_y, tab_width, tab_height))
	view.add_action_button("settingsSection:controls", "按键绑定", Rect2(rect.end.x
		- tab_width - (6 if compact else 12), tab_y, tab_width, tab_height))
	var count: int = 15 if data.controls else SETTINGS.size()
	for index: int in range(count):
		var column: int = floori(float(index) / int(data.rows))
		var row: int = index % int(data.rows)
		var column_x: float = rect.position.x + ((9 if compact else 18) if data.controls
			else (12 if compact else 20)) + column * float(data.columnW)
		var row_y: float = float(data.top) + row * float(data.rowH)
		if data.controls:
			var id: String = SaveCodec.BINDING_ORDER[index]
			var width: float = 52 if compact else 88
			var height: float = maxf(28, minf(34 if compact else 42, float(data.rowH) - 10))
			view.add_action_button("bind:" + id, "请按键" if view.session.pending_binding == id
				else key_label(view.session.save_data.keyBindings[id]), Rect2(column_x
				+ float(data.columnW) - width - (8 if compact else 14), row_y
				+ (float(data.rowH) - height) / 2, width, height), true)
			continue
		var spec: Array = SETTINGS[index]
		var key: String = spec[0]
		var height: float = maxf(34, float(data.rowH) - 14) if compact else minf(46, float(data.rowH) - 16)
		var button_y: float = row_y + (float(data.rowH) - height) / 2
		var right: float = column_x + float(data.columnW) - (10 if compact else 18)
		if spec[2] == "range":
			var small: float = 32 if compact else 38
			var value_width: float = 68 if compact else 92
			view.add_action_button("adjust:" + key + ":-1", "−", Rect2(right - small * 2
				- value_width - 8, button_y, small, height))
			if key in ["music", "sfx"]:
				view.add_action_button("toggle:" + key + "Muted", _value(view, key), Rect2(right
					- small - value_width - 4, button_y, value_width, height), true)
			view.add_action_button("adjust:" + key + ":1", "+", Rect2(right - small,
				button_y, small, height))
		else:
			var width: float = 72 if compact else 100
			view.add_action_button("replayStartup" if spec[2] == "action" else "toggle:" + key,
				_value(view, key), Rect2(right - width, button_y, width, height))
	var width: float = 148 if compact else 168
	view.add_action_button("resetBindings" if data.controls else "fullscreen",
		"恢复默认" if data.controls else "切换全屏  F", Rect2(view.size.x / 2
		- (157 if compact else 180), data.footerY, width, 34 if compact else 42))
	view.add_action_button("back", "返回营地", Rect2(view.size.x / 2 + (9 if compact else 12),
		data.footerY, width, 34 if compact else 42))


static func paint(view: MenuView) -> void:
	var data: Dictionary = view.page_data
	if not data.has("footerY"):
		return
	var rect: Rect2 = data.rect
	var compact: bool = data.compact
	view.draw_rect(Rect2(rect.position, Vector2(minf(rect.size.x * 0.62, 500 if compact else 720),
		data.header)), Color(0.051, 0.055, 0.047, 0.92))
	RadioPaint.radio_mark(view, rect.position + Vector2(18 if compact else 28, 12 if compact else 18),
		Color("76a39a"), 0.7 if compact else 0.95)
	view.fonts.title(view, "桌面设置", rect.position + Vector2(58 if compact else 82,
		float(data.header) / 2 + 2), 25 if compact else 38)
	view.fonts.text(view, "音频、辅助瞄准、手柄与显示", rect.position
		+ Vector2(210 if compact else 286, float(data.header) / 2 + 4), 11 if compact else 14,
		RadioPaint.PAPER, "left", 700)
	var count: int = 15 if data.controls else SETTINGS.size()
	for index: int in range(count):
		var column: int = floori(float(index) / int(data.rows))
		var row: int = index % int(data.rows)
		var x: float = rect.position.x + ((9 if compact else 18) if data.controls
			else (12 if compact else 20)) + column * float(data.columnW)
		var y: float = float(data.top) + row * float(data.rowH)
		if data.controls:
			RadioPaint.surface(view, Rect2(x + 2, y + 2, float(data.columnW) - 6,
				float(data.rowH) - 4))
		else:
			view.draw_rect(Rect2(x, y - 5, float(data.columnW) - 10, float(data.rowH)),
				Color(0.122, 0.137, 0.102, 0.95))
		var label: String = LABELS[index] if data.controls else SETTINGS[index][1]
		view.fonts.fit(view, label, Vector2(x + ((8 if compact else 14) if data.controls
			else (12 if compact else 18)), y + float(data.rowH) / 2),
			(10 if compact else 13) if data.controls else (13 if compact else 16),
			float(data.columnW) - ((66 if compact else 116) if data.controls else (102 if compact else 148)),
			RadioPaint.PAPER, "left", 800, 8 if data.controls else 11)
		if not data.controls and SETTINGS[index][0] == "uiScale":
			view.fonts.text(view, _value(view, "uiScale"), Vector2(x + float(data.columnW)
				- (80 if compact else 110), y + float(data.rowH) / 2), 11 if compact else 13,
				RadioPaint.PAPER, "center", 800)
	var message: String = view.session.message if not view.session.message.is_empty() else (
		"点击一项后按下新按键；冲突按键会自动交换，方向键保留给菜单导航" if data.controls
		else "未检测到手柄 · v1.5.0-alpha.1 · 存档：Godot user://saves"
	)
	view.fonts.fit(view, message, Vector2(view.size.x / 2, float(data.footerY)
		- (9 if compact else 16)), 9 if compact else 11, rect.size.x - 40,
		RadioPaint.MUTED, "center", 700, 8)


static func key_label(code: String) -> String:
	if code.begins_with("Unbound"):
		return "未绑定"
	if code == "Space":
		return "空格"
	if code == "Escape":
		return "Esc"
	if code.begins_with("Key"):
		return code.trim_prefix("Key")
	if code.begins_with("Digit"):
		return code.trim_prefix("Digit")
	return code


static func _value(view: MenuView, key: String) -> String:
	var settings: Dictionary = view.session.save_data.settings
	if key == "replayStartup":
		return "重播"
	var value: Variant = settings[key]
	if key in ["music", "sfx", "uiScale"]:
		return "静音" if bool(settings.get(key + "Muted", false)) else "%d%%" % roundi(float(value) * 100)
	if key == "gamepadDeadzone":
		return "低" if float(value) < 0.15 else "标准" if float(value) < 0.23 else "高"
	if value is bool:
		return "开" if value else "关"
	return {"off": "关", "low": "低", "high": "高"}.get(value, str(value))
