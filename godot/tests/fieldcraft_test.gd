extends SceneTree
## Check bitmap coverage, new weapon outcomes and bounded death presentation independently of screenshots.

var _checks: int = 0
var _failures: Array[String] = []
var _catalog: GameCatalog
var _model: RunSimulation
var _decoded_art_bytes: int = 0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	_catalog = load("res://content/game_catalog.tres") as GameCatalog
	_model = RunSimulation.new(_catalog, _catalog.default_save.duplicate(true))
	_model.save.unlockedWeapons = _catalog.all("weapons").keys()
	_model.save.settings.autoAim = false
	_model.save.settings.autoFire = false
	_check(_catalog.definitions.size() == 164 and _catalog.all("weapons").size() == 20 and _catalog.all("upgrades").size() == 42, "explicit content counts")
	_test_art()
	_test_card_text()
	_test_burning()
	_test_chain()
	_test_melee()
	_test_ownership()
	_test_impacts()
	_model.release_entities()
	var report: Dictionary = {"checks": _checks, "failures": _failures, "decodedArtBytes": _decoded_art_bytes,
		"uniqueUpgradeArt": 42, "refinedWeapons": 13, "deathTypes": 8,
		"scope": "Native bitmap decode, actual attacks/status/ownership, bounded presentation; not human visual or balance acceptance"}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://../output/fieldcraft-v2"))
	var file: FileAccess = FileAccess.open("res://../output/fieldcraft-v2/tests.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  ") + "\n")
	file.close()
	print("GODOT_FIELDCRAFT " + JSON.stringify(report))
	quit(0 if _failures.is_empty() else 1)


func _fresh(id: String) -> void:
	_model.start_run({"weaponId": id, "modeId": "endless", "seed": 9201, "tutorial": false,
		"worldSize": 1024, "layout": {"id": "fieldcraft_arena", "obstacles": [], "interactives": [],
			"roads": [], "zones": [], "tracks": [], "scenery": [], "theme": {}}})
	_model.release_entities()
	_model.spawner_enabled = false
	_model.run.player.merge({"damageMultiplier": 1.0, "criticalChance": 0.0,
		"fireRateMultiplier": 1.0, "projectileBonus": 0, "pierceBonus": 0,
		"projectileRangeMultiplier": 1.0, "projectileSpeedMultiplier": 1.0}, true)
	_model.run.player.xpNext = 1000000.0
	_model.rebuild_enemy_grid()
	_model.drain_events()


func _target(x: float, y: float, hp: float = 1000.0) -> Dictionary:
	var enemy: Dictionary = _model.spawn_enemy("brute", x, y)
	enemy.hp = hp
	enemy.maxHp = hp
	return enemy


func _advance_shot(frames: int = 30) -> void:
	_model.rebuild_enemy_grid()
	for index: int in range(frames):
		_model.run.elapsed += 1.0 / 60
		_model.combat.update_projectiles(_model, 1.0 / 60)


func _test_art() -> void:
	var art: Dictionary = _catalog.metadata.combatArt
	_check(art.frames.size() == 6 and art.upgradeTextures.size() == 42 and art.weaponTextures.size() == 13 and art.deathTextures.size() == 8, "all active bitmap categories covered")
	var hashes: Dictionary = {}
	for id: String in art.upgradeTextures:
		var texture: Texture2D = CombatArt.icon(_catalog, id)
		_check(texture != null and texture.get_size() == Vector2(112, 112), "independent upgrade texture: " + id)
		if texture != null:
			var image: Image = texture.get_image()
			hashes[hash(image.get_data())] = true
			_decoded_art_bytes += image.get_data_size()
	_check(hashes.size() == 42, "no reused central illustration among the 42 upgrade IDs")
	for value: String in art.frames:
		var texture: Texture2D = CombatArt.texture(value)
		_check(texture != null and texture.get_size() == Vector2(256, 384), "tactile frame loads: " + value)
		if texture != null:
			_decoded_art_bytes += texture.get_image().get_data_size()
	var assets := AssetStore.new(_catalog)
	for id: String in art.weaponTextures:
		var texture: Texture2D = assets.weapon_texture(id)
		var spec: Dictionary = _catalog.metadata.poses[id].definition.visual
		_check(texture != null and texture.get_size() == Vector2(float(spec.width) * 2, float(spec.height) * 2), "double-resolution independent gun body: " + id)
		if texture != null:
			_decoded_art_bytes += texture.get_image().get_data_size()
			_check(texture.get_image().get_used_rect().size.x >= texture.get_width() * 0.65, "long weapon was not shrunk by transparent source padding: " + id)
			_check(_palms_touch(id, texture.get_image(), assets), "independent hand layers contact the refined weapon: " + id)
	for id: String in art.deathTextures:
		var texture: Texture2D = CombatArt.texture(art.deathTextures[id])
		_check(texture != null and texture.get_size() == Vector2(512, 128), "four real death drawings: " + id)
		if texture != null:
			_decoded_art_bytes += texture.get_image().get_data_size()
	_check(_decoded_art_bytes < 10 * 1024 * 1024, "all new bitmap uncompressed pixel data remains under 10MiB")
	var previous: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://../art/combat/survival-builds-v1/design.json"))
	for weapon: Dictionary in previous.weapons:
		var actual: Dictionary = _catalog.parameters("weapons", weapon.id)
		var same: bool = actual.size() == weapon.size()
		for key: String in weapon:
			if not actual.has(key):
				same = false
			elif weapon[key] is float or weapon[key] is int:
				same = same and absf(float(actual[key]) - float(weapon[key])) < 1e-7
			else:
				same = same and actual[key] == weapon[key]
		_check(same, "previous weapon stats unchanged: " + str(weapon.id))
	var restored: Dictionary = _catalog.metadata.combatArt
	_catalog.metadata.erase("combatArt")
	_check(CombatArt.icon(_catalog, "damage") == null and CombatArt.frame(_catalog, "firepower", "standard") == null, "missing bitmap metadata leaves fallback available")
	_catalog.metadata.combatArt = restored


