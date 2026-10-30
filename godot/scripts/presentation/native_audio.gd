class_name NativeAudio
extends Node
## Compressed music is streamed; a bounded voice pool handles short weapon samples.

const SFX_BUS: StringName = &"WastelandSFX"
const TONES: Dictionary = {
	"ui": [420, 560, 0.055, 0.035, "square"],
	"hit": [96, 58, 0.042, 0.022, "square"],
	"criticalHit": [610, 270, 0.075, 0.035, "triangle"],
	"playerHit": [92, 38, 0.2, 0.075, "sawtooth"],
	"pickup": [540, 760, 0.07, 0.026, "sine"],
	"levelup": [360, 920, 0.34, 0.05, "square"],
	"boss": [62, 38, 0.72, 0.08, "sawtooth"],
	"win": [330, 880, 0.74, 0.06, "triangle"],
	"lose": [180, 48, 0.74, 0.06, "sawtooth"],
}

var _catalog: GameCatalog
var _paths: Dictionary = {}
var _streams: Dictionary = {}
var _voices: Array[AudioStreamPlayer] = []
var _music: Array[AudioStreamPlayer] = []
var _music_ids: Array[String] = ["", ""]
var _music_gains: Array[float] = [0.0, 0.0]
var _tones: Dictionary = {}
var _settings: Dictionary = {}
var _clock: float = 0.0
var _pending: Array[Dictionary] = []
var _shot_counters: Dictionary = {}
var _last_shot_ids: Dictionary = {}
var _last_impact_at: float = -INF
var _sfx_bus_index: int = -1
var _suspended: bool = false
var _shutting_down: bool = false
var _noise_cursor: int = 0


func _exit_tree() -> void:
	shutdown()


func shutdown() -> void:
	_shutting_down = true
	_pending.clear()
	for player: AudioStreamPlayer in _voices + _music:
		if is_instance_valid(player):
			player.stream_paused = false
			player.stop()
			player.stream = null
	_streams.clear()
	_tones.clear()


func configure(catalog: GameCatalog) -> void:
	_catalog = catalog
	_sfx_bus_index = AudioServer.get_bus_index(SFX_BUS)
	if _sfx_bus_index < 0:
		AudioServer.add_bus()
		_sfx_bus_index = AudioServer.bus_count - 1
		AudioServer.set_bus_name(_sfx_bus_index, SFX_BUS)
		AudioServer.set_bus_send(_sfx_bus_index, &"Master")
		var compressor := AudioEffectCompressor.new()
		compressor.threshold = -10
		compressor.ratio = 5
		compressor.attack_us = 2000
		compressor.release_ms = 120
		AudioServer.add_bus_effect(_sfx_bus_index, compressor)
	for entry: Dictionary in catalog.metadata.audio:
		_paths[entry.id] = entry.get("resourcePath", "res://" + str(entry.src).trim_prefix("./"))
	for index: int in range(48):
		var voice := AudioStreamPlayer.new()
		voice.name = "Voice%02d" % index
		voice.bus = SFX_BUS
		add_child(voice)
		_voices.append(voice)
	for index: int in range(2):
		var player := AudioStreamPlayer.new()
		player.name = "Music%d" % index
		add_child(player)
		_music.append(player)


