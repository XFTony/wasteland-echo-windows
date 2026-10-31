extends SceneTree
## Test real selections, emitted attacks, hits, status lifetime and permanent wave progress.

var _checks: int = 0
var _failures: Array[String] = []
var _audit: Array[Dictionary] = []
var _catalog: GameCatalog
var _model: RunSimulation


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	_catalog = load("res://content/game_catalog.tres") as GameCatalog
	_model = RunSimulation.new(_catalog, _catalog.default_save.duplicate(true))
	_model.save.unlockedWeapons = _catalog.all("weapons").keys()
	_model.save.unlockedEvolutions = _catalog.all("upgrades").keys()
	_model.save.settings.autoFire = false
	_model.save.settings.autoAim = false
	_check(_catalog.definitions.size() == 164 and _catalog.all("weapons").size() == 20 and _catalog.all("upgrades").size() == 42, "native content addition count is deliberate")
	_audit_all_selections()
	_test_multishot()
	_test_live_modifiers()
	_test_trigger_mechanics()
	_test_new_weapons()
	_test_caps_and_economy()
	_test_growth_and_unlocks()
	await _test_new_ui()
	_model.release_entities()
	var report: Dictionary = {"checks": _checks, "failures": _failures,
		"weapons": _catalog.all("weapons").size(), "upgrades": _catalog.all("upgrades").size(),
		"selections": _audit, "scope": "Actual native selections, firing, hits and progression; not human difficulty acceptance"}
	var directory: String = ProjectSettings.globalize_path("res://../output/survival-builds")
	DirAccess.make_dir_recursive_absolute(directory)
	var file: FileAccess = FileAccess.open(directory.path_join("behavior.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  ") + "\n")
	file.close()
	print("GODOT_SURVIVAL_BUILDS " + JSON.stringify({"checks": _checks, "failures": _failures,
		"weapons": _catalog.all("weapons").size(), "auditedUpgrades": _audit.size()}))
	quit(0 if _failures.is_empty() else 1)


func _fresh(weapon_id: String = "scrap_pistol") -> void:
	_model.save.bestTime = 180.0
	_model.start_run({"weaponId": weapon_id, "modeId": "endless", "seed": 88, "tutorial": false,
		"worldSize": 1024, "layout": {"id": "behavior_arena", "obstacles": [], "interactives": [],
			"roads": [], "zones": [], "tracks": [], "scenery": [], "theme": {}}})
	_model.release_entities()
	_model.spawner_enabled = false
	_model.run.player.merge({"hp": 40.0, "maxHp": 100.0, "armor": 0.0, "criticalChance": 0.0,
		"criticalMultiplier": 2.0, "damageMultiplier": 1.0, "fireRateMultiplier": 1.0,
		"projectileBonus": 0, "pierceBonus": 0, "projectileSpeedMultiplier": 1.0,
		"projectileRangeMultiplier": 1.0, "projectileRadiusBonus": 0.0, "knockbackMultiplier": 1.0,
		"pickupRadius": 48.0, "scrapMultiplier": 1.0, "scrapChanceBonus": 0.0, "noHitTime": 0.0}, true)
	_model.run.player.xpNext = 1000000.0
	_model.rebuild_enemy_grid()


func _choose(id: String) -> bool:
	_model.run.upgradeOptions = [_catalog.parameters("upgrades", id).duplicate(true)]
	_model.set_screen(GameSession.Screen.UPGRADE)
	return _model.upgrades.choose(_model, id)


func _fire(x: float = 1.0, y: float = 0.0) -> void:
	_model.run.attack = null
	_model.run.mechanics = MechanicSystem.create_state()
	_model.fire_weapon(x, y)


func _payload() -> Dictionary:
	if _model.run.attack != null:
		return {"damage": _model.run.attack.source.damage, "cooldown": _model.run.player.weaponCooldown,
			"range": _model.run.attack.range, "knockback": _model.run.attack.source.knockback}
	if not _model.projectiles.is_empty():
		var projectile: Dictionary = _model.projectiles[0]
		return {"damage": projectile.damage, "speed": Vector2(projectile.vx, projectile.vy).length(),
			"knockback": projectile.knockback, "radius": projectile.radius, "ttl": projectile.ttl,
			"pierce": projectile.pierce, "bounces": projectile.bounces, "blastRadius": projectile.blastRadius}
	return {}


