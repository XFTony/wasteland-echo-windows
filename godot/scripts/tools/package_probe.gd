extends Node
## Runs from the exported pack to catch missing resources and editor-only dependencies.

var _failures: Array[String] = []


func run(game: Node) -> void:
	game.set_process(false)
	game.set_physics_process(false)
	game.set("_qa_capture", true)
	var session: GameSession = game.get("session")
	var catalog: GameCatalog = game.get("catalog")
	var assets: AssetStore = game.get("assets")
	var audio: NativeAudio = game.get("audio")
	for item: Dictionary in catalog.metadata.assets:
		if assets.texture(item.id) == null:
			_failures.append("Missing packed image: " + str(item.id))
	for item: Dictionary in catalog.metadata.audio:
		if audio._stream(item.id) == null:
			_failures.append("Missing packed audio: " + str(item.id))
	for id: String in catalog.all("weapons"):
		if assets.weapon_texture(id) == null:
			_failures.append("Missing packed weapon: " + id)
	var maps: int = 0
	var art_maps: int = 0
	var painted_maps: int = 0
	var map_atlases: Dictionary = {}
	for id: String in catalog.all("maps"):
		session.save_data.selectedMap = id
		game.call("_start_run", {"seed": 88, "tutorial": false})
		var model: RunSimulation = game.get("simulation")
		model.spawner_enabled = false
		for index: int in range(60):
			model.set_input({"moveX": 1, "moveY": 0})
			model.tick(1.0 / 60)
		var world: WorldView = game.get("world")
		world.synchronize()
		var profile: MapArtProfile = world.map_scene.art_profile
		var ground: TileMapLayer = world.map_scene.get_node_or_null("GroundTiles") as TileMapLayer
		if world.map_scene.has_painted_ground():
			map_atlases[profile.painted_ground_texture.resource_path] = true
			map_atlases[profile.ground_decals.resource_path] = true
			painted_maps += 1
		if profile == null or ground == null or ground.get_used_cells().is_empty():
			_failures.append("Packed map art missing: " + id)
		else:
			var atlas: TileSetAtlasSource = profile.floor_tiles.get_source(0) as TileSetAtlasSource
			if profile.prop_texture == null or atlas == null or atlas.texture == null:
				_failures.append("Packed map atlas missing: " + id)
			else:
				map_atlases[profile.prop_texture.resource_path] = true
				map_atlases[atlas.texture.resource_path] = true
				art_maps += 1
		if model.screen != GameSession.Screen.RUNNING or int(model.run.shotsFired) == 0:
			_failures.append("Packed map failed combat: " + id)
		maps += 1
		await get_tree().process_frame
	game.call("_return_to_menu")
	audio.shutdown()
	game.queue_free()
	await get_tree().process_frame
	await get_tree().create_timer(0.2).timeout
	print("GODOT_PACKAGE_SMOKE " + JSON.stringify({"maps": maps,
		"mapsWithArt": art_maps, "paintedMaps": painted_maps, "sharedMapAtlases": map_atlases.size(),
		"images": catalog.metadata.assets.size(), "audio": catalog.metadata.audio.size(),
		"weapons": catalog.all("weapons").size(), "failures": _failures}))
	get_tree().quit(0 if _failures.is_empty() else 1)
