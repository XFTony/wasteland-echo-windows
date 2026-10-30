@tool
class_name MapScene
extends Node2D
## Native map scenes expose movable obstacles without creating a second collision source.

@export var definition: MapDefinition
@export var ground: Texture2D
@export var art_profile: MapArtProfile
var visible_world: Rect2 = Rect2(0, 0, 1280, 720)
var animation_frame: int = 0
var _visuals: Dictionary = {}
var _fonts := UiFonts.new()
var _patina_regions: Array[Rect2] = []


static func render_hash(x: int, y: int) -> int:
	var a: int = RandomStream._multiply_32(x, 374761393)
	var b: int = RandomStream._multiply_32(y, 668265263)
	if a >= 0x80000000:
		a -= 0x100000000
	if b >= 0x80000000:
		b -= 0x100000000
	var sum: int = (a + b) & 0xffffffff
	var mixed: int = sum ^ (sum >> 13)
	if mixed >= 0x80000000:
		mixed -= 0x100000000
	var product: int = int(float(mixed) * 1274126177.0) & 0xffffffff
	return (product ^ (product >> 16)) & 0xffffffff


static func _interval_before(a: Vector2, b: Vector2) -> bool:
	return a.x < b.x


func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST if art_profile != null else CanvasItem.TEXTURE_FILTER_LINEAR
	if ResourceLoader.exists("res://content/game_catalog.tres"):
		var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
		_visuals = catalog.metadata.get("worldVisuals", {})
	var container: Node = get_node_or_null("Obstacles")
	var drawings: Array = _visuals.get("obstacles", {}).get(str(definition.content_id), []) if definition != null else []
	if container != null:
		for index: int in range(container.get_child_count()):
			var obstacle: MapObstacle = container.get_child(index) as MapObstacle
			if obstacle != null:
				obstacle.apply_style(art_profile)
				var source_index: int = definition.layout.obstacles.find(obstacle.source_data)
				if source_index >= 0 and source_index < drawings.size():
					obstacle.set_drawing(drawings[source_index], str(definition.content_id))
	_build_patina_regions()
	queue_redraw()


func current_layout() -> Dictionary:
	var result: Dictionary = definition.layout.duplicate(true)
	var obstacles: Array[Dictionary] = []
	var container: Node = get_node_or_null("Obstacles")
	if container != null:
		for child: Node in container.get_children():
			if child is MapObstacle:
				obstacles.append(child.collision_data())
	result.obstacles = obstacles
	return result


func update_view(rect: Rect2) -> void:
	visible_world = rect
	queue_redraw()


func _draw() -> void:
	if definition == null:
		return
	var layout: Dictionary = definition.layout
	var theme: Dictionary = layout.theme
	if art_profile == null:
		draw_rect(visible_world, Color(theme.ground))
		_painted_ground(visible_world, 0.48)
		_draw_grain()
		_draw_districts(layout, theme)
	for road: Dictionary in layout.roads:
		var rect := Rect2(float(road.x), float(road.y), float(road.w), float(road.h))
		if not visible_world.intersects(rect):
			continue
		if art_profile == null:
			draw_rect(rect, Color(theme.asphalt))
		if road.orientation == "horizontal":
			draw_rect(Rect2(rect.position.x, rect.position.y + 10, rect.size.x, 3), art_profile.road_edge if art_profile != null else Color("777064"))
			draw_rect(Rect2(rect.position.x, rect.end.y - 15, rect.size.x, 3), art_profile.road_edge if art_profile != null else Color("777064"))
			var start: int = floori((maxf(visible_world.position.x, rect.position.x) - rect.position.x) / 92)
			for index: int in range(start, ceili(rect.size.x / 92)):
				var x: float = rect.position.x + index * 92
				if x > visible_world.end.x:
					break
				draw_rect(Rect2(x, rect.get_center().y - 2, minf(48, rect.end.x - x), 3), art_profile.road_line if art_profile != null else Color("c3a663"))
		else:
			draw_rect(Rect2(rect.position.x + 10, rect.position.y, 3, rect.size.y), art_profile.road_edge if art_profile != null else Color("777064"))
			draw_rect(Rect2(rect.end.x - 15, rect.position.y, 3, rect.size.y), art_profile.road_edge if art_profile != null else Color("777064"))
			var start: int = floori((maxf(visible_world.position.y, rect.position.y) - rect.position.y) / 92)
			for index: int in range(start, ceili(rect.size.y / 92)):
				var y: float = rect.position.y + index * 92
				if y > visible_world.end.y:
					break
				draw_rect(Rect2(rect.get_center().x - 2, y, 3, minf(48, rect.end.y - y)), art_profile.road_line if art_profile != null else Color("c3a663"))
	if art_profile == null:
		for region: Rect2 in _patina_regions:
			if region.intersects(visible_world):
				_painted_ground(region.intersection(visible_world), 0.38)
	_draw_road_details(layout)
	_draw_tracks(layout)
	for zone: Dictionary in layout.zones:
		var point := Vector2(float(zone.x) + float(zone.w) / 2, float(zone.y) + 26)
		if visible_world.grow(150).has_point(point):
			_fonts.text(self, zone.label, point, 11, Color("f3ddaa"), "center", 700)
	for item: Dictionary in layout.scenery:
		var point := Vector2(item.x, item.y)
		if not visible_world.grow(100).has_point(point):
			continue
		var visual: Dictionary = _visuals.get("scenery", {}).get(item.type, {})
		if visual.is_empty():
			continue
		var period: int = int(visual.period)
		var phase: int = 1 if period > 0 and animation_frame % period >= int(visual.onFrames) else 0
		SourceDrawing.paint(self, visual.phases[phase], _fonts, point)


