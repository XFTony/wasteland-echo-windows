class_name SpawnSystem
extends RefCounted
## Spawn choice arrays are exported in reference order, avoiding dictionary sort drift.


func update(model: RunSimulation, delta: float) -> void:
	var mode: Dictionary = model.catalog.parameters("modes", model.run.modeId)
	if model.run.endless:
		_update_continuous(model, delta, mode)
		return
	var run: Dictionary = model.run
	var progress: float = clampf(float(run.elapsed) / float(run.duration), 0, 1)
	if run.rule == "extract" and not run.extraction.active and float(run.elapsed) >= maxf(15, float(run.duration) - 30):
		run.extraction.active = true
		var angle: float = model.random.range_float(0, TAU)
		run.extraction.x = clampf(float(run.player.x) + cos(angle) * 250, 120, model.world_size - 120)
		run.extraction.y = clampf(float(run.player.y) + sin(angle) * 250, 120, model.world_size - 120)
		model.push_event("extraction", {"x": run.extraction.x, "y": run.extraction.y})
	elif run.rule == "survive" and not run.finalWaveAnnounced and float(run.elapsed) >= maxf(15, float(run.duration) - 30):
		run.finalWaveAnnounced = true
		model.push_event("finalWave")
	if not run.bossOneSpawned and progress >= float(mode.get("bossOneAt", INF)):
		var boss: Dictionary = spawn_at_edge(model, "iron_colossus")
		if not boss.is_empty():
			run.bossOneSpawned = true
			model.push_event("boss", model.bosses.spawn_event(model, boss, 1))
	if mode.get("bossTwoAt") != null and not run.bossTwoSpawned and progress >= float(mode.bossTwoAt):
		var boss: Dictionary = spawn_at_edge(model, "warden")
		if not boss.is_empty():
			run.bossTwoSpawned = true
			model.push_event("boss", model.bosses.spawn_event(model, boss, 2))
	var phases: Array = mode.get("spawnPhases", [])
	var phase: Dictionary = {}
	if not phases.is_empty():
		phase = phases[0]
		for next: Dictionary in phases:
			if progress >= float(next.at):
				phase = next
	else:
		phase = {"id": "linear", "index": 0, "cap": mode.enemyLimit,
			"interval": lerpf(float(mode.spawnStart), float(mode.spawnEnd), progress)}
	var cap: int = mini(int(mode.enemyLimit), int(phase.cap))
	if int(run.spawnPhaseIndex) != int(phase.index):
		run.spawnPhaseIndex = phase.index
		if int(phase.index) > 0:
			model.push_event("spawnPhase", {"phaseId": phase.id, "label": phase.label, "detail": phase.detail})
	if model.enemies.size() >= cap:
		return
	var interval: float = maxf(0.1, float(phase.interval))
	run.spawnAccumulator += delta
	while float(run.spawnAccumulator) >= interval and model.enemies.size() < cap:
		run.spawnAccumulator -= interval
		var kind: String = choose_enemy(model, progress)
		spawn_at_edge(model, kind)
		var extra: int = 1 if run.rule == "survive" else 2
		for index: int in range(extra):
			if kind != "crawler" or model.enemies.size() >= cap:
				break
			spawn_at_edge(model, "crawler")


func choose_enemy(model: RunSimulation, progress: float = 0.0) -> String:
	var phases: Array
	var value: float = progress
	if model.run.endless:
		phases = model.catalog.metadata.survival.mapSpawnStages.get(model.run.mapId,
			model.catalog.metadata.survival.mapSpawnStages.echo_district)
		value = float(model.run.elapsed)
	else:
		phases = model.catalog.metadata.spawnStages.get(model.run.spawnProfile,
			model.catalog.metadata.spawnStages.survival)
	var selected: Dictionary = phases[0]
	for phase: Dictionary in phases:
		if value >= float(phase.at):
			selected = phase
	return model.random.weighted(selected.choices).id


