class_name BossSystem
extends RefCounted
## Boss identity, phases and attacks come from the same imported definition.


func definition_for(model: RunSimulation, enemy: Dictionary) -> Dictionary:
	for id: String in model.catalog.all("bosses"):
		var definition: Dictionary = model.catalog.parameters("bosses", id)
		if definition.enemyId == enemy.type:
			return definition
	return {}


func phase_for(enemy: Dictionary, definition: Dictionary) -> Dictionary:
	var ratio: float = maxf(0, float(enemy.hp) / float(enemy.maxHp)) if float(enemy.maxHp) > 0 else 0.0
	for phase: Dictionary in definition.phases:
		if ratio >= float(phase.minHealthRatio):
			return phase
	return definition.phases.back()


func spawn_event(model: RunSimulation, enemy: Dictionary, wave: int = 1) -> Dictionary:
	var definition: Dictionary = definition_for(model, enemy)
	return {"phase": wave, "enemyId": enemy.id, "enemyType": enemy.type,
		"bossId": definition.get("id"), "name": definition.get("name", enemy.type),
		"intro": definition.get("intro", "高危目标逼近"), "detail": definition.get("tactic", "保持移动"),
		"hudColor": definition.get("hudColor")}


func update(model: RunSimulation, enemy: Dictionary, toward_x: float, toward_y: float) -> bool:
	var definition: Dictionary = definition_for(model, enemy)
	if definition.is_empty():
		return false
	var phase: Dictionary = phase_for(enemy, definition)
	if enemy.bossPhaseId != phase.id:
		enemy.bossPhaseId = phase.id
		enemy.bossPhase = definition.phases.find(phase) + 1
		model.push_event("bossPhase", {"bossId": definition.id, "name": definition.name,
			"phase": enemy.bossPhase, "phaseId": phase.id, "phaseLabel": phase.label,
			"warning": phase.warning, "hudColor": definition.hudColor,
			"enemyId": enemy.id, "x": enemy.x, "y": enemy.y})
	if float(enemy.actionCooldown) > 0:
		return true
	if phase.get("radial") is Dictionary:
		model.combat.radial_attack(model, enemy, int(phase.radial.count), float(phase.radial.speed), float(phase.radial.damage))
	if phase.get("aimedShot") is Dictionary:
		model.combat.spawn_enemy_shot(model, enemy, toward_x, toward_y, float(phase.aimedShot.speed),
			float(phase.aimedShot.damage), float(phase.aimedShot.ttl), str(phase.aimedShot.color))
	if phase.get("summon") is Dictionary and model.enemies.size() < int(phase.summon.cap):
		for index: int in range(int(phase.summon.count)):
			var side: int = 1 if index % 2 == 0 else -1
			model.spawn_enemy(phase.summon.enemyId, float(enemy.x) + side * (42 + index * 4),
				float(enemy.y) + side * 22)
	enemy.actionCooldown = phase.cooldown
	model.push_event("enemyAction", {"action": "pulse", "bossId": definition.id,
		"phaseId": phase.id, "x": enemy.x, "y": enemy.y})
	return true


func drop(model: RunSimulation, enemy: Dictionary) -> void:
	var definition: Dictionary = definition_for(model, enemy)
	if definition.is_empty():
		return
	if float(definition.drop.get("scrap", 0)) > 0:
		model.spawn_pickup("scrap", float(enemy.x) - 10, enemy.y, definition.drop.scrap)
	if float(definition.drop.get("healing", 0)) > 0:
		model.spawn_pickup("medkit", float(enemy.x) + 12, float(enemy.y) - 8, definition.drop.healing)
