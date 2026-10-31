class_name KnockbackRules
extends RefCounted
## Per-attack impulse caps keep a shotgun volley from applying six full shoves.

const DAMPING: float = 15.0
const IMPULSE_SCALE: float = 2.4
const MAX_SPEED: float = 360.0


static func add(enemy: Dictionary, source: Dictionary) -> float:
	var vx: float = float(source.get("vx", 0))
	var vy: float = float(source.get("vy", 0))
	var length: float = sqrt(vx * vx + vy * vy)
	var strength: float = maxf(0, float(source.get("knockback", 0)))
	strength *= 1 - clampf(float(enemy.get("knockbackResistance", 0)), 0, 1)
	if not is_finite(length) or length < 1e-8 or strength <= 0:
		return 0
	var allowed: float = strength
	var raw_id: float = SaveCodec.number(source.get("attackId", 0), NAN)
	var attack_id: int = int(raw_id) if is_finite(raw_id) and raw_id == floorf(raw_id) else 0
	if attack_id > 0 and enemy.has("knockbackAttackIds"):
		var ids: PackedInt32Array = enemy.knockbackAttackIds
		var amounts: PackedFloat32Array = enemy.knockbackAttackAmounts
		var index: int = ids.find(attack_id)
		if index < 0:
			index = int(enemy.knockbackAttackCursor)
			enemy.knockbackAttackCursor = (index + 1) % ids.size()
			ids[index] = attack_id
			amounts[index] = 0
		allowed = maxf(0, minf(strength, strength * 1.15 - amounts[index]))
		amounts[index] += allowed
		enemy.knockbackAttackIds = ids
		enemy.knockbackAttackAmounts = amounts
	enemy.knockbackVX = float(enemy.get("knockbackVX", 0)) + vx / length * allowed * IMPULSE_SCALE
	enemy.knockbackVY = float(enemy.get("knockbackVY", 0)) + vy / length * allowed * IMPULSE_SCALE
	var speed: float = sqrt(pow(float(enemy.knockbackVX), 2) + pow(float(enemy.knockbackVY), 2))
	if speed > MAX_SPEED:
		enemy.knockbackVX *= MAX_SPEED / speed
		enemy.knockbackVY *= MAX_SPEED / speed
	return allowed


static func advance(enemy: Dictionary, delta: float, resolve: Callable, context: RunSimulation) -> void:
	var vx: float = float(enemy.knockbackVX)
	var vy: float = float(enemy.knockbackVY)
	if sqrt(vx * vx + vy * vy) < 0.5:
		enemy.knockbackVX = 0.0
		enemy.knockbackVY = 0.0
		return
	var decay: float = exp(-DAMPING * delta)
	var dx: float = vx * (1 - decay) / DAMPING
	var dy: float = vy * (1 - decay) / DAMPING
	var steps: int = clampi(ceili(sqrt(dx * dx + dy * dy) / maxf(3, float(enemy.radius) * 0.65)), 1, 8)
	for index: int in range(steps):
		var wanted_x: float = float(enemy.x) + dx / steps
		var wanted_y: float = float(enemy.y) + dy / steps
		enemy.x = wanted_x
		enemy.y = wanted_y
		resolve.call(context, enemy)
		if absf(float(enemy.x) - wanted_x) > 0.001:
			enemy.knockbackVX = 0.0
		if absf(float(enemy.y) - wanted_y) > 0.001:
			enemy.knockbackVY = 0.0
	enemy.knockbackVX *= decay
	enemy.knockbackVY *= decay
