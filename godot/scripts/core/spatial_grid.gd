class_name SpatialGrid
extends RefCounted
## Buckets and caller-owned candidate arrays are reused instead of rebuilt per query.

var cell_size: float
var columns: int
var _cells: Dictionary = {}
var _used_keys: Array[int] = []


func _init(size: float = 96.0, column_count: int = 66) -> void:
	cell_size = size
	columns = column_count


func clear() -> void:
	for key: int in _used_keys:
		_cells[key].clear()
	_used_keys.clear()


func insert(entity: Dictionary) -> void:
	_insert_cell(entity, floori(float(entity.x) / cell_size), floori(float(entity.y) / cell_size))


func insert_bounds(entity: Dictionary, minimum: Vector2, maximum: Vector2) -> void:
	for y: int in range(floori(minimum.y / cell_size), floori(maximum.y / cell_size) + 1):
		for x: int in range(floori(minimum.x / cell_size), floori(maximum.x / cell_size) + 1):
			_insert_cell(entity, x, y)


func query_circle(x: float, y: float, radius: float, output: Array) -> Array:
	output.clear()
	for cell_y: int in range(floori((y - radius) / cell_size), floori((y + radius) / cell_size) + 1):
		for cell_x: int in range(floori((x - radius) / cell_size), floori((x + radius) / cell_size) + 1):
			var key: int = cell_y * columns + cell_x
			if _cells.has(key):
				output.append_array(_cells[key])
	return output


func _insert_cell(entity: Dictionary, x: int, y: int) -> void:
	var key: int = y * columns + x
	if not _cells.has(key):
		_cells[key] = []
	if _cells[key].is_empty():
		_used_keys.append(key)
	_cells[key].append(entity)