func _audit_all_selections() -> void:
	for id: String in _catalog.all("upgrades"):
		var definition: Dictionary = _catalog.parameters("upgrades", id)
		var accepted: bool = false
		var applied: bool = false
		var state_changed: bool = false
		var weapon_id: String = ""
		for candidate: String in _catalog.all("weapons"):
			_fresh(candidate)
			_model.run.upgrades = definition.get("requires", {}).get("upgrades", {}).duplicate(true)
			_model.run.turretKits = 1
			if not _model.upgrades.requirements_met(_model, definition):
				continue
			accepted = true
			weapon_id = candidate
			var before: Dictionary = _upgrade_state()
			applied = _choose(id)
			state_changed = before != _upgrade_state()
			break
		_check(accepted and applied and state_changed, "selectable with a real native state change: " + id)
		_audit.append({"id": id, "name": definition.name, "weapon": weapon_id, "selected": applied,
			"stateChanged": state_changed, "unlockWave": definition.get("unlockWave", 0)})


func _upgrade_state() -> Dictionary:
	return {"player": _model.run.player.duplicate(true),
		"mechanics": _model.run.mechanicUpgrades.duplicate(true),
		"engineering": _model.run.engineering, "turretRegen": _model.run.turretRegen,
		"scrap": _model.run.scrap}


func _test_multishot() -> void:
	for id: String in _catalog.all("weapons"):
		var weapon: Dictionary = _catalog.parameters("weapons", id)
		if weapon.get("attackType") in ["slash", "slam"]:
			_fresh(id)
			_check(not _model.upgrades.requirements_met(_model, _catalog.parameters("upgrades", "projectile")), id + " does not roll invalid projectile card")
			continue
		for direction: int in range(8):
			_fresh(id)
			var before: int = WeaponRules.projectile_count(weapon, _model.run.player)
			_check(_choose("projectile"), id + " selects +1")
			var angle: float = direction * TAU / 8
			_fire(cos(angle), sin(angle))
			var count: int = 0
			if weapon.get("attackType") == "beam":
				for effect: Dictionary in _model.run.attackEffects:
					if effect.active and effect.kind == "beam":
						count += 1
			else:
				count = _model.projectiles.size()
				var rays: Dictionary = {}
				for projectile: Dictionary in _model.projectiles:
					rays[snappedf(atan2(projectile.vy, projectile.vx), 0.0001)] = true
				_check(rays.size() > 1, id + " extra bullets are visibly separated at direction " + str(direction))
			_check(count == before + 1, id + " actual volley grows by one at direction " + str(direction))