func _palms_touch(id: String, image: Image, assets: AssetStore) -> bool:
	var pose: Dictionary = _catalog.metadata.poses[id]
	var factor := Vector2(float(image.get_width()) / float(pose.definition.visual.width), float(image.get_height()) / float(pose.definition.visual.height))
	for part: Dictionary in pose.layout.layers:
		if part.kind != "hand":
			continue
		var hand: Image = assets.texture(_catalog.metadata.actorMetadata.PART_ASSETS[part.asset]).get_image()
		var sum := Vector2.ZERO
		var count: int = 0
		for y: int in range(int(part.rect[3])):
			for x: int in range(int(part.rect[2])):
				if hand.get_pixel(int(part.rect[0]) + x, int(part.rect[1]) + y).a > 0.5:
					sum += Vector2(x + 0.5, y + 0.5)
					count += 1
		var center: Vector2 = Vector2(part.x, part.y) + sum / maxi(1, count)
		var nearest: float = INF
		for y: int in range(image.get_height()):
			for x: int in range(image.get_width()):
				if image.get_pixel(x, y).a > 0.5:
					nearest = minf(nearest, center.distance_squared_to(Vector2(x + 0.5, y + 0.5) / factor))
		if nearest > 1.2 * 1.2:
			return false
	return true


func _test_card_text() -> void:
	var card := UpgradeCard.new()
	card.fonts = UiFonts.new()
	card.catalog = _catalog
	for scale: float in [1.0, 1.2]:
		card.fonts.ui_scale = scale
		for width: int in [216, 292]:
			for id: String in _catalog.all("upgrades"):
				var option: Dictionary = _catalog.parameters("upgrades", id)
				var broad: bool = option.family == "utility" and option.rarity not in ["prototype", "evolution"]
				var available: float = width * (0.56 if broad else 0.58)
				var size: int = 14 if width < 260 else 16
				var lines: Array[String] = card._wrap_text(WorkshopRules.detail(option), available, size, 800)
				while lines.size() > 3 and size > 12:
					size -= 1
					lines = card._wrap_text(WorkshopRules.detail(option), available, size, 800)
				_check(lines.size() <= 3, "complete effect fits readable lines at %d scale %.1f: %s" % [width, scale, id])
	card.free()


