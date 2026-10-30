extends Node
## Composes the native runtime; individual systems own rules and presentation.

const QaStorage = preload("res://scripts/tools/qa_storage.gd")
const PackageProbe = preload("res://scripts/tools/package_probe.gd")

@export var catalog: GameCatalog
var session: GameSession
var assets: AssetStore
var menu: MenuView
var simulation: RunSimulation
var world: WorldView
var battle: BattleView
var audio: NativeAudio
var startup: StartupView
var controls := GameInput.new()
var _qa_capture: bool = false
var _is_quitting: bool = false


func _ready() -> void:
	get_tree().auto_accept_quit = false
	if catalog == null and ResourceLoader.exists("res://content/game_catalog.tres"):
		catalog = load("res://content/game_catalog.tres") as GameCatalog
	if catalog == null:
		push_error("Run the explicit content importer before starting the native game.")
		return
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	var test_mode: bool = "--qa-ui" in arguments or "--qa-play" in arguments or "--qa-smoke" in arguments or "--qa-package" in arguments or "--qa-map-review" in arguments
	session = GameSession.new(catalog, QaStorage.new() if test_mode else null)
	assets = AssetStore.new(catalog)
	menu = MenuView.new()
	menu.name = "Menu"
	$Interface.add_child(menu)
	menu.setup(session, assets)
	session.fullscreen_requested.connect(_toggle_fullscreen)
	session.run_requested.connect(_start_run)
	session.startup_requested.connect(_play_startup)
	audio = NativeAudio.new()
	audio.name = "Audio"
	add_child(audio)
	audio.configure(catalog)
	session.changed.connect(_session_changed)
	Input.joy_connection_changed.connect(_joy_connection_changed)
	if "--qa-ui" in arguments:
		_capture_ui.call_deferred()
	elif "--qa-play" in arguments:
		_qa_capture = true
		_capture_play.call_deferred()
	elif "--qa-package" in arguments:
		_qa_capture = true
		_package_probe.call_deferred()
	elif "--qa-map-review" in arguments:
		_qa_capture = true
		_capture_map_review.call_deferred()
	elif not test_mode and bool(session.save_data.settings.introAnimation):
		_play_startup.call_deferred()


func _session_changed() -> void:
	if audio != null:
		audio.play_tone("ui")


func _package_probe() -> void:
	var probe := PackageProbe.new()
	get_tree().root.add_child(probe)
	probe.run(self)


func _play_startup() -> void:
	if startup != null:
		return
	startup = StartupView.new()
	startup.name = "RadioStartup"
	startup.assets_ready = assets.texture("menu.radio.camp.v1") != null
	startup.finished.connect(_finish_startup)
	$Interface.add_child(startup)


func _finish_startup() -> void:
	if startup != null:
		startup.queue_free()
		startup = null


func _physics_process(delta: float) -> void:
	if simulation == null or world == null or _qa_capture:
		return
	if simulation.screen == GameSession.Screen.RUNNING:
		simulation.set_input(controls.sample(simulation, world, get_viewport().get_mouse_position()))
		simulation.tick(delta)
	var events: Array[Dictionary] = simulation.drain_events()
	world.consume(events)
	audio.consume(events)
	controls.handle_feedback(events, session.save_data.settings)
	for event: Dictionary in events:
		if event.type in ["result", "tutorialComplete"]:
			session.store.persist()
	world.synchronize()


func _process(delta: float) -> void:
	if audio != null:
		audio.synchronize(delta, simulation, session.save_data.settings)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_quit_cleanly()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		controls.blocked = true
		controls.reset(true)
		if audio != null:
			audio.set_suspended(true)
		if simulation != null and simulation.screen == GameSession.Screen.RUNNING:
			simulation.toggle_pause()
	elif what == NOTIFICATION_APPLICATION_FOCUS_IN:
		controls.blocked = false
		if audio != null:
			audio.set_suspended(false)


