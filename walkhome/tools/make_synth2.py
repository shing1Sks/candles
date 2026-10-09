"""More synthesised sounds for The Long Way Home (original, numpy; fixed seeds). Writes assets/audio/walk/syn_*.ogg
  syn_knock      three knocks on a front door, heard from the street (from the inside of the house)
  syn_musicbox   an original lullaby on a music box: the boy's (and Biscuit's) theme. Loops (12 s).
                 In the game it slows and goes out of tune with fear, and stops dead before the worst
  syn_coat       a long wool coat moving: the only sound he makes when he walks, besides his feet (loops)
  syn_tick       a glass bulb ticking as it cools, after a lamp dies
python walkhome/tools/make_synth2.py
"""
from pathlib import Path
import numpy as np, subprocess
from scipy.io import wavfile
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
OUT = Path(__file__).resolve().parents[2] / 'assets' / 'audio' / 'walk'
rng = np.random.default_rng(2207)
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(n): name, octv = n[:-1], int(n[-1]); return NOTE[name] * 2 ** (octv - 4)
def bp(x, lo, hi): b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)
def lp(x, f): b, a = butter(2, f / (SR / 2)); return lfilter(b, a, x)
def hp(x, f): b, a = butter(2, f / (SR / 2), 'high'); return lfilter(b, a, x)
def reverb(x, secs=1.8, wet=0.3, pre=0.03):
    n = int(SR * secs); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs); ir = lp(ir, 5000); ir[: int(pre * SR)] = 0; ir /= np.abs(ir).sum() ** 0.5 * 4
    y = fftconvolve(x, ir)[: len(x) + n]; dry = np.concatenate([x, np.zeros(n)]); y = np.pad(y, (0, len(dry) - len(y)))
    return dry * (1 - wet) + y * wet
def save(name, x, peak=0.89):
    x = x / (np.abs(x).max() + 1e-9) * peak
    p = OUT / f'{name}.wav'; wavfile.write(p, SR, (x * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(p), '-c:a', 'libvorbis', '-q:a', '4', str(OUT / f'{name}.ogg')]); p.unlink()
    print(name, round(len(x) / SR, 1), 's')
def wrap_loop(y, n):
    """fold everything past n samples back onto the start, so the tail of the reverb carries over the loop point"""
    out = y[:n].copy(); tail = y[n:]
    while len(tail): k = min(len(tail), n); out[:k] += tail[:k]; tail = tail[k:]
    return out

# ---- knocks: a fist on a wooden door, three times, from inside (dull, boomy, the hall's echo)
N = int(SR * 2.4); y = np.zeros(N)
for tt, a in [(0.0, 1.0), (0.34, 0.92), (0.66, 1.0)]:
    s = int(tt * SR); m = int(0.22 * SR); u = np.arange(m) / SR
    body = sum(g * np.sin(2 * np.pi * f * u) * np.exp(-u * d) for f, g, d in [(92, 1, 26), (176, 0.6, 34), (263, 0.35, 40), (410, 0.15, 55)])
    y[s:s + m] += a * (body + lp(rng.standard_normal(m), 700) * 0.7 * np.exp(-u * 70))
save('syn_knock', reverb(lp(y, 1500), 1.1, 0.35))

# ---- the music box. An original little waltz in A minor (3/4), eight bars, with a bass note a bar
beat = 0.5; bars = [
    [('E5', 1), (None, 0), ('C5', 1), ('A4', 1)], [('B4', 1), ('C5', 1), ('D5', 1)], [('E5', 2), ('C5', 1)], [('D5', 1), ('B4', 1), ('G4', 1)],
    [('A4', 1), ('B4', 1), ('C5', 1)], [('B4', 2), ('E4', 1)], [('A4', 1), ('C5', 1), ('E5', 1)], [('D5', 1.5), ('C5', .5), ('B4', 1)],
    [('E5', 1), ('C5', 1), ('A4', 1)], [('B4', 1), ('C5', 1), ('D5', 1)], [('E5', 1), ('F5', 1), ('E5', 1)], [('D5', 1), ('C5', 1), ('B4', 1)],
    [('C5', 1), ('A4', 1), ('B4', 1)], [('G#4', 2), ('B4', 1)], [('A4', 3)], [(None, 3)],
]
bass = ['A3', 'E3', 'A3', 'G3', 'F3', 'E3', 'A3', 'E3', 'A3', 'E3', 'C4', 'G3', 'F3', 'E3', 'A3', 'E3']
L = int(len(bars) * 3 * beat * SR); y = np.zeros(L + int(3 * SR))
def tine(f, dur=2.6, a=1.0):
    m = int(dur * SR); t = np.arange(m) / SR
    # a steel tine: a bright attack, an inharmonic shimmer that dies fast, and a sweet fundamental that rings
    det = 1 + rng.uniform(-0.002, 0.002)
    tone = sum(g * np.sin(2 * np.pi * f * det * k * t + rng.uniform(0, 6)) * np.exp(-t * d) for k, g, d in [(1, 1, 1.6), (3.01, 0.22, 6), (5.93, 0.1, 11), (9.8, 0.05, 20)])
    click = hp(rng.standard_normal(m), 3000) * np.exp(-t * 300) * 0.08
    return a * (tone + click)
