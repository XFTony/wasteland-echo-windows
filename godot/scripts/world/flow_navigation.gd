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
var _neighbors: PackedInt32Array


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
	_bake_neighbors()
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


func is_world_walkable(x: float, y: float) -> bool:
	return walkable[world_index(x, y)] == 1


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
		var offset: int = index * 8
		for slot: int in range(4):
			var next_index: int = _neighbors[offset + slot]
			if next_index < 0:
				continue
			if distances[next_index] != -1:
				continue
			distances[next_index] = distances[index] + 1
			_queue[write] = next_index
			write += 1
	for index: int in range(distances.size()):
		var distance: int = distances[index]
		if distance <= 0:
			continue
		var best: int = distance
		var offset: int = index * 8
		for slot: int in range(8):
			var neighbor: int = _neighbors[offset + slot]
			if neighbor < 0:
				continue
			var value: int = distances[neighbor]
			if value >= 0 and value < best:
				best = value
				direction_x[index] = FLOW[slot].x
				direction_y[index] = FLOW[slot].y
	rebuild_count += 1
	return true


func sample_index(x: float, y: float) -> int:
	var index: int = world_index(x, y)
	if distances[index] >= 0:
		return index
	var nearest: int = nearest_walkable(x, y, 2)
	return nearest if nearest >= 0 and distances[nearest] >= 0 else -1


func _bake(obstacles: Array) -> void:
	# The grid is immutable until world geometry changes; avoid repeated dictionary access.
	var bounds := PackedFloat64Array()
	bounds.resize(obstacles.size() * 4)
	for index: int in range(obstacles.size()):
		var obstacle: Dictionary = obstacles[index]
		bounds[index * 4] = float(obstacle.x)
		bounds[index * 4 + 1] = float(obstacle.y)
		bounds[index * 4 + 2] = float(obstacle.x) + float(obstacle.w)
		bounds[index * 4 + 3] = float(obstacle.y) + float(obstacle.h)
	for cell_y: int in range(rows):
		var center_y: float = (cell_y + 0.5) * cell_size
		var minimum_y: float = cell_y * cell_size
		var maximum_y: float = minf(world_size, (cell_y + 1) * cell_size)
		for cell_x: int in range(columns):
			var center_x: float = (cell_x + 0.5) * cell_size
			var minimum_x: float = cell_x * cell_size
			var maximum_x: float = minf(world_size, (cell_x + 1) * cell_size)
			var index: int = cell_y * columns + cell_x
			if center_x < clearance or center_y < clearance or center_x > world_size - clearance or center_y > world_size - clearance:
				walkable[index] = 0
				continue
			for offset: int in range(0, bounds.size(), 4):
				var inside: bool = center_x >= bounds[offset] - clearance and center_x <= bounds[offset + 2] + clearance
				inside = inside and center_y >= bounds[offset + 1] - clearance and center_y <= bounds[offset + 3] + clearance
				var crossed: bool = maximum_x > bounds[offset] and minimum_x < bounds[offset + 2]
				crossed = crossed and maximum_y > bounds[offset + 1] and minimum_y < bounds[offset + 3]
				if inside or crossed:
					walkable[index] = 0
					break


func _bake_neighbors() -> void:
	_neighbors.resize(walkable.size() * 8)
	_neighbors.fill(-1)
	for index: int in range(walkable.size()):
		if walkable[index] == 0:
			continue
		var x: int = index % columns
		var y: int = index / columns
		for slot: int in range(8):
			var direction: Vector2i = FLOW[slot]
			var next_x: int = x + direction.x
			var next_y: int = y + direction.y
			if not is_walkable(next_x, next_y):
				continue
			if direction.x != 0 and direction.y != 0 and (not is_walkable(next_x, y) or not is_walkable(x, next_y)):
				continue
			_neighbors[index * 8 + slot] = next_y * columns + next_x