func synchronize(delta: float, model: RunSimulation, settings: Dictionary) -> void:
	if _shutting_down:
		return
	_settings = settings
	AudioServer.set_bus_mute(_sfx_bus_index, bool(settings.get("sfxMuted", false)) or float(settings.get("sfx", 0.75)) <= 0)
	AudioServer.set_bus_volume_db(_sfx_bus_index, linear_to_db(0.82))
	if _suspended:
		return
	_clock += maxf(0, delta)
	for index: int in range(_pending.size() - 1, -1, -1):
		var queued: Dictionary = _pending[index]
		if float(queued.at) <= _clock:
			_play(_stream(queued.id), queued.gain, queued.pitch, true)
			_pending.remove_at(index)
	var id: String = "theme_menu"
	if model != null and not model.run.is_empty() and model.screen not in [GameSession.Screen.RESULT_WIN, GameSession.Screen.RESULT_LOSE]:
		id = "theme_combat"
		if int(model.run.activeBosses) > 0 or int(model.run.threatLevel) >= 8:
			id = "theme_pressure"
		if model.screen == GameSession.Screen.PAUSED:
			id = ""
	var volume: float = 0 if settings.get("musicMuted", false) else float(settings.get("music", 0.55))
	var selected: int = _music_ids.find(id)
	if selected < 0 and volume > 0 and not id.is_empty():
		selected = 0 if _music_gains[0] <= _music_gains[1] else 1
		_music[selected].stop()
		_music[selected].stream = _stream(id)
		if _music[selected].stream is AudioStreamOggVorbis:
			_music[selected].stream.loop = true
		_music_ids[selected] = id
		_music_gains[selected] = 0
		_music[selected].volume_db = -80
		_music[selected].play()
	for index: int in range(_music.size()):
		var goal: float = 1.0 if index == selected and volume > 0 else 0.0
		_music_gains[index] = move_toward(_music_gains[index], goal, maxf(0, delta) / 0.7)
		_music[index].volume_db = linear_to_db(maxf(0.0001, _music_gains[index] * volume * 0.58))
		if goal == 0 and _music_gains[index] <= 0:
			_music[index].stop()
		elif goal > 0 and not _music[index].playing:
			_music[index].play()


func consume(events: Array[Dictionary]) -> void:
	if _shutting_down:
		return
	var first_shot: float = INF
	for event: Dictionary in events:
		if event.type == "shot" and event.has("elapsed"):
			first_shot = event.elapsed
			break
	for event: Dictionary in events:
		match str(event.type):
			"runStart":
				_last_shot_ids.clear()
				_last_impact_at = -INF
				_pending.clear()
			"shot":
				if int(event.get("attackId", 0)) > 0 and _last_shot_ids.get(event.weaponId) == event.attackId:
					continue
				_last_shot_ids[event.weaponId] = event.attackId
				var delay: float = minf(0.08, maxf(0, float(event.elapsed) - first_shot)) if is_finite(first_shot) else 0.0
				_play_shot(event.weaponId, float(event.interval), bool(event.get("empowered", false)), delay)
			"turretShot":
				_play_shot("scrap_pistol", 0.85)
			"weaponImpact":
				var id: String = str(event.get("kind", ""))
				play_sample({"explosion": "explosion", "slam": "hammer_impact", "ricochet": "ricochet"}.get(id, ""), 0.5 if id == "ricochet" else 0.85)
			"hit":
				if _clock - _last_impact_at >= (0.016 if bool(event.get("critical", false)) else 0.028):
					_last_impact_at = _clock
					if event.get("weaponId") == "echo_blade":
						play_sample("melee_hit", 0.7)
					elif event.get("weaponId") != "shock_hammer":
						_play_hit_noise(event.get("weaponId") == "coil_cannon", bool(event.get("elite", false)))
						if bool(event.get("critical", false)):
							play_tone("criticalHit", 0.65)
			"pickup":
				play_tone("pickup", 1.3 if event.get("pickupType") == "scrap" else 0.72)
			"playerHit", "levelup", "boss":
				play_tone(event.type)
			"upgrade", "ui", "fieldMarketOpen", "fieldPurchase":
				play_tone("ui")
			"finalWave":
				play_tone("boss", 0.72)
			"extraction":
				play_tone("boss")
			"result":
				play_tone("ui" if event.result == "retire" else "win" if event.result == "win" else "lose")


func play_sample(id: String, gain: float = 1.0, pitch: float = 1.0, delay: float = 0.0) -> void:
	if id.is_empty() or not _paths.has(id):
		return
	if delay > 0:
		if _pending.size() < 96:
			_pending.append({"at": _clock + delay, "id": id, "gain": gain, "pitch": pitch})
	else:
		_play(_stream(id), gain, pitch, true)


func set_suspended(value: bool) -> void:
	_suspended = value
	for player: AudioStreamPlayer in _voices + _music:
		player.stream_paused = value


