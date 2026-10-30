class_name ItemPresentation
extends RefCounted

const SLOT_LABELS: Dictionary = {"helmet": "头盔", "chest": "身甲", "legs": "腿甲", "boots": "靴子"}
const RARITY_LABELS: Dictionary = {"standard": "标准行装", "advanced": "精制行装", "prototype": "原型行装"}


static func accent(kind: String, item: Dictionary, catalog: GameCatalog) -> Color:
	if item.is_empty():
		return Color("5f5d54")
	if kind == "weapon":
		return Color(catalog.metadata.icons.rangeBands.get(item.rangeBand, {}).get("color", "#d2a64f"))
	if kind == "skin":
		return Color(item.get("accent", "#b55238"))
	return Color("d7b75b") if item.get("rarity") == "prototype" else Color("8ba4a0") if item.get("rarity") == "advanced" else Color("879468")


static func weapon_summary(weapon: Dictionary) -> Array[String]:
	match str(weapon.get("attackType", "projectile")):
		"beam":
			return ["基础%d伤害 / %d射程" % [weapon.damage, weapon.lockRange],
				"贯穿%d目标 · 最多3束" % (int(weapon.pierce) + 1), "遇墙终止 · 无普通弹壳"]
		"explosive":
			return ["基础%d伤害 / %d爆炸半径" % [weapon.damage, weapon.blastRadius], "接触或到时引爆", "边缘衰减 · 掩体挡爆"]
		"disc":
			return ["基础%d伤害 / 弹射%d次" % [weapon.damage, weapon.bounces], "每跳78% · 不重复命中", "实体墙阻挡"]
		"slash":
			return ["基础%d刃伤 / %d近战范围" % [weapon.damage, weapon.reach], "110°挥扫 · 40%伤害剑气", "有效挥扫可消弹"]
		"slam":
			return ["基础%d伤害 / %d冲击半径" % [weapon.damage, weapon.blastRadius], "%d落点 · 前摇%s秒" % [weapon.impactOffset, weapon.windup], "击退与短时消弹"]
	return [str(weapon.description)]


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