func _test_live_modifiers() -> void:
	for id: String in _catalog.all("weapons"):
		_fresh(id)
		_fire()
		var before: Dictionary = _payload()
		if not before.is_empty():
			_model.release_entities()
			_check(_choose("damage"), id + " damage selected")
			_fire()
			_check(float(_payload().damage) > float(before.damage) * 1.14, id + " damage buff reaches emitted attack")
	for id: String in ["scrap_pistol", "slag_launcher", "saw_disc"]:
		_fresh(id)
		_fire()
		var before: Dictionary = _payload()
		_model.release_entities()
		_model.run.mechanicUpgrades.salvageOverdrive = 2
		_model.run.mechanics.overdriveTime = 1.0
		_model.fire_weapon(1, 0)
		_check(absf(float(_payload().speed) / float(before.speed) - 1.16) < 0.001, id + " overdrive actual speed is 116%")
	for id: String in ["slag_launcher", "saw_disc"]:
		_fresh(id)
		_model.run.player.noHitTime = 4.1
		_choose("focusProtocol")
		_fire()
		_check(_model.projectiles[0].empowered, id + " marks empowered shots for their actual visuals")
	_fresh("saw_disc")
	_check(_choose("ricochetCoil"), "ricochet upgrade selected")
	_fire()
	_check(int(_payload().bounces) == 3, "new disc has an actual third bounce")
	_fresh("echo_blade")
	_fire()
	var before: Dictionary = _payload()
	_choose("meleeTempo")
	_fire()
	_check(float(_payload().damage) > float(before.damage) and float(_payload().cooldown) < float(before.cooldown), "melee tempo changes both damage and real interval")
	_fresh("slag_launcher")
	_choose("blastFocus")
	_fire()
	_check(float(_payload().blastRadius) > 95 and float(_payload().damage) > 42, "blast upgrade reaches real explosion payload")
	_fresh("scrap_pistol")
	_model.run.player.hp = 40.0
	_choose("killMend")
	for index: int in range(12):
		var enemy: Dictionary = _model.spawn_enemy("drifter", 650, 500)
		_model.damage_enemy(enemy, 100, {"owner": "player", "weaponId": "scrap_pistol", "vx": 1, "vy": 0})
	_check(is_equal_approx(float(_model.run.player.hp), 41), "12 real kills trigger healing")
	_fresh()
	_choose("recovery")
	for index: int in range(78):
		_model.tick(0.05)
	_check(is_equal_approx(float(_model.run.player.hp), 40), "recovery cannot heal before four seconds without a hit")
	for index: int in range(6):
		_model.tick(0.05)
	_check(float(_model.run.player.hp) > 40, "recovery heals after its actual grace period")
	_fresh()
	_model.run.player.criticalChance = 1.0
	_choose("critDamage")
	_fire()
	_check(absf(float(_payload().damage) - 26.4) < 0.001, "critical multiplier upgrade affects real critical payload")
	_fresh()
	_fire()
	var rate_before: float = _model.run.player.weaponCooldown
	_model.release_entities()
	_choose("fireRate")
	_fire()
	_check(float(_model.run.player.weaponCooldown) < rate_before, "attack speed shortens actual cooldown")
	_fresh()
	_fire()
	var moving_before: Dictionary = _payload()
	_model.release_entities()
	_choose("velocity")
	_choose("caliber")
	_fire()
	_check(float(_payload().speed) > float(moving_before.speed) * 1.15 and float(_payload().ttl) > float(moving_before.ttl), "velocity changes real speed and lifetime")
	_check(float(_payload().radius) > float(moving_before.radius) and float(_payload().knockback) > float(moving_before.knockback), "caliber changes real radius and knockback")
	_fresh()
	var pickup: Dictionary = _model.combat.spawn_pickup(_model, "scrap", 566, 512, 1)
	_model.combat.update_pickups(_model, 0.01)
	_check(is_equal_approx(float(pickup.x), 566), "pickup outside original radius stays still")
	_choose("magnet")
	_model.combat.update_pickups(_model, 0.01)
	_check(float(pickup.x) < 566, "magnet starts actual attraction farther away")
	_fresh()
	_choose("armor")
	_model.combat.damage_player(_model, 10, 540, 512, {"type": "drifter"})
	_check(absf(float(_model.run.player.hp) - 30.8) < 0.001, "armor reduces an actual hit to 9.2")
	_fresh()
	var walk_before: float = _model.run.player.speed
	_choose("fieldRush")
	var start_x: float = _model.run.player.x
	_model.set_input({"moveX": 1})
	_model.tick(0.05)
	_check(float(_model.run.player.x) - start_x > walk_before * 0.052, "field rush increases actual walked distance")
	_fresh("breaker_shotgun")
	_model.random = RandomStream.new(991)
	_fire()
	var spread_before: float = atan2(_model.projectiles.back().vy, _model.projectiles.back().vx) - atan2(_model.projectiles[0].vy, _model.projectiles[0].vx)
	_model.release_entities()
	_choose("pressureBarrel")
	_model.random = RandomStream.new(991)
	_fire()
	var spread_after: float = atan2(_model.projectiles.back().vy, _model.projectiles.back().vx) - atan2(_model.projectiles[0].vy, _model.projectiles[0].vx)
	_check(spread_after < spread_before and float(_payload().ttl) > 0.48, "spread reduction narrows actual directions and increases lifetime")


