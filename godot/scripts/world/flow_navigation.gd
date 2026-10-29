class_name FlowNavigation
extends RefCounted
## Shared BFS flow preserves the reference clearance grid and deterministic tie order.

const CARDINAL: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP]
const FLOW: Array[Vector2i] = [Vector2i.RIGHT, Vector2i.LEFT, Vector2i.DOWN, Vector2i.UP,
	Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1)]

var world_size: float
var cell_size: int
var clearance: float
var columns: int
var rows: int
var walkable: PackedByteArray
var distances: PackedInt32Array
var direction_x: PackedInt32Array
var direction_y: PackedInt32Array
var target_index: int = -1
var rebuild_count: int = 0
var _queue: PackedInt32Array


func _init(layout: Dictionary, size: int = 64, padding: float = 32.0) -> void:
	world_size = float(layout.worldSize)
	cell_size = maxi(16, size)
	clearance = maxf(0, padding)
	columns = ceili(world_size / cell_size)
	rows = columns
	var count: int = columns * rows
	walkable.resize(count)
	walkable.fill(1)
	distances.resize(count)
	direction_x.resize(count)
	direction_y.resize(count)
	_queue.resize(count)
	_bake(layout.obstacles)
	clear()


func clear() -> void:
	distances.fill(-1)
	direction_x.fill(0)
	direction_y.fill(0)
	target_index = -1


func is_walkable(x: int, y: int) -> bool:
	return x >= 0 and y >= 0 and x < columns and y < rows and walkable[y * columns + x] == 1


func world_index(x: float, y: float) -> int:
	return clampi(floori(y / cell_size), 0, rows - 1) * columns + clampi(floori(x / cell_size), 0, columns - 1)


func nearest_walkable(x: float, y: float, maximum_radius: int = 5) -> int:
	var origin_x: int = clampi(floori(x / cell_size), 0, columns - 1)
	var origin_y: int = clampi(floori(y / cell_size), 0, rows - 1)
	if is_walkable(origin_x, origin_y):
		return origin_y * columns + origin_x
	for radius: int in range(1, maximum_radius + 1):
		for offset_y: int in range(-radius, radius + 1):
			for offset_x: int in range(-radius, radius + 1):
				if maxi(absi(offset_x), absi(offset_y)) != radius:
					continue
				if is_walkable(origin_x + offset_x, origin_y + offset_y):
					return (origin_y + offset_y) * columns + origin_x + offset_x
	return -1


func rebuild(x: float, y: float) -> bool:
	clear()
	target_index = nearest_walkable(x, y)
	if target_index < 0:
		return false
	distances[target_index] = 0
	var read: int = 0
	var write: int = 1
	_queue[0] = target_index
	while read < write:
		var index: int = _queue[read]
		read += 1
		var cell_x: int = index % columns
		var cell_y: int = index / columns
		for direction: Vector2i in CARDINAL:
			var next_x: int = cell_x + direction.x
			var next_y: int = cell_y + direction.y
			if not is_walkable(next_x, next_y):
				continue
			var next_index: int = next_y * columns + next_x
			if distances[next_index] != -1:
				continue
			distances[next_index] = distances[index] + 1
			_queue[write] = next_index
			write += 1
	for index: int in range(distances.size()):
		var distance: int = distances[index]
		if distance <= 0:
			continue
		var cell_x: int = index % columns
		var cell_y: int = index / columns
		var best: int = distance
		for direction: Vector2i in FLOW:
			var next_x: int = cell_x + direction.x
			var next_y: int = cell_y + direction.y
			if not is_walkable(next_x, next_y):
				continue
			if direction.x != 0 and direction.y != 0:
				if not is_walkable(cell_x + direction.x, cell_y) or not is_walkable(cell_x, cell_y + direction.y):
					continue
			var value: int = distances[next_y * columns + next_x]
			if value >= 0 and value < best:
				best = value
				direction_x[index] = direction.x
				direction_y[index] = direction.y
	rebuild_count += 1
	return true


func sample_index(x: float, y: float) -> int:
	var index: int = world_index(x, y)
	if distances[index] >= 0:
		return index
	var nearest: int = nearest_walkable(x, y, 2)
	return nearest if nearest >= 0 and distances[nearest] >= 0 else -1


func _bake(obstacles: Array) -> void:
	for cell_y: int in range(rows):
		var center_y: float = (cell_y + 0.5) * cell_size
		for cell_x: int in range(columns):
			var center_x: float = (cell_x + 0.5) * cell_size
			var index: int = cell_y * columns + cell_x
			if center_x < clearance or center_y < clearance or center_x > world_size - clearance or center_y > world_size - clearance:
				walkable[index] = 0
				continue
			for obstacle: Dictionary in obstacles:
				var inside: bool = center_x >= float(obstacle.x) - clearance
				inside = inside and center_x <= float(obstacle.x) + float(obstacle.w) + clearance
				inside = inside and center_y >= float(obstacle.y) - clearance
				inside = inside and center_y <= float(obstacle.y) + float(obstacle.h) + clearance
				var crossed: bool = minf(world_size, (cell_x + 1) * cell_size) > float(obstacle.x)
				crossed = crossed and cell_x * cell_size < float(obstacle.x) + float(obstacle.w)
				crossed = crossed and minf(world_size, (cell_y + 1) * cell_size) > float(obstacle.y)
				crossed = crossed and cell_y * cell_size < float(obstacle.y) + float(obstacle.h)
				if inside or crossed:
					walkable[index] = 0
					break
