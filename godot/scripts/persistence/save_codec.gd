class_name SaveCodec
extends RefCounted
## Schema fields intentionally retain their original names for lossless import.

const INTEGER_FIELDS: Array[String] = [
	"scrap", "totalKills", "eliteKills", "wins", "bossesDefeated",
]
const ARRAY_FIELDS: Dictionary = {
	"unlockedWeapons": ["scrap_pistol"], "unlockedSkins": ["wanderer"],
	"unlockedHeroes": ["ranger", "mechanic"], "completedStages": [],
	"ownedEquipment": ["field_vest"], "unlockedBlueprints": [],
	"unlockedModifiers": [], "completedUnlockRules": [], "claimedMasteryRewards": [],
	"unlockedEvolutions": [], "masteryBadges": [],
}
const BINDING_ORDER: Array[String] = [
	"moveUp", "moveDown", "moveLeft", "moveRight", "fire", "pause", "fullscreen",
	"restart", "quit", "upgrade1", "upgrade2", "upgrade3", "upgrade4", "interact",
	"deployTurret",
]
const RESERVED_CODES: Array[String] = [
	"Enter", "NumpadEnter", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]


static func number(value: Variant, fallback: float = 0.0) -> float:
	if value == null:
		return 0.0
	if value is bool:
		return 1.0 if value else 0.0
	if value is int or value is float:
		return float(value) if is_finite(float(value)) else fallback
	if value is String:
		var text: String = value.strip_edges()
		return float(text) if text.is_valid_float() else 0.0 if text.is_empty() else fallback
	return fallback


static func non_negative(value: Variant, fallback: int = 0) -> int:
	if value == null or value is String and value.is_empty():
		return fallback
	var numeric: float = number(value, NAN)
	return maxi(0, floori(numeric)) if is_finite(numeric) else fallback


static func optional_id(value: Variant, fallback: String) -> String:
	return value if value is String and not value.is_empty() else fallback


static func unique_ids(value: Variant, required: Array = []) -> Array:
	var result: Array = required.duplicate()
	if value is Array:
		for item: Variant in value:
			if item is String and not item.is_empty() and item not in result:
				result.append(item)
	return result


static func normalize_bindings(value: Variant, defaults: Dictionary) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var result: Dictionary = {}
	var used: Array[String] = []
	var expression := RegEx.new()
	expression.compile("^[A-Za-z][A-Za-z0-9]{1,23}$")
	for action: String in BINDING_ORDER:
		var proposed: String = str(source.get(action, ""))
		if expression.search(proposed) == null or proposed in RESERVED_CODES:
			proposed = defaults[action]
		var code: String = defaults[action] if proposed in used else proposed
		result[action] = "Unbound" + action if code in used else code
		used.append(result[action])
	return result


static func normalize_settings(value: Variant, defaults: Dictionary) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var result: Dictionary = defaults.duplicate(true)
	result.merge(source, true)
	for pair: Array in [["music", 0.0, 1.0], ["sfx", 0.0, 1.0], ["uiScale", 0.8, 1.2]]:
		result[pair[0]] = clampf(number(result[pair[0]]), float(pair[1]), float(pair[2]))
	var deadzone: float = number(result.gamepadDeadzone)
	result.gamepadDeadzone = clampf(deadzone if deadzone != 0 else 0.18, 0.05, 0.5)
	for key: String in ["screenShake", "flashes"]:
		if result[key] not in ["off", "low", "high"]:
			result[key] = defaults[key]
	for key: String in [
		"musicMuted", "sfxMuted", "gamepadEnabled", "gamepadVibration", "showControlHints",
		"showFps", "autoAim", "autoFire", "introAnimation",
	]:
		result[key] = source[key] if source.get(key) is bool else defaults[key]
	return result


