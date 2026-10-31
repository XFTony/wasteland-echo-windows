extends SceneTree
## A crowded late-run fixture checks bounds and timing without claiming hardware certification.


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
	model.start_run({"mapId": "echo_district", "seed": 727, "tutorial": false})
	model.release_entities()
	model.run.elapsed = 900.0
	model.run.player.hp = 1000000.0
	model.run.player.maxHp = 1000000.0
	var kinds: Array[String] = ["drifter", "runner", "crawler", "spitter", "brute", "screecher"]
	for index: int in range(104):
		var angle: float = float(index % 26) / 26 * TAU
		var radius: float = 180 + floori(float(index) / 26) * 55
		var enemy: Dictionary = model.spawn_enemy(kinds[index % kinds.size()],
			float(model.run.player.x) + cos(angle) * radius,
			float(model.run.player.y) + sin(angle) * radius)
		enemy.hp = 100000.0
		enemy.maxHp = 100000.0
	var times: Array[int] = []
	var peak_enemies: int = 0
	var peak_shots: int = 0
	var failures: Array[String] = []
	var began: int = Time.get_ticks_usec()
	for step: int in range(2400):
		var angle: float = float(step) / 600 * TAU
		model.set_input({"moveX": cos(angle), "moveY": sin(angle)})
		var start: int = Time.get_ticks_usec()
		model.tick(1.0 / 60)
		times.append(Time.get_ticks_usec() - start)
		if model.screen == GameSession.Screen.UPGRADE:
			model.upgrades.choose(model, model.run.upgradeOptions[0].id)
		model.drain_events()
		peak_enemies = maxi(peak_enemies, model.enemies.size())
		peak_shots = maxi(peak_shots, model.projectiles.size() + model.enemy_shots.size())
		if step % 120 == 0:
			await process_frame
		if Time.get_ticks_usec() - began > 90000000:
			failures.append("Dense fixture exceeded wall-time budget")
			break
	if peak_enemies > int(model.limits.enemies) or peak_shots > int(model.limits.projectiles) + int(model.limits.enemyShots):
		failures.append("Entity cap exceeded")
	times.sort()
	var report: Dictionary = {"scope": "Accelerated 40-second dense fixture at minute 15; not rendered FPS",
		"ticks": times.size(), "peakEnemies": peak_enemies, "peakProjectiles": peak_shots,
		"tickMedianMs": float(times[floori(times.size() * 0.5)]) / 1000,
		"tickP95Ms": float(times[floori(times.size() * 0.95)]) / 1000,
		"tickP99Ms": float(times[floori(times.size() * 0.99)]) / 1000,
		"tickMaximumMs": float(times.back()) / 1000, "failures": failures}
	var file: FileAccess = FileAccess.open("res://../output/godot-migration/dense-stress.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	model.release_entities()
	print("GODOT_DENSE_STRESS " + JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