func _test_burning() -> void:
	_fresh("ember_sprayer")
	var pose: Dictionary = WeaponRules.compact_shot_pose(_model.run.player, 1, 0, _catalog)
	var enemy: Dictionary = _target(float(pose.muzzleX) + 60, pose.muzzleY)
	_model.fire_weapon(1, 0)
	_advance_shot(16)
	_check(enemy.has("burnUntil") and float(enemy.hp) < 1000, "actual flame projectile hits and ignites")
	if not enemy.has("burnUntil"):
		return
	var initial_damage: float = float(enemy.burnDamage)
	var until: float = float(enemy.burnUntil)
	_model.run.elapsed = float(enemy.burnNext)
	var before: float = float(enemy.hp)
	StatusWeaponRules.tick(_model, enemy)
	_check(is_equal_approx(before - float(enemy.hp), 3.0), "real scheduled burn deals three base damage")
	StatusWeaponRules.on_hit(_model, enemy, {"owner": "player", "weaponId": "ember_sprayer"}, 3)
	_check(float(enemy.burnUntil) > until and float(enemy.burnDamage) == initial_damage, "repeated flame refreshes lifetime without stacking damage")
	_model.run.player.damageMultiplier = 1.15
	StatusWeaponRules.on_hit(_model, enemy, {"owner": "player", "weaponId": "ember_sprayer"}, 3)
	_check(absf(float(enemy.burnDamage) - 3.45) < 0.0001, "damage upgrades also affect burn power")
	_model.enemy_pool.release(enemy)
	var reused: Dictionary = _target(600, 500)
	_check(not reused.has("burnUntil") and not reused.has("burnDamage") and not reused.has("burnWeapon"), "pooled enemy clears every burn owner and timer")
	_fresh("ember_sprayer")
	_model.fire_weapon(1, 0)
	var doomed: Dictionary = _target(650, 500, 3)
	StatusWeaponRules.on_hit(_model, doomed, {"owner": "player", "weaponId": "ember_sprayer"}, 1)
	_model.run.elapsed = float(doomed.burnNext)
	StatusWeaponRules.tick(_model, doomed)
	_check(not doomed.active and int(_model.run.weaponStats.ember_sprayer.kills) == 1 and int(_model.run.kills) == 1, "burn kill retains weapon ownership and happens exactly once")


func _test_chain() -> void:
	_fresh("arc_repeater")
	var pose: Dictionary = WeaponRules.compact_shot_pose(_model.run.player, 1, 0, _catalog)
	var targets: Array[Dictionary] = []
	for index: int in range(4):
		targets.append(_target(float(pose.muzzleX) + 60 + index * 65, pose.muzzleY))
	_model.fire_weapon(1, 0)
	_advance_shot()
	_check(absf(float(targets[0].hp) - 982) < 0.0001, "electric projectile applies initial eighteen damage")
	_check(absf(float(targets[1].hp) - 988.3) < 0.0001 and absf(float(targets[2].hp) - 992.395) < 0.0001, "two successive actual chain hits retain 65 percent each")
	_check(float(targets[3].hp) == 1000, "electric chain stops after the advertised two jumps")
	var arcs: int = 0
	for event: Dictionary in _model.drain_events():
		if event.type == "weaponArc":
			arcs += 1
	_check(arcs == 2, "actual electric visual events agree with the hit count")
	_fresh("arc_repeater")
	pose = WeaponRules.compact_shot_pose(_model.run.player, 1, 0, _catalog)
	var first: Dictionary = _target(float(pose.muzzleX) + 50, pose.muzzleY)
	var second: Dictionary = _target(float(first.x) + 90, first.y)
	_model.obstacles.append({"x": float(first.x) + 42, "y": float(first.y) - 30, "w": 5.0, "h": 60.0})
	_model.rebuild_obstacle_grid()
	_model.fire_weapon(1, 0)
	_advance_shot()
	_check(float(first.hp) < 1000 and float(second.hp) == 1000, "chain cannot jump through a wall")
	var pooled: Dictionary = _model.projectile_pool.acquire({"arcTriggered": true})
	pooled.arcTriggered = true
	_model.projectile_pool.release(pooled)
	var fresh: Dictionary = _model.projectile_pool.acquire()
	_check(not fresh.has("arcTriggered"), "ordinary reused projectile has no prior chain trigger flag")
	_model.projectile_pool.release(fresh)


func _test_melee() -> void:
	for id: String in ["scrap_knuckles", "reaper_scythe"]:
		for direction: int in range(8):
			_fresh(id)
			var weapon: Dictionary = _catalog.parameters("weapons", id)
			var angle: float = direction * TAU / 8
			var target: Dictionary = _target(512 + cos(angle) * float(weapon.reach) * 0.7, 500 + sin(angle) * float(weapon.reach) * 0.7)
			var aim: Dictionary = WeaponRules.correct_aim(_model.run.player, target, _catalog)
			_model.fire_weapon(aim.x, aim.y)
			for frame: int in range(65):
				_model.run.elapsed += 1.0 / 60
				_model.weapons.update(_model, 1.0 / 60)
			_check(float(target.hp) < 1000 and _model.projectiles.is_empty(), id + " direction hits without an inherited sword wave: " + str(direction))
		_fresh(id)
		var weapon: Dictionary = _catalog.parameters("weapons", id)
		var target: Dictionary = _target(512 + float(weapon.reach) * 0.7, 500)
		_model.obstacles.append({"x": 512 + float(weapon.reach) * 0.35, "y": 465.0, "w": 6.0, "h": 70.0})
		_model.fire_weapon(1, 0)
		for frame: int in range(65):
			_model.run.elapsed += 1.0 / 60
			_model.weapons.update(_model, 1.0 / 60)
		_check(float(target.hp) == 1000, id + " respects solid cover")


