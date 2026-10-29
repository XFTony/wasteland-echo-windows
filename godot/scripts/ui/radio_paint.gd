class_name RadioPaint
extends RefCounted
## Recreates the existing paper, cloth and radio marks with native CanvasItem drawing.

const PAPER: Color = Color("dbc69b")
const PAPER_LIGHT: Color = Color("eeddbb")
const PAPER_EDGE: Color = Color("a28a60")
const INK: Color = Color("29241e")
const COPPER: Color = Color("c29a62")
const WHITE: Color = Color("f6e9c7")
const GOLD: Color = Color("d7b75b")
const MUTED: Color = Color("c1b28d")
const ORANGE: Color = Color("b55238")


static func tag(rect: Rect2, torn: bool = false) -> PackedVector2Array:
	var x: float = rect.position.x
	var y: float = rect.position.y
	var w: float = rect.size.x
	var h: float = rect.size.y
	var notch: float = minf(7, minf(h * 0.14, w * 0.06))
	return PackedVector2Array([
		Vector2(x + notch, y), Vector2(x + w - notch * 2, y + (1 if torn else 0)),
		Vector2(x + w, y + notch), Vector2(x + w - 1, y + h - notch),
		Vector2(x + w - notch, y + h), Vector2(x + notch, y + h - (1 if torn else 0)),
		Vector2(x, y + h - notch), Vector2(x, y + notch),
	])


static func surface(
		canvas: CanvasItem, rect: Rect2, paper: bool = false,
		raised: bool = false, active: bool = false, fill: Color = Color.TRANSPARENT
) -> void:
	if raised:
		canvas.draw_colored_polygon(tag(Rect2(rect.position + Vector2(2, 4), rect.size), paper),
			Color("111610"))
	var polygon: PackedVector2Array = tag(rect, paper)
	var color: Color = fill
	if color.a == 0:
		color = PAPER if paper else Color("34362b") if active else Color("272921")
	canvas.draw_colored_polygon(polygon, color)
	var outline: PackedVector2Array = polygon.duplicate()
	outline.append(polygon[0])
	canvas.draw_polyline(outline, PAPER_EDGE if paper else Color("504f40"), 1)
	var x: float = rect.position.x
	var y: float = rect.position.y
	var w: float = rect.size.x
	var h: float = rect.size.y
	if w > 90 and h > 30:
		var count: int = mini(48, floori((w - 26) / 15))
		for i: int in range(count):
			canvas.draw_rect(Rect2(x + 13 + i * (w - 26) / maxf(1, count), y + h - 7, 3, 1),
				Color("b9a77f") if paper else Color("605f4b"))
		canvas.draw_rect(Rect2(x + 8, y + 3, maxf(0, w - 18), 2),
			Color(1, 0.957, 0.827, 0.18) if paper else Color(0.87, 0.824, 0.67, 0.035))
	if paper and w > 100:
		for i: int in range(14):
			canvas.draw_rect(Rect2(x + 12 + fmod(i * 37, maxf(1, w - 26)),
				y + 6 + fmod(i * 13, maxf(1, h - 15)), 2 + i % 3, 1), Color(0.357, 0.275, 0.161, 0.07))
		canvas.draw_colored_polygon(PackedVector2Array([
			Vector2(x + w - 14, y + 1), Vector2(x + w - 2, y + 11), Vector2(x + w - 15, y + 11),
		]), Color("af986d"))
	if active and not paper and w > 72:
		canvas.draw_rect(Rect2(x + 12, y + h - 4, minf(48, w * 0.24), 2), COPPER)


static func radio_mark(canvas: CanvasItem, position: Vector2, color: Color, scale: float) -> void:
	var center: Vector2 = position + Vector2(12, 12) * scale
	canvas.draw_arc(center, 11 * scale, -PI * 0.78, PI * 0.78, 32, color, 1.8 * scale)
	canvas.draw_arc(center, 7 * scale, -PI * 0.78, PI * 0.78, 24, color, 1.8 * scale)
	for pair: Array in [
		[Vector2(8, 21), Vector2(12, 7)], [Vector2(12, 7), Vector2(16, 21)],
		[Vector2(10, 16), Vector2(14, 16)],
	]:
		canvas.draw_line(position + pair[0] * scale, position + pair[1] * scale,
			color, 1.8 * scale)
	canvas.draw_circle(position + Vector2(12, 7) * scale, 2 * scale, color)


static func focus_ink(canvas: CanvasItem, rect: Rect2, color: Color = PAPER_LIGHT) -> void:
	canvas.draw_line(rect.position + Vector2(5, rect.size.y - 2),
		rect.end - Vector2(5, 2), color, 2)
	canvas.draw_colored_polygon(PackedVector2Array([
		rect.position + Vector2(2, rect.size.y / 2),
		rect.position + Vector2(8, rect.size.y / 2 - 4),
		rect.position + Vector2(8, rect.size.y / 2 + 4),
	]), color)
