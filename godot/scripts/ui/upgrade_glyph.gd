class_name UpgradeGlyph
extends RefCounted
## Source pixel-object geometry is imported as data and drawn by native CanvasItem calls.

static var _ink_regions: Dictionary = {}


static func bitmap_ink(texture: Texture2D) -> Rect2:
	var key: String = texture.resource_path
	if not _ink_regions.has(key):
		var image: Image = texture.get_image()
		if image.is_compressed():
			image.decompress()
		var minimum := Vector2i(image.get_width(), image.get_height())
		var maximum := Vector2i.ZERO
		for y: int in range(image.get_height()):
			for x: int in range(image.get_width()):
				if image.get_pixel(x, y).a > 0.2:
					minimum = minimum.min(Vector2i(x, y))
					maximum = maximum.max(Vector2i(x + 1, y + 1))
		_ink_regions[key] = Rect2(Vector2(minimum), Vector2(maximum - minimum)) if maximum.x > minimum.x else Rect2(Vector2.ZERO, texture.get_size())
	return _ink_regions[key]


static func fitted_bitmap_rect(texture: Texture2D, region: Rect2) -> Rect2:
	var source: Rect2 = bitmap_ink(texture)
	var inside: Rect2 = region.grow(-minf(region.size.x, region.size.y) * 0.07)
	var factor: float = minf(inside.size.x / source.size.x, inside.size.y / source.size.y)
	var dimensions: Vector2 = source.size * factor
	return Rect2(inside.get_center() - dimensions / 2, dimensions)


static func paint_in_region(canvas: CanvasItem, catalog: GameCatalog, id: String, region: Rect2) -> void:
	var texture: Texture2D = CombatArt.icon(catalog, id)
	if texture != null:
		canvas.draw_texture_rect_region(texture, fitted_bitmap_rect(texture, region), bitmap_ink(texture))
	else:
		paint(canvas, catalog, id, region.get_center(), minf(region.size.x, region.size.y) * 0.86)


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
