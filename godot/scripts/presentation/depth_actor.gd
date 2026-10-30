class_name DepthActor
extends Node2D
## A pooled visual can participate in native foot-position sorting without physics proxies.

var subject: Dictionary = {}
var paint: Callable
var revision: int = -1


func _draw() -> void:
	if paint.is_valid() and not subject.is_empty() and bool(subject.get("active", true)):
		paint.call(self, subject)
