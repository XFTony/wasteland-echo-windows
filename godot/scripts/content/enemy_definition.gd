class_name EnemyDefinition
extends ContentDefinition
## Enemy identity and original parameters remain separate from presentation nodes.

@export var max_health: float = 16.0
@export var speed: float = 55.0
@export var damage: float = 8.0
@export var radius: float = 10.0


func parameters() -> Dictionary:
	var result: Dictionary = super.parameters()
	result.merge({"hp": max_health, "speed": speed, "damage": damage, "radius": radius}, true)
	return result
