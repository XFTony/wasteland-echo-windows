class_name ItemPresentation
extends RefCounted

const SLOT_LABELS: Dictionary = {"helmet": "头盔", "chest": "身甲", "legs": "腿甲", "boots": "靴子"}
const RARITY_LABELS: Dictionary = {"standard": "标准行装", "advanced": "精制行装", "prototype": "原型行装"}


static func stats(kind: String, item: Dictionary) -> String:
	if kind == "weapon":
		var rate: float = minf(99, 1.0 / float(item.interval))
		return "伤害 %d  ·  攻速 %s/秒  ·  锁定 %d" % [item.damage,
			("%.1f" if float(item.interval) < 0.15 else "%.2f") % rate, item.lockRange]
	if kind != "equipment":
		return item.description
	var tokens: Array[String] = []
	var values: Dictionary = item.get("stats", {})
	if float(values.get("hp", 0)) != 0:
		tokens.append("生命 +%d" % roundi(float(values.hp)))
	if float(values.get("armor", 0)) != 0:
		tokens.append("护甲 +%d%%" % roundi(float(values.armor) * 100))
	for pair: Array in [["移动", "speedMultiplier"], ["增伤", "damageMultiplier"],
		["射速", "fireRateMultiplier"], ["拾取", "pickupMultiplier"],
		["铜币", "copperMultiplier"], ["锁定", "lockRangeMultiplier"]]:
		if values.has(pair[1]):
			var delta: int = roundi((float(values[pair[1]]) - 1.0) * 100)
			tokens.append(str(pair[0]) + " " + ("+" if delta >= 0 else "") + str(delta) + "%")
	return "  ·  ".join(tokens) if not tokens.is_empty() else str(item.description)


static func meta(kind: String, item: Dictionary, catalog: GameCatalog) -> String:
	if kind == "weapon":
		var bands: Dictionary = catalog.metadata.icons.rangeBands
		var band: Dictionary = bands.get(item.rangeBand, bands.mid)
		return str(band.label) + " · " + str(catalog.metadata.icons.weaponClasses.get(item.weaponClass, item.weaponClass))
	if kind == "skin":
		return "永久行动服饰"
	return str(SLOT_LABELS[item.slot]) + " · " + str(RARITY_LABELS.get(item.rarity, item.rarity))
