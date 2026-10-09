"""Synthesised sounds for The Long Way Home (original, numpy; fixed seeds). Writes assets/audio/walk/syn_*.ogg
  syn_whistle      the Tall Man whistles "London Bridge is Falling Down" (traditional, public domain), slow,
                   a little flat, breathy, with the street's echo
  syn_whistle_far  the same, far off and low-passed
  syn_van          an ice-cream van's chime playing "Greensleeves" (traditional, public domain), warbling
  syn_lamp_die     a sodium lamp failing: a fizz, a tick, a clunk
  syn_sub          a low thud under a scare
  syn_ring         the high ringing in your ears after a fright
python walkhome/tools/make_synth.py
"""
from pathlib import Path
import numpy as np, subprocess
from scipy.io import wavfile
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
OUT = Path(__file__).resolve().parents[2] / 'assets' / 'audio' / 'walk'; OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1907)
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(n):  # 'G4', 'F#5'
    name, octv = n[:-1], int(n[-1]); return NOTE[name] * 2 ** (octv - 4)

def bp(x, lo, hi): b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)
def lp(x, f): b, a = butter(2, f / (SR / 2)); return lfilter(b, a, x)
def hp(x, f): b, a = butter(2, f / (SR / 2), 'high'); return lfilter(b, a, x)
def reverb(x, secs=1.8, wet=0.3, pre=0.03):
    n = int(SR * secs); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs); ir = lp(ir, 5000); ir[: int(pre * SR)] = 0; ir /= np.abs(ir).sum() ** 0.5 * 4
    y = fftconvolve(x, ir)[: len(x) + n]; dry = np.concatenate([x, np.zeros(n)]); y = np.pad(y, (0, len(dry) - len(y)))
    return dry * (1 - wet) + y * wet
def save(name, x, stereo=False):
    x = x / (np.abs(x).max() + 1e-9) * 0.89
    p = OUT / f'{name}.wav'; wavfile.write(p, SR, (x * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(p), '-c:a', 'libvorbis', '-q:a', '4', str(OUT / f'{name}.ogg')]); p.unlink()
    print(name, round(len(x) / SR, 1), 's')

# ---- the whistle
LONDON = [('G4', 1.5), ('A4', .5), ('G4', 1), ('F4', 1), ('E4', 1), ('F4', 1), ('G4', 2), ('D4', 1), ('E4', 1), ('F4', 2), ('E4', 1), ('F4', 1), ('G4', 2),
          ('G4', 1.5), ('A4', .5), ('G4', 1), ('F4', 1), ('E4', 1), ('F4', 1), ('G4', 2), ('D4', 2), ('G4', 2), ('E4', 1), ('C4', 3)]
def whistle(tune, bpm=62, flat=0.985, octave=2):
    beat = 60 / bpm; out = []; f_prev = None
    for n, b in tune:
        dur = b * beat; N = int(dur * SR); t = np.arange(N) / SR
        f = hz(n) * octave * flat * (1 + rng.normal(0, 0.004))      # whistles are high, and he's never quite in tune
        f0 = f_prev or f
        glide = f + (f0 - f) * np.exp(-t / 0.045)                  # a lazy slide between notes
        vib = 1 + 0.007 * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6)) * np.clip(t / 0.25, 0, 1)
        ph = 2 * np.pi * np.cumsum(glide * vib) / SR
        env = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.12, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.7 * t))
        tone = np.sin(ph) + 0.06 * np.sin(2 * ph)
        breath = bp(rng.standard_normal(N), f * 0.7, f * 1.6) * 0.12 + hp(rng.standard_normal(N), 3000) * 0.015
        out.append((tone + breath) * env); f_prev = f
        out.append(np.zeros(int(SR * 0.03)))
    return np.concatenate(out)
w = whistle(LONDON)
save('syn_whistle', reverb(w, 2.2, 0.38))
save('syn_whistle_far', reverb(lp(w, 2200) * 0.6, 3.0, 0.65))

