extends SceneTree
## Source sheets are retained; this tool only crops and scales approved bitmap artwork.

const ROOT: String = "res://../art/combat/fieldcraft-v2/"
const ICON_GROUPS: Array[Array] = [
	["damage", "fireRate", "projectile", "pierce", "velocity", "caliber", "critical", "speed", "vitality", "magnet", "armor", "recovery", "scavenger", "phaseLining", "meleeReach", "blastRadius"],
	["engineering", "turretRepair", "endlessPower", "endlessVitality", "endlessSupplies", "endlessAid", "executionCapacitor", "reactivePlating", "salvageOverdrive", "pointBlankRelay", "focusProtocol", "cascadeRounds", "penetratorDoctrine", "swarmProtocol", "recoveryField", "phaseAegis"],
	["kineticLoop", "arcNetwork", "critDamage", "killMend", "meleeTempo", "ricochetCoil", "chillAmplifier", "blastFocus", "fieldRush", "pressureBarrel"],
]


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	if "--references" in OS.get_cmdline_user_args():
		_reference_sheet()
		quit()
		return
	var frames: Image = Image.load_from_file(ROOT + "sources/cards.png")
	for index: int in range(6):
		var card: Image = _cell(frames, index, 3, 2)
		card.resize(256, 384, Image.INTERPOLATE_NEAREST)
		_save(card, "res://assets/ui/fieldcraft-v2/frame-%d.webp" % index)
	for group: int in range(ICON_GROUPS.size()):
		var sheet: Image = Image.load_from_file(ROOT + "sources/icons-%d.png" % group)
		for index: int in range(ICON_GROUPS[group].size()):
			var item: Image = _cell(sheet, index, 4, 3 if group == 2 else 4)
			item = _fit(item, Vector2i(112, 112), 5)
			_save(item, "res://assets/ui/fieldcraft-v2/upgrades/%s.webp" % ICON_GROUPS[group][index])
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var weapons: Array[String] = ["prism_laser", "slag_launcher", "saw_disc", "echo_blade", "shock_hammer", "ratchet_crossbow", "frost_projector", "breach_spear", "rust_cleaver", "ember_sprayer", "arc_repeater", "scrap_knuckles", "reaper_scythe"]
	var weapon_sheet: Image = Image.load_from_file(ROOT + "sources/weapons.png")
	for index: int in range(weapons.size()):
		var id: String = weapons[index]
		var spec: Dictionary = catalog.metadata.poses[id].definition.visual
		var tile: Image = _cell(weapon_sheet, index, 4, 4)
		if id == "reaper_scythe":
			tile = weapon_sheet.get_region(Rect2i(0, weapon_sheet.get_height() * 3 / 4, weapon_sheet.get_width() / 2, weapon_sheet.get_height() / 4))
		var canvas: Image = _weapon_fit(tile, spec)
		_save(canvas, "res://assets/weapons/fieldcraft-v2/%s.webp" % id)
	_death_assets(catalog)
	print("FIELDCRAFT_BITMAPS 6 frames, 42 unique upgrade illustrations, 13 weapon textures, 8 death strips")
	quit()


func _cell(sheet: Image, index: int, columns: int, rows: int) -> Image:
	var cell_width: int = sheet.get_width() / columns
	var cell_height: int = sheet.get_height() / rows
	return sheet.get_region(Rect2i((index % columns) * cell_width, (index / columns) * cell_height, cell_width, cell_height))


func _fit(image: Image, target: Vector2i, margin: int) -> Image:
	var used: Rect2i = _opaque_rect(image)
	var cropped: Image = image.get_region(used)
	var ratio: float = minf(float(target.x - margin * 2) / maxi(1, used.size.x), float(target.y - margin * 2) / maxi(1, used.size.y))
	var dimensions: Vector2i = Vector2i(Vector2(used.size) * ratio).max(Vector2i.ONE)
	cropped.resize(dimensions.x, dimensions.y, Image.INTERPOLATE_NEAREST)
	var canvas: Image = Image.create_empty(target.x, target.y, false, Image.FORMAT_RGBA8)
	canvas.blit_rect(cropped, Rect2i(Vector2i.ZERO, dimensions), (target - dimensions) / 2)
	return canvas


func _save(image: Image, filename: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(filename.get_base_dir()))
	var error: Error = image.save_webp(filename, false)
	if error != OK:
		push_error("Cannot save runtime art: " + filename)
		quit(1)


