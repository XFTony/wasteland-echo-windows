extends SceneTree
## Verify native event contracts and audio routing separately from gameplay arithmetic.

var _checks: int = 0
var _failures: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var controls := GameInput.new()
	var codes: Array[String] = ["KeyW", "KeyA", "KeyS", "KeyD", "Digit1", "Space", "Enter",
		"Escape", "Backspace", "Tab", "ArrowUp", "Numpad0", "Numpad9", "NumpadEnter",
		"NumpadAdd", "NumpadDecimal", "F1", "F12", "F35", "Backquote", "BracketLeft", "Slash"]
	for code: String in codes:
		var event := InputEventKey.new()
		event.physical_keycode = GameInput.code_to_key(code)
		_check(event.physical_keycode != KEY_NONE and GameInput.event_code(event) == code, "keyboard mapping " + code)
	var modifier := InputEventKey.new()
	modifier.physical_keycode = KEY_SHIFT
	modifier.location = KEY_LOCATION_RIGHT
	_check(GameInput.event_code(modifier) == "ShiftRight", "right modifier location")
	var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
	model.start_run({"seed": 88, "tutorial": false})
	var world := WorldView.new()
	world.camera_position = Vector2(800, 1100)
	world.zoom = 2
	var key := InputEventKey.new()
	key.physical_keycode = KEY_D
	key.pressed = true
	controls.capture(key)
	controls.capture(InputEventMouseMotion.new())
	var state: Dictionary = controls.sample(model, world, Vector2(1280, 720))
	_check(state.moveX == 1 and state.moveY == 0, "captured physical movement")
	_check(state.aimX == -96 and state.aimY == -76 and state.aimActive, "pointer uses camera and zoom")
	controls.reset(true)
	state = controls.sample(model, world, Vector2(1280, 720))
	_check(state.moveX == 0 and not state.firing and not state.aimActive, "focus reset releases keys and pointer")
	model.release_entities()
	world.free()
	var audio := NativeAudio.new()
	root.add_child(audio)
	audio.configure(catalog)
	var settings: Dictionary = catalog.default_save.settings.duplicate()
	settings.musicMuted = true
	audio.synchronize(0, null, settings)
	for asset: Dictionary in catalog.metadata.audio:
		var stream: AudioStream = audio._stream(asset.id)
		_check(stream != null and absf(stream.get_length() - float(asset.seconds)) < 0.01, "audio decode length " + str(asset.id))
	var shot: Dictionary = {"type": "shot", "weaponId": "scrap_pistol", "attackId": 1,
		"elapsed": 0.0, "interval": 0.3, "empowered": false}
	audio.consume([{"type": "runStart"}, shot, shot])
	_check(int(audio._shot_counters.scrap_pistol) == 1, "duplicate attack audio suppressed")
	_check(audio._pending.size() == 1, "mechanical tail is delayed")
	var before: float = audio._clock
	audio.set_suspended(true)
	audio.synchronize(1, null, settings)
	_check(audio._clock == before, "focus suspension freezes scheduled audio")
	audio.set_suspended(false)
	settings.sfxMuted = true
	audio.synchronize(0, null, settings)
	_check(AudioServer.is_bus_mute(audio._sfx_bus_index), "mute applies to active effects bus")
	audio.shutdown()
	audio.queue_free()
	await process_frame
	await create_timer(0.2).timeout
	print("GODOT_INPUT_AUDIO " + JSON.stringify({"checks": _checks, "audioAssets": catalog.metadata.audio.size(), "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
