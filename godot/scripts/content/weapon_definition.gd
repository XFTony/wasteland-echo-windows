class_name WeaponDefinition
extends ContentDefinition
## Explicit attack properties support future tuning without editing shared combat code.

@export_group("Attack")
@export var damage: float = 1.0
@export_range(0.01, 10.0, 0.01) var interval: float = 0.35
@export var projectile_speed: float = 660.0
@export var projectile_count: int = 1
@export var lock_range: float = 520.0
@export var lifetime: float = 0.9
@export var pierce: int = 0
@export var knockback: float = 0.0
@export var recoil: float = 0.0


func parameters() -> Dictionary:
	var result: Dictionary = super.parameters()
	result.merge({
		"damage": damage,
		"interval": interval,
		"projectileSpeed": projectile_speed,
		"projectileCount": projectile_count,
		"lockRange": lock_range,
		"ttl": lifetime,
		"pierce": pierce,
		"knockback": knockback,
		"recoil": recoil,
	}, true)
	return result