func _input(event: InputEvent) -> void:
	if (event is InputEventJoypadButton or event is InputEventJoypadMotion) and session != null and not session.save_data.settings.gamepadEnabled:
		get_viewport().set_input_as_handled()
		return
	controls.capture(event)
	if event is InputEventJoypadButton and event.pressed and simulation == null and session != null:
		if event.button_index in [JOY_BUTTON_B, JOY_BUTTON_BACK]:
			if not session.pending_binding.is_empty():
				session.pending_binding = ""
				session.changed.emit()
			else:
				session.action("back")
			get_viewport().set_input_as_handled()
			return
		elif event.button_index == JOY_BUTTON_A and get_viewport().gui_get_focus_owner() == null:
			if session.page in [GameSession.Page.MAIN, GameSession.Page.DEPLOYMENT]:
				session.action("start" if session.page == GameSession.Page.MAIN else "deploy")
				get_viewport().set_input_as_handled()
				return
	if event is InputEventJoypadButton and event.pressed and (simulation == null or simulation.screen != GameSession.Screen.RUNNING):
		if event.button_index in [JOY_BUTTON_LEFT_SHOULDER, JOY_BUTTON_RIGHT_SHOULDER]:
			_step_focus(-1 if event.button_index == JOY_BUTTON_LEFT_SHOULDER else 1)
			get_viewport().set_input_as_handled()
			return
	if event is InputEventJoypadButton and event.pressed and simulation != null:
		match event.button_index:
			JOY_BUTTON_START:
				_handle_action("fieldClose" if simulation.screen == GameSession.Screen.FIELD_SHOP else "pause")
			JOY_BUTTON_B, JOY_BUTTON_BACK:
				_handle_action("fieldClose" if simulation.screen == GameSession.Screen.FIELD_SHOP else "resume" if simulation.screen == GameSession.Screen.PAUSED else "menu" if simulation.screen in [GameSession.Screen.RESULT_WIN, GameSession.Screen.RESULT_LOSE] else "cancelPlacement")
			JOY_BUTTON_Y:
				_handle_action("deploy")
			JOY_BUTTON_A:
				if simulation.screen == GameSession.Screen.RUNNING:
					_handle_action("fieldOpen")


func _start_run(options: Dictionary = {}) -> void:
	if simulation != null and simulation.run.result == null:
		simulation.finish_run("retire")
		session.store.persist()
	if simulation != null:
		simulation.release_entities()
	if world != null:
		$World.remove_child(world)
		world.queue_free()
	if battle != null:
		$Interface.remove_child(battle)
		battle.queue_free()
	var map_id: String = session.selected("Map")
	var packed: PackedScene = load("res://scenes/maps/" + map_id + ".tscn") as PackedScene
	var map: MapScene = packed.instantiate() as MapScene
	simulation = RunSimulation.new(catalog, session.save_data)
	world = WorldView.new()
	world.name = "WorldView"
	$World.add_child(world)
	world.configure(simulation, assets, map)
	var run_options: Dictionary = {"layout": map.current_layout(), "tutorial": false if _qa_capture else not session.save_data.tutorialCompleted and not session.save_data.tutorialSkipped}
	run_options.merge(options, true)
	simulation.start_run(run_options)
	battle = BattleView.new()
	battle.name = "BattleInterface"
	battle.model = simulation
	battle.assets = assets
	$Interface.add_child(battle)
	battle.action_requested.connect(_handle_action)
	simulation.state_changed.connect(_show_state)
	_show_state()
	var start_events: Array[Dictionary] = simulation.drain_events()
	world.consume(start_events)
	audio.consume(start_events)
	world.synchronize()


func _step_focus(direction: int) -> void:
	var current: Control = get_viewport().gui_get_focus_owner()
	if current != null:
		var target: Control = current.find_next_valid_focus() if direction > 0 else current.find_prev_valid_focus()
		if target != null:
			target.grab_focus()
		return
	var candidates: Array[Node] = get_tree().get_nodes_in_group("native_menu_actions") if simulation == null else battle.get_children()
	for node: Node in candidates:
		if node is Control and node.is_visible_in_tree() and node.focus_mode != Control.FOCUS_NONE:
			node.grab_focus()
			return


func _show_state() -> void:
	if simulation == null:
		return
	session.screen = simulation.screen
	controls.reset()
	menu.visible = false
	if battle != null:
		battle.refresh()


func _return_to_menu() -> void:
	if simulation != null:
		if simulation.run.result == null:
			simulation.finish_run("retire")
		session.store.persist()
		simulation.release_entities()
		simulation = null
	if world != null:
		world.queue_free()
		world = null
	if battle != null:
		battle.queue_free()
		battle = null
	session.screen = GameSession.Screen.MENU
	session.page = GameSession.Page.MAIN
	menu.visible = true
	session.changed.emit()


