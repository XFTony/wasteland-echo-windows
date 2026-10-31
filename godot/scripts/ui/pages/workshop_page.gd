class_name WorkshopPage
extends RefCounted
## Permanent codex and paused run details use the same native upgrade definitions.


static func frame(dimensions: Vector2) -> Rect2:
	var size := Vector2(minf(1080, dimensions.x - 36), minf(650, dimensions.y - 28))
	return Rect2((dimensions - size) / 2, size)


static func page_size(rect: Rect2) -> int:
	return clampi(floori((rect.size.y - 175) / 52), 3, 8)


static func entries(catalog: GameCatalog) -> Array:
	var recent: Array = []
	var original: Array = []
	for id: String in catalog.all("upgrades"):
		if catalog.parameters("upgrades", id).has("unlockWave"):
			recent.append(id)
		else:
			original.append(id)
	return recent + original


static func build(view: MenuView) -> void:
	var rect: Rect2 = frame(view.size)
	var count: int = view.session.catalog.all("upgrades").size()
	var pages: int = ceili(float(count) / page_size(rect))
	view.session.workshop_page = clampi(view.session.workshop_page, 0, pages - 1)
	view.add_action_button("back", "返回行装", Rect2(rect.end.x - 132, rect.position.y + 12, 116, 34))
	if view.session.workshop_page > 0:
		view.add_action_button("workshopPage:" + str(view.session.workshop_page - 1), "上一页", Rect2(rect.position.x + 18, rect.end.y - 43, 110, 30))
	if view.session.workshop_page + 1 < pages:
		view.add_action_button("workshopPage:" + str(view.session.workshop_page + 1), "下一页", Rect2(rect.end.x - 128, rect.end.y - 43, 110, 30))


static func paint(view: MenuView) -> void:
	var rect: Rect2 = frame(view.size)
	RadioPaint.surface(view, rect, false, true, false, Color("25291f"))
	view.fonts.text(view, "战地改件档案", rect.position + Vector2(22, 31), 25, RadioPaint.PAPER_LIGHT, "left", 900)
	var waves: int = WorkshopRules.completed_waves(view.session.save_data)
	view.fonts.text(view, "最高完成 %d 轮 · 每轮45秒连续生存 · 解锁永久保留" % waves, rect.position + Vector2(22, 65), 13, RadioPaint.GOLD)
	view.fonts.text(view, "解锁后仍需满足当前武器、前置改件与等级条件，升级时随机出现", rect.position + Vector2(22, 89), 11, RadioPaint.MUTED)
	var ids: Array = entries(view.session.catalog)
	var capacity: int = page_size(rect)
	for index: int in range(mini(capacity, ids.size() - view.session.workshop_page * capacity)):
		var id: String = str(ids[view.session.workshop_page * capacity + index])
		var upgrade: Dictionary = view.session.catalog.parameters("upgrades", id)
		var y: float = rect.position.y + 126 + index * 52
		UpgradeGlyph.paint(view, view.session.catalog, id, Vector2(rect.position.x + 43, y + 6), 34)
		view.fonts.text(view, upgrade.name, Vector2(rect.position.x + 71, y), 15, RadioPaint.PAPER_LIGHT, "left", 800)
		view.fonts.fit(view, WorkshopRules.detail(upgrade), Vector2(rect.position.x + 71, y + 21), 12, rect.size.x - 260, RadioPaint.MUTED, "left", 600, 10)
		var unlocked: bool = WorkshopRules.unlocked(upgrade, view.session.save_data)
		var label: String = "已解锁" if unlocked else "完成第%d轮解锁" % int(upgrade.get("unlockWave", 0))
		if bool(upgrade.get("requires", {}).get("masteryUnlock", false)) and id not in view.session.save_data.unlockedEvolutions:
			label = "需要精通蓝图"
		view.fonts.text(view, label, Vector2(rect.end.x - 24, y), 12, RadioPaint.GOLD if unlocked else RadioPaint.MUTED, "right", 800)
		view.fonts.fit(view, "适用：" + WorkshopRules.applicability(upgrade, view.session.catalog), Vector2(rect.end.x - 24, y + 21), 11, 200, RadioPaint.MUTED, "right", 500, 10)
	view.fonts.text(view, "%d/%d" % [view.session.workshop_page + 1, ceili(float(ids.size()) / capacity)], Vector2(rect.get_center().x, rect.end.y - 27), 12, RadioPaint.PAPER)


