class_name CompactPose
extends RefCounted
## Coordinates mirror the reference rig; visual transforms never change hitboxes.


static func sample(
		hold: Dictionary, angle: float, pixel_scale: float, facing: float = 1.0,
		recoil: float = 0.0, visual_angle: float = 0.0
) -> Dictionary:
	var direction := Vector2.from_angle(angle)
	var up: float = maxf(0.0, -direction.y)
	var anchor := Vector2(
		float(hold.aimOffsetX) * direction.x + float(hold.upShoulder) * pow(up, 3),
		float(hold.chestY) - float(hold.upLift) * up
	) * pixel_scale - direction * recoil
	var local_muzzle := Vector2(
		float(hold.muzzle[0]) - float(hold.pivot[0]),
		(float(hold.muzzle[1]) - float(hold.pivot[1])) * facing
	) * pixel_scale
	var rotation: float = angle + visual_angle
	return {"anchor": anchor, "angle": rotation, "facing": facing,
		"muzzle": anchor + local_muzzle.rotated(rotation)}


static func aim_at(hold: Dictionary, target: Vector2, pixel_scale: float) -> float:
	var angle: float = (target - Vector2(0, float(hold.chestY) * pixel_scale)).angle()
	for index: int in range(12):
		var pose: Dictionary = sample(hold, angle, pixel_scale)
		if target.distance_to(pose.anchor) < 2 * pixel_scale:
			break
		angle = (target - Vector2(pose.anchor)).angle()
	return angle