func _weapon_fit(image: Image, spec: Dictionary) -> Image:
	var used: Rect2i = _opaque_rect(image)
	var cropped: Image = image.get_region(used)
	var target := Vector2i(int(spec.width) * 2, int(spec.height) * 2)
	var ratio: float = minf(float(target.x - 4) / used.size.x, float(target.y - 4) / used.size.y)
	var dimensions: Vector2i = Vector2i(Vector2(used.size) * ratio).max(Vector2i.ONE)
	var tip_sum: float = 0
	var tip_count: int = 0
	for x: int in range(maxi(0, used.size.x - 5), used.size.x):
		for y: int in range(used.size.y):
			if cropped.get_pixel(x, y).a > 0.25:
				tip_sum += y
				tip_count += 1
	var tip_y: float = tip_sum / maxi(1, tip_count)
	cropped.resize(dimensions.x, dimensions.y, Image.INTERPOLATE_NEAREST)
	var offset := Vector2i(roundi(float(spec.muzzle[0]) * 2 - dimensions.x + 1), roundi(float(spec.muzzle[1]) * 2 - tip_y * ratio))
	offset = offset.clamp(Vector2i.ZERO, target - dimensions)
	var canvas: Image = Image.create_empty(target.x, target.y, false, Image.FORMAT_RGBA8)
	canvas.blit_rect(cropped, Rect2i(Vector2i.ZERO, dimensions), offset)
	return canvas


func _opaque_rect(image: Image) -> Rect2i:
	var minimum := Vector2i(image.get_width(), image.get_height())
	var maximum := Vector2i.ZERO
	for y: int in range(image.get_height()):
		for x: int in range(image.get_width()):
			if image.get_pixel(x, y).a > 0.2:
				minimum = minimum.min(Vector2i(x, y))
				maximum = maximum.max(Vector2i(x + 1, y + 1))
	return Rect2i(minimum, maximum - minimum) if maximum.x > minimum.x else Rect2i(0, 0, image.get_width(), image.get_height())


func _death_assets(catalog: GameCatalog) -> void:
	var names: Array[String] = ["drifter", "runner", "spitter", "brute", "screecher", "crawler", "warden", "iron_colossus"]
	for group: int in range(2):
		var sheet: Image = Image.load_from_file(ROOT + "sources/death-%d.png" % group)
		var bands: Array[Vector2i] = _row_bands(sheet)
		if bands.size() != 4:
			push_error("Death sheet must contain four separated character rows")
			quit(1)
			return
		for row: int in range(4):
			var id: String = names[group * 4 + row]
			var height: int = bands[row].y - bands[row].x
			var cell_width: int = sheet.get_width() / 4
			var first: Image = sheet.get_region(Rect2i(0, bands[row].x, cell_width, height))
			var ratio: float = float(catalog.metadata.actorMetadata.ENEMY_SPRITES[id].referenceHeight) / maxi(1, first.get_used_rect().size.y)
			var dimensions: Vector2i = Vector2i(Vector2(cell_width, height) * ratio).max(Vector2i.ONE)
			var atlas: Image = Image.create_empty(512, 128, false, Image.FORMAT_RGBA8)
			for frame_index: int in range(4):
				var frame: Image = sheet.get_region(Rect2i(frame_index * cell_width, bands[row].x, cell_width, height))
				var baseline: int = roundi(float(frame.get_used_rect().end.y) * ratio)
				frame.resize(dimensions.x, dimensions.y, Image.INTERPOLATE_NEAREST)
				atlas.blit_rect(frame, Rect2i(Vector2i.ZERO, dimensions), Vector2i(frame_index * 128 + (128 - dimensions.x) / 2, 104 - baseline))
			_save(atlas, "res://assets/actors/fieldcraft-v2/%s-death.webp" % id)


func _row_bands(image: Image) -> Array[Vector2i]:
	var groups: Array[Vector2i] = []
	var start: int = -1
	var last: int = -1
	for y: int in range(image.get_height()):
		var count: int = 0
		for x: int in range(image.get_width()):
			if image.get_pixel(x, y).a > 0.2:
				count += 1
		if count >= 4:
			if start < 0:
				start = y
			last = y
		elif start >= 0 and y - last > 12:
			groups.append(Vector2i(start, last + 1))
			start = -1
	if start >= 0:
		groups.append(Vector2i(start, last + 1))
	return groups


func _reference_sheet() -> void:
	var names: Array[String] = ["drifter", "runner", "spitter", "brute", "screecher", "crawler", "warden", "iron_colossus"]
	var atlas: Image = Image.create_empty(1024, 512, false, Image.FORMAT_RGBA8)
	for index: int in range(names.size()):
		var image: Image = Image.load_from_file("res://assets/actors/compact-v1/%s-atlas.webp" % names[index])
		var edge: int = image.get_height()
		var frame: Image = image.get_region(Rect2i(edge, 0, edge, edge))
		frame.resize(256, 256, Image.INTERPOLATE_NEAREST)
		atlas.blit_rect(frame, Rect2i(0, 0, 256, 256), Vector2i((index % 4) * 256, (index / 4) * 256))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(ROOT + "references"))
	atlas.save_png(ROOT + "references/enemies.png")
