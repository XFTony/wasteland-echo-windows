class_name CreditsPage
extends RefCounted
## Credits retain the existing licensing text and progress-driven next objective.


static func build(view: MenuView) -> void:
	var compact: bool = view.size.y < 580 or view.size.x < 850
	var height: float = minf(720, view.size.y - (16 if compact else 48))
	view.add_action_button("back", "返回营地", Rect2(view.size.x / 2 - 80,
		(view.size.y - height) / 2 + height - (43 if compact else 55),
		160, 34 if compact else 42))


static func paint(view: MenuView) -> void:
	var compact: bool = view.size.y < 580 or view.size.x < 850
	var dimensions := Vector2(minf(1180, view.size.x - (16 if compact else 64)),
		minf(720, view.size.y - (16 if compact else 48)))
	var position: Vector2 = (view.size - dimensions) / 2
	var header: float = 52 if compact else 80
	view.draw_rect(Rect2(position, Vector2(minf(dimensions.x * 0.6, 430 if compact else 650),
		header)), Color(0.055, 0.051, 0.039, 0.91))
	RadioPaint.radio_mark(view, position + Vector2(18 if compact else 28, 12 if compact else 18),
		RadioPaint.GOLD, 0.7 if compact else 0.95)
	view.fonts.title(view, "制作与许可", position + Vector2(58 if compact else 82,
		header / 2 + 2), 25 if compact else 38)
	var save: Dictionary = view.session.save_data
	var rules: Array[Dictionary] = []
	for id: String in view.session.catalog.all("unlockRules"):
		if id not in save.completedUnlockRules:
			var rule: Dictionary = view.session.catalog.parameters("unlockRules", id)
			rules.append({"rule": rule, "progress": UnlockRules.progress(save, {}, rule)})
	rules.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return float(a.progress.ratio) > float(b.progress.ratio))
	var next: String = "下一目标：全部规则已完成"
	if not rules.is_empty():
		next = "下一目标：%s — %s（%d%%）" % [rules[0].rule.name, rules[0].rule.description,
			roundi(float(rules[0].progress.ratio) * 100)]
	var lines: Array[String] = [
		"当前版本：v1.5 技术重构预览",
		"生存档案：成就 %d/8 · 结算 %d · 击败 %d" % [save.achievements.size(), save.settledRuns, save.totalKills],
		"规则档案：%d/15 · 蓝图 %d/10 · 协议 %d/4 · 铭牌 %d/7" % [
			save.completedUnlockRules.size(), save.unlockedBlueprints.size(),
			save.unlockedModifiers.size(), save.masteryBadges.size()],
		next,
		"游戏设计、战斗内核与像素角色：本项目原创",
		"像素人物、营地与桌面场景：项目生成素材，经原生像素整理",
		"字标采用 Fusion Pixel；中文正文采用系统字体，许可见素材台账",
		"音频：原创主题编曲；实录枪声 SnakeF8；氛围 SubspaceAudio（CC0）",
		"输入：可重绑定键盘鼠标 + 标准 Gamepad API 手柄",
		"完整来源、许可与修改记录：查看 CREDITS.md 和素材台账",
	]
	var body := Rect2(position + Vector2(12 if compact else 22, header),
		Vector2(minf(dimensions.x - (24 if compact else 44), dimensions.x * 0.94 if compact else 860),
		dimensions.y - header - (52 if compact else 70)))
	view.draw_rect(body, Color(0.063, 0.055, 0.043, 0.9))
	view.fonts.text(view, "荒原档案 / WASTELAND RECORD", body.position
		+ Vector2(16, 20 if compact else 27), 13 if compact else 16, RadioPaint.GOLD, "left", 900)
	for index: int in range(lines.size()):
		view.fonts.fit(view, lines[index], body.position + Vector2(16 if compact else 24,
			(50 if compact else 66) + index * (27 if compact else 38)),
			(13 if compact else 17) if index == 0 else (11 if compact else 14),
			body.size.x - (32 if compact else 48), RadioPaint.GOLD if index == 0 else RadioPaint.PAPER,
			"left", 900 if index == 0 else 700, 10)
