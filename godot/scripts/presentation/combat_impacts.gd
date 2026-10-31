class_name CombatImpacts
extends RefCounted
## Independent presentation snapshots outlive pooled enemies without retaining their mutable state.

const MAX_CORPSES: int = 40
const MAX_BURSTS: int = 112
const REST_POSE: Dictionary = {"offset": Vector2.ZERO, "rotation": 0.0, "scale": Vector2.ONE, "brightness": 1.0}

var corpses: Array[Dictionary] = []
var bursts: Array[Dictionary] = []
var reactions: Dictionary = {}
var _model: RunSimulation
var _now: float = 0.0


func configure(model: RunSimulation) -> void:
	_model = model
	_now = float(model.run.get("elapsed", 0))


func consume(events: Array[Dictionary], visual_states: Dictionary = {}) -> void:
	var merged: Dictionary = {}
	for event: Dictionary in events:
		if event.type == "hit" and float(event.damage) > 0:
			var key: String = "%s:%s" % [event.enemyId, event.get("attackId", 0)]
			if merged.has(key):
				continue
			merged[key] = true
			var direction := Vector2(float(event.aimX), float(event.aimY))
			if direction.length_squared() < 0.001:
				direction = Vector2.UP
			var strength: float = clampf(0.55 + float(event.appliedKnockback) / 80 + (0.35 if event.critical else 0), 0.55, 1.6)
			reactions[event.enemyId] = {"at": _model.run.elapsed, "direction": direction, "strength": strength}
			if reactions.size() > 160:
				reactions.erase(reactions.keys()[0])
			var id: String = str(event.get("weaponId", ""))
			var profile: Dictionary = _model.catalog.metadata.weaponFeedback.get(id, {})
			var enemy_type: String = str(visual_states.get(event.enemyId, {}).get("enemyType", ""))
			var material_color: String = "#a5ada0" if enemy_type in ["brute", "warden", "iron_colossus"] else "#ae8463"
			if profile.get("family") in ["cryo", "flame", "arc", "coil"]:
				material_color = str(profile.get("impact", material_color))
			var budget: int = MAX_BURSTS / 2 if _model.save.settings.get("quality") == "low" else MAX_BURSTS
			if bursts.size() >= budget:
				bursts.pop_front()
			bursts.append({"point": Vector2(event.x, event.y), "direction": direction,
				"at": _model.run.elapsed, "strength": strength, "critical": event.critical,
				"seed": MapScene.render_hash(int(event.enemyId), int(event.get("attackId", 0))),
				"color": material_color})
		elif event.type == "kill":
			_add_corpse(event)


func advance(elapsed: float) -> void:
	if elapsed < _now:
		corpses.clear()
		bursts.clear()
		reactions.clear()
	_now = elapsed
	for index: int in range(corpses.size() - 1, -1, -1):
		if elapsed - float(corpses[index].at) >= float(corpses[index].duration):
			corpses.remove_at(index)
	for index: int in range(bursts.size() - 1, -1, -1):
		if elapsed - float(bursts[index].at) >= 0.23:
			bursts.remove_at(index)
	for id: Variant in reactions.keys():
		if elapsed - float(reactions[id].at) >= 0.18:
			reactions.erase(id)


func reaction_pose(id: int) -> Dictionary:
	if not reactions.has(id):
		return REST_POSE
	var reaction: Dictionary = reactions[id]
	var age: float = maxf(0, _now - float(reaction.at))
	var envelope: float = sin(minf(1, age / 0.018) * PI / 2) * exp(-age * 24) * float(reaction.strength)
	return {"offset": Vector2(reaction.direction) * envelope * 3,
		"rotation": float(reaction.direction.x) * envelope * 0.075,
		"scale": Vector2(1 + envelope * 0.09, 1 - envelope * 0.065),
		"brightness": 1.0 if _model.save.settings.flashes == "off" else 1 + envelope * 0.85}


func corpse_frame(corpse: Dictionary) -> int:
	var age: float = (_now - float(corpse.at)) / (1.35 if corpse.boss else 1.0)
	return 0 if age < 0.065 else 1 if age < 0.155 else 2 if age < 0.27 else 3


