extends SceneTree
## Explicit import refuses to overwrite edited native resources unless requested.

const BaseDefinition = preload("res://scripts/content/content_definition.gd")
const Weapon = preload("res://scripts/content/weapon_definition.gd")
const Enemy = preload("res://scripts/content/enemy_definition.gd")
const Map = preload("res://scripts/content/map_definition.gd")
const Catalog = preload("res://scripts/content/game_catalog.gd")


func _init() -> void:
	_import.call_deferred()


func _import() -> void:
	var overwrite: bool = "--overwrite" in OS.get_cmdline_user_args()
	var catalog: GameCatalog = Catalog.new()
	if ResourceLoader.exists("res://content/game_catalog.tres") and not overwrite:
		catalog = load("res://content/game_catalog.tres") as GameCatalog
		print("Preserved native catalog and %d definitions; use --overwrite only for an intentional reference reset." % catalog.definitions.size())
		quit()
		return
	var source: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://data/content_source.json")
	)
	catalog.defaults = source.defaults
	catalog.default_save = source.defaultSave
	catalog.metadata = source.duplicate(true)
	catalog.metadata.erase("catalogs")
	catalog.metadata.erase("defaultSave")
	var definitions: Array[ContentDefinition] = []
	for category: String in source.catalogs:
		var directory: String = "res://content/" + category.to_snake_case()
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(directory))
		for content_id: String in source.catalogs[category]:
			var filename: String = directory + "/" + content_id.to_snake_case() + ".tres"
			if ResourceLoader.exists(filename) and not overwrite:
				definitions.append(load(filename) as ContentDefinition)
				continue
			var data: Dictionary = source.catalogs[category][content_id]
			var definition: ContentDefinition = _create(category, data, source)
			var error: Error = ResourceSaver.save(definition, filename)
			if error != OK:
				push_error("Cannot save imported definition: " + filename)
				quit(1)
				return
			definitions.append(definition)
	catalog.definitions = definitions
	var result: Error = ResourceSaver.save(catalog, "res://content/game_catalog.tres")
	print("Imported native definitions: %d" % definitions.size())
	quit(0 if result == OK else 1)


func _create(category: String, data: Dictionary, source: Dictionary) -> ContentDefinition:
	var definition: ContentDefinition
	match category:
		"weapons":
			var weapon: WeaponDefinition = Weapon.new()
			weapon.damage = float(data.damage)
			weapon.interval = float(data.interval)
			weapon.projectile_speed = float(data.projectileSpeed)
			weapon.projectile_count = int(data.projectileCount)
			weapon.lock_range = float(data.lockRange)
			weapon.lifetime = float(data.ttl)
			weapon.pierce = int(data.pierce)
			weapon.knockback = float(data.knockback)
			weapon.recoil = float(data.recoil)
			definition = weapon
		"enemies":
			var enemy: EnemyDefinition = Enemy.new()
			enemy.max_health = float(data.hp)
			enemy.speed = float(data.speed)
			enemy.damage = float(data.damage)
			enemy.radius = float(data.radius)
			definition = enemy
		"maps":
			var map: MapDefinition = Map.new()
			map.world_size = int(data.worldSize)
			map.layout_id = StringName(data.layoutId)
			map.layout = source.layouts[data.layoutId]
			definition = map
		_:
			definition = BaseDefinition.new()
	definition.content_id = StringName(data.id)
	definition.category = StringName(category)
	definition.display_name = str(data.get("name", data.id))
	definition.source_data = data.duplicate(true)
	return definition
