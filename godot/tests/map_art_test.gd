extends SceneTree
## Check map authoring, depth participation, occlusion and the turret muzzle boundary.

var _checks: int = 0
var _failures: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var assets := AssetStore.new(catalog)
	for id: String in catalog.all("maps"):
		var scene: PackedScene = load("res://scenes/maps/" + id + ".tscn") as PackedScene
		var map: MapScene = scene.instantiate() as MapScene
		var original: MapDefinition = catalog.find("maps", id) as MapDefinition
		_check(map.current_layout().obstacles == original.layout.obstacles, id + " physical geometry unchanged")
		var layer: TileMapLayer = map.get_node("GroundTiles") as TileMapLayer
		_check(map.art_profile == load("res://content/map_art/" + id + "_art.tres"), id + " uses external editable profile")
		_check(layer.tile_set == map.art_profile.floor_tiles and layer.tile_set == load("res://content/map_art/pixel_wasteland_tiles.tres"), id + " uses shared external tileset")
		_check(layer.material == map.art_profile.floor_material and layer.material == load("res://content/map_art/pixel_floor_material.tres") and map.art_profile.prop_material == load("res://content/map_art/pixel_prop_material.tres"), id + " uses shared external materials")
		_check(layer != null and not layer.collision_enabled and not layer.navigation_enabled, id + " visual floor has no competing physics")
		_check(layer.tile_set.get_source(0).get_tiles_count() == 16, id + " shared 16 tile atlas")
		_check(is_equal_approx(layer.scale.x * layer.tile_set.tile_size.x, 64), id + " editor cells match world scale")
		var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
		var view := WorldView.new()
		root.add_child(view)
		view.configure(model, assets, map)
		model.start_run({"mapId": id, "seed": 88, "tutorial": false, "layout": map.current_layout()})
		view.synchronize()
		_check(view._depth_root.y_sort_enabled and view._player.get_parent() == view._depth_root and view._player.z_index == 0, id + " player uses shared depth plane")
		_check(view._enemy_visuals.size() == model.enemies.size(), id + " enemies have independent depth visuals")
		var prop: MapPropVisual = view._prop_visuals[0]
		_check(is_equal_approx(prop.position.y, prop.base_rect.end.y), id + " prop sort anchor is ground baseline")
		model.release_entities()
		model.run.player.x = prop.base_rect.get_center().x
		model.run.player.y = prop.base_rect.position.y - 15
		prop.update_occlusion(model.run.player, model.enemies, Rect2(0, 0, 3072, 3072))
		_check(prop.roof_opacity < 1, id + " roof fades over player")
		model.run.player.y = prop.base_rect.end.y + 30
		prop.update_occlusion(model.run.player, model.enemies, Rect2(0, 0, 3072, 3072))
		_check(prop.roof_opacity == 1, id + " front face stays opaque when player is in front")
		model.spawn_enemy("drifter", prop.base_rect.get_center().x, prop.base_rect.position.y - 15)
		prop.update_occlusion(model.run.player, model.enemies, Rect2(0, 0, 3072, 3072))
		_check(prop.roof_opacity < 1, id + " nearby enemy also reveals roof")
		view.synchronize()
		var count: int = view._depth_root.get_child_count()
		for iteration: int in range(6):
			model.release_entities()
			view.synchronize()
			model.spawn_enemy("drifter", 1536, 1500)
			view.synchronize()
		_check(view._depth_root.get_child_count() == count, id + " pooled visuals do not grow across respawns")
		model.release_entities()
		view.queue_free()
		await process_frame
	_test_turret_barrel(catalog)
	print("GODOT_MAP_ART " + JSON.stringify({"checks": _checks, "maps": 3, "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _test_turret_barrel(catalog: GameCatalog) -> void:
	var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
	model.start_run({"seed": 88, "tutorial": false})
	model.release_entities()
	model.interactives.clear()
	model.obstacles.assign([{"x": 1480.0, "y": 1391.0, "w": 112.0, "h": 1.0}])
	model.rebuild_obstacle_grid()
	model.setup_navigation()
	model.run.turretKits = 1
	model.run.turretKitHealth = [1.0]
	model.set_input({"aimX": 0, "aimY": -1, "aimActive": true})
	_check(model.structures.begin(model) and model.structures.confirm(model), "thin-wall fixture permits lawful base deployment")
	model.run.structures[0].cooldown = 0.0
	var enemy: Dictionary = model.spawn_enemy("brute", 1536, 1300)
	enemy.hp = 10000.0
	enemy.maxHp = 10000.0
	model.structures.update(model, 1.0 / 60)
	_check(model.projectiles.is_empty(), "tower cannot start a shot beyond a wall crossing its barrel")
	model.obstacles.remove_at(0)
	model.structures.update(model, 1.0 / 60)
	_check(model.projectiles.size() == 1, "tower can fire after the barrel obstruction is removed")
	model.release_entities()


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
