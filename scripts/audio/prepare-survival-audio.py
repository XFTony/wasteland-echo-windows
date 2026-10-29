"""Offline, deterministic audio production. Runtime contains only short WAV/OGG assets."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[2]
INPUT = ROOT / 'output/continuous-survival-2026-10-28/sources'
SOURCE = ROOT / 'art/audio/survival-v1/source'
RUNTIME = ROOT / 'web/assets/audio/survival-v1'
FFMPEG = shutil.which('ffmpeg')
RATE = 22050
assert FFMPEG, 'ffmpeg is required for the offline audio export only'
SOURCE.mkdir(parents=True, exist_ok=True)
RUNTIME.mkdir(parents=True, exist_ok=True)

def ffmpeg(args, data=None):
    result = subprocess.run([FFMPEG, '-v', 'error', *map(str, args)], input=data, capture_output=True)
    if result.returncode: raise RuntimeError(result.stderr.decode('utf-8', errors='replace')[-1600:])
    return result.stdout

def decode(file):
    return np.frombuffer(ffmpeg(['-i', file, '-f', 'f32le', '-ar', RATE, '-ac', '1', '-']), np.float32).copy()

def save_pcm(file, data):
    ffmpeg(['-y', '-f', 'f32le', '-ar', RATE, '-ac', '1', '-i', '-', '-c:a', 'pcm_s16le', file], data.astype(np.float32).tobytes())

def shot_source(name, member):
    file = SOURCE / (name + '.wav')
    if not file.exists():
        with zipfile.ZipFile(INPUT / 'snakef8-authentic-guns.zip') as archive:
            matches = [n for n in archive.namelist() if n.endswith(member)]
            assert len(matches) == 1, member
            file.write_bytes(archive.read(matches[0]))
    return decode(file)

def trim(data, duration, low=95, high=8500):
    peak = np.max(np.abs(data)); assert peak > .0001
    begin = max(0, int(np.flatnonzero(np.abs(data) > peak * .04)[0]) - int(.003 * RATE))
    data = data[begin:begin + int(duration * RATE)].copy()
    data -= np.mean(data)
    data = sosfilt(butter(2, [low, high], btype='bandpass', fs=RATE, output='sos'), data)
    end = min(len(data), int(.035 * RATE)); data[-end:] *= np.linspace(1, 0, end)
    data[:16] *= np.linspace(0, 1, 16)
    return data

def fit(data, seconds):
    output = np.zeros(int(seconds * RATE), np.float64)
    output[:min(len(output),len(data))] = data[:len(output)]
    return output

raw = {
    'pistol': shot_source('recording-9mm', '/Isolated/9mm/WAV/9mm Single Isolated.wav'),
    'rifle': shot_source('recording-308', '/Isolated/.308 (7.62x51)/WAV/308 Single Isolated.wav'),
    'shotgun': shot_source('recording-20g', '/Isolated/20 Gauge/WAV/20 Gauge Single Isolated.wav'),
    'mechanical': shot_source('recording-slide', '/Pistol/WAV/9mm Pistol Rack Part 1.wav'),
    'hammer': shot_source('recording-hammer', '/Revolver/44 Magnum/WAV/44 Magnum Cock Hammer.wav')
}
profiles = {
    'scrap_pistol': ('pistol', .30, 100, 7800, .72),
    'swarm_smg': ('pistol', .145, 180, 9000, .49),
    'breaker_shotgun': ('shotgun', .43, 65, 7200, .87),
    'needle_rifle': ('rifle', .29, 110, 9800, .78),
    'rust_revolver': ('rifle', .36, 65, 6800, .83),
    'ember_carbine': ('rifle', .205, 160, 8000, .65),
    'coil_cannon': ('shotgun', .36, 70, 9200, .80)
}
assets = []
for id, (kind, seconds, low, high, peak) in profiles.items():
    sound = fit(trim(raw[kind], seconds, low, high), seconds)
    if id == 'coil_cannon':
        # A fictional coil gun retains a recorded impact plus an original static crack.
        rng = np.random.default_rng(901)
        t = np.arange(len(sound)) / RATE
        texture = sosfilt(butter(2, [1500, 6500], btype='bandpass', fs=RATE, output='sos'), rng.normal(size=len(t)))
        sound += texture * np.exp(-t * 23) * .07
    sound *= peak / max(.0001, np.max(np.abs(sound)))
    save_pcm(RUNTIME / (id + '.wav'), sound)
    assets.append({'id': id, 'src': './assets/audio/survival-v1/' + id + '.wav', 'role': 'shot', 'seconds': seconds,
                   'source': 'SnakeF8 isolated ' + kind, 'peak': float(np.max(np.abs(sound)))})
for id, kind, seconds in [('mechanical_light', 'mechanical', .11), ('mechanical_heavy', 'hammer', .14)]:
    sound = fit(trim(raw[kind], seconds, 400, 7000), seconds)
    sound *= .32 / max(.0001, np.max(np.abs(sound)))
    save_pcm(RUNTIME / (id + '.wav'), sound)
    assets.append({'id': id, 'src': './assets/audio/survival-v1/' + id + '.wav', 'role': 'mechanical', 'seconds': seconds})

ambience = SOURCE / 'ambience-excerpt.flac'
if not ambience.exists():
    ffmpeg(['-y', '-ss', '43', '-t', '24', '-i', INPUT / 'wasteland-atmosphere.ogg', '-ar', RATE, '-ac', '1', '-c:a', 'flac', ambience])
ambient = decode(ambience)
BPM = 92
beat = 60 / BPM
seconds = 64 * beat
length = round(seconds * RATE)
motif = [62, 57, 60, 55, 62, 65, 60, 57, 62, 57, 60, 53, 55, 57, 60, 62]
roots = [38, 34, 41, 36]
def add(track, voice, at):
    index = round(at * RATE) % length
    count = min(len(voice), length - index)
    track[index:index + count] += voice[:count]
    if count < len(voice): track[:len(voice) - count] += voice[count:]
def pitched(note, duration, pad=False):
    t = np.arange(round(duration * RATE)) / RATE
    frequency = 440 * 2 ** ((note - 69) / 12)
    output = np.zeros(len(t))
    if pad:
        for ratio, amount in [(1, .6), (.997, .25), (1.003, .25), (2, .12)]: output += np.sin(2 * np.pi * frequency * ratio * t) * amount
        output *= np.minimum(1, t / .35) * np.minimum(1, (duration - t) / .6)
    else:
        for h in range(1, 10): output += np.sin(2 * np.pi * frequency * h * t + .03 * h) / h ** 1.6 * np.exp(-t * (1.25 + h * .65))
        output *= np.minimum(1, t / .004)
    return output

for mood, drum_gain, guitar_gain in [('menu', .025, .105), ('combat', .13, .075), ('pressure', .19, .065)]:
    track = np.resize(ambient, length).astype(np.float64)
    track *= .065 / max(.001, np.max(np.abs(track)))
    rng = np.random.default_rng(380 + len(mood))
    for bar in range(16):
        root = roots[(bar // 2) % 4]
        for interval, gain in [(12,.027),(19,.015),(24,.012)]: add(track, pitched(root + interval, beat * 8, True) * gain, bar * 4 * beat)
        for pulse in range(4):
            when = (bar * 4 + pulse) * beat
            note = motif[(bar * 2 + pulse // 2) % len(motif)]
            if pulse % 2 == 0: add(track, pitched(note, beat * 2.8) * guitar_gain, when)
            if pulse in [0,2]:
                t = np.arange(round(.23 * RATE)) / RATE
                kick = np.sin(2 * np.pi * (42 * t + 48 * (1 - np.exp(-t * 30)) / 30)) * np.exp(-t * 23)
                add(track, kick * drum_gain, when)
            if mood != 'menu' and pulse in [1,3]:
                t = np.arange(round(.16 * RATE)) / RATE
                hit = sosfilt(butter(2, [700,8500], btype='bandpass', fs=RATE, output='sos'),rng.normal(size=len(t))) * np.exp(-t * 35)
                add(track, hit * drum_gain * .47, when)
            if mood == 'pressure':
                t = np.arange(round(.06 * RATE)) / RATE
                hat = sosfilt(butter(2, 6500, btype='highpass', fs=RATE, output='sos'),rng.normal(size=len(t))) * np.exp(-t * 90)
                add(track, hat * .035, when + beat / 2)
    # Smooth the loop seam. Runtime crossfades in volume; no beat-lock is claimed.
    fade = round(.06 * RATE); track[:fade] *= np.linspace(0,1,fade); track[-fade:] *= np.linspace(1,0,fade)
    track -= np.mean(track); track *= .67 / max(.001,np.max(np.abs(track)))
    ffmpeg(['-y','-f','f32le','-ar',RATE,'-ac','1','-i','-','-c:a','libvorbis','-q:a','3',RUNTIME / ('theme-' + mood + '.ogg')],track.astype(np.float32).tobytes())
    assets.append({'id':'theme_' + mood,'src':'./assets/audio/survival-v1/theme-' + mood + '.ogg','role':'music','seconds':seconds,'bpm':BPM})

for asset in assets:
    file = ROOT / 'web' / asset['src'].removeprefix('./')
    asset['bytes'] = file.stat().st_size
    asset['sha256'] = hashlib.sha256(file.read_bytes()).hexdigest().upper()
catalog = ROOT / 'src/content/audio-assets.js'
catalog.write_text('"use strict";\n// Generated by scripts/audio/prepare-survival-audio.py.\nmodule.exports = { AUDIO_ASSETS: ' + json.dumps(assets,ensure_ascii=False,indent=2) + ' };\n','utf-8')
provenance = {'date':'2026-10-28','shots':{'author':'SnakeF8','page':'https://f8studios.itch.io/snakes-second-authentic-gun-sounds-pack',
 'license':'Public domain / CC0 per author statement','permission':'All sounds can be used commercially, and credit is not needed',
 'authorPublicDomainComment':'https://itch.io/post/9421534','authorCC0Reply':'https://itch.io/post/9424504',
 'changes':'Selected isolated recordings, trimmed attack/silence, bandpass, short tail fade, normalized peak. Coil adds original filtered noise. Weapon names are fictional and not claims of caliber-accurate recordings.'},
 'music':{'title':'余火信号 / Afterglow Signal','composition':'Original project 16-bar D-minor motif, 92 BPM, plucked-string harmonics, pads, bass and percussion; three arrangements',
 'ambienceAuthor':'Juhani Junkala / SubspaceAudio','ambiencePage':'https://opengameart.org/content/horror-atmosphere','ambienceLicense':'CC0 1.0',
 'ambienceExcerpt':'43s to 67s of original loop, downsampled to mono FLAC; low-level environment layer',
 'motifMidi':motif,'rootsMidi':roots,'bpm':BPM,'beats':64},'runtime':assets}
provenance['sourceFiles'] = [{'path': 'source/' + file.name, 'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest().upper()} for file in sorted(SOURCE.iterdir()) if file.is_file()]
(SOURCE.parent / 'source-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'assets':len(assets),'runtimeBytes':sum(a['bytes'] for a in assets),'musicSeconds':seconds,'shots':{k:len(v)/RATE for k,v in raw.items()}},ensure_ascii=False))
