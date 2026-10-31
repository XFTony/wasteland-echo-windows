class_name CombatArt
extends RefCounted
## Tiny bitmap assets decode once; missing art preserves usable fallback controls.

const CARD_LAYOUT_NAMES: Array[String] = ["firepower", "survival", "mobility", "utility", "prototype", "evolution"]

static var _textures: Dictionary = {}
static var _layouts: Dictionary = {}


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
	var index: int = frame_index(family, rarity)
	return texture(str(frames[index])) if frames.size() > index else null


static func frame_index(family: String, rarity: String) -> int:
	var index: int = {"firepower": 0, "survival": 1, "mobility": 2, "utility": 3}.get(family, 3)
	if rarity == "evolution":
		index = 5
	elif rarity == "prototype":
		index = 4
	return index


static func card_layout(family: String, rarity: String) -> UpgradeCardArtLayout:
	var index: int = frame_index(family, rarity)
	if not _layouts.has(index):
		var filename: String = "res://content/ui/card_layouts/%s.tres" % CARD_LAYOUT_NAMES[index]
		_layouts[index] = load(filename) as UpgradeCardArtLayout if ResourceLoader.exists(filename) else UpgradeCardArtLayout.new()
	return _layouts[index] as UpgradeCardArtLayout