func _painted_ground(area: Rect2, opacity: float) -> void:
	if ground == null or not area.has_area():
		return
	var tile: float = 768
	var image_size: Vector2 = ground.get_size()
	for row: int in range(floori(area.position.y / tile), ceili(minf(definition.world_size, area.end.y) / tile)):
		for column: int in range(floori(area.position.x / tile), ceili(minf(definition.world_size, area.end.x) / tile)):
			var origin := Vector2(column * tile, row * tile)
			var region: Rect2 = area.intersection(Rect2(origin, Vector2.ONE * tile))
			var local: Vector2 = region.position - origin
			var flip_x: bool = column % 2 == 1
			var flip_y: bool = row % 2 == 1
			var uv: Vector2 = Vector2(tile - local.x - region.size.x if flip_x else local.x,
				tile - local.y - region.size.y if flip_y else local.y) / tile * image_size
			draw_set_transform(region.position + Vector2(region.size.x if flip_x else 0, region.size.y if flip_y else 0),
				0, Vector2(-1 if flip_x else 1, -1 if flip_y else 1))
			draw_texture_rect_region(ground, Rect2(Vector2.ZERO, region.size), Rect2(uv, region.size / tile * image_size), Color(1, 1, 1, opacity))
			draw_set_transform(Vector2.ZERO)


func _draw_grain() -> void:
	for row: int in range(floori(visible_world.position.y / 96), ceili(minf(definition.world_size, visible_world.end.y + 96) / 96)):
		for column: int in range(floori(visible_world.position.x / 96), ceili(minf(definition.world_size, visible_world.end.x + 96) / 96)):
			var seed: int = render_hash(column, row)
			var point := Vector2(column * 96, row * 96)
			draw_rect(Rect2(point + Vector2(seed % 78 + 5, (seed >> 8) % 72 + 6), Vector2(3, 2)),
				Color(39.0 / 255, 33.0 / 255, 25.0 / 255, 0.2) if seed % 3 == 0 else Color(226.0 / 255, 190.0 / 255, 126.0 / 255, 0.12))
			if seed % 5 == 0:
				draw_rect(Rect2(point + Vector2((seed >> 13) % 72 + 8, (seed >> 20) % 66 + 12), Vector2(8, 2)), Color(55.0 / 255, 45.0 / 255, 32.0 / 255, 0.22))


func _draw_districts(layout: Dictionary, theme: Dictionary) -> void:
	for zone: Dictionary in layout.zones:
		var rect := Rect2(zone.x, zone.y, zone.w, zone.h)
		if not visible_world.intersects(rect):
			continue
		match str(zone.surface):
			"pavement":
				draw_rect(rect, Color(theme.ground))
				for x: int in range(18, int(zone.w), 58):
					draw_rect(Rect2(float(zone.x) + x, zone.y, 2, zone.h), Color(49.0 / 255, 43.0 / 255, 34.0 / 255, 0.36))
				for y: int in range(28, int(zone.h), 64):
					draw_rect(Rect2(zone.x, float(zone.y) + y, zone.w, 2), Color(49.0 / 255, 43.0 / 255, 34.0 / 255, 0.36))
			"concrete":
				draw_rect(rect, Color(theme.concrete))
				for x: int in range(26, int(zone.w), 96):
					draw_line(Vector2(float(zone.x) + x, float(zone.y) + 8), Vector2(float(zone.x) + x - 18, float(zone.y) + float(zone.h) - 8), Color(35.0 / 255, 36.0 / 255, 33.0 / 255, 0.34), 2)
			"ballast":
				draw_rect(rect, Color(theme.ballast))
				for x: int in range(16, int(zone.w), 42):
					var seed: int = render_hash(int(zone.x) + x, int(zone.y))
					draw_rect(Rect2(float(zone.x) + x, float(zone.y) + 16 + seed % maxi(1, int(zone.h) - 32), 3, 3), Color(49.0 / 255, 44.0 / 255, 37.0 / 255, 0.36))
			"scrap":
				draw_rect(rect, Color(theme.ground))
				draw_rect(rect.grow(-8), Color(150.0 / 255, 93.0 / 255, 57.0 / 255, 0.48), false, 3)