# ---- the van
GREEN = [('A4', 1), ('C5', 2), ('D5', 1), ('E5', 1.5), ('F5', .5), ('E5', 1), ('D5', 2), ('B4', 1), ('G4', 1.5), ('A4', .5), ('B4', 1), ('C5', 2), ('A4', 1), ('A4', 1.5), ('G#4', .5), ('A4', 1), ('B4', 2), ('G#4', 1), ('E4', 3)]
def chime(tune, bpm=96, reps=2):
    beat = 60 / bpm; total = sum(b for _, b in tune) * beat * reps + 3; N = int(total * SR); y = np.zeros(N); t0 = 0
    for r in range(reps):
        for n, b in tune:
            f = hz(n); M = int(2.5 * SR); t = np.arange(M) / SR
            tone = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * d) for k, a, d in [(1, 1, 2.2), (2.76, 0.4, 5), (5.4, 0.18, 9), (8.9, 0.06, 14)])
            s = int(t0 * SR); y[s:s + M] += tone[: N - s]; t0 += b * beat
    # wow: the tape in the van has stretched (pitch wanders)
    t = np.arange(N) / SR; warp = t + 0.012 * np.sin(2 * np.pi * 0.35 * t) + 0.004 * np.sin(2 * np.pi * 1.7 * t)
    y = np.interp(warp * SR, np.arange(N), y)
    y = lp(y, 3500) + 0.02 * hp(rng.standard_normal(N), 4000)
    return reverb(y, 2.4, 0.4)
save('syn_van', chime(GREEN))
save('syn_van_slow', chime(GREEN, bpm=58, reps=1))

# ---- lamp failing
N = int(SR * 2.2); t = np.arange(N) / SR
fizz = bp(rng.standard_normal(N), 2000, 7000) * (np.sin(2 * np.pi * 100 * t) > 0.6) * np.exp(-t * 1.6) * 0.4
ticks = np.zeros(N)
for k in rng.uniform(0.05, 1.2, 9): s = int(k * SR); ticks[s:s + 200] += rng.standard_normal(200) * np.exp(-np.arange(200) / 30)
cl = int(1.35 * SR); clunk = np.zeros(N); m = int(0.25 * SR); tt = np.arange(m) / SR
clunk[cl:cl + m] = (np.sin(2 * np.pi * 95 * tt) * 0.8 + lp(rng.standard_normal(m), 900) * 0.6) * np.exp(-tt * 22)
save('syn_lamp_die', reverb(fizz + ticks * 0.7 + clunk, 1.2, 0.25))

# ---- a low thud
N = int(SR * 3); t = np.arange(N) / SR
sub = np.sin(2 * np.pi * (48 - 18 * t) * t) * np.exp(-t * 1.8) + lp(rng.standard_normal(N), 120) * np.exp(-t * 3) * 0.6
save('syn_sub', sub)
# ---- ringing ears
N = int(SR * 6); t = np.arange(N) / SR
ring = (np.sin(2 * np.pi * 6150 * t) * 0.6 + np.sin(2 * np.pi * 6213 * t) * 0.3) * np.clip(t / 0.3, 0, 1) * np.exp(-t * 0.55)
save('syn_ring', ring)

# ---- a phone box ringing (the old British double ring: 400+450 Hz, 0.4 on 0.2 off 0.4 on, 2 s off)
N = int(SR * 6); t = np.arange(N) / SR
ring = (np.sin(2 * np.pi * 400 * t) + np.sin(2 * np.pi * 450 * t)) * 0.5
gate = ((t % 3) < 0.4) | (((t % 3) > 0.6) & ((t % 3) < 1.0))
bell = ring * gate * (0.8 + 0.2 * np.sin(2 * np.pi * 17 * t))
save('syn_phone', reverb(bp(bell, 300, 3000), 0.8, 0.25))
# ---- a ball bouncing (three hollow thuds, each quieter and sooner)
N = int(SR * 1.6); y = np.zeros(N)
for k, (tt, a) in enumerate([(0.0, 1.0), (0.42, 0.6), (0.7, 0.35), (0.88, 0.2), (1.0, 0.1)]):
    s = int(tt * SR); m = int(0.12 * SR); u = np.arange(m) / SR
    y[s:s + m] += a * (np.sin(2 * np.pi * 180 * u) * 0.7 + lp(rng.standard_normal(m), 1200) * 0.5) * np.exp(-u * 40)
save('syn_ball', reverb(y, 0.9, 0.3))
