class_name GameCatalog
extends Resource
## A single native catalog owns definition lookups for simulation and presentation.

@export var definitions: Array[ContentDefinition] = []
@export var defaults: Dictionary = {}
@export var metadata: Dictionary = {}
@export var default_save: Dictionary = {}

var _by_category: Dictionary = {}


func all(category: String) -> Dictionary:
	if _by_category.is_empty():
		for definition: ContentDefinition in definitions:
			var key: String = String(definition.category)
			if not _by_category.has(key):
				_by_category[key] = {}
			_by_category[key][String(definition.content_id)] = definition
	return _by_category.get(category, {})


func find(category: String, content_id: String) -> ContentDefinition:
	return all(category).get(content_id) as ContentDefinition


func parameters(category: String, content_id: String) -> Dictionary:
	var definition: ContentDefinition = find(category, content_id)
	return definition.parameters() if definition != null else {}
