extends SceneTree
## Explicit scene generation keeps artist edits unless overwrite is requested.


func _init() -> void:
	_build.call_deferred()


func _build() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var assets := AssetStore.new(catalog)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://scenes/maps"))
	for id: String in catalog.all("maps"):
		var filename: String = "res://scenes/maps/" + id + ".tscn"
		if ResourceLoader.exists(filename) and "--overwrite" not in OS.get_cmdline_user_args():
			continue
		var definition: MapDefinition = catalog.find("maps", id) as MapDefinition
		var root := MapScene.new()
		root.name = id.to_pascal_case()
		root.definition = definition
		root.ground = assets.texture(catalog.metadata.artMappings.MAP_GROUND_ART[id])
		var container := Node2D.new()
		container.name = "Obstacles"
		root.add_child(container)
		container.owner = root
		for index: int in range(definition.layout.obstacles.size()):
			var data: Dictionary = definition.layout.obstacles[index]
			var obstacle := MapObstacle.new()
			obstacle.name = "Obstacle%03d" % index
			obstacle.position = Vector2(float(data.x), float(data.y))
			obstacle.footprint = Vector2(float(data.w), float(data.h))
			obstacle.source_data = data.duplicate(true)
			var asset_id: String = ""
			if id == "echo_district" and catalog.metadata.echoPropRects.has(data.kind):
				asset_id = "world.prop.echo.salvage-kit.v1"
				var region: Array = catalog.metadata.echoPropRects[data.kind]
				obstacle.image_region = Rect2(region[0], region[1], region[2], region[3])
				obstacle.pixelated = true
			elif data.kind == "tradePost":
				asset_id = "world.prop.echo.market.v1"
				obstacle.pixelated = true
			elif id == "echo_district":
				asset_id = {"shop": "world.prop.echo.shop-roof.v1",
					"warehouse": "world.prop.echo.warehouse-roof.v1",
					"container": "world.prop.echo.container.v1",
					"railcar": "world.prop.echo.railcar.v1"}.get(data.kind, "")
				if data.kind == "shop" and "药" in str(data.get("sign", "")):
					asset_id = "world.prop.echo.apothecary-roof.v1"
			if not asset_id.is_empty():
				obstacle.image = assets.texture(asset_id)
			container.add_child(obstacle)
			obstacle.owner = root
		var packed := PackedScene.new()
		packed.pack(root)
		var result: Error = ResourceSaver.save(packed, filename)
		root.free()
		if result != OK:
			push_error("Could not save map: " + id)
			quit(1)
			return
		print("Native editable map: " + id)
	quit()