func _play_shot(id: String, interval: float, empowered: bool = false, delay: float = 0.0) -> void:
	var count: int = int(_shot_counters.get(id, 0)) + 1
	_shot_counters[id] = count
	var pitch: float = 1 + ((count * 7 % 11) - 5) * 0.003
	play_sample(id, 1.08 if empowered else 1.0, pitch, delay)
	if id not in ["prism_laser", "saw_disc", "echo_blade", "shock_hammer"]:
		play_sample("mechanical_heavy" if id in ["breaker_shotgun", "rust_revolver", "coil_cannon"] else "mechanical_light",
			0.28, pitch, delay + minf(0.085, interval * 0.4))


func play_tone(id: String, gain: float = 1.0) -> void:
	if not _tones.has(id):
		if not TONES.has(id):
			return
		var spec: Array = TONES[id]
		var count: int = ceili(float(spec[2]) * 22050)
		var bytes := PackedByteArray()
		bytes.resize(count * 2)
		var phase: float = 0
		for index: int in range(count):
			var progress: float = float(index) / count
			var frequency: float = float(spec[0]) * pow(float(spec[1]) / float(spec[0]), progress)
			phase += TAU * frequency / 22050
			var envelope: float = minf(1, float(index) / 176) * pow(0.0001 / float(spec[3]), progress)
			var value: float = sin(phase)
			if spec[4] == "square":
				value = signf(value)
			elif spec[4] == "triangle":
				value = asin(value) * 2 / PI
			elif spec[4] == "sawtooth":
				value = 2 * fposmod(phase / TAU, 1) - 1
			bytes.encode_s16(index * 2, roundi(value * envelope * float(spec[3]) * 32767))
		var wave := AudioStreamWAV.new()
		wave.format = AudioStreamWAV.FORMAT_16_BITS
		wave.mix_rate = 22050
		wave.data = bytes
		_tones[id] = wave
	_play(_tones[id], gain)


func _play_hit_noise(energy: bool, elite: bool) -> void:
	var variant: int = _noise_cursor % 4
	_noise_cursor += 1
	var key: String = "impact-%d-%d-%d" % [int(energy), int(elite), variant]
	if not _tones.has(key):
		var duration: float = 0.04 if energy else 0.022
		var gain: float = 0.025 if elite else 0.015
		var count: int = ceili(duration * 22050)
		var omega: float = TAU * (2900 if energy else 1050) / 22050
		var alpha: float = sin(omega) / (2 * 0.72)
		var b0: float = alpha / (1 + alpha)
		var a1: float = -2 * cos(omega) / (1 + alpha)
		var a2: float = (1 - alpha) / (1 + alpha)
		var previous_x: float = 0.0
		var older_x: float = 0.0
		var previous_y: float = 0.0
		var older_y: float = 0.0
		var random := RandomNumberGenerator.new()
		random.seed = 136713 + variant * 839
		var bytes := PackedByteArray()
		bytes.resize(count * 2)
		for index: int in range(count):
			var input: float = random.randf_range(-1, 1)
			var output: float = b0 * input - b0 * older_x - a1 * previous_y - a2 * older_y
			older_x = previous_x
			previous_x = input
			older_y = previous_y
			previous_y = output
			var envelope: float = gain * pow(0.0001 / gain, float(index) / count)
			bytes.encode_s16(index * 2, roundi(clampf(output * envelope, -1, 1) * 32767))
		var wave := AudioStreamWAV.new()
		wave.format = AudioStreamWAV.FORMAT_16_BITS
		wave.mix_rate = 22050
		wave.data = bytes
		_tones[key] = wave
	_play(_tones[key], 1.0)


func _play(stream: AudioStream, gain: float, pitch: float = 1.0, recorded: bool = false) -> void:
	if _shutting_down or stream == null or _settings.get("sfxMuted", false) or float(_settings.get("sfx", 0.75)) <= 0:
		return
	for voice: AudioStreamPlayer in _voices:
		if not voice.playing:
			voice.stream = stream
			voice.volume_db = linear_to_db(maxf(0.0001, gain * float(_settings.get("sfx", 0.75)) * (0.68 if recorded else 1.0)))
			voice.pitch_scale = pitch
			voice.play()
			return


func _stream(id: String) -> AudioStream:
	if not _streams.has(id) and _paths.has(id):
		_streams[id] = load(_paths[id]) as AudioStream
	return _streams.get(id) as AudioStream
