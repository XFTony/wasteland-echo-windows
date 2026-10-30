class_name WeaponFeedback
extends RefCounted
## Presentation-only recoil never changes aim, muzzle collision or seeded gameplay.


static func sample(catalog: GameCatalog, shot: Dictionary, elapsed: float,
		weapon_id: String, facing: float = 1, angle: float = 0) -> Dictionary:
	if shot.is_empty() or shot.weaponId != weapon_id:
		return {"offset": 0.0, "angle": 0.0, "strength": 0.0}
	var profile: Dictionary = catalog.metadata.weaponFeedback[weapon_id]
	var age: float = maxf(0, elapsed - float(shot.elapsed))
	var recovery: float = minf(float(profile.recovery), maxf(0.025, float(shot.interval) * 0.65))
	var curve: float = 1 - pow(1 - age / 0.012, 2) if age < 0.012 else exp(-(age - 0.012) / recovery)
	var strength: float = curve if curve >= 0.015 else 0.0
	var boost: float = 1.12 if shot.get("empowered", false) else 1.0
	return {"offset": float(profile.kick) * strength * boost,
		"angle": -facing * float(profile.angle) * PI / 180 * strength * boost * (0.2 + 0.8 * absf(cos(angle))),
		"strength": strength}
