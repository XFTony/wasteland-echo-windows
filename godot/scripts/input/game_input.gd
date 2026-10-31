class_name GameInput
extends RefCounted
## Native polling keeps pointer coordinates in world units across window sizes.

const CODE_KEYS: Dictionary = {
	"Space": KEY_SPACE, "Escape": KEY_ESCAPE, "Enter": KEY_ENTER, "NumpadEnter": KEY_KP_ENTER,
	"ArrowUp": KEY_UP, "ArrowDown": KEY_DOWN, "ArrowLeft": KEY_LEFT, "ArrowRight": KEY_RIGHT,
	"Tab": KEY_TAB, "ShiftLeft": KEY_SHIFT, "ShiftRight": KEY_SHIFT,
	"ControlLeft": KEY_CTRL, "ControlRight": KEY_CTRL, "AltLeft": KEY_ALT, "AltRight": KEY_ALT,
	"Backspace": KEY_BACKSPACE, "Delete": KEY_DELETE, "Insert": KEY_INSERT,
	"Home": KEY_HOME, "End": KEY_END, "PageUp": KEY_PAGEUP, "PageDown": KEY_PAGEDOWN,
	"CapsLock": KEY_CAPSLOCK, "NumLock": KEY_NUMLOCK, "ScrollLock": KEY_SCROLLLOCK,
	"Minus": KEY_MINUS, "Equal": KEY_EQUAL, "Backquote": KEY_QUOTELEFT,
	"BracketLeft": KEY_BRACKETLEFT, "BracketRight": KEY_BRACKETRIGHT, "Backslash": KEY_BACKSLASH,
	"Semicolon": KEY_SEMICOLON, "Quote": KEY_APOSTROPHE, "Comma": KEY_COMMA,
	"Period": KEY_PERIOD, "Slash": KEY_SLASH, "NumpadAdd": KEY_KP_ADD,
	"NumpadSubtract": KEY_KP_SUBTRACT, "NumpadMultiply": KEY_KP_MULTIPLY,
	"NumpadDivide": KEY_KP_DIVIDE, "NumpadDecimal": KEY_KP_PERIOD,
}

var pointer_active: bool = false
var blocked: bool = false
var _held: Dictionary = {}
var _mouse_firing: bool = false
var _last_rumble_at: int = -1000


static func code_to_key(code: String) -> Key:
	if code.begins_with("Key") and code.length() == 4:
		return code.unicode_at(3) as Key
	if code.begins_with("Digit") and code.length() == 6:
		return code.unicode_at(5) as Key
	if code.begins_with("Numpad") and code.length() == 7 and code.substr(6).is_valid_int():
		return (KEY_KP_0 + code.substr(6).to_int()) as Key
	if code.begins_with("F") and code.substr(1).is_valid_int():
		var number: int = code.substr(1).to_int()
		if number >= 1 and number <= 35:
			return (KEY_F1 + number - 1) as Key
	return CODE_KEYS.get(code, KEY_NONE)


static func event_code(event: InputEventKey) -> String:
	var code: Key = event.physical_keycode
	if code >= KEY_A and code <= KEY_Z:
		return "Key" + char(code)
	if code >= KEY_0 and code <= KEY_9:
		return "Digit" + char(code)
	if code >= KEY_F1 and code <= KEY_F35:
		return "F" + str(code - KEY_F1 + 1)
	if code >= KEY_KP_0 and code <= KEY_KP_9:
		return "Numpad" + str(code - KEY_KP_0)
	for pair: Array in [[KEY_SHIFT, "Shift"], [KEY_CTRL, "Control"], [KEY_ALT, "Alt"]]:
		if code == pair[0]:
			return str(pair[1]) + ("Right" if event.location == KEY_LOCATION_RIGHT else "Left")
	for name: String in CODE_KEYS:
		if CODE_KEYS[name] == code:
			return name
	return OS.get_keycode_string(code)


