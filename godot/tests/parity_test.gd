extends SceneTree
## Expected values are produced by the frozen reference game, not by native code.

const RandomSequence = preload("res://scripts/core/random_stream.gd")
const Survival = preload("res://scripts/core/survival_rules.gd")
const Loadout = preload("res://scripts/core/loadout_rules.gd")
const Upgrades = preload("res://scripts/core/upgrade_rules.gd")
const Codec = preload("res://scripts/persistence/save_codec.gd")
const Economy = preload("res://scripts/core/economy_rules.gd")
const Store = preload("res://scripts/persistence/save_store.gd")
const Pose = preload("res://scripts/presentation/compact_pose.gd")
const Navigation = preload("res://scripts/world/flow_navigation.gd")
const Geometry = preload("res://scripts/core/geometry_rules.gd")

var _checks: int = 0
var _failures: Array[String] = []
var _maximum_pose_error: float = 0.0


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	var source: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://data/content_source.json")
	)
	var cases: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://data/parity_cases.json")
	)
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	for category: String in source.catalogs:
		_check(catalog.all(category).size() >= source.catalogs[category].size(), category + " retains all legacy definitions")
		for content_id: String in source.catalogs[category]:
			_compare(catalog.parameters(category, content_id), source.catalogs[category][content_id],
				category + "." + content_id)
	for sample: Dictionary in cases.random:
		var random: RandomStream = RandomSequence.new(int(sample.seed))
		for index: int in range(sample.values.size()):
			_compare(random.next(), sample.values[index], "random %s/%d" % [sample.seed, index])
	for sample: Dictionary in cases.pressure:
		var actual: Dictionary = Survival.pressure(float(sample.seconds))
		var expected: Dictionary = sample.expected.duplicate()
		for revised: String in ["cap", "interval"]:
			actual.erase(revised)
			expected.erase(revised)
		_compare(actual, expected, "unchanged pressure stats %s" % sample.seconds)
	for sample: Dictionary in cases.loadouts:
		var save: Dictionary = source.defaultSave.duplicate(true)
		save.ownedEquipment = catalog.all("equipment").keys()
		save.equippedEquipment = sample.equipment
		_compare(Loadout.calculate(Loadout.base_stats(catalog.parameters("modes", "endless")),
			catalog.parameters("heroes", sample.heroId), save, catalog), sample.expected,
			"loadout " + sample.heroId)
	for sample: Dictionary in cases.upgrades:
		var player: Dictionary = sample.before.player.duplicate(true)
		var run: Dictionary = sample.before.run.duplicate(true)
		_check(Upgrades.apply(sample.id, player, run), "upgrade registered: " + sample.id)
		_compare(player, sample.player, "upgrade player " + sample.id)
		run.erase("upgrades")
		_compare(run, sample.run, "upgrade run " + sample.id)
	for sample: Dictionary in cases.saves:
		_compare(Codec.normalize(sample.input, source.defaultSave, source.survival.legacyMaps),
			sample.expected, "save schema")
	for sample: Dictionary in cases.shop:
		_compare(Economy.shop_state(sample.save.duplicate(true),
			catalog.parameters("shopItems", sample.id), int(sample.highestStage)),
			sample.expected, "shop " + sample.id + "/" + sample.profile)
	_test_save_recovery(catalog)
	for sample: Dictionary in cases.poses:
		var expected: Dictionary = sample.expected.weapon
		var actual: Dictionary = Pose.sample(source.poses[sample.weaponId].hold,
			float(sample.angle), 1.5, float(sample.expected.facing))
		# Vector2 uses real_t precision; preserve strict double checks for rule arithmetic.
		for pair: Array in [[Vector2(actual.anchor).x + 100, expected.anchorX],
			[Vector2(actual.anchor).y + 100, expected.anchorY],
			[Vector2(actual.muzzle).x + 100, expected.muzzleX],
			[Vector2(actual.muzzle).y + 100, expected.muzzleY]]:
			var error: float = absf(float(pair[0]) - float(pair[1]))
			_maximum_pose_error = maxf(_maximum_pose_error, error)
			_check(error < 0.0001, "pose %s/%s" % [sample.weaponId, sample.angle])
	for sample: Dictionary in cases.navigation:
		var map: MapDefinition = catalog.find("maps", sample.mapId) as MapDefinition
		var navigation: FlowNavigation = Navigation.new(map.layout, 64, float(sample.clearance))
		navigation.rebuild(float(sample.target[0]), float(sample.target[1]))
		_compare(Array(navigation.walkable), sample.walkable, "navigation grid " + sample.mapId)
		_compare(Array(navigation.distances), sample.distances, "navigation distance " + sample.mapId)
		_compare(Array(navigation.direction_x), sample.directionX, "navigation x " + sample.mapId)
		_compare(Array(navigation.direction_y), sample.directionY, "navigation y " + sample.mapId)
	for sample: Dictionary in cases.geometry:
		var values: Array = sample.values
		var result: float
		if sample.kind == "circle":
			result = Geometry.segment_circle_time(values[0], values[1], values[2], values[3],
				values[4], values[5], values[6])
		else:
			result = Geometry.segment_rect_time(values[0], values[1], values[2], values[3],
				sample.rect, float(sample.padding))
		if sample.expected == null:
			_check(is_inf(result), "no geometry contact")
		else:
			_compare(result, sample.expected, "geometry contact")
	var report: Dictionary = {
		"checks": _checks, "failures": _failures, "contentDefinitions": catalog.definitions.size(),
		"maximumPoseError": _maximum_pose_error,
		"scope": "Content, RNG, pressure, loadouts, upgrades, shop rules, save codec and recovery",
	}
	DirAccess.make_dir_recursive_absolute(
		ProjectSettings.globalize_path("res://../output/godot-migration")
	)
	var file: FileAccess = FileAccess.open(
		"res://../output/godot-migration/parity.json", FileAccess.WRITE
	)
	file.store_string(JSON.stringify(report, "  "))
	print("GODOT_PARITY " + JSON.stringify(report))
	quit(0 if _failures.is_empty() else 1)


