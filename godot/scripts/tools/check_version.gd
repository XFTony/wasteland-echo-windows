extends SceneTree


func _init() -> void:
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	if arguments.is_empty() or str(catalog.metadata.version) != arguments[0]:
		push_error("Native catalog version must match package.json before building.")
		quit(1)
	else:
		quit(0)
