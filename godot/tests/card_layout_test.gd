extends SceneTree
## Pixel-content bounds are fitted to each measured frame window; selection stays within the header.

var _checks: int = 0
var _failures: Array[String] = []


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	var frame_cases: Array[Array] = [["firepower", "standard", Vector2(149.5, 124)],
		["survival", "standard", Vector2(145.5, 123)], ["mobility", "standard", Vector2(139, 128.5)],
		["utility", "standard", Vector2(149.5, 109.5)], ["utility", "prototype", Vector2(144.5, 109.5)],
		["firepower", "evolution", Vector2(145, 110.5)]]
	for row: Array in frame_cases:
		var profile: UpgradeCardArtLayout = CombatArt.card_layout(row[0], row[1])
		_check(profile.illustration.get_center().distance_to(row[2]) < 0.01, "frame window matches measured artwork: " + str(row[0]) + "/" + str(row[1]))
		_check(Rect2(0, 0, 256, 384).encloses(profile.illustration), "illustration stays on source frame")
		_check(profile.header.end.y < profile.illustration.position.y, "header hardware and illustration are separated")
	for id: String in catalog.all("upgrades"):
		var option: Dictionary = catalog.parameters("upgrades", id)
		var texture: Texture2D = CombatArt.icon(catalog, id)
		var profile: UpgradeCardArtLayout = CombatArt.card_layout(option.family, option.rarity)
		for dimensions: Vector2 in [Vector2(216, 396), Vector2(292, 480), Vector2(584, 960)]:
			var region: Rect2 = profile.illustration_for(dimensions)
			var placed: Rect2 = UpgradeGlyph.fitted_bitmap_rect(texture, region)
			_check(placed.get_center().distance_to(region.get_center()) < 0.01 and region.encloses(placed), "actual bitmap ink is centered and contained: " + id)
	var card := UpgradeCard.new()
	card.fonts = UiFonts.new()
	var lines: Array[String] = card._wrap_text("收益 +20%（小数累计）", 116, 14, 800)
	_check(not lines.any(func(line: String) -> bool: return line.begins_with("）")), "closing punctuation is not orphaned")
	card.free()
	var report: Dictionary = {"checks": _checks, "failures": _failures, "frameLayouts": 6, "icons": 42,
		"scope": "Measured source-frame windows and actual alpha bounds; pointer/keyboard focus and below-frame pixels checked in rendered review"}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://../output/card-layout-cleanup"))
	var file: FileAccess = FileAccess.open("res://../output/card-layout-cleanup/card-layout-tests.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  ") + "\n")
	file.close()
	print("GODOT_CARD_LAYOUT " + JSON.stringify(report))
	quit(0 if _failures.is_empty() else 1)


func _check(value: bool, label: String) -> void:
	_checks += 1
	if not value:
		_failures.append(label)