static func run_lines(model: RunSimulation) -> Array[String]:
	var player: Dictionary = model.run.player
	var weapon: Dictionary = model.catalog.parameters("weapons", player.weaponId)
	var refit: Dictionary = EconomyRules.weapon_modifiers(model.run)
	var count: int = WeaponRules.projectile_count(weapon, player)
	var damage: float = float(weapon.damage) * float(player.damageMultiplier) * float(refit.damage)
	if weapon.get("attackType") == "beam":
		damage /= 1 + maxi(0, count - 1) * 0.35
	elif weapon.get("attackType") in ["disc", "explosive"]:
		damage /= 1 + maxi(0, count - 1) * 0.2
	var interval: float = float(weapon.interval) / (float(player.fireRateMultiplier) * float(refit.rate))
	if weapon.get("attackType") in ["slash", "slam"]:
		var rate: float = minf(2.4, float(player.fireRateMultiplier) * float(refit.rate))
		interval = maxf(float(weapon.interval) / rate, (float(weapon.windup) + float(weapon.activeTime) + float(weapon.recovery)) / rate + 0.035)
	var extra: String = ""
	var kind: String = str(weapon.get("attackType", "projectile"))
	if kind in ["slash", "slam"]:
		extra = "近战范围 %.0f · 有效段 %.2f秒" % [float(weapon.reach) * float(player.meleeRangeMultiplier), float(weapon.activeTime) / minf(2.4, float(player.fireRateMultiplier) * float(refit.rate))]
	elif kind == "disc":
		extra = "弹射 %d次 · 锁定范围 %.0f" % [int(weapon.bounces) + int(player.get("bounceBonus", 0)), WeaponRules.target_range(weapon, player)]
	elif kind == "explosive":
		extra = "爆炸半径 %.0f · 锁定范围 %.0f" % [float(weapon.blastRadius) * float(player.blastRadiusMultiplier), WeaponRules.target_range(weapon, player)]
	elif kind == "beam":
		extra = "瞬时射线 · 穿透次数 %d · 锁定范围 %.0f" % [int(weapon.pierce) + int(player.pierceBonus), WeaponRules.target_range(weapon, player)]
	else:
		extra = "穿透次数 %d · 锁定范围 %.0f · 弹速 %.0f" % [int(weapon.pierce) + int(player.pierceBonus), WeaponRules.target_range(weapon, player), float(weapon.projectileSpeed) * float(player.projectileSpeedMultiplier)]
		if weapon.has("slowDuration"):
			extra += " · 减速%.1f秒" % (float(weapon.slowDuration) + float(player.get("chillDurationBonus", 0)))
		if weapon.has("burnDuration"):
			extra += " · 灼烧%.1f秒（刷新）" % float(weapon.burnDuration)
		if weapon.has("chainJumps"):
			extra += " · 最多%d次连锁" % int(weapon.chainJumps)
	return ["%s · 常态伤害 %.1f%s · %.2f次/秒" % [weapon.name, damage, "×%d弹" % count if count > 0 else "/次", 1 / maxf(1.0 / 60, interval)],
		"移速 %.0f · 拾取 %.0f · 暴击 %.0f%% · 暴伤 %.2f倍" % [player.speed, player.pickupRadius, float(player.criticalChance) * 100, player.criticalMultiplier],
		"护甲减伤 %.0f%% · 脱战回复 %.1f/秒 · 当前轮数 %d" % [float(player.armor) * 100, player.regenPerSecond, 1 + floori(float(model.run.elapsed) / 45)], extra]


static func paint_run(view: BattleView, page: int) -> void:
	var rect: Rect2 = frame(view.size)
	RadioPaint.surface(view, rect, false, true, false, Color("25291f"))
	view.fonts.text(view, "本局战地改件", rect.position + Vector2(22, 31), 25, RadioPaint.PAPER_LIGHT, "left", 900)
	var lines: Array[String] = run_lines(view.model)
	for index: int in range(lines.size()):
		view.fonts.fit(view, lines[index], rect.position + Vector2(22, 65 + index * 21), 12, rect.size.x - 44, RadioPaint.GOLD, "left", 600, 10)
	var ids: Array = view.model.run.upgrades.keys()
	var capacity: int = page_size(rect)
	for index: int in range(mini(capacity, ids.size() - page * capacity)):
		var id: String = str(ids[page * capacity + index])
		var upgrade: Dictionary = view.model.catalog.parameters("upgrades", id)
		view.fonts.text(view, "%s  Lv.%d" % [upgrade.get("name", id), int(view.model.run.upgrades[id])], rect.position + Vector2(24, 147 + index * 46), 15, RadioPaint.PAPER_LIGHT, "left", 800)
		view.fonts.fit(view, WorkshopRules.detail(upgrade), rect.position + Vector2(250, 147 + index * 46), 12, rect.size.x - 275, RadioPaint.MUTED, "left", 600, 10)
	if ids.is_empty():
		view.fonts.text(view, "本局尚未装配改件；升级后可在此核对", rect.position + Vector2(24, 165), 15, RadioPaint.MUTED)
