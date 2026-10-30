extends SceneTree
## Accelerated logic stress measures this host; it is not a rendered FPS benchmark.

var _failures: Array[String] = []
var _reports: Array[Dictionary] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	if "--resume" in OS.get_cmdline_user_args() and FileAccess.file_exists("res://../output/godot-migration/survival-stress.json"):
		var previous: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://../output/godot-migration/survival-stress.json"))
		_reports.assign(previous.maps)
	for map_id: String in catalog.all("maps"):
		var complete: bool = false
		for report: Dictionary in _reports:
			complete = complete or report.map == map_id and int(report.ticks) == 10800
		if complete:
			continue
		var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
		model.start_run({"mapId": map_id, "seed": 727, "tutorial": false})
		model.run.player.maxHp = 1000000.0
		model.run.player.hp = 1000000.0
		var times: Array[int] = []
		var peak_enemies: int = 0
		var peak_projectiles: int = 0
		var peak_pickups: int = 0
		var began: int = Time.get_ticks_usec()
		var completed: int = 0
		for step: int in range(10800):
			if Time.get_ticks_usec() - began > 90000000:
				_failures.append(map_id + ": stress exceeded 90 second wall budget")
				break
			var angle: float = float(step) / 600 * TAU
			model.set_input({"moveX": cos(angle), "moveY": sin(angle)})
			var tick_start: int = Time.get_ticks_usec()
			model.tick(1.0 / 60)
			times.append(Time.get_ticks_usec() - tick_start)
			if model.screen == GameSession.Screen.UPGRADE:
				model.upgrades.choose(model, model.run.upgradeOptions[0].id)
			model.drain_events()
			peak_enemies = maxi(peak_enemies, model.enemies.size())
			peak_projectiles = maxi(peak_projectiles, model.projectiles.size() + model.enemy_shots.size())
			peak_pickups = maxi(peak_pickups, model.pickups.size())
			completed += 1
			if step % 600 == 0:
				await process_frame
			if model.screen != GameSession.Screen.RUNNING:
				_failures.append(map_id + ": unexpected modal or termination")
				break
		times.sort()
		var report: Dictionary = {"map": map_id, "ticks": completed, "simulatedSeconds": model.run.elapsed,
			"wallSeconds": float(Time.get_ticks_usec() - began) / 1000000,
			"tickMedianMs": float(times[floori(times.size() * 0.5)]) / 1000,
			"tickP95Ms": float(times[mini(times.size() - 1, floori(times.size() * 0.95))]) / 1000,
			"tickP99Ms": float(times[mini(times.size() - 1, floori(times.size() * 0.99))]) / 1000,
			"tickMaximumMs": float(times.back()) / 1000,
			"peakEnemies": peak_enemies, "peakProjectiles": peak_projectiles, "peakPickups": peak_pickups,
			"playerLevel": model.run.player.level, "bossWave": model.run.endlessBossWave,
			"pools": {"enemies": model.enemy_pool.stats(), "projectiles": model.projectile_pool.stats(),
				"pickups": model.pickup_pool.stats()}}
		_reports.append(report)
		_store_progress(true)
		print("GODOT_STRESS_MAP " + JSON.stringify(report))
		if peak_enemies > int(model.limits.enemies) or peak_projectiles > int(model.limits.projectiles) + int(model.limits.enemyShots) or peak_pickups > int(model.limits.pickups):
			_failures.append(map_id + ": entity limit exceeded")
		model.release_entities()
		model = null
		await process_frame
	_store_progress(false)
	print("GODOT_SURVIVAL_STRESS " + JSON.stringify({"maps": _reports.size(), "failures": _failures}))
	quit(0 if _failures.is_empty() else 1)


func _store_progress(in_progress: bool) -> void:
	var result: Dictionary = {"scope": "Accelerated simulation only; 180 seconds per map; not rendered FPS or low-end certification",
		"maps": _reports, "failures": _failures, "inProgress": in_progress}
	var file: FileAccess = FileAccess.open("res://../output/godot-migration/survival-stress.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(result, "  "))
	file.close()