func capture(event: InputEvent) -> void:
	if event is InputEventKey:
		var code: String = event_code(event)
		if event.pressed:
			_held[code] = true
		else:
			_held.erase(code)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_mouse_firing = event.pressed
	elif event is InputEventMouseMotion:
		pointer_active = true


func reset(reset_aim: bool = false) -> void:
	_held.clear()
	_mouse_firing = false
	if reset_aim:
		pointer_active = false


func sample(model: RunSimulation, world: WorldView, pointer: Vector2) -> Dictionary:
	if blocked or model.run.is_empty():
		return {"moveX": 0.0, "moveY": 0.0, "firing": false, "aimActive": false}
	var bindings: Dictionary = model.save.keyBindings
	var x: float = float(_pressed(bindings, "moveRight", "KeyD") or _held.has("ArrowRight")) - float(_pressed(bindings, "moveLeft", "KeyA") or _held.has("ArrowLeft"))
	var y: float = float(_pressed(bindings, "moveDown", "KeyS") or _held.has("ArrowDown")) - float(_pressed(bindings, "moveUp", "KeyW") or _held.has("ArrowUp"))
	var player: Dictionary = model.run.player
	var aim: Vector2 = world.screen_to_world(pointer) - Vector2(player.x, player.y) if pointer_active else Vector2.RIGHT
	var firing: bool = _mouse_firing or _pressed(bindings, "fire", "Space")
	var aim_active: bool = pointer_active
	if model.save.settings.get("gamepadEnabled", true) and not Input.get_connected_joypads().is_empty():
		var device: int = Input.get_connected_joypads()[0]
		var deadzone: float = clampf(float(model.save.settings.get("gamepadDeadzone", 0.18)), 0.05, 0.5)
		var movement: Vector2 = _deadzone(Vector2(Input.get_joy_axis(device, JOY_AXIS_LEFT_X),
			Input.get_joy_axis(device, JOY_AXIS_LEFT_Y)), deadzone)
		if movement.length_squared() > 0:
			x = movement.x
			y = movement.y
		var stick: Vector2 = _deadzone(Vector2(Input.get_joy_axis(device, JOY_AXIS_RIGHT_X),
			Input.get_joy_axis(device, JOY_AXIS_RIGHT_Y)), deadzone)
		if stick.length_squared() > 0.0001:
			aim = stick
			aim_active = true
		firing = firing or Input.get_joy_axis(device, JOY_AXIS_TRIGGER_RIGHT) > 0.28 or Input.is_joy_button_pressed(device, JOY_BUTTON_RIGHT_SHOULDER) or Input.is_joy_button_pressed(device, JOY_BUTTON_X)
	return {"moveX": x, "moveY": y, "aimX": aim.x, "aimY": aim.y,
		"aimActive": aim_active, "firing": firing}


func handle_feedback(events: Array[Dictionary], settings: Dictionary) -> bool:
	if not settings.get("gamepadEnabled", true) or not settings.get("gamepadVibration", true) or Input.get_connected_joypads().is_empty():
		return false
	var now: int = Time.get_ticks_msec()
	if now - _last_rumble_at < 35:
		return false
	for event: Dictionary in events:
		if event.type in ["playerHit", "boss", "finalWave", "shot"]:
			var strong: bool = event.type != "shot"
			Input.start_joy_vibration(Input.get_connected_joypads()[0], 0.48 if strong else 0.34,
				0.72 if strong else 0.22, 0.15 if strong else 0.055)
			_last_rumble_at = now
			return true
	return false


func matches(event: InputEventKey, bindings: Dictionary, action: String, fallback: String) -> bool:
	return event_code(event) == str(bindings.get(action, fallback))


func _pressed(bindings: Dictionary, action: String, fallback: String) -> bool:
	return _held.has(str(bindings.get(action, fallback)))


func _deadzone(value: Vector2, deadzone: float) -> Vector2:
	var length: float = value.length()
	if length <= deadzone:
		return Vector2.ZERO
	return value * minf(1, (length - deadzone) / maxf(0.001, 1 - deadzone)) / maxf(length, 0.00001)