func _handle_action(command: String) -> void:
	if simulation == null:
		return
	var parts: PackedStringArray = command.split(":", true, 1)
	var value: String = parts[1] if parts.size() > 1 else ""
	match parts[0]:
		"pause":
			if simulation.screen in [GameSession.Screen.RUNNING, GameSession.Screen.PAUSED]:
				simulation.toggle_pause()
		"resume":
			if simulation.screen == GameSession.Screen.PAUSED:
				simulation.toggle_pause()
		"fieldOpen":
			if simulation.run.placement != null:
				simulation.structures.confirm(simulation)
			elif not simulation.field_market.open(simulation):
				simulation.structures.recover(simulation)
		"fieldClose":
			simulation.field_market.close(simulation)
		"fieldBuy":
			simulation.field_market.purchase(simulation, value)
		"arsenalBuy":
			simulation.arsenal.buy(simulation, value)
		"arsenalEquip":
			simulation.arsenal.equip(simulation, value)
		"arsenalImprove":
			simulation.arsenal.improve(simulation, value)
		"fieldTab":
			simulation.run.fieldMarket.tab = value
			simulation.run.fieldMarket.page = 0
		"fieldPage":
			simulation.run.fieldMarket.page = int(value)
		"deploy":
			simulation.structures.begin(simulation)
		"cancelPlacement":
			simulation.structures.cancel(simulation)
		"upgrade":
			simulation.upgrades.choose(simulation, value)
		"upgradeSalvage":
			simulation.upgrades.salvage(simulation)
		"retire":
			simulation.finish_run("retire")
			session.store.persist()
		"quit":
			if simulation.run.endless:
				simulation.finish_run("retire")
				session.store.persist()
			else:
				_return_to_menu()
		"skipTutorial":
			simulation.run.tutorial.active = false
			simulation.run.tutorial.completed = false
			session.save_data.tutorialSkipped = true
			session.store.persist()
			simulation.push_event("tutorialSkipped")
		"restart":
			_start_run()
		"menu":
			_return_to_menu()
	if battle != null:
		battle.refresh()


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo or session == null:
		return
	if startup != null:
		return
	if not session.pending_binding.is_empty():
		var code: String = GameInput.event_code(event)
		if event.physical_keycode == KEY_ESCAPE:
			session.pending_binding = ""
			session.changed.emit()
		else:
			session.bind_code(code)
		return
	if simulation != null:
		_handle_run_key(event)
		return
	match event.physical_keycode:
		KEY_ESCAPE:
			session.action("back")
		KEY_F:
			_toggle_fullscreen()
		KEY_ENTER:
			if get_viewport().gui_get_focus_owner() == null:
				if session.page in [GameSession.Page.MAIN, GameSession.Page.DEPLOYMENT]:
					session.action("start" if session.page == GameSession.Page.MAIN else "deploy")
		KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_TAB:
			if get_viewport().gui_get_focus_owner() == null:
				var buttons: Array[Node] = get_tree().get_nodes_in_group("native_menu_actions")
				if not buttons.is_empty():
					(buttons[0] as Control).grab_focus()


func _handle_run_key(event: InputEventKey) -> void:
	var bindings: Dictionary = session.save_data.keyBindings
	if controls.matches(event, bindings, "fullscreen", "KeyF"):
		_toggle_fullscreen()
	elif event.physical_keycode == KEY_ESCAPE:
		if simulation.run.placement != null:
			_handle_action("cancelPlacement")
		elif simulation.screen == GameSession.Screen.FIELD_SHOP:
			_handle_action("fieldClose")
		else:
			_handle_action("pause")
	elif controls.matches(event, bindings, "pause", "KeyP"):
		_handle_action("fieldClose" if simulation.screen == GameSession.Screen.FIELD_SHOP else "pause")
	elif controls.matches(event, bindings, "interact", "KeyE") or event.physical_keycode == KEY_ENTER and simulation.screen == GameSession.Screen.RUNNING:
		_handle_action("fieldClose" if simulation.screen == GameSession.Screen.FIELD_SHOP else "fieldOpen")
	elif controls.matches(event, bindings, "deployTurret", "KeyT"):
		_handle_action("deploy")
	elif controls.matches(event, bindings, "quit", "KeyQ") and simulation.screen != GameSession.Screen.RUNNING:
		_handle_action("menu")
	elif controls.matches(event, bindings, "restart", "KeyR") and simulation.screen in [GameSession.Screen.PAUSED, GameSession.Screen.RESULT_LOSE, GameSession.Screen.RESULT_WIN]:
		_handle_action("restart")
	elif simulation.screen == GameSession.Screen.UPGRADE:
		for index: int in range(mini(4, simulation.run.upgradeOptions.size())):
			if controls.matches(event, bindings, "upgrade%d" % (index + 1), "Digit%d" % (index + 1)):
				_handle_action("upgrade:" + str(simulation.run.upgradeOptions[index].id))


