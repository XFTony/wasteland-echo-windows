extends SceneTree
## Replay checkpoints from the frozen JS game through the native simulation.

var _checks: int = 0
var _failures: Array[String] = []
var _observations: Array = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/combat_cases.json"))
	var checkpoints: int = 0
	var migrated: Array[String] = []
	for sample: Dictionary in data.cases:
		if ":survival-at-" in str(sample.name):
			migrated.append(sample.name)
			continue
		_observations.clear()
		var model := RunSimulation.new(catalog, sample.initialSave.duplicate(true))
		model.start_run(sample.options)
		var cursor: int = 0
		for checkpoint: Dictionary in sample.checkpoints:
			while cursor <= int(checkpoint.after):
				_apply(model, sample.operations[cursor])
				cursor += 1
			_compare(_snapshot(model), checkpoint.expected, "%s/%d" % [sample.name, checkpoint.after])
			checkpoints += 1
		model.release_entities()
	var result: Dictionary = {"cases": data.cases.size() - migrated.size(), "checkpoints": checkpoints,
		"checks": _checks, "failures": _failures, "revisedSpawnCases": migrated,
		"scope": "Unchanged legacy behavior; revised spawning is validated separately"}
	var report: FileAccess = FileAccess.open("res://../output/godot-migration/combat-parity.json", FileAccess.WRITE)
	report.store_string(JSON.stringify(result, "  "))
	report.close()
	print("GODOT_COMBAT_PARITY " + JSON.stringify(result))
	quit(0 if _failures.is_empty() else 1)


func _apply(model: RunSimulation, operation: Dictionary) -> void:
	var player: Dictionary = model.run.player
	match str(operation.kind):
		"clean":
			model.release_entities()
			model.obstacles.clear()
			model.interactives.clear()
			model.rebuild_obstacle_grid()
			model.setup_navigation()
			model.spawner_enabled = false
		"settings":
			model.save.settings.merge(operation.values, true)
		"player":
			player.merge(operation.values, true)
		"run":
			model.run.merge(operation.values, true)
		"spawn":
			var enemy: Dictionary = model.spawn_enemy(operation.type,
				float(player.x) + float(operation.x), float(player.y) + float(operation.y))
			enemy.merge(operation.get("values", {}), true)
			model.rebuild_enemy_grid()
		"obstacles":
			model.obstacles.clear()
			for original: Dictionary in operation.values:
				var rect: Dictionary = original.duplicate()
				rect.x += player.x
				rect.y += player.y
				model.obstacles.append(rect)
			model.rebuild_obstacle_grid()
			model.setup_navigation()
		"fire":
			model.fire_weapon(operation.x, operation.y)
		"pause":
			model.toggle_pause()
		"step":
			if operation.has("input"):
				model.set_input(operation.input)
			for index: int in range(int(operation.count)):
				match str(operation.get("system", "tick")):
					"weapons":
						model.run.elapsed += 1.0 / 60
						model.weapons.update(model, 1.0 / 60)
					"projectiles":
						model.combat.update_projectiles(model, 1.0 / 60)
					"enemies":
						model.run.elapsed += 1.0 / 60
						model.combat.update_enemies(model, 1.0 / 60)
					_:
						model.tick(1.0 / 60)
		"level":
			model.check_level_up()
		"settle":
			model.finish_run(operation.result)
		"station":
			model.interactives.append({"id": "qa-station", "type": "tradePost", "active": true,
				"x": float(player.x) + 80, "y": player.y, "radius": 160, "pulse": 0.0})
		"marketOpen":
			_observations.append(model.field_market.open(model))
		"marketClose":
			_observations.append(model.field_market.close(model))
		"marketBuy":
			_observations.append(model.field_market.purchase(model, operation.id).duplicate(true))
		"arsenalBuy":
			_observations.append(model.arsenal.buy(model, operation.id))
		"arsenalImprove":
			_observations.append(model.arsenal.improve(model, operation.id))
		"deploy":
			model.set_input({"aimX": 90, "aimY": 0, "aimActive": true})
			_observations.append(model.structures.begin(model))
			_observations.append(model.structures.confirm(model))
		"offsetPlayer":
			player.x += operation.x
			player.y += operation.y
		"recover":
			_observations.append(model.structures.recover(model))
		"choose":
			_observations.append(model.upgrades.choose(model, model.run.upgradeOptions[0].id))
		"salvage":
			_observations.append(model.upgrades.salvage(model))
		"extraction":
			model.run.extraction.merge({"active": true, "x": player.x, "y": player.y}, true)
			model.run.extraction.merge(operation.values, true)
		"damagePlayer":
			model.combat.damage_player(model, operation.amount, float(player.x) + float(operation.x),
				float(player.y) + float(operation.y), operation.get("source", {}))
		"hitEnemy":
			model.damage_enemy(model.enemies[int(operation.get("index", 0))], operation.amount, operation.source)
		"mechState":
			model.run.mechanics.merge(operation.values, true)
		"pickup":
			model.spawn_pickup(operation.type, float(player.x) + float(operation.x), float(player.y) + float(operation.y), operation.value)
			model.combat.update_pickups(model, 1.0 / 60)
		"enemyShot":
			var values: Dictionary = {"id": model.entity_id, "x": float(player.x) + float(operation.x), "y": float(player.y) + float(operation.y)}
			values.merge(operation.values, true)
			model.enemy_shots.append(model.projectile_pool.acquire(values))
			model.entity_id += 1
		"limits":
			model.limits.merge(operation.values, true)
		"manyPickups":
			for index: int in range(int(operation.count)):
				model.spawn_pickup(operation.types[index % operation.types.size()], float(player.x) + index * 2, float(player.y) + 70, 1)
		"restart":
			var options: Dictionary = {"seed": 88, "tutorial": false}
			options.merge(operation.get("options", {}), true)
			model.start_run(options)
		"invalidInput":
			model.set_input({"moveX": "2", "moveY": INF, "aimX": NAN, "firing": 1})
		"poolReset":
			var pool: EntityPool = model.enemy_pool if operation.pool == "enemy" else model.pickup_pool if operation.pool == "pickup" else model.projectile_pool
			var first: Dictionary = pool.acquire(operation.first)
			pool.release(first)
			var second: Dictionary = pool.acquire(operation.second)
			_observations.append(_plain(second))
			pool.release(second)


