extends SceneTree
## Real viewport events verify every card, stable hit areas and input modality.

var _checks: int = 0
var _failures: Array[String] = []
var _commands: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var packed: PackedScene = load("res://scenes/game_root.tscn") as PackedScene
	var game: Node = packed.instantiate()
	root.add_child(game)
	game.set_physics_process(false)
	await process_frame
	var session: GameSession = game.get("session")
	session.save_data.tutorialSkipped = true
	session.action("deploy")
	var model: RunSimulation = game.get("simulation")
	model.run.player.xp = model.run.player.xpNext
	model.check_level_up()
	var battle: BattleView = game.get("battle")
	battle.action_requested.disconnect(Callable(game, "_handle_action"))
	battle.action_requested.connect(func(command: String) -> void: _commands.append(command))
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440), Vector2i(640, 360)]:
		var prior: Control = root.gui_get_focus_owner()
		var prior_id: String = str(prior.option.id) if prior is UpgradeCard else ""
		root.size = dimensions
		battle.refresh()
		await process_frame
		await process_frame
		var cards: Array[UpgradeCard] = _cards(battle)
		if not prior_id.is_empty():
			var focused: Control = root.gui_get_focus_owner()
			_check(focused is UpgradeCard and str(focused.option.id) == prior_id, str(dimensions) + " resize preserves selected upgrade")
		cards[0].grab_focus()
		_check(cards.size() == 4, str(dimensions) + " has all four cards")
		_mouse(Vector2(-100, -100))
		await process_frame
		_settle(cards)
		_check(cards[0].has_focus() and not cards[0].interaction_active(), str(dimensions) + " default focus does not latch mouse hover")
		await _snapshot("cards-%dx%d-idle" % [dimensions.x, dimensions.y])
		for index: int in range(cards.size()):
			var card: UpgradeCard = cards[index]
			var before: Rect2 = card.get_global_rect()
			_mouse(before.get_center())
			await process_frame
			_settle(cards)
			_check(card.interaction_active() and card._hover > 0.98, str(dimensions) + " card " + str(index + 1) + " enters hover")
			_check(before == card.get_global_rect(), str(dimensions) + " card hit area stays still")
			_check(_active_count(cards) == 1, str(dimensions) + " pointer has only one active card")
			if dimensions == Vector2i(1280, 720):
				await _snapshot("cards-720-hover-" + str(index + 1))
			_mouse(before.end - Vector2(2, 2))
			await process_frame
			_settle(cards)
			_check(card.interaction_active(), str(dimensions) + " hover remains stable at slot edge")
			var count: int = _commands.size()
			_click(before.get_center())
			await process_frame
			_check(_commands.size() == count + 1 and _commands.back() == "upgrade:" + str(card.option.id), str(dimensions) + " click emits matching option")
			_mouse(Vector2(-100, -100))
			await process_frame
			_settle(cards)
			_check(not card.interaction_active() and card._hover < 0.01, str(dimensions) + " card returns after pointer exits")
		cards[1].grab_focus()
		var key := InputEventKey.new()
		key.physical_keycode = KEY_TAB
		key.keycode = KEY_TAB
		key.pressed = true
		root.push_input(key)
		await process_frame
		_check(_active_count(cards) == 1 and battle._navigation_focus_enabled, str(dimensions) + " keyboard navigation activates current focus only")
		_mouse(cards[0].get_global_rect().get_center())
		await process_frame
		_settle(cards)
		_check(cards[0].interaction_active() and _active_count(cards) == 1, str(dimensions) + " pointer takes over from keyboard")
	model.save.settings.reducedMotion = true
	battle.refresh()
	await process_frame
	var reduced_cards: Array[UpgradeCard] = _cards(battle)
	_mouse(reduced_cards[0].get_global_rect().get_center())
	await process_frame
	_settle(reduced_cards)
	_check(reduced_cards[0].interaction_active(), "reduced motion retains visible active feedback")
	await _snapshot("cards-reduced-motion")
	for card: UpgradeCard in reduced_cards:
		_check(card.visual_transform.is_equal_approx(Transform2D.IDENTITY) and card.modulate.a == 1, "reduced motion has no lift, tilt, scale or reveal fade")
	model.save.settings.gamepadEnabled = true
	var joy := InputEventJoypadMotion.new()
	joy.axis = JOY_AXIS_LEFT_X
	joy.axis_value = 0.8
	root.push_input(joy)
	await process_frame
	_check(battle._navigation_focus_enabled and _active_count(reduced_cards) == 1, "gamepad modality uses navigation focus without retaining pointer highlight")
	game.call("_return_to_menu")
	await process_frame
	session.save_data.settings.reducedMotion = false
	game.call("_play_startup")
	var normal_intro: StartupView = game.get("startup")
	normal_intro._process(0.5)
	_check(not normal_intro._finished, "normal startup retains its animated duration")
	await _snapshot("startup-normal")
	normal_intro.skip()
	_check(game.get("startup") == null, "normal startup can be skipped")
	session.save_data.settings.reducedMotion = true
	session.save_data.settings.gamepadEnabled = false
	game.call("_play_startup")
	var quiet_intro: StartupView = game.get("startup")
	quiet_intro._process(0.1)
	_check(quiet_intro.reduced_motion and not quiet_intro._finished, "startup receives the reduced motion preference")
	var disabled_button := InputEventJoypadButton.new()
	disabled_button.button_index = JOY_BUTTON_A
	disabled_button.pressed = true
	quiet_intro._input(disabled_button)
	_check(not quiet_intro._finished, "disabled gamepad cannot skip the startup overlay")
	await _snapshot("startup-reduced-motion")
	quiet_intro._process(0.7)
	_check(game.get("startup") == null, "reduced motion startup finishes after the shorter static interval")
	game.set_process(false)
	var audio: NativeAudio = game.get("audio")
	audio.shutdown()
	game.queue_free()
	await process_frame
	await create_timer(0.25).timeout
	print("GODOT_UI_INTERACTION " + JSON.stringify({"checks": _checks, "resolutions": 5, "failures": _failures,
		"scope": "Native viewport pointer, click and navigation events; not physical device acceptance"}))
	quit(0 if _failures.is_empty() else 1)


func _cards(battle: BattleView) -> Array[UpgradeCard]:
	var cards: Array[UpgradeCard] = []
	for control: Control in battle._buttons:
		if control is UpgradeCard:
			cards.append(control)
	return cards


func _settle(cards: Array[UpgradeCard]) -> void:
	for step: int in range(14):
		for card: UpgradeCard in cards:
			card._process(0.1)


func _active_count(cards: Array[UpgradeCard]) -> int:
	var count: int = 0
	for card: UpgradeCard in cards:
		if card.interaction_active():
			count += 1
	return count


func _mouse(point: Vector2) -> void:
	var event := InputEventMouseMotion.new()
	event.position = point
	event.global_position = point
	root.push_input(event)


func _click(point: Vector2) -> void:
	for pressed: bool in [true, false]:
		var event := InputEventMouseButton.new()
		event.position = point
		event.global_position = point
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		root.push_input(event)


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)


func _snapshot(name: String) -> void:
	if "--qa-ui-visual" not in OS.get_cmdline_user_args():
		return
	await RenderingServer.frame_post_draw
	var directory: String = ProjectSettings.globalize_path("res://../output/echo-ground-ui")
	DirAccess.make_dir_recursive_absolute(directory)
	root.get_texture().get_image().save_png(directory.path_join(name + ".png"))
