class_name UpgradeGlyph
extends RefCounted
## Source pixel-object geometry is imported as data and drawn by native CanvasItem calls.


static func paint(canvas: CanvasItem, catalog: GameCatalog, id: String,
		center: Vector2, size: float) -> void:
	var texture: Texture2D = CombatArt.icon(catalog, id)
	if texture != null:
		canvas.draw_texture_rect(texture, Rect2(center - Vector2.ONE * size / 2, Vector2.ONE * size), false)
		return
	var scale: float = size / 64
	var origin: Vector2 = center - Vector2.ONE * size / 2
	for command: Dictionary in catalog.metadata.get("upgradeGlyphs", {}).get(id, []):
		var color := Color(command.color)
		var point: Vector2 = origin + Vector2(command.x, command.y) * scale
		if command.kind == "rect":
			canvas.draw_rect(Rect2(point, Vector2(command.w, command.h) * scale), color)
		elif bool(command.get("filled", false)):
			canvas.draw_circle(point, float(command.radius) * scale, color)
		else:
			canvas.draw_arc(point, float(command.radius) * scale, command.start, command.end,
				48, color, float(command.width) * scale)
