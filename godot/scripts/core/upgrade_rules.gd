class_name UpgradeRules
extends RefCounted
## Upgrade arithmetic is independent of card animation and screen state.

const MECHANIC_UPGRADES: Array[String] = [
	"executionCapacitor", "reactivePlating", "salvageOverdrive", "pointBlankRelay",
	"focusProtocol", "cascadeRounds",
]


static func apply(content_id: String, player: Dictionary, run: Dictionary) -> bool:
	if content_id in MECHANIC_UPGRADES:
		var next_level: int = int(run.upgrades.get(content_id, 0)) + 1
		run.mechanicUpgrades[content_id] = maxi(int(run.mechanicUpgrades.get(content_id, 0)), next_level)
		return true
	match content_id:
		"critDamage":
			player.criticalMultiplier += 0.2
		"killMend":
			player["killMend"] = int(player.get("killMend", 0)) + 1
		"meleeTempo":
			player.fireRateMultiplier *= 1.1
			player.damageMultiplier *= 1.08
		"ricochetCoil":
			player["bounceBonus"] = int(player.get("bounceBonus", 0)) + 1
		"chillAmplifier":
			player["chillDurationBonus"] = float(player.get("chillDurationBonus", 0)) + 0.3
		"blastFocus":
			player.damageMultiplier *= 1.12
			player.blastRadiusMultiplier = minf(1.4, float(player.blastRadiusMultiplier) + 0.06)
		"fieldRush":
			player.speed *= 1.06
			player.fireRateMultiplier *= 1.04
		"pressureBarrel":
			player["spreadMultiplier"] = float(player.get("spreadMultiplier", 1)) * 0.88
			player.projectileRangeMultiplier *= 1.08
		"meleeReach":
			player.meleeRangeMultiplier = minf(1.5, float(player.meleeRangeMultiplier) + 0.1)
		"blastRadius":
			player.blastRadiusMultiplier = minf(1.4, float(player.blastRadiusMultiplier) + 0.1)
		"engineering":
			run.engineering += 1
		"turretRepair":
			run.turretRegen += 1
		"endlessPower":
			player.damageMultiplier *= 1.05
		"endlessVitality":
			player.maxHp += 8
			player.hp += 8
		"endlessSupplies":
			run.scrap += 10
		"endlessAid":
			player.hp = minf(float(player.maxHp), float(player.hp) + float(player.maxHp) * 0.15)
			run.scrap += 4
		"damage":
			player.damageMultiplier *= 1.15
		"fireRate":
			player.fireRateMultiplier *= 1.12
		"projectile":
			player.projectileBonus += 1
		"pierce":
			player.pierceBonus += 1
		"velocity":
			player.projectileSpeedMultiplier *= 1.16
			player.projectileRangeMultiplier *= 1.08
		"caliber":
			player.projectileRadiusBonus += 0.6
			player.knockbackMultiplier *= 1.18
		"critical":
			player.criticalChance = maxf(float(player.criticalChance), minf(0.42, float(player.criticalChance) + 0.07))
		"speed":
			player.speed *= 1.08
		"vitality":
			player.maxHp += 15
			player.hp = minf(float(player.maxHp), float(player.hp) + 15.0)
		"magnet":
			player.pickupRadius *= 1.25
		"armor":
			player.armor = maxf(float(player.armor), minf(0.45, float(player.armor) + 0.08))
		"recovery":
			player.regenPerSecond += 0.4
		"scavenger":
			player.scrapChanceBonus = minf(0.4, float(player.scrapChanceBonus) + 0.08)
			player.scrapMultiplier *= 1.2
		"phaseLining":
			player.invulnerabilityDuration += 0.08
		"penetratorDoctrine":
			player.damageMultiplier *= 1.25
			player.pierceBonus += 2
			player.projectileRadiusBonus += 1
		"swarmProtocol":
			player.projectileBonus += 2
			player.fireRateMultiplier *= 1.15
			player.damageMultiplier *= 0.88
		"recoveryField":
			player.pickupRadius *= 1.8
			player.regenPerSecond += 0.8
		"phaseAegis":
			player.armor = minf(0.55, float(player.armor) + 0.1)
			player.invulnerabilityDuration += 0.12
			player.speed *= 1.08
		"kineticLoop":
			player.speed *= 1.16
			player.invulnerabilityDuration += 0.1
			player.criticalChance = minf(0.5, float(player.criticalChance) + 0.05)
		"arcNetwork":
			player.projectileSpeedMultiplier *= 1.2
			player.damageMultiplier *= 1.12
			player.pierceBonus += 1
		_:
			return false
	return true
