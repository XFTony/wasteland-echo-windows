extends SceneTree
## An explicit one-time authoring step saves editable TileMapLayers, not runtime generators.


func _init() -> void:
	_build.call_deferred()


func _build() -> void:
	var catalog: GameCatalog = load("res://content/game_catalog.tres") as GameCatalog
	for id: String in catalog.all("maps"):
		var packed: PackedScene = load("res://scenes/maps/" + id + ".tscn") as PackedScene
		var map: MapScene = packed.instantiate() as MapScene
		var authored: bool = map.has_node("GroundTiles")
		map.free()
		if authored or ResourceLoader.exists("res://content/map_art/" + id + "_art.tres"):
			push_error("Map art already authored; preserve existing profiles and painted layers.")
			quit(1)
			return
	var terrain: Texture2D = load("res://assets/world/pixel_map_v2/terrain_atlas.png") as Texture2D
	var props: Texture2D = load("res://assets/world/pixel_map_v2/props_atlas.png") as Texture2D
	var tiles := TileSet.new()
	tiles.tile_size = Vector2i(312, 312)
	var atlas := TileSetAtlasSource.new()
	atlas.texture = terrain
	atlas.texture_region_size = Vector2i(312, 312)
	atlas.margins = Vector2i.ONE
	atlas.separation = Vector2i.ONE
	atlas.use_texture_padding = false
	for row: int in range(4):
		for column: int in range(4):
			atlas.create_tile(Vector2i(column, row))
	tiles.add_source(atlas, 0)
	ResourceSaver.save(tiles, "res://content/map_art/pixel_wasteland_tiles.tres", ResourceSaver.FLAG_CHANGE_PATH)
	tiles.take_over_path("res://content/map_art/pixel_wasteland_tiles.tres")
	var floor_material := ShaderMaterial.new()
	floor_material.shader = load("res://shaders/pixel_terrain.gdshader") as Shader
	ResourceSaver.save(floor_material, "res://content/map_art/pixel_floor_material.tres", ResourceSaver.FLAG_CHANGE_PATH)
	floor_material.take_over_path("res://content/map_art/pixel_floor_material.tres")
	var prop_material := ShaderMaterial.new()
	prop_material.shader = load("res://shaders/pixel_prop.gdshader") as Shader
	ResourceSaver.save(prop_material, "res://content/map_art/pixel_prop_material.tres", ResourceSaver.FLAG_CHANGE_PATH)
	prop_material.take_over_path("res://content/map_art/pixel_prop_material.tres")
	var rectangles: Array[Rect2] = [Rect2(28, 78, 287, 252), Rect2(334, 70, 284, 273),
		Rect2(647, 78, 306, 259), Rect2(982, 95, 245, 241), Rect2(23, 415, 319, 226),
		Rect2(357, 425, 293, 206), Rect2(674, 356, 281, 310), Rect2(987, 396, 243, 262),
		Rect2(90, 697, 136, 213), Rect2(336, 725, 259, 179), Rect2(650, 691, 252, 216),
		Rect2(963, 717, 265, 195), Rect2(41, 966, 256, 226), Rect2(366, 992, 249, 198),
		Rect2(707, 918, 146, 293), Rect2(982, 963, 211, 240)]
	var regions: Dictionary = {}
	var kinds: Array[String] = ["shop", "clinic", "warehouse", "container", "bus", "railcar",
		"tradePost", "station", "explosiveBarrel", "supplyCache", "generator", "barricade",
		"crate", "lowWall", "streetlight", "sign"]
	for index: int in range(kinds.size()):
		regions[kinds[index]] = rectangles[index]
	for id: String in catalog.all("maps"):
		var style := MapArtProfile.new()
		style.floor_tiles = tiles
		style.floor_material = floor_material
		style.prop_texture = props
		style.prop_material = prop_material
		style.prop_regions = regions.duplicate()
		if id == "echo_district":
			style.ground_tint = Color(0.9, 0.95, 0.84)
			style.prop_tint = Color(1, 0.98, 0.91)
		elif id == "freight_nexus":
			style.ground_tint = Color(0.83, 0.92, 0.96)
			style.prop_tint = Color(0.91, 0.97, 1)
			style.base_surface_row = 3
			style.road_line = Color("a6b3a5")
		else:
			style.ground_tint = Color(1.12, 0.88, 0.69)
			style.prop_tint = Color(1, 0.94, 0.81)
			style.road_line = Color("d6b37b")
		ResourceSaver.save(style, "res://content/map_art/" + id + "_art.tres", ResourceSaver.FLAG_CHANGE_PATH)
		style.take_over_path("res://content/map_art/" + id + "_art.tres")
		var filename: String = "res://scenes/maps/" + id + ".tscn"
		var packed: PackedScene = load(filename) as PackedScene
		var map: MapScene = packed.instantiate() as MapScene
		map.art_profile = style
		map.ground = null
		if map.has_node("GroundTiles"):
			push_error("GroundTiles already authored; do not overwrite existing painted layers.")
			map.free()
			quit(1)
			return
		var ground := TileMapLayer.new()
		ground.name = "GroundTiles"
		ground.tile_set = tiles
		ground.scale = Vector2.ONE * float(style.world_tile_size) / style.atlas_tile_size
		ground.z_index = -1
		ground.material = floor_material
		ground.modulate = style.ground_tint
		ground.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		ground.collision_enabled = false
		ground.navigation_enabled = false
		ground.set_meta("role", "visual_only; model geometry remains authoritative")
		map.add_child(ground)
		ground.owner = map
		var count: int = ceili(float(map.definition.world_size) / style.world_tile_size)
		for y: int in range(count):
			for x: int in range(count):
				var point := Vector2((x + 0.5) * style.world_tile_size, (y + 0.5) * style.world_tile_size)
				var surface: int = style.base_surface_row
				for zone: Dictionary in map.definition.layout.zones:
					if Rect2(zone.x, zone.y, zone.w, zone.h).has_point(point):
						surface = 1 if zone.surface in ["pavement", "concrete"] else 3 if zone.surface == "ballast" else 2
				for road: Dictionary in map.definition.layout.roads:
					if Rect2(road.x, road.y, road.w, road.h).has_point(point):
						surface = 0
				ground.set_cell(Vector2i(x, y), 0, Vector2i(MapScene.render_hash(x, y) % 4, surface))
		var result := PackedScene.new()
		result.pack(map)
		var error: Error = ResourceSaver.save(result, filename)
		map.free()
		if error != OK:
			quit(1)
			return
		print("Authored pixel floor: " + id)
	quit()
