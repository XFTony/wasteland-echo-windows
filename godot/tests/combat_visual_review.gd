extends SceneTree
## Capture actual native controls and held-weapon rendering using isolated QA storage.

var _game: Node
var _directory: String


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	_directory = ProjectSettings.globalize_path("res://../output/survival-builds/review")
	DirAccess.make_dir_recursive_absolute(_directory)
	var packed: PackedScene = load("res://scenes/game_root.tscn") as PackedScene
	_game = packed.instantiate()
	root.add_child(_game)
	_game.set_physics_process(false)
	_game.set("_qa_capture", true)
	var session: GameSession = _game.get("session")
	var catalog: GameCatalog = _game.get("catalog")
	session.save_data.tutorialSkipped = true
	session.save_data.unlockedWeapons = catalog.all("weapons").keys()
	session.save_data.settings.autoFire = false
	session.save_data.settings.autoAim = false
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440)]:
		root.size = dimensions
		await process_frame
		for record: int in [0, 180]:
			session.save_data.bestTime = record
			session.action("workshop")
			await _capture("codex-%s-%d" % ["locked" if record == 0 else "unlocked", dimensions.y])
	root.size = Vector2i(1280, 720)
	session.action("shop")
	session.shop_category = "weapon"
	session.shop_page = 2
	session.changed.emit()
	await _capture("shop-new-weapons-720")
	root.size = Vector2i(960, 540)
	await _capture("shop-new-weapons-540")
	root.size = Vector2i(1280, 720)
	var model: RunSimulation = _fresh("scrap_pistol")
	await _pistol_shot(model, "one-bullet")
	model.release_entities()
	_choose(model, "projectile")
	await _pistol_shot(model, "two-bullets")
	for id: String in ["critDamage", "recovery", "damage"]:
		_choose(model, id)
	model.toggle_pause()
	var battle: BattleView = _game.get("battle")
	battle._emit_action("buildInfo")
	await _capture("run-build-details")
	model = _fresh("scrap_pistol")
	for station: Dictionary in model.interactives:
		if station.type == "tradePost":
			model.run.player.x = station.x
			model.run.player.y = float(station.y) + 20
			break
	model.run.scrap = 1000
	_game.call("_handle_action", "fieldOpen")
	_game.call("_handle_action", "fieldTab:arsenal")
	_game.call("_handle_action", "fieldPage:2")
	await _capture("field-new-weapons-720")
	root.size = Vector2i(960, 540)
	await _capture("field-new-weapons-540")
	root.size = Vector2i(1280, 720)
	for id: String in ["ratchet_crossbow", "frost_projector", "breach_spear", "rust_cleaver"]:
		model = _fresh(id)
		var weapon: Dictionary = catalog.parameters("weapons", id)
		var pose: Dictionary = WeaponRules.compact_shot_pose(model.run.player, 1, 0, catalog)
		var distance: float = float(weapon.get("reach", 150)) * 0.75 if weapon.has("attackType") else 145
		var target: Dictionary = model.spawn_enemy("drifter", float(model.run.player.x) + distance,
			float(model.run.player.y) - 12 if weapon.has("attackType") else float(pose.muzzleY))
		target.hp = 1000
		target.maxHp = 1000
		model.set_input({"aimX": 1, "aimY": 0, "aimActive": true})
		model.fire_weapon(1, 0)
		var world: WorldView = _game.get("world")
		world.consume(model.drain_events())
		for frame: int in range(17 if id == "rust_cleaver" else 11 if id == "breach_spear" else 25):
			if model.screen == GameSession.Screen.PAUSED:
				model.set_screen(GameSession.Screen.RUNNING)
			model.tick(1.0 / 60)
			world.consume(model.drain_events())
		world.synchronize()
		await _capture("weapon-" + id)
	await _directions()
	_game.set_process(false)
	var audio: NativeAudio = _game.get("audio")
	audio.shutdown()
	_game.queue_free()
	await process_frame
	await create_timer(0.25).timeout
	print("COMBAT_VISUAL_REVIEW " + JSON.stringify({"codexResolutions": 4, "weaponDirections": 32, "directory": _directory}))
	quit()


func _fresh(id: String) -> RunSimulation:
	var session: GameSession = _game.get("session")
	session.save_data.selectedWeapon = id
	session.save_data.bestTime = 180
	_game.call("_start_run", {"seed": 88, "tutorial": false})
	var model: RunSimulation = _game.get("simulation")
	model.spawner_enabled = false
	model.release_entities()
	return model


func _choose(model: RunSimulation, id: String) -> void:
	model.run.upgradeOptions = [model.catalog.parameters("upgrades", id).duplicate(true)]
	model.set_screen(GameSession.Screen.UPGRADE)
	model.upgrades.choose(model, id)


func _pistol_shot(model: RunSimulation, name: String) -> void:
	model.set_input({"aimX": 1, "aimY": 0, "aimActive": true})
	model.run.mechanics = MechanicSystem.create_state()
	model.fire_weapon(1, 0)
	var world: WorldView = _game.get("world")
	world.consume(model.drain_events())
	for frame: int in range(10):
		if model.screen == GameSession.Screen.PAUSED:
			model.set_screen(GameSession.Screen.RUNNING)
		model.tick(1.0 / 60)
		world.consume(model.drain_events())
	world.synchronize()
	await _capture(name)


func _directions() -> void:
	var world: WorldView = _game.get("world")
	var battle: BattleView = _game.get("battle")
	world.visible = false
	battle.visible = false
	var grid := Node2D.new()
	root.add_child(grid)
	var catalog: GameCatalog = _game.get("catalog")
	var assets: AssetStore = _game.get("assets")
	var rows: Array[String] = ["ratchet_crossbow", "frost_projector", "breach_spear", "rust_cleaver"]
	for row: int in range(rows.size()):
		for direction: int in range(8):
			var visual := CharacterVisual.new()
			grid.add_child(visual)
			visual.configure(catalog, assets)
			visual.weapon_id = rows[row]
			visual.position = Vector2(82 + direction * 153, 130 + row * 165)
			visual.update_aim(direction * TAU / 8)
	await _capture("new-weapon-directions")
	grid.queue_free()


func _capture(name: String) -> void:
	for frame: int in range(4):
		await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(_directory.path_join(name + ".png"))
