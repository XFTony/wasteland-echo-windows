class_name SaveTransferView
extends Control
## Import previews retain the selected snapshot until the user confirms replacement.

const MAX_IMPORT_BYTES: int = 8 * 1024 * 1024
const SUMMARY_FIELDS: Array[Array] = [
	["copper", "铜币"], ["gold", "金币"], ["unlockedWeapons", "已解锁武器"],
	["unlockedHeroes", "已解锁角色"], ["unlockedSkins", "已解锁服饰"],
	["unlockedMaps", "可用地图"], ["ownedEquipment", "已拥有护具"],
	["totalKills", "累计击败感染者"], ["bossesDefeated", "累计击败首领"],
	["bestTime", "最长生存时间"], ["settledRuns", "有效生存记录"],
]

var _catalog: GameCatalog
var _store: SaveStore
var _storage: FileStorage
var _pending_text: String = ""
var _pending_data: Dictionary = {}
var _selected_path: String = ""
var _current_labels: Dictionary = {}
var _pending_labels: Dictionary = {}
var _test_mode: bool = false

@onready var _summary: GridContainer = $Margin/Content/SummaryPanel/Scroll/Summary
@onready var _status: Label = $Margin/Content/Status
@onready var _source: Label = $Margin/Content/SourcePath
@onready var _confirm_button: Button = $Margin/Content/Bottom/ConfirmImport
@onready var _open_dialog: FileDialog = $ChooseImport
@onready var _save_dialog: FileDialog = $ChooseExport
@onready var _confirmation: ConfirmationDialog = $ConfirmReplacement


func _ready() -> void:
	_apply_theme()
	_catalog = load("res://content/game_catalog.tres") as GameCatalog
	if _catalog == null:
		_set_status("内容资源尚未准备好，请先完成项目导入。", true)
		return
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	_test_mode = "--qa-save-transfer" in arguments or "--qa-save-transfer-test" in arguments
	_storage = FileStorage.new("res://../output/godot-migration/save-transfer-qa" if _test_mode else "user://saves")
	_store = SaveStore.new(_catalog, _storage)
	_store.load_save()
	_build_summary()
	$Margin/Content/Actions/ChooseImport.pressed.connect(_choose_import)
	$Margin/Content/Actions/ExportCurrent.pressed.connect(_choose_export)
	$Margin/Content/Actions/ReloadCurrent.pressed.connect(_reload)
	$Margin/Content/Bottom/Close.pressed.connect(_close)
	_confirm_button.pressed.connect(_request_confirmation)
	_open_dialog.file_selected.connect(_load_import)
	_save_dialog.file_selected.connect(_export_selected)
	_confirmation.confirmed.connect(_confirm_import)
	_open_dialog.current_dir = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS)
	_save_dialog.current_dir = OS.get_system_dir(OS.SYSTEM_DIR_DOCUMENTS)
	_refresh_summary()
	_set_status("请选择旧版导出的 JSON 文件，核对预览后再确认导入。")
	if _store.read_only:
		_set_status("当前进度无法安全写入。可先导出备份，导入暂不可用。", true)
	if "--qa-save-transfer-test" in arguments:
		_self_check.call_deferred()


func _apply_theme() -> void:
	var palette := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"])
	palette.default_font = font
	palette.default_font_size = 16
	palette.set_color("font_color", "Label", Color("eeddbb"))
	palette.set_color("font_color", "Button", Color("eeddbb"))
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color("242a21")
	panel.border_color = Color("71694f")
	panel.set_border_width_all(1)
	panel.content_margin_left = 16
	panel.content_margin_right = 16
	panel.content_margin_top = 12
	panel.content_margin_bottom = 12
	palette.set_stylebox("panel", "PanelContainer", panel)
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		var surface: StyleBoxFlat = panel.duplicate() as StyleBoxFlat
		surface.bg_color = Color("4a4a35") if state == "hover" else Color("363e2d") if state == "pressed" else Color("2d3327")
		surface.border_color = Color("d7b75b") if state == "focus" else Color("71694f")
		palette.set_stylebox(state, "Button", surface)
	theme = palette