func _joy_connection_changed(_device: int, connected: bool) -> void:
	if not connected and simulation != null and simulation.save.settings.gamepadEnabled and simulation.screen == GameSession.Screen.RUNNING:
		simulation.toggle_pause()


func _capture_play() -> void:
	var directory: String = ProjectSettings.globalize_path("res://../output/godot-migration/native-play")
	DirAccess.make_dir_recursive_absolute(directory)
	var reference: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://../output/godot-migration/reference-battle-regions.json"))
	var setup: Dictionary = reference.setup
	var records: Array[Dictionary] = []
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440)]:
		DisplayServer.window_set_size(dimensions)
		for index: int in range(4):
			await RenderingServer.frame_post_draw
		for map_id: String in catalog.all("maps"):
			_qa_fresh_run(setup.initialSave, map_id)
			world.synchronize()
			await _save_play_frame(directory.path_join("%s-%d.png" % [map_id, dimensions.y]))
		_qa_fresh_run(setup.initialSave, "echo_district")
		simulation.run.player.xp = simulation.run.player.xpNext
		simulation.check_level_up()
		for index: int in range(45):
			await RenderingServer.frame_post_draw
		await _capture_battle_state(directory, "upgrade", dimensions, records)
		simulation.set_screen(GameSession.Screen.RUNNING)
		var station: Dictionary = {}
		for item: Dictionary in simulation.interactives:
			if item.type == "tradePost":
				station = item
				break
		if not station.is_empty():
			simulation.run.player.x = station.x
			simulation.run.player.y = float(station.y) + 20
			simulation.run.scrap = setup.fieldScrap
			_handle_action("fieldOpen")
			for tab: String in ["supplies", "arsenal", "support"]:
				_handle_action("fieldTab:" + tab)
				for page: int in range(2 if tab == "arsenal" else 1):
					_handle_action("fieldPage:" + str(page))
					await _capture_battle_state(directory, "field-%s-%d" % [tab, page], dimensions, records)
			_handle_action("fieldClose")
		_handle_action("pause")
		await _capture_battle_state(directory, "pause", dimensions, records)
		simulation.finish_run("retire")
		await _capture_battle_state(directory, "result", dimensions, records)
	var file: FileAccess = FileAccess.open(directory.path_join("regions.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"records": records}, "  "))
	file.close()
	_quit_cleanly()


func _capture_map_review() -> void:
	var directory: String = ProjectSettings.globalize_path("res://../output/map-art/review")
	DirAccess.make_dir_recursive_absolute(directory)
	DisplayServer.window_set_size(Vector2i(1280, 720))
	var original: Dictionary = catalog.default_save.duplicate(true)
	var cases: Array[Dictionary] = [
		{"name": "echo-spawn", "map": "echo_district"},
		{"name": "echo-shop-behind", "map": "echo_district", "x": 465, "y": 375},
		{"name": "echo-shop-front", "map": "echo_district", "x": 465, "y": 550},
		{"name": "echo-trade-active", "map": "echo_district", "x": 1570, "y": 1422},
		{"name": "echo-supply", "map": "echo_district", "x": 1810, "y": 860},
		{"name": "echo-barrel", "map": "echo_district", "x": 970, "y": 1330},
		{"name": "echo-dense", "map": "echo_district", "x": 1536, "y": 1536, "dense": true},
		{"name": "freight-spawn", "map": "freight_nexus"},
		{"name": "red-spawn", "map": "red_basin"}]
	for sample: Dictionary in cases:
		_qa_fresh_run(original, sample.map)
		simulation.release_entities()
		var x: float = float(sample.get("x", simulation.run.player.x))
		var y: float = float(sample.get("y", simulation.run.player.y))
		simulation.run.player.x = x
		simulation.run.player.y = y
		simulation.spawn_enemy("drifter", x + 90, y - 12)
		world.synchronize()
		if bool(sample.get("dense", false)):
			simulation.release_entities()
			simulation.run.player.hp = 1000000.0
			simulation.run.player.maxHp = 1000000.0
			for index: int in range(104):
				var angle: float = float(index) / 104 * TAU
				var enemy: Dictionary = simulation.spawn_enemy("drifter" if index % 3 != 0 else "runner", x + cos(angle) * 240, y + sin(angle) * 180)
				enemy.hp = 100000.0
				enemy.maxHp = 100000.0
			var frame_times: Array[int] = []
			var previous: int = Time.get_ticks_usec()
			for frame: int in range(180):
				if simulation.screen == GameSession.Screen.PAUSED:
					simulation.set_screen(GameSession.Screen.RUNNING)
				simulation.tick(1.0 / 60)
				world.consume(simulation.drain_events())
				world.synchronize()
				await RenderingServer.frame_post_draw
				var now: int = Time.get_ticks_usec()
				if frame >= 60:
					frame_times.append(now - previous)
				previous = now
			frame_times.sort()
			var report: Dictionary = {"scope": "Short rendered 104-enemy sample on this host; capped at 60fps; not low-end or long-session certification",
				"frames": frame_times.size(), "medianFrameMs": float(frame_times[frame_times.size() / 2]) / 1000,
				"p95FrameMs": float(frame_times[floori(frame_times.size() * 0.95)]) / 1000,
				"enemyVisuals": world._enemy_visuals.size(), "props": world._prop_visuals.size()}
			var file: FileAccess = FileAccess.open(directory.path_join("rendered-sample.json"), FileAccess.WRITE)
			file.store_string(JSON.stringify(report, "  "))
			file.close()
		await _save_play_frame(directory.path_join(str(sample.name) + ".png"))
	_quit_cleanly()


func _qa_fresh_run(save_data: Dictionary, map_id: String) -> void:
	if simulation != null:
		_return_to_menu()
	session.save_data.clear()
	session.save_data.merge(save_data.duplicate(true), true)
	session.save_data.selectedMap = map_id
	_start_run({"seed": 88, "tutorial": false})
	simulation.spawner_enabled = false


func _capture_battle_state(directory: String, kind: String, dimensions: Vector2i,
		records: Array[Dictionary]) -> void:
	await _save_play_frame(directory.path_join("%s-%d.png" % [kind, dimensions.y]))
	records.append({"kind": kind, "width": dimensions.x, "height": dimensions.y,
		"actions": battle.action_regions()})


func _quit_cleanly() -> void:
	if _is_quitting:
		return
	_is_quitting = true
	controls.blocked = true
	if audio != null:
		audio.shutdown()
	if session != null:
		session.store.persist()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit()


func _save_play_frame(filename: String) -> void:
	for index: int in range(3):
		await RenderingServer.frame_post_draw
	var screenshot: Image = get_viewport().get_texture().get_image()
	screenshot.save_png(filename)


func _toggle_fullscreen() -> void:
	var fullscreen: bool = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if fullscreen
		else DisplayServer.WINDOW_MODE_FULLSCREEN)


func _key_code(code: Key) -> String:
	if code >= KEY_A and code <= KEY_Z:
		return "Key" + char(code)
	if code >= KEY_0 and code <= KEY_9:
		return "Digit" + char(code)
	return {KEY_SPACE: "Space", KEY_ESCAPE: "Escape", KEY_SHIFT: "ShiftLeft",
		KEY_CTRL: "ControlLeft", KEY_ALT: "AltLeft"}.get(code, OS.get_keycode_string(code))


func _capture_ui() -> void:
	var directory: String = ProjectSettings.globalize_path("res://../output/godot-migration/native-ui")
	DirAccess.make_dir_recursive_absolute(directory)
	var records: Array[Dictionary] = []
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440)]:
		DisplayServer.window_set_size(dimensions)
		for index: int in range(3):
			await RenderingServer.frame_post_draw
		for page: int in range(6):
			session.page = page
			session.changed.emit()
			for index: int in range(3):
				await RenderingServer.frame_post_draw
			var image: Image = get_viewport().get_texture().get_image()
			var filename: String = "%s-%d.png" % [["main", "loadout", "inventory", "shop", "settings", "credits"][page], dimensions.y]
			image.save_png(directory.path_join(filename))
			records.append({"menu": ["main", "loadout", "inventory", "shop", "settings", "credits"][page],
				"width": image.get_width(), "height": image.get_height(), "actions": menu.action_regions()})
			image = null
	var file: FileAccess = FileAccess.open(directory.path_join("regions.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(records, "  "))
	file.close()
	_quit_cleanly.call_deferred()