func spawn_at_edge(model: RunSimulation, kind: String) -> Dictionary:
	var player: Dictionary = model.run.player
	if model.run.endless and model.world_size >= 1600:
		var cx: float = clampf(float(player.x) - 640, 0, model.world_size - 1280)
		var cy: float = clampf(float(player.y) - 360, 0, model.world_size - 720)
		for attempt: int in range(16):
			var side: int = model.random.range_int(0, 3)
			var padding: float = model.random.range_float(32, 96)
			var x: float = cx - padding if side == 0 else cx + 1280 + padding if side == 1 else cx + model.random.range_float(0, 1280)
			var y: float = cy - padding if side == 2 else cy + 720 + padding if side == 3 else cy + model.random.range_float(0, 720)
			if x < 32 or y < 32 or x > model.world_size - 32 or y > model.world_size - 32:
				continue
			return model.spawn_enemy(kind, x, y)
		var x: float = minf(model.world_size - 32, cx + 1320) if float(player.x) < model.world_size / 2 else maxf(32, cx - 40)
		return model.spawn_enemy(kind, x, clampf(float(player.y), 32, model.world_size - 32))
	var angle: float = model.random.range_float(0, TAU)
	var distance: float = 1.0 / maxf(absf(cos(angle)) / 700, absf(sin(angle)) / 430) + model.random.range_float(20, 100) if model.run.endless else model.random.range_float(360, 520)
	return model.spawn_enemy(kind, clampf(float(player.x) + cos(angle) * distance, 32, model.world_size - 32),
		clampf(float(player.y) + sin(angle) * distance, 32, model.world_size - 32))


func _update_continuous(model: RunSimulation, delta: float, mode: Dictionary) -> void:
	var run: Dictionary = model.run
	var pressure: Dictionary = SurvivalRules.pressure(run.elapsed)
	if int(run.spawnPhaseIndex) < 0:
		for index: int in range(4):
			spawn_at_edge(model, "drifter")
	WorkshopRules.update_progress(model)
	for enemy: Dictionary in model.enemies:
		if enemy.active and not enemy.boss and GeometryRules.distance_squared(enemy.x, enemy.y,
			run.player.x, run.player.y) > 1450 * 1450:
			model.enemy_pool.release(enemy)
	if int(run.spawnPhaseIndex) != int(pressure.level):
		run.spawnPhaseIndex = pressure.level
		if int(pressure.level) > 1:
			model.push_event("spawnPhase", {"phaseId": "threat-%d" % pressure.level,
				"label": "威胁等级 %d" % pressure.level, "detail": "感染者正在增强，调整走位与构筑"})
	if float(run.elapsed) >= float(run.nextEndlessBossAt):
		if int(run.activeBosses) >= 2:
			run.nextEndlessBossAt = float(run.elapsed) + 30
		else:
			var wave: int = int(run.endlessBossWave) + 1
			var boss: Dictionary = spawn_at_edge(model, "iron_colossus" if wave % 3 == 0 else "warden")
			if not boss.is_empty():
				run.endlessBossWave = wave
				run.nextEndlessBossAt = float(run.elapsed) + maxi(120, 180 - wave * 5)
				model.push_event("boss", model.bosses.spawn_event(model, boss, wave))
	var cap: int = mini(int(mode.enemyLimit), int(pressure.cap))
	if model.enemies.size() >= cap:
		run.spawnAccumulator = minf(float(run.spawnAccumulator), float(pressure.interval))
		return
	run.spawnAccumulator += delta
	var attempts: int = 0
	while float(run.spawnAccumulator) >= float(pressure.interval) and model.enemies.size() < cap and attempts < 4:
		attempts += 1
		run.spawnAccumulator -= pressure.interval
		var kind: String = choose_enemy(model)
		spawn_at_edge(model, kind)
		if kind == "crawler" and model.enemies.size() < cap:
			spawn_at_edge(model, "crawler")
