class_name EconomyRules
extends RefCounted
## Purchases are validated before mutation; permanent and field wallets stay separate.

const GRANT_LISTS: Dictionary = {
	"weapon": "unlockedWeapons", "skin": "unlockedSkins", "equipment": "ownedEquipment",
}


static func wallet(save: Dictionary) -> Dictionary:
	if not save.get("currencies") is Dictionary:
		save.currencies = {"copper": 0, "gold": 0}
	for key: String in ["copper", "gold"]:
		save.currencies[key] = SaveCodec.non_negative(save.currencies.get(key))
	return save.currencies


static func shop_state(save: Dictionary, item: Dictionary, highest_stage: int) -> Dictionary:
	if item.is_empty():
		return {"status": "missing", "owned": false, "unlocked": false,
			"affordable": false, "ruleLocked": false}
	var money: Dictionary = wallet(save)
	var list_name: String = GRANT_LISTS.get(item.grantType, "")
	var owned: bool = not list_name.is_empty() and item.grantId in save.get(list_name, [])
	var stage_locked: bool = highest_stage < int(item.get("unlockStage", 1))
	var rule_locked: bool = not str(item.get("unlockRuleId", "")).is_empty()
	rule_locked = rule_locked and item.id not in save.get("unlockedBlueprints", [])
	var affordable: bool = int(money[item.currency]) >= int(item.price)
	var status: String = "owned" if owned else "ruleLocked" if rule_locked else (
		"locked" if stage_locked else "available" if affordable else "insufficient"
	)
	return {
		"status": status, "owned": owned, "unlocked": not stage_locked and not rule_locked,
		"stageLocked": stage_locked, "ruleLocked": false if owned else rule_locked,
		"affordable": affordable, "balance": money[item.currency],
	}


static func buy_shop(save: Dictionary, item: Dictionary, highest_stage: int) -> Dictionary:
	var state: Dictionary = shop_state(save, item, highest_stage)
	if state.status != "available":
		state["ok"] = false
		return state
	var list_name: String = GRANT_LISTS[item.grantType]
	save.currencies[item.currency] -= int(item.price)
	save[list_name].append(item.grantId)
	return {"ok": true, "status": "purchased", "owned": true, "itemId": item.id,
		"balance": save.currencies[item.currency]}


static func weapon_modifiers(run: Dictionary, weapon_id: String = "") -> Dictionary:
	var id: String = weapon_id if not weapon_id.is_empty() else run.player.weaponId
	var entry: Dictionary = run.arsenal.get(id, {})
	return {
		"damage": pow(1.32, int(entry.get("tier", 1)) - 1) * pow(1.12, int(entry.get("calibration", 0))),
		"rate": pow(1.03, int(entry.get("calibration", 0))),
	}


static func payout(run: Dictionary, stage: Dictionary, mode: Dictionary, result: String) -> Dictionary:
	var victory: bool = result == "win"
	var legacy: int = int(run.scrap) + floori(float(run.kills) / 10)
	legacy += int(mode.get("winReward", 0)) if victory else 0
	var copper: float = float(run.scrap) * 12 + float(run.kills) * 2 + float(run.eliteKills) * 15
	copper += 120 if victory else 0
	copper *= float(stage.get("copperMultiplier", 1)) * float(run.player.copperMultiplier)
	return {"legacyScrap": legacy, "copper": maxi(0, floori(copper)),
		"gold": maxi(0, floori(float(stage.get("goldReward", 0)))) if victory else 0}
