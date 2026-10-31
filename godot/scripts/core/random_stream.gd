class_name RandomStream
extends RefCounted
## Reproduces the existing Mulberry32 stream rather than changing seeded runs.

const MASK_32: int = 0xffffffff
var state: int = 1


static func _multiply_32(a: int, b: int) -> int:
	var low: int = (a & 0xffff) * (b & 0xffff)
	var cross: int = ((a >> 16) * (b & 0xffff) + (b >> 16) * (a & 0xffff)) << 16
	return (low + cross) & MASK_32


func _init(seed_value: int = 1) -> void:
	state = (seed_value if seed_value != 0 else 1) & MASK_32
	if state == 0:
		state = 0x6d2b79f5


func next() -> float:
	state = (state + 0x6d2b79f5) & MASK_32
	var value: int = _multiply_32(state ^ (state >> 15), state | 1)
	value = value ^ ((value + _multiply_32(value ^ (value >> 7), value | 61)) & MASK_32)
	return float((value ^ (value >> 14)) & MASK_32) / 4294967296.0


func range_float(minimum: float, maximum: float) -> float:
	return minimum + (maximum - minimum) * next()


func range_int(minimum: int, maximum: int) -> int:
	return floori(range_float(minimum, maximum + 1))


func weighted(items: Array, weight_key: String = "weight") -> Variant:
	if items.is_empty():
		return null
	var total: float = 0.0
	for item: Dictionary in items:
		total += maxf(0.0, float(item.get(weight_key, 1)))
	if total <= 0.0:
		return items[0]
	var cursor: float = next() * total
	for item: Dictionary in items:
		cursor -= maxf(0.0, float(item.get(weight_key, 1)))
		if cursor <= 0.0:
			return item
	return items.back()