func _test_ownership() -> void:
	for id: String in ["ember_sprayer", "arc_repeater", "scrap_knuckles", "reaper_scythe"]:
		var save: Dictionary = _catalog.default_save.duplicate(true)
		save.currencies.copper = 1000
		var purchase: Dictionary = EconomyRules.buy_shop(save, _catalog.parameters("shopItems", "buy_" + id), 3)
		_check(purchase.ok and id in save.unlockedWeapons, id + " permanent purchase")
		var normalized: Dictionary = SaveCodec.normalize(save, _catalog.default_save, _catalog.metadata.survival.legacyMaps)
		_check(id in normalized.unlockedWeapons, id + " ownership survives normalization")
		_fresh("scrap_pistol")
		_model.run.scrap = 1000
		_model.interactives.append({"id": "qa-market", "type": "tradePost", "active": true, "x": 512.0, "y": 512.0, "radius": 90.0})
		_check(_model.field_market.open(_model) and _model.arsenal.buy(_model, id) and _model.run.player.weaponId == id, id + " real field purchase and equip")


func _test_impacts() -> void:
	_fresh("scrap_pistol")
	var impacts := CombatImpacts.new()
	impacts.configure(_model)
	var enemy: Dictionary = _target(620, 500, 8)
	_model.damage_enemy(enemy, 12, {"owner": "player", "weaponId": "scrap_pistol", "vx": 1.0, "vy": 0.0, "knockback": 30.0})
	impacts.consume(_model.drain_events())
	_check(not enemy.active and impacts.corpses.size() == 1, "actual kill removes enemy while retaining one independent death drawing")
	var original: Dictionary = impacts.corpses[0].duplicate(true)
	_model.spawn_enemy("runner", 800, 800)
	_check(impacts.corpses[0] == original, "pool reuse cannot alter a corpse snapshot")
	for pair: Array in [[0.0, 0], [0.1, 1], [0.2, 2], [0.35, 3]]:
		impacts.advance(float(pair[0]))
		_check(impacts.corpse_frame(impacts.corpses[0]) == int(pair[1]), "death advances through actual distinct pose at " + str(pair[0]))
	_model.run.elapsed = 0.35
	impacts.consume([{"type": "hit", "enemyId": 999, "x": 600.0, "y": 500.0, "aimX": 1.0, "aimY": 0.0,
		"damage": 4.0, "critical": false, "appliedKnockback": 20.0, "weaponId": "scrap_pistol", "attackId": 55}])
	_model.save.settings.flashes = "off"
	impacts.advance(0.39)
	var pose: Dictionary = impacts.reaction_pose(999)
	_check(float(pose.brightness) == 1.0 and Vector2(pose.offset).length() > 0, "flashes off retains directional reaction without brightness pulses")
	_model.save.settings.flashes = "subtle"
	for index: int in range(180):
		impacts.consume([{"type": "kill", "enemyId": 1000 + index, "enemyType": "drifter", "x": 600.0, "y": 500.0, "boss": false, "elite": false}])
	_check(impacts.corpses.size() == CombatImpacts.MAX_CORPSES and impacts.bursts.size() <= CombatImpacts.MAX_BURSTS, "dense deaths remain inside fixed presentation budgets")
	impacts.advance(10.0)
	_check(impacts.corpses.is_empty() and impacts.bursts.is_empty() and impacts.reactions.is_empty(), "expired corpse and particle state is released")
	_model.save.settings.quality = "low"
	impacts = CombatImpacts.new()
	impacts.configure(_model)
	for index: int in range(90):
		impacts.consume([{"type": "hit", "enemyId": index, "x": 600.0, "y": 500.0, "aimX": 1.0, "aimY": 0.0,
			"damage": 4.0, "critical": false, "appliedKnockback": 20.0, "weaponId": "scrap_pistol", "attackId": index},
			{"type": "kill", "enemyId": index, "enemyType": "drifter", "x": 600.0, "y": 500.0, "boss": false, "elite": false}])
	_check(impacts.corpses.size() == 20 and impacts.bursts.size() == 56, "low quality halves corpse and burst budgets")
	for id: String in ["ember_sprayer", "arc_repeater"]:
		_check(ItemPresentation.weapon_summary(_catalog.parameters("weapons", id)).size() == 3, "new ranged weapon has a complete compact three-line summary: " + id)


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