t0 = 0.0
for bi, bar in enumerate(bars):
    tb = t0
    if bass[bi]: s = int(tb * SR); x = tine(hz(bass[bi]), 3.5, 0.45); y[s:s + len(x)] += x[: len(y) - s]
    for n, b in bar:
        if n and b: s = int(tb * SR); x = tine(hz(n), 2.6, 0.8 + rng.uniform(-0.1, 0.1)); y[s:s + len(x)] += x[: len(y) - s]
        tb += b * beat
    t0 += 3 * beat
# the mechanism: a faint whirr and the comb's tick under it all
t = np.arange(len(y)) / SR
y += bp(rng.standard_normal(len(y)), 900, 2600) * 0.006 * (1 + 0.5 * np.sin(2 * np.pi * 7 * t))
y = reverb(y, 1.6, 0.28)
save('syn_musicbox', wrap_loop(y, L), peak=0.8)

# ---- the coat: heavy wool brushing, two swishes a stride (a stride ~1.2 s), loops (4.8 s)
N = int(SR * 4.8); t = np.arange(N) / SR; y = np.zeros(N)
for k in range(8):
    c = k * 0.6 + rng.uniform(-0.04, 0.04); env = np.exp(-((t - c - 0.15) ** 2) / (2 * 0.09 ** 2))
    y += bp(rng.standard_normal(N), 350, 2400) * env * rng.uniform(0.7, 1.0)
    y += lp(rng.standard_normal(N), 260) * env * 0.5   # the weight of it
save('syn_coat', y, peak=0.7)

# ---- a hot glass bulb ticking as it cools (a dozen ticks over 4 s, spreading out)
N = int(SR * 4.2); y = np.zeros(N)
tt = 0.15
for k in range(12):
    s = int(tt * SR); m = 260; u = np.arange(m) / SR
    y[s:s + m] += (np.sin(2 * np.pi * rng.uniform(3500, 5200) * u) * np.exp(-u * 900)) * rng.uniform(0.4, 1)
    tt += 0.12 + k * 0.03 + rng.uniform(0, 0.08)
save('syn_tick', reverb(y, 0.6, 0.2), peak=0.6)

# ---- a fox screaming, far off over the gardens: three hoarse rising wails, jittered and rough
#      (the British night's own false alarm: everyone thinks it's a woman)
def wail(dur, f0, f1, f2):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f = np.where(u < 0.35, f0 + (f1 - f0) * (u / 0.35) ** 0.7, f1 + (f2 - f1) * ((u - 0.35) / 0.65) ** 1.4)
    f = f * (1 + 0.035 * lp(rng.standard_normal(n), 60) * 6)                         # jitter
    ph = 2 * np.pi * np.cumsum(f) / SR
    v = sum((1 / k ** 1.1) * np.sin(k * ph) for k in range(1, 9))                       # a raw, buzzy voice
    v = bp(v, 700, 5200) + 0.5 * bp(v, 2200, 3600)                                     # nasal formants
    rough = 1 + 0.45 * np.sin(2 * np.pi * 70 * t + 3 * lp(rng.standard_normal(n), 30))  # shimmer
    env = np.clip(u / 0.08, 0, 1) * np.clip((1 - u) / 0.25, 0, 1) ** 1.5
    return (v * rough + bp(rng.standard_normal(n), 1500, 6000) * 0.25) * env
N = int(SR * 4.2); y = np.zeros(N)
for t0, d, a, b, c in [(0.0, 0.9, 820, 1350, 900), (1.25, 1.05, 760, 1420, 820), (2.6, 1.3, 700, 1500, 640)]:
    s = int(t0 * SR); w = wail(d, a, b, c); y[s:s + len(w)] += w
save('syn_fox', reverb(lp(y, 6000), 2.4, 0.45), peak=0.85)

# ---- his squeaky toy (a rubber hedgehog in your pocket: squeeze it and Biscuit comes running)
N = int(SR * 0.9); y = np.zeros(N)
for t0, d, f in [(0.0, 0.16, 1650), (0.3, 0.22, 1500)]:
    n = int(d * SR); t = np.arange(n) / SR; u = t / d
    fr = f * (1 + 0.25 * np.sin(np.pi * u)) * (1 + 0.02 * np.sin(2 * np.pi * 37 * t))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    v = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.15 * bp(rng.standard_normal(n), 2000, 6000)
    s = int(t0 * SR); y[s:s + n] += v * np.sin(np.pi * u) ** 0.6