func paint_corpses(canvas: CanvasItem, visible: Rect2) -> void:
	for corpse: Dictionary in corpses:
		var age: float = maxf(0, _now - float(corpse.at))
		var point: Vector2 = Vector2(corpse.point) + Vector2(corpse.slide) * (1 - exp(-age * 13))
		if not visible.grow(150).has_point(point):
			continue
		var filename: String = str(_model.catalog.metadata.get("combatArt", {}).get("deathTextures", {}).get(corpse.enemyType, ""))
		var texture: Texture2D = CombatArt.texture(filename)
		if texture == null:
			continue
		var alpha: float = minf(1, (float(corpse.duration) - age) / 0.7)
		var shade: float = lerpf(0.95, 0.63, clampf(age / 0.38, 0, 1))
		canvas.draw_set_transform(point.round() + Vector2(0, 1), 0, Vector2(1, 0.3))
		canvas.draw_circle(Vector2.ZERO, 22 if corpse.boss else 13, Color(0.06, 0.055, 0.04, alpha * 0.45))
		canvas.draw_set_transform(point.round(), 0, Vector2(1.5 * float(corpse.facing), 1.5))
		canvas.draw_texture_rect_region(texture, Rect2(-64, -104, 128, 128),
			Rect2(corpse_frame(corpse) * 128, 0, 128, 128), Color(shade, shade * 0.97, shade * 0.9, alpha))
		canvas.draw_set_transform(Vector2.ZERO)


func paint_bursts(canvas: CanvasItem, visible: Rect2) -> void:
	for burst: Dictionary in bursts:
		var point: Vector2 = burst.point
		if not visible.grow(60).has_point(point):
			continue
		var age: float = maxf(0, _now - float(burst.at))
		var progress: float = clampf(age / 0.23, 0, 1)
		var alpha: float = (1 - progress) * 0.9
		var direction: Vector2 = burst.direction
		var side := Vector2(-direction.y, direction.x)
		var color := Color(Color(burst.color), alpha)
		for index: int in range(8 if burst.critical else 5):
			var seed: int = int(burst.seed) + index * 7919
			var fan: float = float(posmod(seed, 101) - 50) / 50
			var speed: float = (10 + posmod(seed >> 3, 17)) * float(burst.strength)
			var offset: Vector2 = direction * (4 + speed * progress) + side * fan * (4 + progress * 15)
			offset.y += progress * progress * 12
			var tip: Vector2 = (point + offset).round()
			var size: float = 3 if index < 2 else 2
			canvas.draw_rect(Rect2(tip - Vector2.ONE, Vector2.ONE * (size + 2)), Color(0.11, 0.09, 0.06, alpha * 0.7))
			canvas.draw_rect(Rect2(tip, Vector2.ONE * size), color)
			if index < 2 and age < 0.09:
				canvas.draw_line(tip - direction * 6, tip, Color(0.93, 0.84, 0.65, alpha), 1)


func _add_corpse(event: Dictionary) -> void:
	var reaction: Dictionary = reactions.get(event.enemyId, {"direction": Vector2.RIGHT, "strength": 0.55})
	var direction: Vector2 = reaction.direction
	var point := Vector2(event.x, event.y)
	var slide: Vector2 = direction * (8 if event.boss else 10 + float(reaction.strength) * 7)
	var contact: float = GeometryRules.first_obstacle_time(_model.obstacles, point.x, point.y, slide.x, slide.y, 4)
	if is_finite(contact):
		slide *= maxf(0, contact - 0.05)
	var budget: int = MAX_CORPSES / 2 if _model.save.settings.get("quality") == "low" else MAX_CORPSES
	if corpses.size() >= budget:
		corpses.pop_front()
	corpses.append({"point": point, "slide": slide, "enemyType": str(event.enemyType),
		"at": float(_model.run.elapsed), "facing": -1.0 if direction.x < -0.1 else 1.0,
		"duration": 4.2 if event.boss else 3.0, "boss": bool(event.boss)})
