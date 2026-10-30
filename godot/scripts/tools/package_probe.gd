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
		"images": catalog.metadata.assets.size(), "audio": catalog.metadata.audio.size(),
		"weapons": catalog.all("weapons").size(), "failures": _failures}))
	get_tree().quit(0 if _failures.is_empty() else 1)
