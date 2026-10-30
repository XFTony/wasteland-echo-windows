class_name MapArtProfile
extends Resource
## Visual materials stay independent from the tested collision and spawn definitions.

@export var floor_tiles: TileSet
@export var floor_material: ShaderMaterial
@export var prop_texture: Texture2D
@export var prop_material: ShaderMaterial
@export var prop_regions: Dictionary = {}
@export var ground_tint: Color = Color.WHITE
@export var prop_tint: Color = Color.WHITE
@export var base_surface_row: int = 2
@export var world_tile_size: int = 64
@export var atlas_tile_size: int = 312
@export var road_edge: Color = Color("79755b")
@export var road_line: Color = Color("bba96f")
@export var landmark_color: Color = Color("d5b875")
@export var roof_fade: float = 0.42


func prop_key(data: Dictionary) -> String:
	var kind: String = str(data.get("kind", ""))
	if kind == "shop" and "药" in str(data.get("sign", "")):
		return "clinic"
	return kind


func height_for(data: Dictionary) -> float:
	match str(data.get("kind", "")):
		"shop", "warehouse", "station":
			return 56.0
		"tradePost":
			return 64.0
		"container", "railcar", "bus":
			return 24.0
	return 0.0
