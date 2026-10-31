extends "res://tests/combat_visual_review.gd"
## Real pointer focus and below-art pixels reproduce the user's frame-specific report.

var _records: Array[Dictionary] = []
var _failures: Array[String] = []


func _run() -> void:
	_directory = ProjectSettings.globalize_path("res://../output/card-layout-cleanup/review")
	DirAccess.make_dir_recursive_absolute(_directory)
	var packed: PackedScene = load("res://scenes/game_root.tscn") as PackedScene
	_game = packed.instantiate()
	root.add_child(_game)
	_game.set_physics_process(false)
	_game.set("_qa_capture", true)
	var session: GameSession = _game.get("session")
	session.save_data.tutorialSkipped = true
	session.save_data.settings.autoAim = false
	session.save_data.settings.autoFire = false
	session.save_data.unlockedWeapons = session.catalog.all("weapons").keys()
	var model: RunSimulation = _fresh("shock_hammer")
	model.run.player.level = 2
	var ids: Array[String] = ["damage", "scavenger", "speed", "reactivePlating"]
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440)]:
		root.size = dimensions
		await process_frame
		model.run.upgradeOptions = []
		for id: String in ids:
			var option: Dictionary = model.catalog.parameters("upgrades", id).duplicate(true)
			option.detail = WorkshopRules.detail(option)
			option["preview"] = WorkshopRules.preview(id, model.run.player, model.run, model.catalog.parameters("weapons", model.run.player.weaponId))
			model.run.upgradeOptions.append(option)
		model.set_screen(GameSession.Screen.UPGRADE)
		var battle: BattleView = _game.get("battle")
		battle.refresh()
		await create_timer(0.5).timeout
		for index: int in range(4):
			var card: UpgradeCard = battle._buttons[index] as UpgradeCard
			var motion := InputEventMouseMotion.new()
			motion.position = card.get_global_rect().get_center()
			root.push_input(motion, true)
			await create_timer(0.23).timeout
			await _capture("hover-%d-%d" % [dimensions.y, index])
			var below: int = _gold_run_below(card)
			var active: bool = card.interaction_active()
			_records.append({"width": dimensions.x, "height": dimensions.y, "index": index, "hover": active, "brightGoldRunBelowArtwork": below})
			if not active or below > 32:
				_failures.append("Residual focus line or inactive card at " + str(dimensions) + ": " + str(index))
		var move_out := InputEventMouseMotion.new()
		move_out.position = Vector2(5, 5)
		root.push_input(move_out, true)
		var tab := InputEventKey.new()
		tab.physical_keycode = KEY_TAB
		tab.pressed = true
		root.push_input(tab, true)
		await create_timer(0.23).timeout
		await _capture("keyboard-%d" % dimensions.y)
		var owner: Control = root.gui_get_focus_owner()
		if not owner is UpgradeCard or not owner.interaction_active():
			_failures.append("Keyboard card focus not visible at " + str(dimensions))
	var audio: NativeAudio = _game.get("audio")
	audio.shutdown()
	_game.queue_free()
	await process_frame
	await create_timer(0.25).timeout
	var report: Dictionary = {"records": _records, "failures": _failures,
		"scope": "Actual native viewport events, per-frame illustration windows and bright residual lines below artwork; not physical gamepad or OS DPI acceptance"}
	var file: FileAccess = FileAccess.open(_directory.path_join("review.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  ") + "\n")
	file.close()
	print("CARD_LAYOUT_VISUAL " + JSON.stringify({"hoverCases": _records.size(), "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _gold_run_below(card: UpgradeCard) -> int:
	var texture: Texture2D = CombatArt.frame(card.catalog, card.option.family, card.option.rarity)
	var bounds: Rect2 = UpgradeGlyph.bitmap_ink(texture)
	var factor: Vector2 = card.size / texture.get_size()
	var local: Rect2 = Rect2(bounds.position * factor, bounds.size * factor)
	var transform: Transform2D = card.get_global_transform_with_canvas() * card.visual_transform
	var maximum_y: float = -INF
	var minimum_x: float = INF
	var maximum_x: float = -INF
	for point: Vector2 in [local.position, Vector2(local.end.x, local.position.y), local.end, Vector2(local.position.x, local.end.y)]:
		var transformed: Vector2 = transform * point
		maximum_y = maxf(maximum_y, transformed.y)
		minimum_x = minf(minimum_x, transformed.x)
		maximum_x = maxf(maximum_x, transformed.x)
	var image: Image = root.get_texture().get_image()
	var longest: int = 0
	var end_y: int = mini(image.get_height(), ceili(maximum_y + 32 * transform.get_scale().y))
	for y: int in range(maxi(0, ceili(maximum_y + 2)), end_y):
		var run: int = 0
		for x: int in range(maxi(0, floori(minimum_x)), mini(image.get_width(), ceili(maximum_x))):
			var color: Color = image.get_pixel(x, y)
			run = run + 1 if color.r > 0.68 and color.g > 0.50 and color.b < 0.62 else 0
			longest = maxi(longest, run)
	return longest
