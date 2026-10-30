class_name SourceDrawing
extends RefCounted
## Imported decorative geometry is rendered with native drawing calls, never JavaScript.


static func paint(canvas: CanvasItem, commands: Array, fonts: UiFonts,
		origin: Vector2 = Vector2.ZERO, scale: Vector2 = Vector2.ONE,
		text_only: bool = false) -> void:
	canvas.draw_set_transform(origin, 0, scale)
	for command: Dictionary in commands:
		if text_only and command.kind != "text":
			continue
		var values: Array = command.color
		var color := Color(values[0], values[1], values[2], values[3])
		match str(command.kind):
			"rect", "outline":
				var rect := Rect2(command.x, command.y, command.w, command.h)
				if rect.size.x < 0:
					rect.position.x += rect.size.x
					rect.size.x = -rect.size.x
				if rect.size.y < 0:
					rect.position.y += rect.size.y
					rect.size.y = -rect.size.y
				if rect.has_area():
					canvas.draw_rect(rect, color, command.kind == "rect", command.get("width", -1))
			"line":
				canvas.draw_line(Vector2(command.from.x, command.from.y), Vector2(command.to.x, command.to.y), color, command.width)
			"arc":
				canvas.draw_arc(Vector2(command.x, command.y), command.radius, command.start, command.end, 64, color, command.width)
			"polygon":
				var points := PackedVector2Array()
				for point: Dictionary in command.points:
					points.append(Vector2(point.x, point.y))
				if points.size() >= 3:
					canvas.draw_colored_polygon(points, color)
			"text":
				fonts.text(canvas, command.value, Vector2(command.x, command.y), command.size, color, command.align, command.weight)
	canvas.draw_set_transform(Vector2.ZERO)
