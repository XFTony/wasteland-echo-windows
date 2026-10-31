class_name GeometryRules
extends RefCounted
## Scalar geometry retains double precision in the fixed-step simulation.

enum InteractiveMode { NONE, ALL, AIM }


static func distance_squared(ax: float, ay: float, bx: float, by: float) -> float:
	return (bx - ax) * (bx - ax) + (by - ay) * (by - ay)


static func circle_rect_push_out(circle: Dictionary, rect: Dictionary) -> bool:
	var nearest_x: float = clampf(float(circle.x), float(rect.x), float(rect.x) + float(rect.w))
	var nearest_y: float = clampf(float(circle.y), float(rect.y), float(rect.y) + float(rect.h))
	var dx: float = float(circle.x) - nearest_x
	var dy: float = float(circle.y) - nearest_y
	var distance: float = sqrt(dx * dx + dy * dy)
	if distance >= float(circle.radius):
		return false
	if distance < 0.0001:
		var edges: Array[float] = [absf(float(circle.x) - float(rect.x)),
			absf(float(rect.x) + float(rect.w) - float(circle.x)),
			absf(float(circle.y) - float(rect.y)),
			absf(float(rect.y) + float(rect.h) - float(circle.y))]
		match edges.find(edges.min()):
			0:
				circle.x = float(rect.x) - float(circle.radius)
			1:
				circle.x = float(rect.x) + float(rect.w) + float(circle.radius)
			2:
				circle.y = float(rect.y) - float(circle.radius)
			3:
				circle.y = float(rect.y) + float(rect.h) + float(circle.radius)
		return true
	var overlap: float = float(circle.radius) - distance
	circle.x += dx / distance * overlap
	circle.y += dy / distance * overlap
	return true


static func segment_circle_time(
		x: float, y: float, dx: float, dy: float, cx: float, cy: float, radius: float
) -> float:
	var ox: float = x - cx
	var oy: float = y - cy
	var a: float = dx * dx + dy * dy
	var c: float = ox * ox + oy * oy - radius * radius
	if c <= 0:
		return 0
	if a < 1e-10:
		return INF
	var b: float = ox * dx + oy * dy
	var discriminant: float = b * b - a * c
	if discriminant < 0:
		return INF
	var result: float = (-b - sqrt(discriminant)) / a
	return result if result >= 0 and result <= 1 else INF


static func segment_rect_time(
		x: float, y: float, dx: float, dy: float, rect: Dictionary, padding: float = 0.0
) -> float:
	var low: float = 0.0
	var high: float = 1.0
	for axis: int in range(2):
		var start: float = x if axis == 0 else y
		var delta: float = dx if axis == 0 else dy
		var minimum: float = float(rect.x if axis == 0 else rect.y) - padding
		var maximum: float = minimum + float(rect.w if axis == 0 else rect.h) + padding * 2
		if absf(delta) < 1e-10:
			if start < minimum or start > maximum:
				return INF
		else:
			var a: float = (minimum - start) / delta
			var b: float = (maximum - start) / delta
			low = maxf(low, minf(a, b))
			high = minf(high, maxf(a, b))
			if low > high:
				return INF
	return low


static func first_obstacle_time(
		obstacles: Array, x: float, y: float, dx: float, dy: float,
		padding: float = 0.0, interactive_mode: InteractiveMode = InteractiveMode.NONE
) -> float:
	var first: float = INF
	for obstacle: Dictionary in obstacles:
		if obstacle.get("interactiveId") != null and interactive_mode != InteractiveMode.NONE:
			if interactive_mode != InteractiveMode.AIM or not bool(obstacle.get("blocksAim", false)):
				continue
		first = minf(first, segment_rect_time(x, y, dx, dy, obstacle, padding))
	return first


static func sector_contains(
		x: float, y: float, radius: float, angle: float, arc: float, circle: Dictionary
) -> bool:
	var dx: float = float(circle.x) - x
	var dy: float = float(circle.y) - y
	var distance: float = sqrt(dx * dx + dy * dy)
	var padding: float = float(circle.get("radius", 0))
	if distance > radius + padding:
		return false
	if distance <= padding:
		return true
	var delta: float = absf(fposmod(atan2(dy, dx) - angle + PI, TAU) - PI)
	if delta <= arc / 2:
		return true
	var edge: float = delta - arc / 2
	var projection: float = clampf(distance * cos(edge), 0, radius)
	return distance * distance + projection * projection - 2 * distance * projection * cos(edge) <= padding * padding


static func segment_sector_time(
		x: float, y: float, dx: float, dy: float, cx: float, cy: float,
		radius: float, angle: float, arc: float, padding: float = 0.0
) -> float:
	var ox: float = x - cx
	var oy: float = y - cy
	var rr: float = radius + padding
	var a: float = dx * dx + dy * dy
	if a < 1e-12:
		return 0.0 if sector_contains(cx, cy, radius, angle, arc, {"x": x, "y": y, "radius": padding}) else INF
	var b: float = ox * dx + oy * dy
	var c: float = ox * ox + oy * oy - rr * rr
	var discriminant: float = b * b - a * c
	if discriminant < 0:
		return INF
	var root: float = sqrt(discriminant)
	var low: float = maxf(0, (-b - root) / a)
	var high: float = minf(1, (-b + root) / a)
	for pair: Array in [[angle - arc / 2, 1.0], [angle + arc / 2, -1.0]]:
		var ex: float = cos(float(pair[0]))
		var ey: float = sin(float(pair[0]))
		var value: float = float(pair[1]) * (ex * oy - ey * ox) + padding
		var slope: float = float(pair[1]) * (ex * dy - ey * dx)
		if absf(slope) < 1e-12:
			if value < 0:
				return INF
		elif slope > 0:
			low = maxf(low, -value / slope)
		else:
			high = minf(high, -value / slope)
	return low if low <= high else INF
