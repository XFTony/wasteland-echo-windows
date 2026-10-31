extends SceneTree
## Normal-health opening proxies compare pressure, not rendered performance or human difficulty.


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var reports: Array[Dictionary] = []
	var build_impact: bool = "--build-impact" in OS.get_cmdline_user_args()
	for map_id: String in catalog.all("maps"):
		if build_impact and map_id != "echo_district":
			continue
		var policies: Array[String] = []
		policies.assign(["orbit-build"] if build_impact else ["standing", "orbit"])
		for policy: String in policies:
			var model := RunSimulation.new(catalog, catalog.default_save.duplicate(true))
			model.start_run({"mapId": map_id, "seed": 88, "tutorial": false})
			var center := Vector2(model.run.player.x, model.run.player.y)
			var peak: int = 0
			var visible_sum: int = 0
			var near_sum: int = 0
			var first_hit: float = -1
			var first_upgrade: float = -1
			var samples: Array[Dictionary] = []
			var ticks: int = 0
			for index: int in range(3600):
				if policy.begins_with("orbit"):
					var angle: float = float(model.run.elapsed) * 0.65
					var goal: Vector2 = center + Vector2(cos(angle), sin(angle)) * 210 - Vector2(model.run.player.x, model.run.player.y)
					goal = goal.normalized()
					model.set_input({"moveX": goal.x, "moveY": goal.y})
				model.tick(1.0 / 60)
				if model.screen == GameSession.Screen.UPGRADE:
					if first_upgrade < 0:
						first_upgrade = model.run.elapsed
					if build_impact:
						var selected: String = str(model.run.upgradeOptions[0].id)
						for id: String in ["projectile", "focusProtocol", "damage", "fireRate", "critical", "pierce", "vitality", "armor"]:
							var found: bool = false
							for option: Dictionary in model.run.upgradeOptions:
								if option.id == id:
									selected = id
									found = true
							if found:
								break
						model.upgrades.choose(model, selected)
					else:
						model.upgrades.salvage(model)
				peak = maxi(peak, model.enemies.size())
				for enemy: Dictionary in model.enemies:
					if absf(float(enemy.x) - float(model.run.player.x)) <= 640 and absf(float(enemy.y) - float(model.run.player.y)) <= 360:
						visible_sum += 1
					if GeometryRules.distance_squared(enemy.x, enemy.y, model.run.player.x, model.run.player.y) < 240 * 240:
						near_sum += 1
				ticks += 1
				if float(model.run.damageTaken) > 0 and first_hit < 0:
					first_hit = model.run.elapsed
				if (index + 1) % 600 == 0:
					samples.append({"time": model.run.elapsed, "enemies": model.enemies.size(), "kills": model.run.kills, "hp": model.run.player.hp})
				if model.screen != GameSession.Screen.RUNNING:
					break
			var report: Dictionary = {"map": map_id, "policy": policy, "seconds": model.run.elapsed,
				"peakEnemies": peak, "meanVisible": float(visible_sum) / ticks, "meanNear": float(near_sum) / ticks,
				"kills": model.run.kills, "damageTaken": model.run.damageTaken, "hp": model.run.player.hp,
				"firstHit": null if first_hit < 0 else first_hit, "firstUpgrade": first_upgrade, "samples": samples}
			reports.append(report)
			print("OPENING_PRESSURE " + JSON.stringify(report))
			model.release_entities()
			await process_frame
	var directory: String = ProjectSettings.globalize_path("res://../output/survival-builds")
	DirAccess.make_dir_recursive_absolute(directory)
	var file: FileAccess = FileAccess.open(directory.path_join("opening-native-build.json" if build_impact else "opening-native.json"), FileAccess.WRITE)
	var upgrade_policy: String = "prioritize projectile/focus/damage/fire rate upgrades" if build_impact else "salvage every upgrade"
	file.store_string(JSON.stringify({"scope": "Normal health, seed88, starting pistol, %s; not human win rates or an FPS benchmark" % upgrade_policy, "reports": reports}, "  "))
	file.close()
	quit()
