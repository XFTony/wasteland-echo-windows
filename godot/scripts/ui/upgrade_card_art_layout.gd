class_name UpgradeCardArtLayout
extends Resource
## Regions use the approved 256x384 frame canvas, independently of window scaling.

@export var illustration: Rect2 = Rect2(60, 72, 168, 94)
@export var header: Rect2 = Rect2(65, 28, 156, 30)


func illustration_for(card_size: Vector2) -> Rect2:
	return _scaled(illustration, card_size)


func header_for(card_size: Vector2) -> Rect2:
	return _scaled(header, card_size)


func _scaled(region: Rect2, card_size: Vector2) -> Rect2:
	var factor: Vector2 = card_size / Vector2(256, 384)
	return Rect2(region.position * factor, region.size * factor)
