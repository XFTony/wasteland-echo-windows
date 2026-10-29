class_name ContentDefinition
extends Resource
## Keeps stable source IDs while making native resources editable in the inspector.

@export var content_id: StringName
@export var category: StringName
@export var display_name: String
@export var source_data: Dictionary = {}


func parameters() -> Dictionary:
	var result: Dictionary = source_data.duplicate(true)
	result["id"] = String(content_id)
	if result.has("name"):
		result["name"] = display_name
	return result
