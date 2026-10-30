class_name MasteryRules
extends RefCounted
## Claimed reward IDs make save reconciliation and repeated settlement idempotent.

const THRESHOLDS: Array[int] = [0, 50, 140, 280, 480, 750, 1100, 1550, 2100, 2800]


static func level_for_experience(experience: float) -> int:
	var level: int = 1
	for index: int in range(1, THRESHOLDS.size()):
		if experience < THRESHOLDS[index]:
			break
		level = index + 1
	return level


static func apply_perks(player: Dictionary, save: Dictionary, id: String, catalog: GameCatalog) -> void:
	for reward: Dictionary in catalog.metadata.masteryRewards:
		if id + ":" + str(reward.id) not in save.claimedMasteryRewards:
			continue
		for key: String in ["copperMultiplier", "damageMultiplier", "scrapMultiplier"]:
			if float(reward.get(key, 0)) != 0:
				player[key] *= 1 + float(reward[key])
		player.criticalChance += float(reward.get("criticalChance", 0))
	player.criticalChance = clampf(float(player.criticalChance), 0, 0.75)


static func grant_rewards(
		save: Dictionary, id: String, previous: int, current: int, catalog: GameCatalog
) -> Array:
	var granted: Array = []
	var money: Dictionary = EconomyRules.wallet(save)
	for reward: Dictionary in catalog.metadata.masteryRewards:
		if int(reward.level) <= previous or int(reward.level) > mini(10, current):
			continue
		var claim: String = id + ":" + str(reward.id)
		if claim in save.claimedMasteryRewards:
			continue
		save.claimedMasteryRewards.append(claim)
		var copper: int = maxi(0, int(reward.get("copper", 0)))
		var gold: int = maxi(0, int(reward.get("gold", 0)))
		money.copper += copper
		money.gold += gold
		save.totalCopper += copper
		save.totalGold += gold
		var evolutions: Array = catalog.metadata.masteryEvolutionRewards.get(id, []) if bool(reward.get("evolutionAccess", false)) else []
		for evolution: String in evolutions:
			if evolution not in save.unlockedEvolutions:
				save.unlockedEvolutions.append(evolution)
		if bool(reward.get("badge", false)) and id not in save.masteryBadges:
			save.masteryBadges.append(id)
		granted.append({"weaponId": id, "claimId": claim, "level": reward.level,
			"id": reward.id, "name": reward.name, "description": reward.description,
			"copper": copper, "gold": gold, "evolutions": evolutions.duplicate(),
			"badge": bool(reward.get("badge", false))})
	return granted


static func reconcile(save: Dictionary, catalog: GameCatalog) -> Array:
	var granted: Array = []
	for id: String in save.weaponMastery:
		var record: Dictionary = save.weaponMastery[id]
		var level: int = clampi(maxi(int(record.level), level_for_experience(float(record.experience))), 1, 10)
		record.level = level
		granted.append_array(grant_rewards(save, id, 1, level, catalog))
	return granted
