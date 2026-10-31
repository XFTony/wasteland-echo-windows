extends SceneTree
## Read-only by default; --apply snaps separated palms to the actual bitmap silhouette, never moving collision or muzzle data.


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var apply: bool = "--apply" in OS.get_cmdline_user_args()
	var records: Array[Dictionary] = []
	for id: String in catalog.metadata.combatArt.weaponTextures:
		var image: Image = Image.load_from_file(ProjectSettings.globalize_path(catalog.metadata.combatArt.weaponTextures[id]))
		var pose: Dictionary = catalog.metadata.poses[id]
		var spec: Dictionary = pose.definition.visual
		var factor := Vector2(float(image.get_width()) / float(spec.width), float(image.get_height()) / float(spec.height))
		for part: Dictionary in pose.layout.layers:
			if part.kind != "hand":
				continue
			var asset_id: String = catalog.metadata.actorMetadata.PART_ASSETS[part.asset]
			var filename: String = ""
			for asset: Dictionary in catalog.metadata.assets:
				if asset.id == asset_id:
					filename = asset.resourcePath
			var hand: Image = Image.load_from_file(ProjectSettings.globalize_path(filename))
			var sum := Vector2.ZERO
			var count: int = 0
			for y: int in range(int(part.rect[3])):
				for x: int in range(int(part.rect[2])):
					if hand.get_pixel(int(part.rect[0]) + x, int(part.rect[1]) + y).a > 0.5:
						sum += Vector2(x + 0.5, y + 0.5)
						count += 1
			var center: Vector2 = Vector2(float(part.x), float(part.y)) + sum / maxi(1, count)
			var best: Vector2 = center
			var distance: float = INF
			for y: int in range(image.get_height()):
				for x: int in range(image.get_width()):
					if image.get_pixel(x, y).a <= 0.5:
						continue
					var point: Vector2 = Vector2(x + 0.5, y + 0.5) / factor
					if center.distance_squared_to(point) < distance:
						distance = center.distance_squared_to(point)
						best = point
			var delta: Vector2 = (best - center).round() if distance > 1.2 * 1.2 else Vector2.ZERO
			records.append({"weapon": id, "slot": part.slot, "gap": sqrt(distance), "shift": [delta.x, delta.y]})
			if apply and not delta.is_zero_approx():
				for layer: Dictionary in pose.layout.layers:
					if layer.slot == part.slot:
						layer.x += delta.x
						layer.y += delta.y
	var error: Error = ResourceSaver.save(catalog, "res://content/game_catalog.tres") if apply else OK
	print("FIELDCRAFT_GRIPS " + JSON.stringify({"applied": apply, "records": records}))
	quit(0 if error == OK else 1)
