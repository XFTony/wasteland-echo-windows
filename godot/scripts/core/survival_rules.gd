class_name SurvivalRules
extends RefCounted
## Time pressure and stat ceilings are shared by combat and the field market.


static func pressure(seconds: float) -> Dictionary:
	var elapsed: float = maxf(0.0, seconds) if is_finite(seconds) else 0.0
	var minutes: float = elapsed / 60.0
	var growth: float = maxf(0.0, minutes - 0.5)
	var cycle: int = floori(elapsed / 60.0) % 3
	return {
		"level": 1 + floori(minutes),
		"minutes": minutes,
		"hp": minf(1e8, (1.0 + growth * 0.18) * exp(minf(18.0, growth * 0.055))),
		"damage": minf(1e7, 1.0 + minutes * 0.08 + minutes * minutes * 0.0008),
		"speed": minf(1.5, 1.0 + minutes * 0.012),
		"cap": mini(104, 18 + floori(minutes * 8)),
		"interval": maxf(0.11, 1.25 / (1 + minutes * 0.28)) / [1.03, 1.0, 1.1][cycle],
		"price": 1.0 + minutes * 0.06,
		"reward": 1.0 + floori(minutes / 5.0) * 0.25,
		"xp": 1.0 + minf(3.0, minutes * 0.045),
	}


static func clamp_stats(player: Dictionary) -> void:
	var ceilings: Dictionary = {
		"speed": 360, "fireRateMultiplier": 8, "projectileBonus": 10,
		"pierceBonus": 16, "pickupRadius": 440, "projectileRangeMultiplier": 3,
		"projectileSpeedMultiplier": 4, "projectileRadiusBonus": 12,
		"damageMultiplier": 1e6, "maxHp": 1e7, "regenPerSecond": 50,
		"invulnerabilityDuration": 1.2,
	}
	for key: String in ceilings:
		player[key] = minf(float(player[key]), float(ceilings[key]))
	player["hp"] = minf(float(player.maxHp), float(player.hp))
