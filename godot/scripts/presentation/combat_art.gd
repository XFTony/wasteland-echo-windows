class_name CombatArt
extends RefCounted
## Tiny bitmap assets decode once; missing art preserves usable fallback controls.

static var _textures: Dictionary = {}


static func texture(filename: String) -> Texture2D:
	if filename.is_empty():
		return null
	if not _textures.has(filename):
		_textures[filename] = load(filename) as Texture2D if ResourceLoader.exists(filename) else null
	return _textures[filename] as Texture2D


static func icon(catalog: GameCatalog, id: String) -> Texture2D:
	return texture(str(catalog.metadata.get("combatArt", {}).get("upgradeTextures", {}).get(id, "")))


static func frame(catalog: GameCatalog, family: String, rarity: String) -> Texture2D:
	var frames: Array = catalog.metadata.get("combatArt", {}).get("frames", [])
	var index: int = {"firepower": 0, "survival": 1, "mobility": 2, "utility": 3}.get(family, 3)
	if rarity == "evolution":
		index = 5
	elif rarity == "prototype":
		index = 4
	return texture(str(frames[index])) if frames.size() > index else null
