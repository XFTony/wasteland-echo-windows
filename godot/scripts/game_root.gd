extends Node
## Composes the native runtime; individual systems own rules and presentation.

@export var catalog: GameCatalog
var session: GameSession
var assets: AssetStore
var menu: MenuView


func _ready() -> void:
	if catalog == null and ResourceLoader.exists("res://content/game_catalog.tres"):
		catalog = load("res://content/game_catalog.tres") as GameCatalog
	if catalog == null:
		push_error("Run the explicit content importer before starting the native game.")
		return
	var test_mode: bool = "--qa-ui" in OS.get_cmdline_user_args()
	session = GameSession.new(catalog, FileStorage.new(
		"res://../output/godot-migration/ui-test-save"
	) if test_mode else null)
	assets = AssetStore.new(catalog)
	menu = MenuView.new()
	menu.name = "Menu"
	$Interface.add_child(menu)
	menu.setup(session, assets)
	session.fullscreen_requested.connect(_toggle_fullscreen)
	if test_mode:
		_capture_ui.call_deferred()


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo or session == null:
		return
	if not session.pending_binding.is_empty():
		var code: String = _key_code(event.physical_keycode)
		if event.physical_keycode == KEY_ESCAPE:
			session.pending_binding = ""
			session.changed.emit()
		else:
			session.bind_code(code)
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
	get_tree().quit.call_deferred()
