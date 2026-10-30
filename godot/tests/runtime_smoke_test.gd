extends SceneTree
## Exercise the actual composition root and native modal controls using isolated storage.

var _checks: int = 0
var _failures: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var scene: PackedScene = load("res://scenes/game_root.tscn") as PackedScene
	var game: Node = scene.instantiate()
	root.add_child(game)
	game.set_physics_process(false)
	await process_frame
	var session: GameSession = game.get("session")
	_check(session != null and session.screen == GameSession.Screen.MENU, "native menu created")
	session.save_data.tutorialSkipped = true
	session.action("deploy")
	var simulation: RunSimulation = game.get("simulation")
	var world: WorldView = game.get("world")
	_check(simulation != null and simulation.screen == GameSession.Screen.RUNNING, "deploy starts native combat")
	_check(world.map_scene.current_layout().obstacles.size() > 0, "editable map collision loaded")
	var before: float = simulation.run.player.x
	var move := InputEventKey.new()
	move.physical_keycode = KEY_D
	move.pressed = true
	Input.parse_input_event(move)
	Input.flush_buffered_events()
	game.call("_physics_process", 1.0 / 60)
	var released: InputEventKey = move.duplicate() as InputEventKey
	released.pressed = false
	Input.parse_input_event(released)
	Input.flush_buffered_events()
	world.synchronize()
	_check(float(simulation.run.player.x) > before, "native event moves player through composition root")
	game.call("_handle_action", "pause")
	var paused_time: float = simulation.run.elapsed
	simulation.tick(1.0 / 60)
	_check(simulation.screen == GameSession.Screen.PAUSED and float(simulation.run.elapsed) == paused_time, "pause freezes combat time")
	game.call("_handle_action", "resume")
	simulation.run.player.xp = 100
	simulation.check_level_up()
	_check(simulation.screen == GameSession.Screen.UPGRADE and simulation.run.upgradeOptions.size() == 4, "native four-card draft")
	game.call("_handle_action", "upgrade:" + str(simulation.run.upgradeOptions[0].id))
	_check(simulation.screen == GameSession.Screen.RUNNING, "card action resumes combat")
	var station: Dictionary = {}
	for item: Dictionary in simulation.interactives:
		if item.type == "tradePost":
			station = item
			break
	_check(not station.is_empty(), "map has trade post")
	if not station.is_empty():
		simulation.run.player.x = station.x
		simulation.run.player.y = float(station.y) + 20
		game.call("_handle_action", "fieldOpen")
		_check(simulation.screen == GameSession.Screen.FIELD_SHOP, "trade post modal")
		simulation.run.scrap = 1000
		game.call("_handle_action", "fieldTab:arsenal")
		game.call("_handle_action", "arsenalBuy:echo_blade")
		_check(simulation.run.player.weaponId == "echo_blade", "native arsenal purchase and equip")
		game.call("_handle_action", "fieldClose")
	game.call("_handle_action", "retire")
	_check(simulation.run.result == "retire" and not simulation.run.payout.is_empty(), "retirement settlement")
	game.call("_handle_action", "menu")
	_check(game.get("simulation") == null and session.screen == GameSession.Screen.MENU, "return to menu releases run")
	var audio: NativeAudio = game.get("audio")
	audio.shutdown()
	game.queue_free()
	await process_frame
	# AudioServer releases streamed decoder handles on its next mixing cycle.
	await create_timer(0.2).timeout
	print("GODOT_RUNTIME_SMOKE " + JSON.stringify({"checks": _checks, "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
