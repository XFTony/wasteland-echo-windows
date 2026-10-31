extends "res://tests/combat_visual_review.gd"
## Actual native window captures; forced card galleries and isolated death timing are labeled QA fixtures.

const DrawLayer = preload("res://scripts/presentation/world_draw_layer.gd")
var _labels := UiFonts.new()


func _run() -> void:
	_directory = ProjectSettings.globalize_path("res://../output/fieldcraft-v2/review")
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
	session.save_data.settings.flashes = "off"
	if "--grips-only" in OS.get_cmdline_user_args():
		var model: RunSimulation = _fresh("reaper_scythe")
		await _grip_gallery()
		model = _fresh("reaper_scythe")
		var target: Dictionary = model.spawn_enemy("drifter", float(model.run.player.x) + 83, float(model.run.player.y) - 12)
		target.hp = 1000
		target.speed = 0
		model.fire_weapon(1, 0)
		var world: WorldView = _game.get("world")
		for step: int in range(17):
			model.tick(1.0 / 60)
			world.consume(model.drain_events())
		world.synchronize()
		await _capture("attack-reaper_scythe")
		var audio: NativeAudio = _game.get("audio")
		audio.shutdown()
		_game.queue_free()
		await process_frame
		await create_timer(0.25).timeout
		print("FIELDCRAFT_GRIP_REVIEW 104 poses and corrected scythe attack")
		quit()
		return
	if "--extra-ui" in OS.get_cmdline_user_args():
		await _extra_ui()
		var audio: NativeAudio = _game.get("audio")
		audio.shutdown()
		_game.queue_free()
		await process_frame
		await create_timer(0.25).timeout
		quit()
		return
	var model: RunSimulation = _fresh("scrap_pistol")
	var showcase: Array[String] = ["executionCapacitor", "reactivePlating", "magnet", "cascadeRounds"]
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720), Vector2i(1920, 1080), Vector2i(2560, 1440)]:
		root.size = dimensions
		await process_frame
		_set_cards(model, showcase)
		await create_timer(0.55).timeout
		await _capture("upgrade-%d" % dimensions.y)
	root.size = Vector2i(1280, 720)
	var ids: Array = catalog.all("upgrades").keys()
	for offset: int in range(0, ids.size(), 4):
		var group: Array[String] = []
		for id: String in ids.slice(offset, mini(offset + 4, ids.size())):
			group.append(id)
		_set_cards(model, group)
		await create_timer(0.48).timeout
		await _capture("card-gallery-%02d" % (offset / 4))
	if "--cards-only" in OS.get_cmdline_user_args():
		var audio: NativeAudio = _game.get("audio")
		audio.shutdown()
		_game.queue_free()
		await process_frame
		await create_timer(0.25).timeout
		print("FIELDCRAFT_CARD_REVIEW 42 cards, four resolutions")
		quit()
		return
	_game.call("_return_to_menu")
	session.action("shop")
	session.shop_category = "weapon"
	for page: int in [1, 2, 3]:
		session.shop_page = page
		session.changed.emit()
		await _capture("weapon-shop-%d" % page)
	model = _fresh("ember_sprayer")
	for id: String in ["ember_sprayer", "arc_repeater", "scrap_knuckles", "reaper_scythe"]:
		model = _fresh(id)
		var weapon: Dictionary = catalog.parameters("weapons", id)
		var pose: Dictionary = WeaponRules.compact_shot_pose(model.run.player, 1, 0, catalog)
		var melee: bool = weapon.get("attackType") == "slash"
		for index: int in range(3):
			var target: Dictionary = model.spawn_enemy("drifter", float(model.run.player.x) + float(weapon.reach) * 0.72 if melee else float(pose.muzzleX) + 55 + index * 55,
				float(model.run.player.y) - 12 if melee else float(pose.muzzleY))
			target.hp = 1000
			target.speed = 0
			if melee:
				break
		model.fire_weapon(1, 0)
		var world: WorldView = _game.get("world")
		world.consume(model.drain_events())
		var steps: int = 17 if id == "reaper_scythe" else 4 if id == "scrap_knuckles" else 9
		for index: int in range(steps):
			model.tick(1.0 / 60)
			world.consume(model.drain_events())
		world.synchronize()
		await _capture("attack-" + id)
	await _grip_gallery()
	await _death_clip()
	var audio: NativeAudio = _game.get("audio")
	audio.shutdown()
	_game.set_process(false)
	_game.queue_free()
	await process_frame
	await create_timer(0.25).timeout
	print("FIELDCRAFT_VISUAL_REVIEW " + JSON.stringify({"cards": 42, "weaponDirections": 104, "deathFrames": 80, "directory": _directory}))
	quit()


func _set_cards(model: RunSimulation, ids: Array[String]) -> void:
	model.run.upgradeOptions = []
	for id: String in ids:
		var option: Dictionary = model.catalog.parameters("upgrades", id).duplicate(true)
		option.detail = WorkshopRules.detail(option, model.catalog.parameters("weapons", model.run.player.weaponId))
		option["preview"] = WorkshopRules.preview(id, model.run.player, model.run, model.catalog.parameters("weapons", model.run.player.weaponId))
		model.run.upgradeOptions.append(option)
	model.set_screen(GameSession.Screen.UPGRADE)
	var battle: BattleView = _game.get("battle")
	battle.refresh()