func _test_new_weapons() -> void:
	for id: String in ["ratchet_crossbow", "frost_projector", "breach_spear", "rust_cleaver"]:
		var save: Dictionary = _catalog.default_save.duplicate(true)
		save.currencies.copper = 1000
		var purchase: Dictionary = EconomyRules.buy_shop(save, _catalog.parameters("shopItems", "buy_" + id), 3)
		_check(purchase.ok and id in save.unlockedWeapons, id + " is purchasable as a starting weapon")
		var stored: Dictionary = SaveCodec.normalize(save, _catalog.default_save, _catalog.metadata.survival.legacyMaps)
		_check(id in stored.unlockedWeapons, id + " ownership survives save normalization")
		_fresh()
		_model.run.scrap = 1000
		_model.interactives.append({"id": "qa-market", "type": "tradePost", "active": true, "x": 512.0, "y": 512.0, "radius": 90.0})
		_check(_model.field_market.open(_model) and _model.arsenal.buy(_model, id) and _model.run.player.weaponId == id, id + " is purchased and equipped through the real field market")
	for direction: int in range(8):
		_fresh("breach_spear")
		var angle: float = direction * TAU / 8
		var target: Dictionary = _model.spawn_enemy("brute", 512 + cos(angle) * 95, 500 + sin(angle) * 95)
		target.hp = 1000
		var aim: Dictionary = WeaponRules.correct_aim(_model.run.player, target, _catalog)
		_fire(aim.x, aim.y)
		for frame: int in range(32):
			_model.run.elapsed += 1.0 / 60
			_model.weapons.update(_model, 1.0 / 60)
		_check(float(target.hp) < 1000, "thrust auto aim and collision agree at direction " + str(direction))
	for id: String in ["breach_spear", "rust_cleaver"]:
		_fresh(id)
		var weapon: Dictionary = _catalog.parameters("weapons", id)
		var near: Dictionary = _model.spawn_enemy("brute", 512 + float(weapon.reach) * 0.72, 500)
		var behind: Dictionary = _model.spawn_enemy("brute", 512 - float(weapon.reach), 500)
		near.hp = 1000.0
		behind.hp = 1000.0
		_fire()
		for frame: int in range(45):
			_model.run.elapsed += 1.0 / 60
			_model.weapons.update(_model, 1.0 / 60)
		_check(float(near.hp) < 1000 and float(behind.hp) == 1000, id + " hits forward but not behind")
		_check(_model.projectiles.is_empty(), id + " does not accidentally inherit sword waves")
	_fresh("frost_projector")
	var target: Dictionary = _model.spawn_enemy("brute", 650, 500)
	_model.damage_enemy(target, 1, {"owner": "player", "weaponId": "frost_projector", "vx": 1, "vy": 0})
	_check(is_equal_approx(float(target.chillFactor), 0.7) and float(target.chillUntil) > 1.19, "cryo applies ordinary slow")
	var old_x: float = target.x
	_model.combat.update_enemies(_model, 0.1)
	_check(absf(float(target.x) - old_x) < float(target.speed) * 0.09, "cryo actually reduces enemy movement")
	var until: float = target.chillUntil
	_choose("chillAmplifier")
	_model.damage_enemy(target, 1, {"owner": "player", "weaponId": "frost_projector", "vx": 1, "vy": 0})
	_check(float(target.chillUntil) > until + 0.29, "cryo duration upgrade reaches hit status")
	_model.enemy_pool.release(target)
	var fresh: Dictionary = _model.enemy_pool.acquire()
	_check(not fresh.has("chillUntil") and not fresh.has("chillFactor"), "pooled enemies do not inherit old cold status")
	_model.enemy_pool.release(fresh)
	_fresh("frost_projector")
	var boss: Dictionary = _model.spawn_enemy("warden", 650, 500)
	_model.damage_enemy(boss, 1, {"owner": "player", "weaponId": "frost_projector", "vx": 1, "vy": 0})
	_check(is_equal_approx(float(boss.chillFactor), 0.9) and float(boss.chillUntil) < 0.61, "boss slow is weaker and shorter")


