class_name EnemyBrain
extends RefCounted
## Shared steering preserves role-specific flow blending and ranged spacing.


static func steer(
		enemy: Dictionary, target: Dictionary, navigation: FlowNavigation,
		role_profiles: Dictionary, role_weights: Dictionary, output: Dictionary
) -> Dictionary:
	var dx: float = float(target.x) - float(enemy.x)
	var dy: float = float(target.y) - float(enemy.y)
	var squared: float = dx * dx + dy * dy
	var distance: float = sqrt(squared) if squared > 1e-8 else 0.0
	var toward_x: float = dx / distance if distance > 0 else 1.0
	var toward_y: float = dy / distance if distance > 0 else 0.0
	var direction_x: float = toward_x
	var direction_y: float = toward_y
	if distance > 96 and navigation != null:
		var probe: float = maxf(navigation.cell_size * 0.9, float(enemy.radius) * 3)
		var blocked: bool = not navigation.is_world_walkable(float(enemy.x) + toward_x * probe,
			float(enemy.y) + toward_y * probe)
		if blocked:
			enemy.navigationTime = maxf(float(enemy.navigationTime), 1.1)
		if blocked or float(enemy.navigationTime) > 0:
			var index: int = navigation.sample_index(float(enemy.x), float(enemy.y))
			if index >= 0:
				var flow_x: int = navigation.direction_x[index]
				var flow_y: int = navigation.direction_y[index]
				if flow_x != 0 or flow_y != 0:
					var weight: float = float(role_weights.get(enemy.role, 0.72))
					var blended_x: float = toward_x * (1 - weight) + flow_x * weight
					var blended_y: float = toward_y * (1 - weight) + flow_y * weight
					var length_squared: float = blended_x * blended_x + blended_y * blended_y
					if length_squared > 1e-8:
						var length: float = sqrt(length_squared)
						direction_x = blended_x / length
						direction_y = blended_y / length
	var spacing: Dictionary = role_profiles.get(enemy.role, {}).get("spacing", {})
	if not spacing.is_empty():
		if distance < float(spacing.retreatDistance):
			direction_x = -toward_x
			direction_y = -toward_y
		elif distance < float(spacing.strafeDistance):
			direction_x = -toward_y * float(spacing.strafeScale)
			direction_y = toward_x * float(spacing.strafeScale)
	output.distance = distance
	output.towardX = toward_x
	output.towardY = toward_y
	output.directionX = direction_x
	output.directionY = direction_y
	return output