func _test_save_recovery(catalog: GameCatalog) -> void:
	var memory := MemoryStorage.new()
	var store: SaveStore = Store.new(catalog, memory)
	store.load_save()
	_check(store.persist(), "initial save write")
	store.data.currencies.copper = 777
	_check(store.persist(), "save write with backup")
	var valid: String = memory.values[Store.KEY]
	memory.values[Store.KEY] = "{damaged"
	store.load_save()
	_check(store.status == "recovered", "damaged primary recovers backup")
	_check(memory.values[Store.DAMAGED_KEY] == "{damaged", "original bytes retained")
	memory.values[Store.KEY] = "another damaged primary"
	store.load_save()
	_check(store.read_only and not store.persist(), "occupied recovery prevents overwrite")
	_check(memory.values[Store.KEY] == "another damaged primary", "read-only retains primary")
	memory.values[Store.KEY] = valid
	memory.fail_writes = true
	store.load_save()
	_check(not store.persist(), "failed write reported")
	_check(memory.values[Store.KEY] == valid, "failed write retains old primary")
	_check(not store.preview_import("[]").ok, "array import rejected")
	_check(not store.preview_import("bad").ok, "invalid import rejected")
	var disk := FileStorage.new("res://../output/godot-migration/save-atomic-probe")
	var disk_store: SaveStore = Store.new(catalog, disk)
	disk_store.data.currencies.copper = 111
	_check(disk_store.persist(), "native file first atomic write")
	disk_store.data.currencies.copper = 222
	_check(disk_store.persist(), "native file replacement")
	var restored: SaveStore = Store.new(catalog, disk)
	_check(int(restored.load_save().currencies.copper) == 222, "native persisted value")
	var backup: Dictionary = JSON.parse_string(disk.get_value(Store.BACKUP_KEY))
	_check(int(backup.currencies.copper) == 111, "native previous value backed up")


func _check(condition: bool, label: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(label)


func _compare(actual: Variant, expected: Variant, label: String) -> void:
	if expected is Dictionary:
		_check(actual is Dictionary, label + " dictionary")
		if not actual is Dictionary:
			return
		_check(actual.size() == expected.size(), label + " keys")
		for key: String in expected:
			_check(actual.has(key), label + "." + key + " present")
			if actual.has(key):
				_compare(actual[key], expected[key], label + "." + key)
	elif expected is Array:
		_check(actual is Array and actual.size() == expected.size(), label + " array")
		if actual is Array and actual.size() == expected.size():
			for index: int in range(expected.size()):
				_compare(actual[index], expected[index], label + "[%d]" % index)
	elif expected is float or expected is int:
		_check((actual is float or actual is int)
			and absf(float(actual) - float(expected)) <= 1e-7 * maxf(1, absf(float(expected))), label)
	else:
		_check(actual == expected, label)


class MemoryStorage extends RefCounted:
	var values: Dictionary = {}
	var fail_writes: bool = false


	func get_value(key: String) -> Variant:
		return values.get(key)


	func set_value(key: String, value: String) -> bool:
		if fail_writes:
			return false
		values[key] = value
		return true
