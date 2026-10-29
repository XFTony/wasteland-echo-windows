class_name LoadoutRules
extends RefCounted
## The inventory preview and run initialization use exactly the same composition.

const SLOTS: Array[String] = ["helmet", "chest", "legs", "boots"]
const STAT_KEYS: Array[String] = [
	"maxHp", "armor", "speed", "damageMultiplier", "fireRateMultiplier",
	"pickupRadius", "copperMultiplier", "lockRangeMultiplier",
]


static func base_stats(mode: Dictionary) -> Dictionary:
	var survival: bool = mode.rule != "extract"
	return {
		"hp": mode.get("playerHp", 115 if survival else 100),
		"maxHp": mode.get("playerHp", 115 if survival else 100),
		"speed": mode.get("playerSpeed", 178 if survival else 170),
		"pickupRadius": 48.0, "armor": 0.0, "damageMultiplier": 1.0,
		"meleeRangeMultiplier": 1.0, "blastRadiusMultiplier": 1.0,
		"fireRateMultiplier": 1.0, "copperMultiplier": 1.0, "lockRangeMultiplier": 1.0,
	}


static func calculate(
		base: Dictionary, hero: Dictionary, save: Dictionary, catalog: GameCatalog
) -> Dictionary:
	var stats: Dictionary = {}
	for key: String in STAT_KEYS:
		stats[key] = float(base.get(key, 0.0 if key in ["maxHp", "speed", "pickupRadius", "armor"] else 1.0))
	for pair: Array in [
		["maxHp", "hpMultiplier"], ["speed", "speedMultiplier"],
		["pickupRadius", "pickupMultiplier"], ["damageMultiplier", "damageMultiplier"],
		["copperMultiplier", "copperMultiplier"], ["lockRangeMultiplier", "lockRangeMultiplier"],
	]:
		stats[pair[0]] *= float(hero.get(pair[1], 1.0))
	stats.armor += float(hero.get("armorBonus", 0.0))
	var owned: Array = save.get("ownedEquipment", [])
	var equipped: Dictionary = save.get("equippedEquipment", {})
	for slot: String in SLOTS:
		var id: String = str(equipped.get(slot, ""))
		var item: Dictionary = catalog.parameters("equipment", id)
		if item.is_empty() or item.slot != slot or id not in owned:
			continue
		var modifiers: Dictionary = item.get("stats", {})
		stats.maxHp += float(modifiers.get("hp", 0.0))
		stats.armor += float(modifiers.get("armor", 0.0))
		for pair: Array in [
			["speed", "speedMultiplier"], ["pickupRadius", "pickupMultiplier"],
			["damageMultiplier", "damageMultiplier"], ["fireRateMultiplier", "fireRateMultiplier"],
			["copperMultiplier", "copperMultiplier"], ["lockRangeMultiplier", "lockRangeMultiplier"],
		]:
			stats[pair[0]] *= float(modifiers.get(pair[1], 1.0))
	stats.armor = clampf(float(stats.armor), 0.0, 0.65)
	stats.maxHp = floori(float(stats.maxHp) + 0.5)
	return stats
