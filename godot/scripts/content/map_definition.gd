class_name MapDefinition
extends ContentDefinition
## Original geometry is imported alongside the map's stable content identity.

@export var world_size: int = 3072
@export var layout_id: StringName
@export var layout: Dictionary = {}


func parameters() -> Dictionary:
	var result: Dictionary = super.parameters()
	result["worldSize"] = world_size
	result["layoutId"] = String(layout_id)
	return result
