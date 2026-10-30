class_name SaveStore
extends RefCounted
## Corrupt originals are retained before any normalization or recovery write.

const KEY: String = "wasteland_echo_save_v1"
const BACKUP_KEY: String = KEY + "_backup"
const DAMAGED_KEY: String = KEY + "_damaged"

var data: Dictionary = {}
var status: String = "ok"
var read_only: bool = false
var _storage: RefCounted
var _defaults: Dictionary
var _legacy_maps: Dictionary


func _init(catalog: GameCatalog, storage: RefCounted = null) -> void:
	_defaults = catalog.default_save
	_legacy_maps = catalog.metadata.survival.legacyMaps
	_storage = storage if storage != null else FileStorage.new()
	data = _defaults.duplicate(true)


func load_save() -> Dictionary:
	status = "ok"
	read_only = false
	var primary: Variant = _storage.call("get_value", KEY)
	var backup: Variant = _storage.call("get_value", BACKUP_KEY)
	if primary is Dictionary or backup is Dictionary:
		read_only = true
		status = "write-failed"
		data = _defaults.duplicate(true)
		return data
	var parsed: Dictionary = _parse(primary)
	if parsed.valid:
		data = parsed.data
		return data
	if primary == null or str(primary).is_empty():
		var fallback: Dictionary = _parse(backup)
		if fallback.valid:
			data = fallback.data
			status = "recovered"
		elif backup != null and not str(backup).is_empty():
			data = _defaults.duplicate(true)
			status = "damaged"
		return data
	var retained: Variant = _storage.call("get_value", DAMAGED_KEY)
	if retained != null and retained != primary:
		read_only = true
	elif retained == null and not bool(_storage.call("set_value", DAMAGED_KEY, primary)):
		read_only = true
	var recovery: Dictionary = _parse(backup)
	data = recovery.data if recovery.valid else _defaults.duplicate(true)
	status = "write-failed" if read_only else "recovered" if recovery.valid else "damaged"
	return data


func persist() -> bool:
	if read_only:
		return false
	var previous: Variant = _storage.call("get_value", KEY)
	if previous is Dictionary:
		status = "write-failed"
		return false
	if _parse(previous).valid:
		if not bool(_storage.call("set_value", BACKUP_KEY, previous)):
			status = "write-failed"
			return false
	var result: bool = bool(_storage.call("set_value", KEY, JSON.stringify(data, "", false, true)))
	if not result:
		status = "write-failed"
	elif status == "write-failed":
		status = "ok"
	return result


func preview_import(text: String) -> Dictionary:
	var parsed: Dictionary = _parse(text)
	if not parsed.valid:
		return {"ok": false, "reason": "无效存档JSON，未修改当前数据"}
	return {"ok": true, "data": parsed.data, "current": data.duplicate(true)}


func import_confirmed(text: String) -> bool:
	var preview: Dictionary = preview_import(text)
	if not preview.ok or read_only:
		return false
	var previous: Dictionary = data
	data = preview.data
	if not persist():
		data = previous
		return false
	return true


func _parse(value: Variant) -> Dictionary:
	if not value is String or value.is_empty():
		return {"valid": false}
	var parser := JSON.new()
	if parser.parse(value) != OK or not parser.data is Dictionary:
		return {"valid": false}
	return {"valid": true, "data": SaveCodec.normalize(parser.data, _defaults, _legacy_maps)}
