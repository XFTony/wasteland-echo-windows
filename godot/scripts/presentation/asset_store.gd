class_name AssetStore
extends RefCounted
## Asset IDs remain stable while Godot handles decoded resource lifetime.

var _catalog: GameCatalog
var _paths: Dictionary = {}
var _textures: Dictionary = {}
var _weapons: Dictionary = {}


func _init(catalog: GameCatalog) -> void:
	_catalog = catalog
	for asset: Dictionary in catalog.metadata.assets:
		_paths[asset.id] = asset.resourcePath


func texture(asset_id: String) -> Texture2D:
	if not _paths.has(asset_id):
		return null
	if not _textures.has(asset_id):
		_textures[asset_id] = load(_paths[asset_id]) as Texture2D
	return _textures[asset_id] as Texture2D


func path_for(asset_id: String) -> String:
	return _paths.get(asset_id, "")


func release(asset_id: String) -> void:
	_textures.erase(asset_id)


func weapon_texture(id: String) -> Texture2D:
	var filename: String = str(_catalog.metadata.get("combatArt", {}).get("weaponTextures", {}).get(id, ""))
	var refined: Texture2D = CombatArt.texture(filename)
	if refined != null:
		return refined
	var spec: Dictionary = _catalog.metadata.poses[id].definition.visual
	if not str(spec.asset).begins_with("native."):
		return texture(_catalog.metadata.actorMetadata.PART_ASSETS[spec.asset])
	if not _weapons.has(id):
		var image := Image.create_empty(int(spec.width), int(spec.height), false, Image.FORMAT_RGBA8)
		for rectangle: Array in spec.shapes:
			image.fill_rect(Rect2i(int(rectangle[0]), int(rectangle[1]), int(rectangle[2]),
				int(rectangle[3])), Color(_catalog.metadata.nativePalette[rectangle[4]]))
		_weapons[id] = ImageTexture.create_from_image(image)
	return _weapons[id] as Texture2D


func item_texture(kind: String, id: String) -> Texture2D:
	if kind == "weapon":
		return weapon_texture(id)
	var mapping: Dictionary = _catalog.metadata.icons.skins if kind == "skin" else _catalog.metadata.icons.equipment
	return texture(mapping.get(id, ""))