func _snapshot(model: RunSimulation) -> Dictionary:
	var save: Dictionary = model.save.duplicate(true)
	for history: Dictionary in save.runHistory:
		history.completedAt = 0
	return _plain({"screen": ["menu", "running", "paused", "levelup", "fieldShop",
		"resultWin", "resultLose"][model.screen], "entityId": model.entity_id, "randomState": model.random.state,
		"run": model.run, "enemies": model.enemies, "projectiles": model.projectiles,
		"enemyShots": model.enemy_shots, "pickups": model.pickups,
		"interactives": model.interactives, "obstacles": model.obstacles,
		"save": save, "events": model.drain_events(), "observations": _observations})


func _plain(value: Variant, key: String = "") -> Variant:
	if value is Dictionary:
		if key == "hitIds":
			return value.keys()
		var result: Dictionary = {}
		for item: Variant in value:
			if str(item) == "preview":
				continue
			result[item] = _plain(value[item], str(item))
		return result
	if value is Array or value is PackedInt32Array or value is PackedFloat32Array:
		var result: Array = []
		for item: Variant in value:
			result.append(_plain(item))
		return result
	if value is float and not is_finite(value):
		return null
	return value


func _compare(actual: Variant, expected: Variant, label: String) -> void:
	if ".run.upgradeOptions[" in label and label.ends_with(".detail"):
		return
	# Two legacy cases encode the old missing-overdrive bug. New behavior tests
	# verify their corrected speed; all other recorded fields still compare.
	if (label.begins_with("slag_launcher:mechanic-upgrade-synergies/") or label.begins_with("saw_disc:mechanic-upgrade-synergies/")) and ".projectiles[" in label and (label.ends_with(".x") or label.ends_with(".vx") or label.ends_with(".empowered")):
		return
	_checks += 1
	if _failures.size() >= 100:
		return
	if expected is Dictionary:
		if not actual is Dictionary:
			_failures.append(label + " expected dictionary")
			return
		for key: String in expected:
			if not actual.has(key):
				_failures.append(label + "." + key + " missing")
			else:
				_compare(actual[key], expected[key], label + "." + key)
	elif expected is Array:
		if not actual is Array or actual.size() != expected.size():
			_failures.append(label + " array length actual=%s expected=%s" % [actual.size() if actual is Array else -1, expected.size()])
			return
		for index: int in range(expected.size()):
			_compare(actual[index], expected[index], label + "[%d]" % index)
	elif expected is float or expected is int:
		if not (actual is float or actual is int) or absf(float(actual) - float(expected)) > 0.00000001 * maxf(1, absf(float(expected))):
			_failures.append(label + " actual=%s expected=%s" % [actual, expected])
	elif actual != expected:
		_failures.append(label + " actual=%s expected=%s" % [actual, expected])
