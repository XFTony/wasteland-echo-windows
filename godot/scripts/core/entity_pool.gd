class_name EntityPool
extends RefCounted
## Mutable payload collections belong to one entity and are cleared on every reuse.

var created: int = 0
var _template: Dictionary
var _kind: String
var _free: Array[Dictionary] = []


func _init(template: Dictionary, kind: String, warmup: int = 0) -> void:
	_template = template.duplicate(true)
	_kind = kind
	for index: int in range(warmup):
		_free.append(_create())


func acquire(values: Dictionary = {}) -> Dictionary:
	var item: Dictionary = _free.pop_back() if not _free.is_empty() else _create()
	var hit_ids: Dictionary = item.get("hitIds", {})
	for key: String in _template:
		var value: Variant = _template[key]
		if key == "hitIds":
			item[key].clear()
		elif key == "knockbackAttackIds" or key == "knockbackAttackAmounts":
			var collection: Variant = item[key]
			collection.fill(0)
			item[key] = collection
		elif value is Array:
			item[key].assign(value)
		elif value is Dictionary:
			item[key] = value.duplicate(true)
		else:
			item[key] = value
	item.merge(values, true)
	if _kind == "projectile":
		item.hitIds = hit_ids
		hit_ids.clear()
		item.critical = bool(values.get("critical", false))
		item.empowered = bool(values.get("empowered", false))
		item.hitX = null
		item.hitY = null
		for key: String in ["barrelStartX", "barrelStartY"]:
			var value: Variant = values.get(key)
			item[key] = value if (value is float or value is int) and is_finite(float(value)) else null
		var attack: Variant = values.get("attackId")
		item.attackId = int(attack) if (attack is float or attack is int) and is_finite(float(attack)) and float(attack) == floorf(float(attack)) else 0
	elif _kind == "enemy":
		for key: String in ["vx", "vy", "hitFlash", "hitCooldown", "dashTime", "navigationTime",
			"bossPhase", "knockbackVX", "knockbackVY", "knockbackAttackCursor"]:
			item[key] = 0
		item.targetStructureId = null
		item.bossPhaseId = null
	elif _kind == "pickup":
		item.age = 0
	item.active = true
	return item


func release(item: Dictionary) -> void:
	if not bool(item.get("active", false)):
		return
	item.active = false
	_free.append(item)


func stats() -> Dictionary:
	return {"created": created, "free": _free.size()}


func _create() -> Dictionary:
	created += 1
	var item: Dictionary = _template.duplicate(true)
	if _kind == "projectile":
		item.hitIds = {}
	elif _kind == "enemy":
		item.knockbackAttackIds = PackedInt32Array(item.knockbackAttackIds)
		item.knockbackAttackAmounts = PackedFloat32Array(item.knockbackAttackAmounts)
	return item
