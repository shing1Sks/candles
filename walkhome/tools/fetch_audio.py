"""Fetch the outdoor night sound set for The Long Way Home from BigSoundBank (every item CC0), check
each page says CC0, trim / loop / normalise with ffmpeg + numpy, write assets/audio/walk/*.ogg and
assets/audio/walk/CREDITS.md.  Downloads go to their own empty folder and are deleted afterwards.

python walkhome/tools/fetch_audio.py [name ...]      (no names = all)
"""
import os, re, subprocess, sys, tempfile, json, shutil
from pathlib import Path
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'audio' / 'walk'; OUT.mkdir(parents=True, exist_ok=True)

# name: (bsb id, page slug, kind, start, end, extra)   kind: one | loop ;  times in seconds (None = whole)
SET = {
  # Biscuit
  'dog_bark_small':     ('0612', 'small-dog-barking', 'one', None, None, {}),
  'dog_growl_bark':     ('1060', 'small-dogs-bark-growl', 'one', None, None, {}),
  'dog_growl_bark2':    ('1061', 'small-dogs-bark-growl-2', 'one', None, None, {}),
  'dog_pant_loop':      ('1547', 'dogs-breathing', 'loop', None, None, {}),
  'dog_cry_1':          ('1544', 'dogs-barking-and-crying-1', 'one', None, None, {}),
  'dog_cry_2':          ('1545', 'dogs-barking-and-crying-2', 'one', None, None, {}),
  'dog_cry_3':          ('1546', 'dogs-barking-and-crying-3', 'one', None, None, {}),
  # other dogs, behind doors, far off
  'dogs_far':           ('0288', 'barking-dogs', 'one', None, None, {}),
  'dog_behind_door':    ('3537', 'small-dog-barking-behind-door', 'one', None, None, {}),
  'dog_inside':         ('0112', 'barking-dog-inside', 'one', None, None, {}),
  # feet
  'step_concrete':      ('0514', 'footsteps-shoe-on-concrete', 'one', None, None, {}),
  'run_concrete':       ('1318', 'fast-steps-on-concrete', 'one', None, None, {}),
  'step_leaves':        ('0137', 'feet-in-leaves', 'one', None, None, {}),
  'step_gravel':        ('0085', 'step-on-gravel', 'one', None, None, {}),
  'step_grass':         ('1253', 'steps-in-the-grass-slow', 'one', None, None, {}),
  # beds
  'amb_night_rain':     ('0621', 'night-after-rain', 'loop', None, None, {'stereo': True}),
  'amb_city_far':       ('0680', 'paris-by-night', 'loop', None, None, {'stereo': True}),
  'amb_country_night':  ('1469', 'campaign-at-night-3', 'loop', None, None, {'stereo': True}),
  'wind_tree':          ('0659', 'wind-in-a-tree', 'loop', None, None, {'stereo': True}),
  'wind_shrub':         ('0907', 'wind-in-shrub', 'loop', None, None, {'stereo': True}),
  'wind_creak':         ('1051', 'wind-and-tree-squeaks', 'loop', None, None, {'stereo': True}),
  'wind_whistle':       ('0155', 'whistling-of-the-wind-2', 'loop', None, None, {'stereo': True}),
  'stream_loop':        ('0823', 'small-stream', 'loop', None, None, {'stereo': True}),
  # the town's life
  'owl_tawny_1':        ('1763', 'tawny-owl-1', 'one', None, None, {}),
  'owl_tawny_2':        ('1764', 'tawny-owl-2', 'one', None, None, {}),
  'crow_1':             ('3461', 'carrion-crow-1', 'one', None, None, {}),
  'crows':              ('0754', 'crows', 'one', None, None, {}),
  'cat_complain':       ('0658', 'cat-complaining', 'one', None, None, {}),
  'cat_growl':          ('1885', 'growling-cat-1', 'one', None, None, {}),
  'cats_fight':         ('0817', 'two-cats-fighting', 'one', None, None, {}),
  'chimes':             ('2687', 'cluster-chimes-1', 'one', 0, 60, {}),
  'tv_static':          ('1037', 'white-noise', 'loop', 0, 20, {}),
  'tv_zap':             ('2134', 'zapping', 'one', None, None, {}),
  'train_far':          ('3341', 'freight-train-crossing', 'one', None, None, {'stereo': True}),
  'train_whistle_far':  ('0226', 'whistling-train-2', 'one', None, None, {}),
  'car_idle':           ('0291', 'car-engine-2', 'loop', None, None, {}),
  'car_pass':           ('0187', 'car-arrival-stop-departure', 'one', None, None, {}),
  'swing_creak':        ('1094', 'swing-lightly-loaded', 'loop', None, None, {}),
  'gate_creak':         ('0616', 'creaking-metallic-door', 'one', None, None, {}),
  'door_creak':         ('3205', 'creaking-door-2', 'one', None, None, {}),
  'drips':              ('1384', 'drops-of-water-1', 'loop', None, None, {}),
  'breath_run':         ('1345', 'breathless-woman', 'one', None, None, {}),
  'heartbeat':          ('1929', 'heart-beat-4', 'loop', None, None, {}),
  'rain_concrete':      ('1289', 'rain-on-concrete', 'loop', None, None, {'stereo': True}),
  'rain_puddle':        ('1290', 'rain-on-puddle', 'loop', None, None, {'stereo': True}),
  'bottles':            ('0294', 'small-bell-3', 'one', None, None, {}),
}

def run(cmd): return subprocess.run(cmd, capture_output=True)