static func normalize(value: Variant, defaults: Dictionary, legacy_maps: Dictionary) -> Dictionary:
	if not value is Dictionary:
		return defaults.duplicate(true)
	var source: Dictionary = value
	var version: int = int(number(source.get("schemaVersion")))
	var result: Dictionary = defaults.duplicate(true)
	result.merge(source, true)
	result.schemaVersion = 10
	result.settings = normalize_settings(source.get("settings"), defaults.settings)
	result.keyBindings = normalize_bindings(source.get("keyBindings"), defaults.keyBindings)
	if version < 3:
		result.settings.autoAim = true
	var wallet: Dictionary = source.currencies if source.get("currencies") is Dictionary else {}
	var has_wallet: bool = source.get("currencies") is Dictionary
	var migrated: int = non_negative(source.get("scrap")) * 10 if version < 10 and not has_wallet else 250
	result.currencies = {
		"copper": non_negative(wallet.get("copper"), migrated),
		"gold": non_negative(wallet.get("gold")),
	}
	result.totalCopper = maxi(int(result.currencies.copper),
		non_negative(source.get("totalCopper"), int(result.currencies.copper)))
	result.totalGold = maxi(int(result.currencies.gold),
		non_negative(source.get("totalGold"), int(result.currencies.gold)))
	for key: String in INTEGER_FIELDS:
		result[key] = non_negative(source.get(key))
	result.totalScrap = maxi(int(result.scrap), non_negative(source.get("totalScrap")))
	result.bestTime = maxf(0, number(source.get("bestTime")))
	result.settledRuns = non_negative(source.get("settledRuns"), int(result.wins))
	result.survivalRecords = {}
	if source.get("survivalRecords") is Dictionary:
		for id: String in source.survivalRecords:
			var record: Variant = source.survivalRecords[id]
			if record is Dictionary:
				result.survivalRecords[id] = {
					"bestTime": non_negative(record.get("bestTime")),
					"bestKills": non_negative(record.get("bestKills")),
					"runs": non_negative(record.get("runs")),
				}
	for key: String in ARRAY_FIELDS:
		result[key] = unique_ids(source.get(key), ARRAY_FIELDS[key])
	result.unlockedMaps = unique_ids(source.get("unlockedMaps"), defaults.unlockedMaps)
	result.equippedEquipment = _equipment(source.get("equippedEquipment"), version,
		result.ownedEquipment)
	for key: String in [
		"selectedWeapon", "selectedSkin", "selectedHero", "selectedMap", "selectedStage",
		"selectedMode", "shopCategory",
	]:
		result[key] = optional_id(source.get(key), defaults[key])
	if version < 10 and source.get("selectedMode") in ["survival", "extraction"]:
		result.selectedMode = "endless"
	result.achievements = {}
	if source.get("achievements") is Dictionary:
		for id: String in source.achievements:
			if not id.is_empty() and source.achievements[id] is bool and source.achievements[id]:
				result.achievements[id] = true
	result.tutorialCompleted = source.get("tutorialCompleted") is bool and source.tutorialCompleted
	result.tutorialSkipped = source.get("tutorialSkipped") is bool and source.tutorialSkipped
	result.weaponMastery = _mastery(source.get("weaponMastery"))
	result.runHistory = _history(source.get("runHistory"), defaults, legacy_maps)
	return result


static func _equipment(value: Variant, version: int, owned: Array) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var chest: Variant = source.get("chest", source.get("armor", null if version >= 6 else "field_vest"))
	var result: Dictionary = {
		"helmet": source.get("helmet"), "chest": chest,
		"legs": source.get("legs"), "boots": source.get("boots"),
	}
	if version < 6:
		var legacy_targets: Dictionary = {
			"magnet_coil": "helmet", "ammo_rig": "legs", "signal_charm": "helmet",
		}
		for item: Variant in [source.get("charm"), source.get("tool")]:
			var slot: String = legacy_targets.get(str(item), "")
			if not slot.is_empty() and result[slot] == null:
				result[slot] = item
	for slot: String in result:
		if result[slot] != null and result[slot] not in owned:
			result[slot] = null
	return result


static func _mastery(value: Variant) -> Dictionary:
	var result: Dictionary = {}
	if not value is Dictionary:
		return result
	for id: String in value:
		if id.is_empty() or not value[id] is Dictionary:
			continue
		var record: Dictionary = value[id]
		var kills: int = non_negative(record.get("kills"))
		var runs: int = non_negative(record.get("runs"))
		result[id] = {
			"kills": kills, "runs": runs,
			"experience": non_negative(record.get("experience"), kills + runs * 5),
			"level": clampi(non_negative(record.get("level"), 1), 1, 10),
		}
	return result


static func _history(value: Variant, defaults: Dictionary, legacy_maps: Dictionary) -> Array:
	var result: Array = []
	if not value is Array:
		return result
	for record: Variant in value.slice(0, 20):
		if not record is Dictionary:
			continue
		var stage_id: Variant = null if record.has("stageId") and record.stageId == null else optional_id(
			record.get("stageId"), defaults.selectedStage
		)
		var entry: Dictionary = {
			"seed": non_negative(record.get("seed")),
			"modeId": optional_id(record.get("modeId"), defaults.selectedMode),
			"stageId": stage_id,
			"mapId": optional_id(record.get("mapId"),
				legacy_maps.get(record.get("stageId", ""), defaults.selectedMap)),
			"weaponId": optional_id(record.get("weaponId"), defaults.selectedWeapon),
			"result": record.result if record.get("result") in ["win", "retire"] else "lose",
			"bossesDefeated": non_negative(record.get("bossesDefeated")),
			"accuracy": clampf(number(record.get("accuracy")), 0.0, 1.0),
			"masteryGain": non_negative(record.get("masteryGain")),
			"masteryLevel": maxi(1, non_negative(record.get("masteryLevel"), 1)),
			"completedAt": non_negative(record.get("completedAt")),
		}
		for key: String in ["elapsed", "damageDealt", "maxNoHitTime"]:
			entry[key] = maxf(0.0, number(record.get(key)))
		entry.kills = non_negative(record.get("kills"))
		result.append(entry)
	return result
