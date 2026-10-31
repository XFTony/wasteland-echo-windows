extends RefCounted
## Each capture starts from a fresh save without changing the player's storage.

var _values: Dictionary = {}


func get_value(key: String) -> Variant:
	return _values.get(key)


func set_value(key: String, value: String) -> bool:
	_values[key] = value
	return true
