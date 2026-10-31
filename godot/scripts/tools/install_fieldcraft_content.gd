extends SceneTree
## Explicit installation preserves the existing 16 weapons and 42 upgrades.


func _init() -> void:
	_install.call_deferred()


func _install() -> void:
	var design: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://../art/combat/fieldcraft-v2/design.json"))
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	if catalog.metadata.get("fieldcraftVersion", 0) == design.version and "--apply-design" not in OS.get_cmdline_user_args():
		print("Fieldcraft content already installed; native edits retained.")
		quit()
		return
	for data: Dictionary in design.weapons:
		var weapon := WeaponDefinition.new()
		weapon.damage = float(data.damage)
		weapon.interval = float(data.interval)
		weapon.projectile_speed = float(data.projectileSpeed)
		weapon.projectile_count = int(data.projectileCount)
		weapon.lock_range = float(data.lockRange)
		weapon.lifetime = float(data.ttl)
		weapon.pierce = int(data.pierce)
		weapon.knockback = float(data.knockback)
		weapon.recoil = float(data.recoil)
		_register(catalog, weapon, "weapons", data)
		var visual: Dictionary = design.visuals[data.id].duplicate(true)
		visual.asset = "native." + str(data.id)
		var definition: Dictionary = {"id": data.id, "name": data.name, "version": "fieldcraft-v2", "visual": visual, "combat": data}
		var layers: Array = catalog.metadata.poses.echo_blade.layout.layers.duplicate(true)
		for layer: Dictionary in layers:
			layer.x += float(visual.primaryGrip[0]) - 13
			layer.y += float(visual.primaryGrip[1]) - 11
		for layer: Dictionary in catalog.metadata.poses.echo_blade.layout.layers:
			var support: Dictionary = layer.duplicate(true)
			support.x += float(visual.supportGrip[0]) - 13
			support.y += float(visual.supportGrip[1]) - 11
			support.slot = "support"
			support.depth = "back"
			layers.append(support)
		var hold: Dictionary = visual.hold.duplicate(true)
		hold.merge({"width": visual.width, "height": visual.height, "pivot": visual.pivot, "muzzle": visual.muzzle, "recoil": data.recoil}, true)
		catalog.metadata.poses[data.id] = {"definition": definition, "hold": hold, "layout": {
			"weapon": definition, "layers": layers, "width": visual.width, "height": visual.height,
			"origin": [0, 0], "pivot": visual.pivot, "muzzle": visual.muzzle}}
		catalog.metadata.nativeWeapons[data.id] = visual
		catalog.metadata.weaponFeedback[data.id] = design.feedback[data.id]
		catalog.metadata.survival.gunPrices[data.id] = design.gunPrices[data.id]
		_register(catalog, ContentDefinition.new(), "shopItems", {"id": "buy_" + str(data.id),
			"category": "weapon", "name": data.name, "description": data.description, "grantType": "weapon",
			"grantId": data.id, "currency": "copper", "price": design.prices[data.id], "unlockStage": 1})
	for data: Dictionary in [{"id": "burning_jet", "name": "燃烧火舌", "description": "短程灼烧，刷新但不无限叠加"},
		{"id": "arc_tether", "name": "有限电链", "description": "初始命中后最多两次邻近连锁，受墙体阻挡"}]:
		_register(catalog, ContentDefinition.new(), "mechanics", data)
	for audio: Dictionary in design.audio:
		var found: bool = false
		for index: int in range(catalog.metadata.audio.size()):
			if catalog.metadata.audio[index].id == audio.id:
				catalog.metadata.audio[index] = audio
				found = true
		if not found:
			catalog.metadata.audio.append(audio)
	catalog.metadata["combatArt"] = design.art.duplicate(true)
	catalog.metadata.icons.weaponClasses.merge({"crossbow": "机械弩", "elemental": "控制喷射", "spear": "长矛", "axe": "战斧",
		"flamethrower": "喷火器", "electric": "电链枪", "fist": "拳刃", "scythe": "战镰"}, true)
	catalog.metadata["fieldcraftVersion"] = design.version
	catalog.clear_runtime_cache()
	var error: Error = ResourceSaver.save(catalog, "res://content/game_catalog.tres")
	print("FIELDCRAFT_CONTENT " + JSON.stringify({"definitions": catalog.definitions.size(), "weapons": catalog.all("weapons").size(), "audio": catalog.metadata.audio.size()}))
	quit(0 if error == OK else 1)


func _register(catalog: GameCatalog, definition: ContentDefinition, category: String, data: Dictionary) -> void:
	definition.content_id = StringName(data.id)
	definition.category = StringName(category)
	definition.display_name = data.name
	definition.source_data = data.duplicate(true)
	var filename: String = "res://content/" + category.to_snake_case() + "/" + str(data.id).to_snake_case() + ".tres"
	definition.take_over_path(filename)
	var error: Error = ResourceSaver.save(definition, filename)
	if error != OK:
		push_error("Cannot save fieldcraft resource: " + filename)
		quit(1)
		return
	for index: int in range(catalog.definitions.size()):
		if catalog.definitions[index].category == definition.category and catalog.definitions[index].content_id == definition.content_id:
			catalog.definitions[index] = definition
			return
	catalog.definitions.append(definition)