func _test_caps_and_economy() -> void:
	_fresh()
	_model.run.player.armor = 0.5
	_model.run.player.criticalChance = 0.5
	UpgradeRules.apply("armor", _model.run.player, _model.run)
	UpgradeRules.apply("critical", _model.run.player, _model.run)
	_check(float(_model.run.player.armor) == 0.5 and float(_model.run.player.criticalChance) == 0.5, "basic upgrades cannot reduce already higher stats")
	_check(not _model.upgrades.requirements_met(_model, _catalog.parameters("upgrades", "armor")), "capped armor does not waste a card slot")
	_fresh()
	_choose("scavenger")
	for index: int in range(5):
		var enemy: Dictionary = _model.spawn_enemy("drifter", 512, 512)
		enemy.scrapChance = 1.0
		_model.damage_enemy(enemy, 100, {"owner": "player", "weaponId": "scrap_pistol", "vx": 1, "vy": 0})
		_model.combat.update_pickups(_model, 0.01)
	_check(absf(float(_model.run.scrap) - 6.0) < 0.001, "five ordinary coins with 20% gain pay six, without per-coin rounding loss")
	for bonus: int in range(2):
		_fresh()
		if bonus == 1:
			_choose("pierce")
		var pose: Dictionary = WeaponRules.compact_shot_pose(_model.run.player, 1, 0, _catalog)
		var targets: Array[Dictionary] = []
		for index: int in range(3):
			var target: Dictionary = _model.spawn_enemy("brute", float(pose.muzzleX) + 70 + index * 70, pose.muzzleY)
			target.hp = 1000
			targets.append(target)
		_model.rebuild_enemy_grid()
		_fire()
		for index: int in range(60):
			_model.run.elapsed += 1.0 / 60
			_model.combat.update_projectiles(_model, 1.0 / 60)
		var hit_count: int = 0
		for target: Dictionary in targets:
			if float(target.hp) < 1000:
				hit_count += 1
		_check(hit_count == 1 + bonus, "pierce +1 hits a real additional aligned enemy")


func _test_trigger_mechanics() -> void:
	_fresh()
	_choose("reactivePlating")
	var close: Dictionary = _model.spawn_enemy("brute", 552, 512)
	close.hp = 1000
	_model.combat.damage_player(_model, 8, 540, 512, {"type": "drifter"})
	_check(float(close.hp) < 1000 and float(_model.run.mechanics.reactiveCooldown) > 0, "taking an actual hit triggers reactive damage and cooldown")
	_fresh()
	_choose("executionCapacitor")
	for index: int in range(10):
		var enemy: Dictionary = _model.spawn_enemy("drifter", 650, 500)
		_model.damage_enemy(enemy, 100, {"owner": "player", "weaponId": "scrap_pistol", "vx": 1, "vy": 0})
	_check(int(_model.run.mechanics.chargedShots) == 1, "ten real kills store an execution attack")
	_model.fire_weapon(1, 0)
	_check(float(_payload().damage) >= 18 and int(_payload().pierce) == 1 and int(_model.run.mechanics.chargedShots) == 0, "stored execution charge changes the next real attack and is consumed")
	_fresh()
	_choose("focusProtocol")
	_model.run.player.noHitTime = 3.9
	_fire()
	_check(not _model.projectiles[0].critical, "focus protocol does not trigger before its grace interval")
	_model.release_entities()
	_model.run.player.noHitTime = 4.1
	_fire()
	_check(_model.projectiles[0].critical and float(_payload().damage) > 26, "no-hit focus produces an actual forced critical")
	_fresh()
	_choose("cascadeRounds")
	var first: Dictionary = _model.spawn_enemy("brute", 612, 512)
	var second: Dictionary = _model.spawn_enemy("brute", 662, 512)
	first.hp = 1000
	second.hp = 1000
	_model.damage_enemy(first, 10, {"owner": "player", "weaponId": "scrap_pistol", "critical": true, "vx": 1, "vy": 0})
	_check(float(second.hp) < 1000, "critical hit actually transfers damage to a nearby enemy")
	_fresh()
	_choose("salvageOverdrive")
	_model.combat.spawn_pickup(_model, "xp", 512, 512, 1)
	_model.combat.update_pickups(_model, 0.01)
	_model.fire_weapon(1, 0)
	_check(float(_model.run.mechanics.overdriveTime) > 0 and float(_payload().speed) > 660 and float(_payload().damage) > 12, "real pickup triggers attack and speed overdrive")