func _build_summary() -> void:
	for caption: String in ["进度项目", "本机新版当前进度", "准备导入的旧版进度"]:
		_summary.add_child(_label(caption, 18))
	for field: Array in SUMMARY_FIELDS:
		_summary.add_child(_label(field[1]))
		var current: Label = _label("—")
		var candidate: Label = _label("—")
		_summary.add_child(current)
		_summary.add_child(candidate)
		_current_labels[field[0]] = current
		_pending_labels[field[0]] = candidate


func _label(value: String, font_size: int = 16) -> Label:
	var label := Label.new()
	label.text = value
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size = Vector2(200, 30)
	label.add_theme_font_size_override("font_size", font_size)
	return label


func _summary_value(data: Dictionary, field: String) -> String:
	if data.is_empty():
		return "—"
	if field in ["copper", "gold"]:
		return str(int(data.get("currencies", {}).get(field, 0)))
	if field == "bestTime":
		var seconds: int = maxi(0, floori(float(data.get(field, 0))))
		return "%d 分 %02d 秒" % [floori(float(seconds) / 60), seconds % 60]
	var value: Variant = data.get(field, 0)
	return str(value.size()) if value is Array else str(int(value))


func _refresh_summary() -> void:
	for field: Array in SUMMARY_FIELDS:
		_current_labels[field[0]].text = _summary_value(_store.data, field[0])
		_pending_labels[field[0]].text = _summary_value(_pending_data, field[0])
	_confirm_button.disabled = _pending_text.is_empty() or _store.read_only
	_source.text = "尚未选择旧版存档" if _selected_path.is_empty() else "准备导入：" + _selected_path.get_file()
	_source.tooltip_text = _selected_path


func _choose_import() -> void:
	_open_dialog.popup_centered_ratio(0.8)


func _choose_export() -> void:
	_save_dialog.current_file = "荒原回响-进度备份.json"
	_save_dialog.popup_centered_ratio(0.8)


func _load_import(path: String) -> void:
	_clear_preview()
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		_set_status("无法读取所选文件，请重新选择。", true)
		return
	if file.get_length() > MAX_IMPORT_BYTES:
		file.close()
		_set_status("文件过大，请确认选择的是游戏导出的 JSON 存档。", true)
		return
	var text: String = file.get_as_text()
	file.close()
	if _preview_text(text):
		_selected_path = path
		_refresh_summary()


func _preview_text(text: String) -> bool:
	_clear_preview()
	var parser := JSON.new()
	if parser.parse(text) != OK or not parser.data is Dictionary or not _resembles_save(parser.data):
		_set_status("所选文件不包含可识别的游戏进度。请使用旧版导出的 JSON 存档。", true)
		return false
	var preview: Dictionary = _store.preview_import(text)
	if not preview.ok:
		_set_status(str(preview.get("reason", "存档无法读取。")), true)
		return false
	_pending_text = text
	_pending_data = preview.data
	_refresh_summary()
	_set_status("预览已准备好。核对两列进度，确认后将导入到本机新版；当前进度会自动备份。")
	return true


func _resembles_save(data: Dictionary) -> bool:
	if data.has("schemaVersion"):
		var version: Variant = data.schemaVersion
		if not (version is int or version is float) or not is_finite(float(version)) or float(version) < 1:
			return false
	var known: int = 0
	for key: String in ["scrap", "totalKills", "unlockedWeapons", "selectedWeapon", "bestTime", "currencies"]:
		known += 1 if data.has(key) else 0
	return known >= 2


func _request_confirmation() -> void:
	if _pending_text.is_empty() or _store.read_only:
		return
	_confirmation.dialog_text = "将导入预览中的进度到本机新版。\n当前新版进度会先自动备份。\n\n所选文件：%s\n铜币：%s → %s\n金币：%s → %s" % [
		_selected_path.get_file(), _summary_value(_store.data, "copper"), _summary_value(_pending_data, "copper"),
		_summary_value(_store.data, "gold"), _summary_value(_pending_data, "gold")]
	_confirmation.popup_centered(Vector2i(560, 280))


func _confirm_import() -> void:
	if not _perform_import():
		return
	_clear_preview()
	_set_status("导入成功，当前进度已备份。关闭此工具后启动新版游戏即可使用。")