func _draw_road_details(layout: Dictionary) -> void:
	for detail: Dictionary in layout.get("roadDetails", []):
		var rect := Rect2(detail.x, detail.y, detail.w, detail.h)
		if not visible_world.intersects(rect):
			continue
		if detail.type == "crosswalk":
			var count: int = maxi(2, int(detail.get("stripes", 6)))
			var horizontal: bool = detail.orientation == "horizontal"
			var step: float = float(detail.h if horizontal else detail.w) / count
			for index: int in range(count):
				var stripe := Rect2(Vector2(float(detail.x), float(detail.y) + floorf(index * step + 0.5)) if horizontal else Vector2(float(detail.x) + floorf(index * step + 0.5), detail.y),
					Vector2(detail.w, maxf(3, floorf(step * 0.52))) if horizontal else Vector2(maxf(3, floorf(step * 0.52)), detail.h))
				draw_rect(stripe, Color(224.0 / 255, 211.0 / 255, 169.0 / 255, 0.45))
		elif detail.type == "crack":
			var seed: int = int(detail.get("seed", render_hash(int(detail.x), int(detail.y))))
			var color := Color(22.0 / 255, 22.0 / 255, 20.0 / 255, 0.35)
			if float(detail.w) >= float(detail.h):
				var y: float = float(detail.y) + floorf(float(detail.h) * 0.55)
				draw_rect(Rect2(detail.x, y, detail.w, 3), color)
				draw_rect(Rect2(float(detail.x) + 5 + seed % maxi(6, int(detail.w) - 12), y - floorf(float(detail.h) * 0.45), 3, maxf(7, floorf(float(detail.h) * 0.7))), color)
			else:
				var x: float = float(detail.x) + floorf(float(detail.w) * 0.5)
				draw_rect(Rect2(x, detail.y, 3, detail.h), color)
				draw_rect(Rect2(x - floorf(float(detail.w) * 0.4), float(detail.y) + 5 + seed % maxi(6, int(detail.h) - 12), maxf(7, floorf(float(detail.w) * 0.7)), 3), color)


func _draw_tracks(layout: Dictionary) -> void:
	for track: Dictionary in layout.tracks:
		var rect := Rect2(track.x, track.y, track.w, track.h)
		if not visible_world.intersects(rect):
			continue
		var horizontal: bool = track.orientation == "horizontal"
		draw_rect(rect, Color(60.0 / 255, 55.0 / 255, 45.0 / 255, 0.44 if horizontal else 0.38))
		for line: int in range(int(track.lines)):
			var rail: float = (float(track.y) + 24 if horizontal else float(track.x) + 38) + line * float(track.spacing)
			if horizontal:
				draw_rect(Rect2(track.x, rail - 4, track.w, 2), Color("242624"))
				draw_rect(Rect2(track.x, rail + 5, track.w, 2), Color("242624"))
				var start: int = floori((maxf(visible_world.position.x, track.x) - float(track.x)) / 24)
				for index: int in range(start, mini(ceili(float(track.w) / 24), ceili((visible_world.end.x - float(track.x)) / 24))):
					draw_rect(Rect2(float(track.x) + index * 24, rail - 7, minf(5, float(track.w) - index * 24), 16), Color("8c7654"))
			else:
				draw_rect(Rect2(rail - 4, track.y, 2, track.h), Color("242624"))
				draw_rect(Rect2(rail + 5, track.y, 2, track.h), Color("242624"))
				var start: int = floori((maxf(visible_world.position.y, track.y) - float(track.y)) / 24)
				for index: int in range(start, mini(ceili(float(track.h) / 24), ceili((visible_world.end.y - float(track.y)) / 24))):
					draw_rect(Rect2(rail - 7, float(track.y) + index * 24, 16, minf(5, float(track.h) - index * 24)), Color("8c7654"))


func _build_patina_regions() -> void:
	_patina_regions.clear()
	if definition == null:
		return
	var rectangles: Array[Rect2] = []
	var edges: Array[float] = []
	for item: Dictionary in definition.layout.zones + definition.layout.roads:
		var rect := Rect2(item.x, item.y, item.w, item.h)
		rectangles.append(rect)
		for x: float in [rect.position.x, rect.end.x]:
			if x not in edges:
				edges.append(x)
	edges.sort()
	for index: int in range(edges.size() - 1):
		var left: float = edges[index]
		var right: float = edges[index + 1]
		var intervals: Array[Vector2] = []
		for rect: Rect2 in rectangles:
			if rect.position.x < right and rect.end.x > left:
				intervals.append(Vector2(rect.position.y, rect.end.y))
		intervals.sort_custom(_interval_before)
		var merged: Array[Vector2] = []
		for interval: Vector2 in intervals:
			if merged.is_empty() or interval.x > merged.back().y:
				merged.append(interval)
			else:
				merged[merged.size() - 1].y = maxf(merged.back().y, interval.y)
		for interval: Vector2 in merged:
			_patina_regions.append(Rect2(left, interval.x, right - left, interval.y - interval.x))