func _test_growth_and_unlocks() -> void:
	_fresh()
	_model.spawner_enabled = true
	_model.run.player.hp = 1000000.0
	_model.run.player.maxHp = 1000000.0
	for frame: int in range(600):
		_model.tick(1.0 / 60)
	_check(_model.enemies.size() >= 18 and _model.enemies.size() <= 28, "ten-second opening has a sustained group within its cap")
	_fresh()
	_model.save.bestTime = 0
	_check(not _model.upgrades.requirements_met(_model, _catalog.parameters("upgrades", "critDamage")), "new damage card stays locked before wave one")
	_model.spawner_enabled = true
	_model.run.elapsed = 44.99
	_model.tick(0.02)
	_check(WorkshopRules.completed_waves(_model.save) == 1, "first completed continuous wave updates persistent time record")
	_check(_model.upgrades.requirements_met(_model, _catalog.parameters("upgrades", "critDamage")), "wave-one card joins the draft immediately")
	_check(not _model.upgrades.requirements_met(_model, _catalog.parameters("upgrades", "fieldRush")), "later wave card stays locked")
	var roundtrip: Dictionary = SaveCodec.normalize(_model.save, _catalog.default_save, _catalog.metadata.survival.legacyMaps)
	_check(WorkshopRules.completed_waves(roundtrip) == 1, "wave unlock survives save normalization")
	var cap: int = 0
	for seconds: int in [0, 20, 45, 90, 180, 300, 900, 3600]:
		var pressure: Dictionary = SurvivalRules.pressure(seconds)
		_check(int(pressure.cap) >= cap and int(pressure.cap) <= 104 and float(pressure.interval) >= 0.1, "bounded growth at " + str(seconds))
		cap = int(pressure.cap)
	for seconds: int in [600, 1800]:
		_fresh()
		_model.run.elapsed = seconds
		_model.run.spawnPhaseIndex = 1
		_model.run.player.hp = 1000000.0
		_model.run.player.maxHp = 1000000.0
		_model.spawner_enabled = true
		for index: int in range(100):
			var angle: float = index * TAU / 100
			_model.spawn_enemy("drifter", 512 + cos(angle) * 380, 512 + sin(angle) * 380)
		for frame: int in range(120):
			_model.tick(1.0 / 60)
		_check(_model.enemies.size() <= int(_model.limits.enemies) and _model.projectiles.size() <= int(_model.limits.projectiles), "late dense fixture stays within entity limits at " + str(seconds))


func _test_new_ui() -> void:
	var packed: PackedScene = load("res://scenes/game_root.tscn") as PackedScene
	var game: Node = packed.instantiate()
	root.add_child(game)
	game.set_physics_process(false)
	await process_frame
	var session: GameSession = game.get("session")
	session.action("inventory")
	await process_frame
	await process_frame
	var menu: MenuView = game.get("menu")
	var codex_button: RadioButton
	for button: RadioButton in menu._buttons:
		if button.action_id == "workshop":
			codex_button = button
	_check(codex_button != null, "personal inventory exposes the codex")
	if codex_button != null:
		codex_button.pressed.emit()
	await process_frame
	_check(session.page == GameSession.Page.WORKSHOP, "personal codex button really navigates")
	session.action("back")
	_check(session.page == GameSession.Page.INVENTORY, "codex returns to the personal inventory")
	session.save_data.tutorialSkipped = true
	session.action("deploy")
	var model: RunSimulation = game.get("simulation")
	model.toggle_pause()
	var battle: BattleView = game.get("battle")
	battle._emit_action("buildInfo")
	_check(battle.show_build_details, "paused build inspector opens")
	var elapsed: float = model.run.elapsed
	model.tick(0.05)
	_check(float(model.run.elapsed) == elapsed and model.screen == GameSession.Screen.PAUSED, "build inspector keeps survival time paused")
	var escape := InputEventKey.new()
	escape.physical_keycode = KEY_ESCAPE
	escape.pressed = true
	game.call("_handle_run_key", escape)
	_check(not battle.show_build_details and model.screen == GameSession.Screen.PAUSED, "back from build inspector returns to pause")
	game.set_process(false)
	var audio: NativeAudio = game.get("audio")
	audio.shutdown()
	game.queue_free()
	await process_frame
	await create_timer(0.25).timeout


func _check(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
