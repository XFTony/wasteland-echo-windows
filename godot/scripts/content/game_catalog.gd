class_name GameCatalog
extends Resource
## A single native catalog owns definition lookups for simulation and presentation.

@export var definitions: Array[ContentDefinition] = []
@export var defaults: Dictionary = {}
@export var metadata: Dictionary = {}
@export var default_save: Dictionary = {}

var _by_category: Dictionary = {}
var _parameter_cache: Dictionary = {}


func all(category: String) -> Dictionary:
	if _by_category.is_empty():
		for definition: ContentDefinition in definitions:
			var key: String = String(definition.category)
			if not _by_category.has(key):
				_by_category[key] = {}
			_by_category[key][String(definition.content_id)] = definition
			definition.changed.connect(_invalidate_definition.bind(key, String(definition.content_id)))
	return _by_category.get(category, {})


func find(category: String, content_id: String) -> ContentDefinition:
	return all(category).get(content_id) as ContentDefinition


func parameters(category: String, content_id: String) -> Dictionary:
	var key: String = category + ":" + content_id
	if _parameter_cache.has(key):
		return _parameter_cache[key]
	var definition: ContentDefinition = find(category, content_id)
	if definition == null:
		return {}
	var result: Dictionary = definition.parameters()
	result.make_read_only()
	_parameter_cache[key] = result
	return result


func clear_runtime_cache() -> void:
	_parameter_cache.clear()


func _invalidate_definition(category: String, content_id: String) -> void:
	_parameter_cache.erase(category + ":" + content_id)