func _perform_import() -> bool:
	if _pending_text.is_empty():
		return false
	if not _store.import_confirmed(_pending_text):
		_set_status("未能完成导入，当前进度未替换。请先导出备份并检查存档目录是否可写。", true)
		return false
	return true


func _export_selected(path: String) -> void:
	if _write_export(path):
		_set_status("已导出备份：" + path.get_file())


func _write_export(path: String) -> bool:
	var destination: String = ProjectSettings.globalize_path(path).replace("\\", "/").simplify_path().to_lower()
	for key: String in [SaveStore.KEY, SaveStore.BACKUP_KEY, SaveStore.DAMAGED_KEY]:
		var internal: String = ProjectSettings.globalize_path(_storage.directory.path_join(key + ".json")).replace("\\", "/").simplify_path().to_lower()
		if destination == internal:
			_set_status("请选择另一个备份文件名，保留自动维护的进度文件。", true)
			return false
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		_set_status("无法写入所选位置，请选择其他备份位置。", true)
		return false
	file.store_string(JSON.stringify(_store.data, "  ", false, true) + "\n")
	file.flush()
	var error: Error = file.get_error()
	file.close()
	if error != OK:
		_set_status("备份未能完整写入，请重新导出到其他位置。", true)
		return false
	return true


func _clear_preview() -> void:
	_pending_text = ""
	_pending_data = {}
	_selected_path = ""
	_refresh_summary()


func _reload() -> void:
	_clear_preview()
	_store.load_save()
	_refresh_summary()
	_set_status("已重新读取本机新版进度。")


func _set_status(value: String, failed: bool = false) -> void:
	_status.text = value
	_status.add_theme_color_override("font_color", Color("e3a68a") if failed else Color("d5ccaa"))


func _close() -> void:
	get_tree().quit()


func _self_check() -> void:
	var failures: Array[String] = []
	var checks: int = 0
	_store.data = _catalog.default_save.duplicate(true)
	if not _store.persist():
		failures.append("Could not prepare isolated QA save")
	var previous: String = str(_storage.get_value(SaveStore.KEY))
	for invalid: String in ["bad json", "[]", "{}", "{\"schemaVersion\":\"not-a-number\"}", "{\"schemaVersion\":10}"]:
		checks += 1
		if _preview_text(invalid) or str(_storage.get_value(SaveStore.KEY)) != previous:
			failures.append("Invalid preview altered the current save")
	var candidate: Dictionary = _catalog.default_save.duplicate(true)
	candidate.currencies = {"copper": 1234, "gold": 7}
	candidate.totalKills = 91
	checks += 1
	if not _preview_text(JSON.stringify(candidate)) or str(_storage.get_value(SaveStore.KEY)) != previous:
		failures.append("Valid preview did not remain read-only")
	checks += 1
	if not _perform_import() or int(_store.data.currencies.copper) != 1234:
		failures.append("Confirmed import failed")
	checks += 1
	if str(_storage.get_value(SaveStore.BACKUP_KEY)) != previous:
		failures.append("Previous save backup was not retained")
	var export_path: String = _storage.directory.path_join("roundtrip-export.json")
	checks += 1
	if not _write_export(export_path) or not _same_values(JSON.parse_string(FileAccess.get_file_as_string(export_path)), _store.data):
		failures.append("Export round trip failed")
	checks += 1
	if _write_export(_storage.directory.path_join(SaveStore.KEY + ".json")):
		failures.append("Internal primary save accepted as export destination")
	print("GODOT_SAVE_TRANSFER " + JSON.stringify({"checks": checks, "failures": failures, "isolated": true}))
	get_tree().quit(0 if failures.is_empty() else 1)


func _same_values(actual: Variant, expected: Variant) -> bool:
	if expected is Dictionary:
		if not actual is Dictionary or actual.size() != expected.size():
			return false
		for key: Variant in expected:
			if not actual.has(key) or not _same_values(actual[key], expected[key]):
				return false
		return true
	if expected is Array:
		if not actual is Array or actual.size() != expected.size():
			return false
		for index: int in range(expected.size()):
			if not _same_values(actual[index], expected[index]):
				return false
		return true
	if expected is float and (actual is int or actual is float):
		return absf(float(actual) - float(expected)) <= 1e-10 * maxf(1, absf(float(expected)))
	return actual == expected