func _extra_ui() -> void:
	var session: GameSession = _game.get("session")
	for dimensions: Vector2i in [Vector2i(960, 540), Vector2i(1280, 720)]:
		root.size = dimensions
		_game.call("_return_to_menu")
		session.action("shop")
		session.shop_category = "weapon"
		for page: int in range(4):
			session.shop_page = page
			session.changed.emit()
			await _capture("shop-%d-%d" % [page, dimensions.y])
		var model: RunSimulation = _fresh("scrap_pistol")
		for station: Dictionary in model.interactives:
			if station.type == "tradePost":
				model.run.player.x = station.x
				model.run.player.y = float(station.y) + 20
				break
		model.run.scrap = 1000
		_game.call("_handle_action", "fieldOpen")
		_game.call("_handle_action", "fieldTab:arsenal")
		for page: int in [2, 3]:
			_game.call("_handle_action", "fieldPage:" + str(page))
			await _capture("field-%d-%d" % [page, dimensions.y])
	root.size = Vector2i(1280, 720)
	var model: RunSimulation = _fresh("scrap_pistol")
	_set_cards(model, ["executionCapacitor", "reactivePlating", "magnet", "cascadeRounds"])
	await create_timer(0.5).timeout
	await _capture("upgrade-final-720")
	var battle: BattleView = _game.get("battle")
	for child: Node in battle.get_children():
		if child is UpgradeCard:
			var motion := InputEventMouseMotion.new()
			motion.position = child.get_global_rect().get_center()
			root.push_input(motion, true)
			await create_timer(0.25).timeout
			await _capture("upgrade-first-hover")
			print("FIELDCRAFT_FIRST_HOVER " + JSON.stringify({"active": child.interaction_active(), "lift": child._hover}))
			break


func _grip_gallery() -> void:
	var world: WorldView = _game.get("world")
	var battle: BattleView = _game.get("battle")
	var menu: MenuView = _game.get("menu")
	world.visible = false
	battle.visible = false
	menu.visible = false
	var catalog: GameCatalog = _game.get("catalog")
	var assets: AssetStore = _game.get("assets")
	var ids: Array = catalog.metadata.combatArt.weaponTextures.keys()
	for offset: int in range(0, ids.size(), 4):
		var grid := Node2D.new()
		root.add_child(grid)
		var heading := DrawLayer.new()
		grid.add_child(heading)
		var names: Array[String] = []
		for row: int in range(mini(4, ids.size() - offset)):
			var id: String = ids[offset + row]
			names.append(str(catalog.parameters("weapons", id).name))
			for direction: int in range(8):
				var visual := CharacterVisual.new()
				grid.add_child(visual)
				visual.configure(catalog, assets)
				visual.weapon_id = id
				visual.position = Vector2(82 + direction * 153, 138 + row * 165)
				visual.update_aim(direction * TAU / 8)
		heading.paint = func(canvas: CanvasItem) -> void:
			for row: int in range(names.size()):
				_labels.text(canvas, names[row], Vector2(20, 30 + row * 165), 14, Color("d2c69f"))
		await _capture("grips-%d" % (offset / 4))
		grid.queue_free()
		await process_frame
	world.visible = true
	battle.visible = true


func _death_clip() -> void:
	root.size = Vector2i(1280, 720)
	var model: RunSimulation = _fresh("scrap_pistol")
	var world: WorldView = _game.get("world")
	model.run.player.hp = 100000.0
	model.run.player.maxHp = 100000.0
	model.run.player.xpNext = 1000000.0
	var names: Array[String] = ["drifter", "runner", "spitter", "brute", "screecher", "crawler", "warden", "iron_colossus"]
	var targets: Array[Dictionary] = []
	for index: int in range(names.size()):
		var target: Dictionary = model.spawn_enemy(names[index], float(model.run.player.x) - 190 + (index % 4) * 150,
			float(model.run.player.y) + 90 + (index / 4) * 125)
		target.hp = 100
		target.maxHp = 100
		target.speed = 0
		target.actionCooldown = 999
		targets.append(target)
	var frames: String = _directory.path_join("death-frames")
	DirAccess.make_dir_recursive_absolute(frames)
	for frame_index: int in range(80):
		if frame_index in [3, 7, 12]:
			for target: Dictionary in targets:
				if target.active:
					model.damage_enemy(target, 120 if frame_index == 12 else 8,
						{"owner": "player", "weaponId": "scrap_pistol", "vx": 1.0, "vy": 0.0,
							"knockback": 26.0, "critical": frame_index == 12, "attackId": frame_index})
		for step: int in range(3):
			if model.screen == GameSession.Screen.PAUSED:
				model.set_screen(GameSession.Screen.RUNNING)
			model.tick(1.0 / 60)
			world.consume(model.drain_events())
		world.synchronize()
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(frames.path_join("frame-%03d.png" % frame_index))
		if frame_index in [4, 13, 16, 24, 50]:
			root.get_texture().get_image().save_png(_directory.path_join("death-%02d.png" % frame_index))
