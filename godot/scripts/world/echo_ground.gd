@tool
class_name EchoGround
extends Node2D
## Continuous painted materials and cached decals share the real layout's road union.

const DrawLayer = preload("res://scripts/presentation/world_draw_layer.gd")

var profile: MapArtProfile
var world_size: float = 3072.0
var _stamps: Array[Dictionary] = []
var _surface: Node2D


static func edge_intervals(start: float, finish: float, fixed: float,
		vertical: bool, blockers: Array[Rect2]) -> Array[Vector2]:
	var segments: Array[Vector2] = [Vector2(start, finish)]
	for blocker: Rect2 in blockers:
		var perpendicular_start: float = blocker.position.x if vertical else blocker.position.y
		var perpendicular_end: float = blocker.end.x if vertical else blocker.end.y
		if fixed < perpendicular_start or fixed > perpendicular_end:
			continue
		var low: float = blocker.position.y if vertical else blocker.position.x
		var high: float = blocker.end.y if vertical else blocker.end.x
		var next: Array[Vector2] = []
		for segment: Vector2 in segments:
			if high <= segment.x or low >= segment.y:
				next.append(segment)
				continue
			if low > segment.x:
				next.append(Vector2(segment.x, low))
			if high < segment.y:
				next.append(Vector2(high, segment.y))
		segments = next
	return segments


func configure(layout: Dictionary, style: MapArtProfile, extent: float) -> void:
	profile = style
	world_size = extent
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	var surface_material: ShaderMaterial = profile.painted_ground_material.duplicate() as ShaderMaterial
	surface_material.set_shader_parameter("terrain_texture", profile.painted_ground_texture)
	var roads := PackedVector4Array()
	var paving := PackedVector4Array()
	var ballast := PackedVector4Array()
	for road: Dictionary in layout.roads:
		roads.append(Vector4(road.x, road.y, road.w, road.h))
	for zone: Dictionary in layout.zones:
		if zone.surface in ["pavement", "concrete"]:
			paving.append(Vector4(zone.x, zone.y, zone.w, zone.h))
		elif zone.surface == "ballast":
			ballast.append(Vector4(zone.x, zone.y, zone.w, zone.h))
	surface_material.set_shader_parameter("road_count", mini(8, roads.size()))
	surface_material.set_shader_parameter("pavement_count", mini(8, paving.size()))
	surface_material.set_shader_parameter("ballast_count", mini(4, ballast.size()))
	roads.resize(8)
	paving.resize(8)
	ballast.resize(4)
	surface_material.set_shader_parameter("roads", roads)
	surface_material.set_shader_parameter("pavements", paving)
	surface_material.set_shader_parameter("ballast_zones", ballast)
	_surface = DrawLayer.new()
	_surface.name = "ContinuousSurface"
	_surface.paint = _paint_surface
	_surface.material = surface_material
	_surface.z_index = -1
	add_child(_surface)
	_build_stamps(layout)
	queue_redraw()


func _draw() -> void:
	if profile == null or profile.ground_decals == null:
		return
	for stamp: Dictionary in _stamps:
		draw_set_transform(stamp.center, stamp.angle)
		draw_texture_rect_region(profile.ground_decals, Rect2(-stamp.size / 2, stamp.size),
			profile.ground_regions[stamp.key], stamp.color)
	draw_set_transform(Vector2.ZERO)


func _paint_surface(canvas: CanvasItem) -> void:
	canvas.draw_texture_rect(profile.painted_ground_texture,
		Rect2(Vector2.ZERO, Vector2.ONE * world_size), false)


func _build_stamps(layout: Dictionary) -> void:
	_stamps.clear()
	var roads: Array[Rect2] = []
	for road: Dictionary in layout.roads:
		roads.append(Rect2(road.x, road.y, road.w, road.h))
	for index: int in range(roads.size()):
		var road: Rect2 = roads[index]
		var horizontal: bool = road.size.x > road.size.y
		var others: Array[Rect2] = []
		for other: int in range(roads.size()):
			if other != index:
				others.append(roads[other].grow(10))
		for side: int in range(2):
			var fixed: float = (road.position.y if side == 0 else road.end.y) if horizontal else (road.position.x if side == 0 else road.end.x)
			var start: float = road.position.x if horizontal else road.position.y
			var finish: float = road.end.x if horizontal else road.end.y
			for interval: Vector2 in edge_intervals(start, finish, fixed, not horizontal, others):
				var cursor: float = interval.x
				while cursor < interval.y - 14:
					var length: float = minf(116, interval.y - cursor)
					var center: Vector2 = Vector2(cursor + length / 2, fixed) if horizontal else Vector2(fixed, cursor + length / 2)
					var angle: float = (0.0 if side == 0 else PI) if horizontal else (-PI / 2 if side == 0 else PI / 2)
					_stamp("curb", center, Vector2(length + 1, 19), angle, Color(0.80, 0.78, 0.70, 0.95))
					cursor += length
		var run_length: float = road.size.x if horizontal else road.size.y
		for distance: int in range(45, int(run_length) - 30, 112):
			var center: Vector2 = road.position + Vector2(distance, road.size.y / 2) if horizontal else road.position + Vector2(road.size.x / 2, distance)
			var crossing: bool = false
			for other: Rect2 in others:
				if other.has_point(center):
					crossing = true
			if not crossing:
				_stamp("stripe", center, Vector2(43, 6), 0.0 if horizontal else PI / 2, Color(0.88, 0.83, 0.67, 0.60))
	for detail: Dictionary in layout.get("roadDetails", []):
		var rect := Rect2(detail.x, detail.y, detail.w, detail.h)
		_stamp("crosswalk" if detail.type == "crosswalk" else "crack", rect.get_center(),
			rect.size * (0.90 if detail.type == "crosswalk" else 1.6), 0, Color(0.79, 0.78, 0.70, 0.60))
	for obstacle: Dictionary in layout.obstacles:
		var rect := Rect2(obstacle.x, obstacle.y, obstacle.w, obstacle.h)
		var vehicle: bool = obstacle.kind in ["car", "wreck", "bus", "railcar", "container"]
		_stamp("oil" if vehicle else "contact", Vector2(rect.get_center().x + 6, rect.end.y - 3),
			Vector2(rect.size.x + 36, minf(70, rect.size.y * 0.42 + 26)), 0,
			Color(0.57, 0.53, 0.43, 0.62 if vehicle else 0.48))
		if not vehicle and rect.size.x > 100:
			_stamp("paving_edge", Vector2(rect.position.x + 14, rect.end.y + 8), Vector2(62, 27), 0, Color(0.8, 0.77, 0.67, 0.60))
	for track: Dictionary in layout.tracks:
		for line: int in range(int(track.lines)):
			for x: int in range(int(track.x), int(float(track.x) + float(track.w)), 150):
				_stamp("rail", Vector2(x + 75, float(track.y) + 24 + line * float(track.spacing)),
					Vector2(151, 34), 0, Color(0.77, 0.74, 0.65, 0.95))


func _stamp(key: String, center: Vector2, dimensions: Vector2, angle: float, color: Color) -> void:
	_stamps.append({"key": key, "center": center, "size": dimensions, "angle": angle, "color": color})
