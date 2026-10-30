@tool
extends Node2D
## A layer delegates native draw commands without duplicating the simulation state.

var paint: Callable


func _draw() -> void:
	if paint.is_valid():
		paint.call(self)