def fetch(name, spec, work):
    bid, slug, kind, t0, t1, extra = spec
    page = f'https://bigsoundbank.com/{slug}-s{bid}.html'
    html = run(['curl', '-sL', '-m', '40', page]).stdout.decode('utf-8', 'ignore')
    title = re.search(r'<title>([^<]*)</title>', html); title = title.group(1).split('—')[0].split(' - ')[0].strip() if title else slug
    author = re.search(r'(?:Author|Auteur)[^<]*</[^>]+>\s*<[^>]+>([^<]+)<', html)
    cc0 = 'CC0' in html
    if not cc0: return {'name': name, 'error': 'page does not say CC0', 'page': page}
    src = work / f'{bid}.wav'
    r = run(['curl', '-sL', '-m', '120', f'https://bigsoundbank.com/UPLOAD/bwf-en/{bid}.wav', '-o', str(src)])
    if not src.exists() or src.stat().st_size < 2000:
        src = work / f'{bid}.mp3'; run(['curl', '-sL', '-m', '120', f'https://bigsoundbank.com/UPLOAD/mp3/{bid}.mp3', '-o', str(src)])
    stereo = extra.get('stereo', False)
    tmp = work / f'{name}.wav'
    af = []
    if t0 is not None or t1 is not None: af.append(f'atrim={t0 or 0}' + (f':{t1}' if t1 else ''))
    if kind == 'one': af += ['silenceremove=start_periods=1:start_threshold=-50dB', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB', 'areverse']
    af += ['highpass=f=35']
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-ac', '2' if stereo else '1', '-ar', '44100']
    if af: cmd += ['-af', ','.join(af)]
    cmd += [str(tmp)]
    r = run(cmd)
    if r.returncode: return {'name': name, 'error': r.stderr.decode()[:300]}
    sr, x = wavfile.read(tmp); x = x.astype(np.float32) / (32768.0 if x.dtype == np.int16 else 1.0)
    if x.ndim == 1: x = x[:, None]
    if kind == 'loop':
        # equal-power crossfade the tail over the head so it loops without a seam
        n = min(int(sr * 2.0), len(x) // 4)
        a = np.linspace(0, 1, n)[:, None]
        head, tail = x[:n], x[-n:]
        x = np.concatenate([tail * np.cos(a * np.pi / 2) + head * np.sin(a * np.pi / 2), x[n:-n]])
    peak = np.max(np.abs(x)) + 1e-9
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    gain = (0.89 / peak) if kind == 'one' else min(0.89 / peak, 0.12 / rms)   # one-shots peak-normalised, beds to a quiet RMS
    x = np.clip(x * gain, -1, 1)
    wavfile.write(tmp, sr, (x * 32767).astype(np.int16))
    out = OUT / f'{name}.ogg'
    r = run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-c:a', 'libvorbis', '-q:a', '4', str(out)])
    if r.returncode: return {'name': name, 'error': r.stderr.decode()[:300]}
    # the separate sounds inside a one-shot recording (a bark, a whimper, a step): envelope above a threshold
    slices = []
    if kind == 'one':
        m = np.abs(x).max(axis=1); hop = int(sr * 0.01); env = np.array([m[i:i + hop].max() for i in range(0, len(m), hop)])
        on = env > 0.12; i = 0
        while i < len(on):
            if on[i]:
                j = i
                while j < len(on) and (on[j] or (j + 25 < len(on) and on[j:j + 25].any())): j += 1
                a, b = max(0, i - 3) * 0.01, min(len(on), j + 8) * 0.01
                if 0.06 < b - a < 5: slices.append([round(a, 2), round(b, 2)])
                i = j
            i += 1
    return {'name': name, 'id': bid, 'title': title, 'page': page, 'kind': kind, 'secs': round(len(x) / sr, 1), 'stereo': stereo, 'slices': slices}

def main():
    names = sys.argv[1:] or list(SET)
    work = Path(tempfile.mkdtemp(prefix='bsb_'))
    log = []
    try:
        for n in names:
            res = fetch(n, SET[n], work); log.append(res); print(json.dumps(res))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    # credits (merge with an existing log)
    lp = OUT / 'sources.json'
    old = json.loads(lp.read_text()) if lp.exists() else {}
    for r in log:
        if 'error' not in r: old[r['name']] = r
    lp.write_text(json.dumps(old, indent=1))
    (OUT / 'slices.json').write_text(json.dumps({k: v.get('slices', []) for k, v in old.items()}))
    lines = ['# Audio credits: The Long Way Home (outdoor set)', '',
             'Every file in this folder is from **BigSoundBank** (https://bigsoundbank.com), each page marked',
             '"CC0 (public domain): Free and royalty-free" (https://creativecommons.org/publicdomain/zero/1.0/).',
             'Courtesy credit, as BigSoundBank suggests: *Additional sounds: Joseph SARDIN - BigSoundBank.com*.', '',
             'Changes to every file: decoded, resampled to 44.1 kHz, high-passed at 35 Hz; one-shots had leading and',
             'trailing silence trimmed and were peak-normalised to about -1 dBFS; loops had a 2 s equal-power',
             'crossfade from tail to head so they loop seamlessly, and were levelled to a quiet RMS. Encoded Ogg Vorbis q4.', '',
             '| Our file | Original (BigSoundBank #) | Source | Licence |', '|---|---|---|---|']
    for k in sorted(old):
        r = old[k]; lines.append(f"| `{k}.ogg` | {r['title'].split(' - ')[0]} (#{r['id']}) | {r['page']} | CC0 1.0 |")
    (OUT / 'CREDITS.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

if __name__ == '__main__': main()