save('syn_squeak', reverb(y, 0.5, 0.15), peak=0.75)

# ---- a doorbell, heard from outside: the old two-tone electric chime (ding... dong), muffled by the door
N = int(SR * 3.2); y = np.zeros(N)
for t0, n in [(0.0, 'E5'), (0.55, 'C5')]:
    s = int(t0 * SR); m = int(2.4 * SR); t = np.arange(m) / SR; f = hz(n)
    tone = sum(g * np.sin(2 * np.pi * f * k * t) * np.exp(-t * d) for k, g, d in [(1, 1, 1.5), (2.0, 0.3, 3), (3.0, 0.12, 5), (4.2, 0.05, 8)])
    y[s:s + m] += (tone + hp(rng.standard_normal(m), 2000) * np.exp(-t * 200) * 0.3)[: N - s]
save('syn_bell', reverb(lp(y, 2600), 1.0, 0.35), peak=0.8)

# ---- a Shepard tone: a rising glissando that never arrives (for when he's hunting you). 20 s loop:
#      eight sine voices an octave apart, each fading in at the bottom and out at the top
N = int(SR * 20); t = np.arange(N) / SR; y = np.zeros(N); base = 55.0
for k in range(8):
    pos = (k + t / 20.0) % 8.0                                   # each voice climbs one octave per loop
    f = base * 2 ** pos
    amp = np.exp(-((pos - 4.0) ** 2) / (2 * 1.4 ** 2))           # bell over log-frequency
    ph = 2 * np.pi * np.cumsum(f) / SR
    y += amp * (np.sin(ph) + 0.15 * np.sin(2 * ph))
y = lp(y, 3000) * (1 + 0.08 * np.sin(2 * np.pi * 0.5 * t))
save('syn_shepard', y, peak=0.7)

# ---- the dread drone: two low sines beating against each other (felt more than heard) plus their
#      harmonics, so laptop speakers still carry it. 10 s loop (every partial completes whole cycles)
N = int(SR * 10); t = np.arange(N) / SR
y = (np.sin(2 * np.pi * 38 * t) + np.sin(2 * np.pi * 38.6 * t)) * 0.6 + (np.sin(2 * np.pi * 76 * t) + np.sin(2 * np.pi * 77.2 * t)) * 0.35 + (np.sin(2 * np.pi * 114 * t) + np.sin(2 * np.pi * 115.8 * t)) * 0.2
y += lp(rng.standard_normal(N), 90) * 0.15
save('syn_dread', y, peak=0.8)

# ---- a lick: a quick wet little sound (Biscuit, at your mitten)
N = int(SR * 0.35); t = np.arange(N) / SR
y = bp(rng.standard_normal(N), 1500, 5000) * np.exp(-((t - 0.08) ** 2) / 0.0012) + bp(rng.standard_normal(N), 900, 3000) * np.exp(-((t - 0.2) ** 2) / 0.0008) * 0.7
save('syn_lick', y, peak=0.6)

# ---- a whisper: "Bis...cuit". Whispered speech is breath through the shapes of the vowels: noise
#      through formant filters, consonants as bursts and hiss. (Slow, drawn out, a little wet.)
def formant(n, fs, bws, gains):
    x = rng.standard_normal(n); y = np.zeros(n)
    for f, bw, g in zip(fs, bws, gains): y += bp(x, max(60, f - bw / 2), f + bw / 2) * g
    return y
def seg(dur, kind, fs=None):
    n = int(dur * SR); t = np.arange(n) / SR
    if kind == 'vowel': y = formant(n, fs, [120, 220, 320], [1.0, 0.8, 0.4]); env = np.clip(t / 0.04, 0, 1) * np.clip((dur - t) / 0.06, 0, 1)
    elif kind == 's': y = bp(rng.standard_normal(n), 4500, 9000) * 0.9; env = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.05, 0, 1)
    elif kind == 'burst': y = bp(rng.standard_normal(n), fs[0], fs[1]) * 1.4; env = np.exp(-t * 60)
    else: y = np.zeros(n); env = np.zeros(n)
    return y * env
word = np.concatenate([
    seg(0.025, 'burst', (300, 1500)),                  # b
    seg(0.2, 'vowel', (420, 1950, 2650)),              # i
    seg(0.22, 's'),                                    # s
    seg(0.07, 'gap'),
    seg(0.035, 'burst', (1500, 3500)),                 # k
    seg(0.24, 'vowel', (440, 1850, 2550)),             # i
    seg(0.03, 'burst', (3000, 6000)),                  # t
])
word = np.concatenate([np.zeros(int(0.1 * SR)), word, np.zeros(int(0.5 * SR)), word * 0.7, np.zeros(int(0.2 * SR))])
save('syn_whisper_biscuit', reverb(lp(word, 7000), 1.2, 0.3), peak=0.8)
