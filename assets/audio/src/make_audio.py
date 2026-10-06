#!/usr/bin/env python3
"""GameNet audio generator.

Synthesises every music bed, ambience loop and SFX one-shot for GameNet from
scratch (numpy + scipy). Nothing is sampled; every sound is owned by the
project. Fixed seeds make the output deterministic.

    python assets/audio/src/make_audio.py              # build everything
    python assets/audio/src/make_audio.py --only sfx_staple_click music_calm
    python assets/audio/src/make_audio.py --wav        # also keep WAV masters in src/_wav/

Output: assets/audio/<name>.ogg (Vorbis q5 via ffmpeg), or .wav if ffmpeg is
missing. Then run check_audio.py to analyse peaks, DC, loop seams and edges.

How loops are made seamless: every loop is built *circularly*. Notes, grains
and breaths that run past the loop end wrap round to the start; noise beds are
shaped in the FFT domain (inherently periodic); modulators use whole numbers
of cycles per loop; IIR filters and reverb are applied circularly. The loop
point is therefore not a crossfade but genuinely continuous.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 44100
OUT_DIR = Path(__file__).resolve().parent.parent  # assets/audio
TAU = 2 * np.pi

# Music: D dorian, 60 bpm, 96 beats = 96 s. Both beds share length + grid,
# so the game can run them in sync and crossfade.
BPM = 60
LOOP_MUSIC = 96.0


# ----------------------------------------------------------------------------
# basic helpers
# ----------------------------------------------------------------------------
def rng(seed):
    return np.random.default_rng(seed)


def secs(s):
    return int(round(s * SR))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def db(x):
    return 10 ** (x / 20)


def todb(x):
    return 20 * np.log10(max(x, 1e-12))


def tvec(n):
    return np.arange(n) / SR


def sos_lp(f, order=2):
    return signal.butter(order, f, "lowpass", fs=SR, output="sos")


def sos_hp(f, order=2):
    return signal.butter(order, f, "highpass", fs=SR, output="sos")


def sos_bp(lo, hi, order=2):
    return signal.butter(order, [lo, min(hi, SR / 2 - 200)], "bandpass", fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(sos_lp(f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(sos_hp(f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos_bp(lo, hi, order), x, axis=0)


def circ_filter(sos, x, warm=2.0):
    """IIR-filter a periodic signal so the result is also periodic."""
    w = min(secs(warm), len(x))
    xx = np.concatenate([x[-w:], x], axis=0)
    return signal.sosfilt(sos, xx, axis=0)[w:]


def add(buf, sig, start, circ=False):
    """Mix sig into buf at sample `start`. circ=True wraps past the end."""
    N, n = len(buf), len(sig)
    if circ:
        s, i = start % N, 0
        while i < n:
            m = min(n - i, N - s)
            buf[s:s + m] += sig[i:i + m]
            i += m
            s = 0
    else:
        if start < 0:
            sig, start = sig[-start:], 0
            n = len(sig)
        if start >= N:
            return
        m = min(n, N - start)
        buf[start:start + m] += sig[:m]


def pan(x, p):
    """Constant-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def envelope(n, att, rel):
    e = np.ones(n)
    na, nr = min(secs(att), n), min(secs(rel), n)
    if na:
        e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr:
        e[n - nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def fade(x, fin=0.001, fout=0.02):
    x = x.copy()
    ni, no = secs(fin), secs(fout)
    if ni:
        r = np.sin(np.linspace(0, np.pi / 2, ni)) ** 2
        x[:ni] *= r if x.ndim == 1 else r[:, None]
    if no:
        r = np.cos(np.linspace(0, np.pi / 2, no)) ** 2
        x[-no:] *= r if x.ndim == 1 else r[:, None]
    return x


def circ_freq(f, N):
    """Nearest frequency with a whole number of cycles in N samples."""
    return max(1, round(f * N / SR)) * SR / N


def circ_noise(N, shape, r):
    """Periodic coloured noise (std 1), shaped in the FFT domain."""
    f = np.fft.rfftfreq(N, 1 / SR)
    with np.errstate(divide="ignore", invalid="ignore"):
        H = np.nan_to_num(shape(f))
    y = np.fft.irfft(np.fft.rfft(r.standard_normal(N)) * H, n=N)
    return y / (np.std(y) + 1e-12)


def band_shape(lo, hi, slope=0.0, order=2):
    """Magnitude response: smooth band from lo..hi with spectral tilt (slope = exponent of f)."""
    def H(f):
        ff = np.maximum(f, 1e-3)
        return ((ff / 1000.0) ** slope
                / np.sqrt(1 + (lo / ff) ** (2 * order))
                / np.sqrt(1 + (ff / hi) ** (2 * order)))
    return H


def circ_smooth(N, cutoff, r):
    """Periodic slow random curve in [0, 1] (cutoff in Hz)."""
    y = circ_noise(N, lambda f: np.exp(-(f / cutoff) ** 2) * (f > 0), r)
    y -= y.min()
    return y / (y.max() + 1e-12)


def short_rms(x, win=0.1):
    m = x if x.ndim == 1 else np.sqrt((x ** 2).mean(axis=1))
    n = max(1, min(secs(win), len(m)))
    c = np.cumsum(np.concatenate([[0], m ** 2]))
    return np.sqrt(np.maximum((c[n:] - c[:-n]) / n, 0))


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)))


def peak(x):
    return float(np.max(np.abs(x)))


# ----------------------------------------------------------------------------
# reverb (synthetic stereo impulse response)
# ----------------------------------------------------------------------------
def make_ir(t60=4.0, seed=0, predelay=0.02, length=None, bright=1.0):
    r = rng(seed)
    n = secs(length or t60 * 1.1)
    t = tvec(n)
    chans = []
    for _ in range(2):
        nz = r.standard_normal(n)
        low = lp(nz, 450)
        mid = bp(nz, 450, 2800)
        high = hp(nz, 2800)
        ir = (low * np.exp(-6.91 * t / t60)
              + mid * np.exp(-6.91 * t / (t60 * 0.7))
              + 0.5 * bright * high * np.exp(-6.91 * t / (t60 * 0.3)))
        ir *= 1 - np.exp(-t / 0.015)
        chans.append(np.concatenate([np.zeros(secs(predelay)), ir]))
    ir = np.stack(chans, axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=0)).max()


def circ_reverb(x, ir):
    """Periodic convolution. x mono or stereo (N,2) -> stereo (N,2)."""
    N = len(x)
    irf = np.zeros((N, 2))
    add(irf, ir, 0, circ=True)  # fold IR if it were longer than the loop
    out = np.zeros((N, 2))
    for c in range(2):
        xc = x if x.ndim == 1 else x[:, c]
        out[:, c] = np.fft.irfft(np.fft.rfft(xc) * np.fft.rfft(irf[:, c]), n=N)
    return out


def reverb(x, ir, wet=0.2):
    """Linear (one-shot) reverb, mono in -> mono out (mid of the stereo IR)."""
    w = signal.fftconvolve(x, ir[:, 0] + ir[:, 1])[: len(x)] * 0.5
    return x * (1 - wet) + w * wet * 2.2


def circ_wobble(x, mods):
    """Tape wow/flutter on a periodic signal. mods: (cycles_per_loop, cents, phase)."""
    N = len(x)
    n = np.arange(N)
    d = np.zeros(N)
    for k, cents, ph in mods:
        f = k * SR / N
        ratio = 2 ** (cents / 1200) - 1
        d += ratio * SR / (TAU * f) * np.sin(TAU * k * n / N + ph)
    pos = (n - d) % N
    i0 = np.floor(pos).astype(np.int64)
    fr = pos - i0
    i1 = (i0 + 1) % N
    if x.ndim == 2:
        fr = fr[:, None]
    return x[i0] * (1 - fr) + x[i1] * fr


# ----------------------------------------------------------------------------
# instruments
# ----------------------------------------------------------------------------
def felt_piano(m, vel, r, dur=6.0, detune=0.0, sag=0.0, bright=1.0, decay=1.0):
    """Soft felt piano: inharmonic partials, two-string beating, felt thump.
    sag (cents) bends the pitch after the attack - a 'misremembered' note."""
    n = secs(dur)
    t = tvec(n)
    f0 = mtof(m) * 2 ** (detune / 1200)
    inst = 2 ** (sag * (1 - np.exp(-t / 1.2)) / 1200)
    ph = TAU * np.cumsum(inst) / SR
    T = 7.0 * 2 ** (-(m - 60) / 18) * decay
    fc = (650 + 2400 * vel) * bright
    B = 0.00025 * 2 ** ((m - 60) / 24)
    y = np.zeros(n)
    for k in range(1, 16):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 12000:
            break
        a = k ** -1.0 * np.exp(-((fk / fc) ** 1.5))
        if a < 2e-4:
            continue
        Tk = T / (1 + 0.45 * (k - 1))
        env = 0.7 * np.exp(-6.91 * t / (Tk * 0.3)) + 0.3 * np.exp(-6.91 * t / Tk)
        d = fk * 0.0004
        p0 = r.uniform(0, TAU)
        y += a * env * 0.5 * (np.sin((fk + d) * ph + p0) + np.sin((fk - d) * ph + p0 + 0.4))
    y *= 1 - np.exp(-t / 0.005)
    nt = secs(0.04)
    thump = lp(r.standard_normal(nt) * np.exp(-np.arange(nt) / (SR * 0.006)), 900)
    y[:nt] += thump * 0.06
    return fade(y, 0, 0.4) * vel ** 1.4


MB_RATIOS = [1.0, 2.0, 2.76, 5.40, 8.93]
MB_AMPS = [1.0, 0.10, 0.28, 0.09, 0.035]
MB_DEC = [1.0, 0.45, 0.32, 0.14, 0.08]


def music_box(m, vel, r, dur=4.0, detune=0.0, sag=0.0, decay=1.0):
    """Music-box / celesta tine: free-bar partials, tiny pluck click.
    sag bends pitch down like a spring running out."""
    n = secs(dur)
    t = tvec(n)
    f0 = mtof(m) * 2 ** (detune / 1200)
    inst = 2 ** (sag * (1 - np.exp(-t / 0.8)) / 1200)
    ph = TAU * np.cumsum(inst) / SR
    T = 3.5 * 2 ** (-(m - 84) / 24) * decay
    y = np.zeros(n)
    for ratio, a, dk in zip(MB_RATIOS, MB_AMPS, MB_DEC):
        f = f0 * ratio * (1 + r.uniform(-0.002, 0.002))
        if f > 16000:
            continue
        y += a * np.exp(-6.91 * t / (T * dk)) * np.sin(f * ph + r.uniform(0, TAU))
    y *= 1 - np.exp(-t / 0.0015)
    nc = secs(0.003)
    y[:nc] += hp(r.standard_normal(nc), 3000) * np.exp(-np.arange(nc) / (nc / 4)) * 0.12
    return fade(y, 0, 0.3) * vel


def glass(m, vel, r, dur=1.5, decay=1.0):
    """Small glassy chime (purer than the music box, longer shimmer)."""
    n = secs(dur)
    t = tvec(n)
    f0 = mtof(m)
    y = np.zeros(n)
    for ratio, a, dk in [(1, 1, 1), (2.32, 0.18, 0.5), (4.25, 0.08, 0.3), (1.003, 0.6, 1.1)]:
        y += a * np.exp(-6.91 * t / (1.3 * decay * dk)) * np.sin(TAU * f0 * ratio * t + r.uniform(0, TAU))
    y *= 1 - np.exp(-t / 0.001)
    return fade(y, 0, 0.2) * vel


def pad_note(m, dur, att, rel, r, fc=900, detune=5.0, voices=3, amp=1.0):
    """Warm additive pad voice (stereo), slow vibrato drift per voice."""
    n = secs(dur)
    t = tvec(n)
    f0 = mtof(m)
    y = np.zeros((n, 2))
    for v in range(voices):
        off = v - (voices - 1) / 2
        cents = off * detune + r.uniform(-1.5, 1.5)
        f = f0 * 2 ** (cents / 1200)
        drift = 1 + 0.0007 * np.sin(TAU * r.uniform(0.07, 0.17) * t + r.uniform(0, TAU))
        phb = TAU * f * np.cumsum(drift) / SR
        sv = np.zeros(n)
        for k in range(1, 12):
            if k * f > 6000:
                break
            a = np.exp(-((k * f / fc) ** 2)) / k
            if a < 1e-3:
                continue
            sv += a * np.sin(k * phb + r.uniform(0, TAU))
        p = 0.7 * off / max(1, (voices - 1) / 2)
        y += pan(sv, p)
    return y * envelope(n, att, rel)[:, None] * amp


# ----------------------------------------------------------------------------
# paper / metal primitives
# ----------------------------------------------------------------------------
BANK_FC = np.geomspace(200, 11000, 34)
BANK = [sos_bp(fc / 1.25, fc * 1.25) for fc in BANK_FC]


def bank_idx(fc):
    return int(np.argmin(np.abs(np.log(BANK_FC / fc))))


def grain(r, fc, dur_ms, amp):
    """One paper crackle: decaying noise burst through a band of the bank."""
    n = max(16, int(dur_ms * 1e-3 * SR))
    g = r.standard_normal(n) * np.exp(-np.arange(n) / (n / 5))
    g[:3] *= (0.3, 0.6, 0.85)
    g = np.concatenate([g, np.zeros(n // 2 + 200)])
    y = signal.sosfilt(BANK[bank_idx(fc)], g)
    return amp * y / (np.max(np.abs(y)) + 1e-9)


def crumple(r, dur, env, rate, fc_lo, fc_hi, alpha=1.7, dms=(0.5, 5.0),
            echo=0.35, body=0.0, rustle=0.03, circ=False, fc_drift=None):
    """Paper crumple/crackle. env: array (len secs(dur)) of intensity 0..1.
    Poisson-thinned grains with power-law loudness, little echo clusters,
    optional low 'fold' bodies and a friction rustle bed.
    fc_drift: optional array multiplying the band centre over time."""
    n = secs(dur)
    out = np.zeros(n + (0 if circ else secs(0.05)))
    lo, hi = np.log(fc_lo), np.log(fc_hi)
    t = 0.0
    while True:
        t += r.exponential(1 / rate)
        if t >= dur:
            break
        i = min(int(t * SR), n - 1)
        e = env[i]
        if r.random() > e:
            continue
        a = min(1.0, 0.1 * (r.pareto(alpha) + 1)) * (0.4 + 0.6 * e)
        fc = np.exp(r.uniform(lo, hi)) * (fc_drift[i] if fc_drift is not None else 1)
        add(out, grain(r, fc, r.uniform(*dms), a), i, circ)
        if r.random() < echo:
            for _ in range(r.integers(1, 4)):
                j = i + secs(r.uniform(0.0005, 0.006))
                add(out, grain(r, fc * r.uniform(0.7, 1.4), r.uniform(*dms), a * r.uniform(0.25, 0.7)), j, circ)
        if body and r.random() < body:
            add(out, grain(r, r.uniform(250, 700), r.uniform(8, 20), a * 0.6), i, circ)
    if rustle:
        nz = r.standard_normal(n)
        bed = (circ_filter(sos_bp(1500, 7000), nz) if circ else bp(nz, 1500, 7000)) * env * rustle
        out[:n] += bed
    return out


def flap(r, fc, amp, dur_ms=14):
    """One soft paper flap: band noise puff plus a low 'whomp'."""
    n = secs(dur_ms / 1000)
    w = np.sin(np.linspace(0, np.pi, n)) ** 2
    nz = r.standard_normal(n + 400)
    hi_part = signal.sosfilt(BANK[bank_idx(fc)], np.concatenate([nz[:n] * w, np.zeros(400)]))
    lo_part = lp(np.concatenate([nz[:n] * w, np.zeros(400)]), 380)
    y = hi_part / (peak(hi_part) + 1e-9) + 0.5 * lo_part / (peak(lo_part) + 1e-9)
    return y * amp


def flutter(r, dur, rate0, rate1, fc0, fc1, amp_env=None, amp=1.0, circ_buf=None, start=0, circ=False):
    """A train of flaps whose rate and colour glide (a falling/fluttering sheet)."""
    n = secs(dur)
    out = np.zeros(n + secs(0.05)) if circ_buf is None else circ_buf
    t = 0.0
    while t < dur:
        x = t / dur
        rate = rate0 + (rate1 - rate0) * x
        fc = fc0 * (fc1 / fc0) ** x
        e = amp_env(x) if amp_env else 1.0
        y = flap(r, fc * r.uniform(0.8, 1.25), amp * e * r.uniform(0.55, 1.0), r.uniform(9, 20))
        add(out, y, start + secs(t), circ)
        t += (1 / rate) * r.uniform(0.75, 1.3)
    return out


def ping(r, f0, amp, decay=0.06, dur=0.35, dull=1.0):
    """Small metal ping: split pin / staple. Inharmonic modes + 1 ms click."""
    n = secs(dur)
    t = tvec(n)
    y = np.zeros(n)
    for ratio, a, dk in [(1, 1, 1), (2.31, 0.6, 0.7), (3.87, 0.45 * dull, 0.5),
                         (5.73, 0.3 * dull, 0.35), (8.1, 0.2 * dull, 0.25)]:
        f = f0 * ratio * r.uniform(0.98, 1.02)
        if f > 17000:
            continue
        y += a * np.exp(-t / (decay * dk)) * np.sin(TAU * f * t + r.uniform(0, TAU))
    nc = secs(0.001)
    y[:nc] += hp(r.standard_normal(nc), 4000) * 0.5 * dull
    y *= 1 - np.exp(-t / 0.0003)
    return y * amp / (peak(y) + 1e-9)


def swoosh(r, env, fc_traj, width=0.35):
    """Noise through a moving band (centre fc_traj, same length as env)."""
    n = len(env)
    nz = r.standard_normal(n)
    out = np.zeros(n)
    lf = np.log(fc_traj)
    for i, fc in enumerate(BANK_FC):
        w = np.exp(-(((np.log(fc) - lf) / width) ** 2))
        if w.max() < 1e-3:
            continue
        out += signal.sosfilt(BANK[i], nz) * w
    return out * env / (np.std(out) + 1e-9) * 0.3


def thump(r, amp, f=180, dur=0.12, tau=0.02):
    n = secs(dur)
    y = lp(r.standard_normal(n) * np.exp(-np.arange(n) / (SR * tau)), f, 2)
    return y * amp / (peak(y) + 1e-9)


def droplet(r, amp, f0=550, f1=1300):
    """Small wet 'plip': rising sine with fast decay."""
    n = secs(0.06)
    t = tvec(n)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / 0.012))
    y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.014) * (1 - np.exp(-t / 0.0008))
    return y * amp


def ramp_env(n, att, dec, shape=1.0):
    """Fast-attack / exponential-ish decay envelope over n samples (att,dec in s)."""
    t = tvec(n)
    return (1 - np.exp(-t / max(att, 1e-4))) * np.exp(-t / dec) ** shape


# ----------------------------------------------------------------------------
# MUSIC
# ----------------------------------------------------------------------------
CHORDS = [  # 12 s each, D dorian
    ("Dm9", [38, 45, 53, 57, 64]),     # D2 A2 F3 A3 E4
    ("Bbmaj7", [34, 46, 50, 53, 57]),  # Bb1 Bb2 D3 F3 A3
    ("Fmaj9", [41, 48, 52, 55, 57]),   # F2 C3 E3 G3 A3
    ("G6/9", [43, 50, 52, 57, 59]),    # G2 D3 E3 A3 B3 (dorian IV)
    ("Dm9", [38, 45, 52, 53, 60]),     # D2 A2 E3 F3 C4
    ("Bbmaj7", [34, 46, 53, 57, 62]),  # Bb1 Bb2 F3 A3 D4
    ("Cadd9", [36, 43, 50, 52, 55]),   # C2 G2 D3 E3 G3
    ("Asus4", [33, 45, 50, 52, 57]),   # A1 A2 D3 E3 A3
]

# (beat, midi, velocity, instrument, detune_cents, sag_cents)
# p = felt piano, m = music box. Non-zero detune/sag = a misremembered note.
MELODY = [
    (0.0, 50, .30, "p", 0, 0),
    (1.0, 69, .55, "p", 0, 0), (2.5, 76, .45, "p", 0, 0), (3.0, 74, .50, "p", 0, 0),
    (7.0, 72, .40, "p", 0, 0), (9.5, 69, .42, "p", 0, 0), (10.0, 81, .30, "m", 0, 0),
    (13.0, 74, .50, "p", 0, 0), (14.0, 77, .45, "p", 0, 0), (16.0, 81, .35, "m", 0, 0),
    (19.0, 77, .40, "p", 0, 0), (21.5, 76, .38, "p", -38, 0),
    (24.0, 41, .28, "p", 0, 0),
    (25.0, 72, .50, "p", 0, 0), (27.0, 76, .45, "p", 0, 0), (28.0, 79, .33, "m", 0, 0),
    (31.0, 77, .42, "p", 0, 0), (34.0, 76, .38, "p", 0, 0),
    (37.0, 71, .45, "p", 0, 0), (38.0, 74, .42, "p", 0, 0), (40.0, 76, .48, "p", 0, 0),
    (43.0, 83, .30, "m", 0, 0), (45.0, 69, .38, "p", 0, -25),
    (48.0, 50, .30, "p", 0, 0),
    (49.0, 65, .45, "p", 0, 0), (50.0, 69, .48, "p", 0, 0), (51.0, 76, .50, "p", 0, 0),
    (52.5, 74, .45, "p", 0, 0), (56.0, 72, .40, "p", 32, 0), (58.0, 69, .38, "p", 0, 0),
    (61.5, 77, .45, "p", 0, 0), (62.0, 81, .30, "m", 0, 0), (66.0, 86, .22, "m", -30, -20),
    (68.0, 77, .40, "p", 0, 0), (70.0, 76, .40, "p", 0, 0),
    (72.0, 48, .28, "p", 0, 0),
    (73.0, 67, .42, "p", 0, 0), (74.0, 74, .45, "p", 0, 0), (76.0, 76, .48, "p", 0, 0),
    (79.0, 79, .30, "m", 0, 0), (81.0, 74, .40, "p", -28, -15),
    (85.0, 76, .45, "p", 0, 0), (86.5, 74, .42, "p", 0, 0), (88.0, 69, .45, "p", 0, 0),
    (92.0, 64, .35, "p", 0, 0),
]


def render_melody(events, N, r, beat_scale=1.0, transpose=0, vel_scale=1.0, extra_detune=0.0,
                  piano_kw=None, mb_kw=None, pan_spread=0.35, mb_gain=0.6):
    """Render note events into a periodic stereo buffer of N samples."""
    piano_kw, mb_kw = piano_kw or {}, mb_kw or {}
    out = np.zeros((N, 2))
    spb = 60.0 / BPM
    for beat, m, vel, inst, det, sag in events:
        jitter = r.uniform(-0.035, 0.035)
        start = secs(beat * spb * beat_scale + jitter) % N
        if inst == "p":
            y = felt_piano(m + transpose, vel * vel_scale, r, detune=det + extra_detune, sag=sag, **piano_kw)
        else:
            y = music_box(m + transpose, vel * vel_scale * mb_gain, r, detune=det + extra_detune, sag=sag, **mb_kw)
        p = np.clip((m - 70) / 14, -1, 1) * pan_spread + r.uniform(-0.1, 0.1)
        add(out, pan(y, p), start, circ=True)
    return out


def render_pad(N, r, chords=CHORDS, seg=12.0, transpose=0, fc=750, att=3.5, rel=5.0):
    out = np.zeros((N, 2))
    for ci, (_, notes) in enumerate(chords):
        start = ci * seg - 1.0
        dur = seg + rel + 1.0
        for m in notes:
            amp = 1.0 if m >= 40 else 0.8
            add(out, pad_note(m + transpose, dur, att, rel, r, fc=fc, amp=amp), secs(start), circ=True)
    return out


def tape_hiss(N, r, level):
    h = np.stack([circ_noise(N, band_shape(800, 9000, -0.3), r) for _ in range(2)], axis=1)
    return h * level


def scale_to_rms(x, target_db):
    return x * db(target_db) / (rms(x) + 1e-12)


def scale_to_short(x, target_db, win=0.4):
    return x * db(target_db) / (short_rms(x, win).max() + 1e-12)


def music_calm():
    N = secs(LOOP_MUSIC)
    r = rng(101)
    pad = scale_to_rms(render_pad(N, r), -30)
    mel = render_melody(MELODY, N, rng(102))
    mel = scale_to_short(mel, -21)
    dry = pad + mel + tape_hiss(N, rng(103), db(-66))
    # faint tape wobble: slow drift + wow + a little flutter (whole cycles per loop)
    dry = circ_wobble(dry, [(7, 7, 0.3), (48, 5, 1.1), (576, 1.2, 0.0)])
    wet = circ_reverb(dry, make_ir(4.5, seed=104, predelay=0.03))
    wet = scale_to_rms(wet, todb(rms(dry)) - 3)
    mix = dry * 0.8 + wet * 0.55
    return mix


DREAD_DYADS = [  # (beat, notes, vel) - sparse dissonant music-box intervals, all in D dorian
    (5.0, (76, 77), .30), (17.0, (83, 84), .22), (29.5, (77, 83), .26),
    (42.0, (71, 72), .28), (53.0, (88, 89), .16), (64.5, (76, 77), .26),
    (77.0, (77, 83), .22), (86.0, (83, 84), .20),
]


def breath_layer(N, r, cycles=16, level=1.0):
    """Slow, uneven breathing: band-noise inhales (rising) and exhales (falling)."""
    lens = r.uniform(5.0, 7.5, cycles)
    lens *= (N / SR) / lens.sum()
    out = np.zeros((N, 2))
    t0 = r.uniform(0, 2)
    for L in lens:
        ti = L * r.uniform(0.28, 0.36)
        te = L * r.uniform(0.38, 0.48)
        ni, ne = secs(ti), secs(te)
        x = np.linspace(0, 1, ni)
        inh = swoosh(r, np.sin(np.pi * x) ** 1.5, 800 * (1.9 ** x), width=0.4)
        x = np.linspace(0, 1, ne)
        exh = swoosh(r, (np.sin(np.pi * x ** 0.6)) ** 1.2, 1100 * (0.45 ** x), width=0.45)
        g = r.uniform(0.6, 1.0)
        p = r.uniform(-0.3, 0.3)
        add(out, pan(inh * 0.7 * g, p), secs(t0), circ=True)
        add(out, pan(exh * g, p * 0.8), secs(t0 + ti + r.uniform(0.05, 0.3)), circ=True)
        t0 += L
    out = circ_filter(sos_lp(3500), out)
    return out * level


def circ_drone(N, notes, r, fc=500, detune=9.0):
    """Periodic beating cluster: each partial has whole cycles per loop and its own slow swell."""
    t = tvec(N)
    mods = [0.25 + 0.75 * circ_smooth(N, 0.05, r) for _ in range(6)]
    y = np.zeros((N, 2))
    for m, amp in notes:
        for v in range(3):
            cents = (v - 1) * detune + r.uniform(-2, 2)
            f = mtof(m) * 2 ** (cents / 1200)
            sv = np.zeros(N)
            for k in range(1, 12):
                fk = circ_freq(k * f, N)
                a = np.exp(-((fk / fc) ** 2)) / k
                if a < 2e-3:
                    break
                sv += a * mods[r.integers(6)] * np.sin(TAU * fk * t + r.uniform(0, TAU))
            y += pan(sv * amp, (v - 1) * 0.6)
    return y


def music_dread():
    N = secs(LOOP_MUSIC)
    r = rng(201)
    # 1. low cluster drone (D2 E2 A2 + D1 sub), beating, in key
    drone = circ_drone(N, [(38, 1.0), (40, 0.45), (45, 0.8), (50, 0.25)], r, fc=420, detune=10)
    t = tvec(N)
    drone += pan(np.sin(TAU * circ_freq(mtof(26), N) * t) * 0.35, 0)
    drone = scale_to_rms(drone, -29)
    # 2. the calm melody, first half, played at half speed an octave down, darker and flat
    first_half = [e for e in MELODY if e[0] < 48]
    slow = render_melody(first_half, N, rng(202), beat_scale=2.0, transpose=-12, extra_detune=-14,
                         piano_kw=dict(bright=0.55, decay=1.6, dur=9.0))
    slow = circ_wobble(slow, [(3, 16, 0.0), (19, 9, 0.7)])
    slow = scale_to_short(slow, -25)
    # 3. the calm melody reversed (swelling, sucked-back notes), quiet and drowned in reverb
    calm_mel = render_melody(MELODY, N, rng(102))
    rev = np.roll(calm_mel[::-1], 1, axis=0)
    rev = circ_filter(sos_lp(2500), rev)
    rev = scale_to_short(rev, -33)
    # 4. sparse dissonant music-box dyads, flat and sagging like a dying spring
    dy_events = []
    for beat, notes, vel in DREAD_DYADS:
        for j, m in enumerate(notes):
            dy_events.append((beat + j * 0.06, m, vel, "m", -18, -45 if j else -25))
    dyads = render_melody(dy_events, N, rng(203), mb_kw=dict(decay=1.4, dur=6.0), pan_spread=0.6, mb_gain=1.0)
    dyads = scale_to_short(dyads, -30)
    # 5. breathing texture
    breath = scale_to_rms(breath_layer(N, rng(204)), -40)
    hiss = tape_hiss(N, rng(205), db(-58))
    dry = drone + slow + dyads + breath + hiss
    ir = make_ir(6.5, seed=206, predelay=0.04, bright=0.6)
    wet = circ_reverb(dry - drone * 0.7 + rev * 3.0, ir)
    wet = scale_to_rms(wet, todb(rms(dry)) - 2)
    return dry * 0.75 + wet * 0.6


# ----------------------------------------------------------------------------
# AMBIENCE (all periodic)
# ----------------------------------------------------------------------------
def amb_wind_paper():
    L = 32.0
    N = secs(L)
    r = rng(301)
    gust = circ_smooth(N, 0.12, r) ** 1.3
    gust_r = np.roll(gust, secs(0.4))
    out = np.zeros((N, 2))
    for c, g in enumerate((gust, gust_r)):
        dark = circ_noise(N, band_shape(40, 450, -0.8), r)
        bright = circ_noise(N, band_shape(300, 2600, -0.5), r)
        whistle = circ_noise(N, lambda f: np.exp(-((f - 640) / 18) ** 2) + 0.6 * np.exp(-((f - 960) / 22) ** 2), r)
        out[:, c] = dark * (0.45 + 0.55 * g) + bright * 0.55 * g ** 1.6 + whistle * 0.06 * g ** 2.5
    # paper flutter during gusts: loose scraps flapping in the wind
    flut = np.zeros((N, 2))
    t = r.uniform(0, 1)
    while t < L:
        g = gust[min(secs(t), N - 1)]
        if r.random() < 0.15 + 0.85 * g:
            d = r.uniform(0.25, 1.1)
            buf = np.zeros(secs(d) + secs(0.05))
            flutter(r, d, r.uniform(14, 30), r.uniform(10, 22), r.uniform(1500, 3000), r.uniform(1100, 2500),
                    amp_env=lambda x: np.sin(np.pi * x) ** 0.7, amp=0.12 * (0.4 + g), circ_buf=buf)
            add(flut, pan(buf, r.uniform(-0.8, 0.8)), secs(t), circ=True)
        t += r.exponential(1.3)
    out = out / rms(out) * db(-31) + flut * db(-31) / 0.12 * 0.10
    return circ_filter(sos_hp(30), out)


def amb_leaves_rustle():
    L = 30.0
    N = secs(L)
    r = rng(401)
    gust = circ_smooth(N, 0.2, r)
    out = np.zeros((N, 2))
    for c in range(2):
        bed = circ_noise(N, band_shape(1200, 8000, -0.2), r)
        out[:, c] = bed * (0.15 + 0.85 * np.roll(gust, c * secs(0.3)) ** 2) * 0.003
    # clumps of paper leaves rustling: bursts of crackle, panned, near and far
    t = r.uniform(0, 0.5)
    while t < L:
        g = gust[min(secs(t), N - 1)]
        if r.random() < 0.2 + 0.8 * g:
            d = r.uniform(0.15, 0.9)
            n = secs(d)
            x = np.linspace(0, 1, n)
            env = np.sin(np.pi * x) ** 0.8
            far = r.random() < 0.5
            c = crumple(r, d, env, rate=r.uniform(90, 320), fc_lo=1500 if far else 1200, fc_hi=6500 if far else 8500,
                        alpha=2.6, dms=(0.6, 3.5), echo=0.25, rustle=0.04)
            if far:
                c = lp(c, 3500) * 0.45
            c *= (0.3 + 0.7 * g) * r.uniform(0.5, 1.0) * 0.25
            add(out, pan(c, r.uniform(-0.9, 0.9)), secs(t), circ=True)
        t += r.exponential(0.45 / (0.3 + g))
    out = circ_filter(sos_lp(8500), out)
    return circ_filter(sos_hp(60), out)


def amb_mist():
    L = 24.0
    N = secs(L)
    r = rng(501)
    swell = 0.35 + 0.65 * circ_smooth(N, 0.08, r)
    out = np.zeros((N, 2))
    for c in range(2):
        air = circ_noise(N, band_shape(700, 9000, -0.6, order=1), r)
        low = circ_noise(N, band_shape(30, 160, -0.5), r)
        side = 0.75 + 0.25 * circ_smooth(N, 0.06, r)
        out[:, c] = (air * 1.0 + low * 0.35) * swell * side
    # faint airy resonances on D6 / A6, like wind across a bottle far away
    t = tvec(N)
    for f, a in [(mtof(86), 0.04), (mtof(93), 0.025)]:
        env = circ_smooth(N, 0.05, r) ** 3
        tone = circ_noise(N, lambda ff, f=f: np.exp(-((ff - f) / 6) ** 2), r) * env * a
        out += pan(tone, r.uniform(-0.5, 0.5))
    return circ_filter(sos_hp(30), out)


# ----------------------------------------------------------------------------
# SFX
# ----------------------------------------------------------------------------
def sfx_step(seed):
    def build():
        r = rng(seed)
        n = secs(0.5)
        y = np.zeros(n)
        heel = secs(r.uniform(0.003, 0.008))
        add(y, thump(r, 0.35, f=r.uniform(130, 190), dur=0.12, tau=0.018), heel)
        e1 = ramp_env(secs(0.07), 0.002, 0.02)
        add(y, crumple(r, 0.07, e1, rate=r.uniform(700, 1000), fc_lo=800, fc_hi=5000, alpha=1.7,
                       dms=(0.4, 3.0), echo=0.4, body=0.15, rustle=0.02) * 0.8, heel)
        toe = heel + secs(r.uniform(0.07, 0.12))
        e2 = np.sin(np.pi * np.linspace(0, 1, secs(0.13))) ** 1.5
        add(y, crumple(r, 0.13, e2, rate=r.uniform(450, 750), fc_lo=1000, fc_hi=6000, alpha=1.9,
                       dms=(0.4, 2.5), echo=0.3, rustle=0.02) * 0.6, toe)
        ns = secs(0.2)
        x = np.linspace(0, 1, ns)
        sw = swoosh(r, np.sin(np.pi * x ** 0.5) ** 2, 3200 * (0.7 ** x), width=0.5)
        add(y, sw * 0.25, heel)
        return lp(y, 6500, order=4)
    return build


def sfx_petal_pickup():
    r = rng(601)
    n = secs(1.8)
    y = np.zeros(n)
    # paper flick
    add(y, grain(r, 4200, 2.5, 0.5), 0)
    add(y, grain(r, 2600, 4.0, 0.3), secs(0.006))
    add(y, flap(r, 2200, 0.25, 12), secs(0.03))
    # glassy two-note chime (A6 then E7), soft shimmer
    add(y, glass(93, 0.32, r, dur=1.7), secs(0.045))
    add(y, glass(100, 0.18, r, dur=1.5, decay=0.8), secs(0.12))
    add(y, music_box(86, 0.08, r, dur=1.4), secs(0.12))
    return y


def sfx_petal_drop():
    r = rng(611)
    n = secs(2.0)
    y = np.zeros(n)
    flutter(r, 1.1, 20, 7, 2600, 1300, amp_env=lambda x: (1 - x) ** 1.5 * (1 - np.exp(-x * 30)),
            amp=0.35, circ_buf=y, start=0)
    # descending note: soft tone gliding A5 -> D5 (a falling fourth)
    nt = secs(1.6)
    t = tvec(nt)
    f = mtof(74) * (mtof(81) / mtof(74)) ** np.exp(-t / 0.25)
    ph = TAU * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(2.76 * ph)) * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.01))
    add(y, tone * 0.22, secs(0.05))
    return y


BLOOM_CHORD = [50, 57, 64, 65, 72, 76]  # D3 A3 E4 F4 C5 E5 = Dm9


def bloom_voice(m, n, r, amp, fc_traj, att_env):
    t = tvec(n)
    f0 = mtof(m)
    y = np.zeros(n)
    for v in (-4, 0, 4):
        f = f0 * 2 ** ((v + r.uniform(-1, 1)) / 1200)
        for k in range(1, 9):
            a = np.exp(-((k * f / fc_traj) ** 2)) / k
            y += a * np.sin(TAU * k * f * t + r.uniform(0, TAU))
    return y * att_env * amp / 3


def sfx_field_bloom():
    r = rng(701)
    n = secs(4.8)
    y = np.zeros(n)
    t = tvec(n)
    fc = 350 + 2300 * (1 - np.exp(-t / 1.3))
    env = (1 - np.exp(-t / 0.7)) ** 2 * np.exp(-np.maximum(t - 2.4, 0) / 0.9)
    for i, m in enumerate(BLOOM_CHORD):
        y += bloom_voice(m, n, r, 0.16 * (1 - 0.08 * i), fc, env)
    # pop-up book unfolding: creases snapping into place, growing, then the final pop
    for k, (tt, a) in enumerate([(0.10, .25), (0.36, .35), (0.58, .45), (0.76, .55), (0.9, .65)]):
        e = ramp_env(secs(0.03), 0.001, 0.008)
        add(y, crumple(r, 0.03, e, rate=1500, fc_lo=1500, fc_hi=6000, echo=0.5, rustle=0) * a * 0.5, secs(tt))
        add(y, flap(r, 1400 + 250 * k, a * 0.35, 16), secs(tt + 0.01))
    add(y, thump(r, 0.35, f=260, dur=0.1, tau=0.02), secs(1.05))
    add(y, flap(r, 1800, 0.45, 22), secs(1.05))
    # shimmering music-box arpeggio rising out of the pop
    for i, m in enumerate([74, 77, 81, 84, 88]):
        add(y, music_box(m, 0.14 - 0.012 * i, r, dur=3.0), secs(1.1 + 0.17 * i + 0.01 * i * i))
    return reverb(y, make_ir(1.6, seed=702, predelay=0.015), wet=0.22)


def sfx_field_dissolve():
    r = rng(711)
    n = secs(5.5)
    y = np.zeros(n)
    t = tvec(n)
    # the bloom chord thins out from the top down, each note sagging flat as it goes
    for i, m in enumerate(BLOOM_CHORD[::-1]):
        t_off = 0.35 + 0.55 * i
        fade_ = np.clip(1 - (t - t_off) / 1.3, 0, 1) ** 1.5
        sag = 2 ** (-45 * np.clip((t - t_off) / 1.3, 0, 1) / 1200)
        f0 = mtof(m)
        v = np.zeros(n)
        for d in (-4, 0, 4):
            ph = TAU * f0 * 2 ** (d / 1200) * np.cumsum(sag) / SR
            for k in range(1, 7):
                a = np.exp(-((k * f0 / (1800 - 200 * i)) ** 2)) / k
                v += a * np.sin(k * ph + r.uniform(0, TAU))
        y += v * fade_ * (1 - np.exp(-t / 0.08)) * 0.16 / 3
    # falling paper rustle: dense at first, drifting down in pitch, then sparse
    env = np.clip(np.sin(np.pi * np.clip(t / 4.8, 0, 1)) ** 0.8, 0, 1) * np.exp(-t / 2.2)
    drift = 0.45 ** (t / 5.5)
    c = crumple(r, 5.5, env / env.max(), rate=600, fc_lo=1500, fc_hi=7000, alpha=2.2, dms=(0.6, 4), echo=0.25,
                rustle=0.08, fc_drift=drift)
    y += c[:n] * 0.22
    for k in range(6):
        st = r.uniform(0.4, 3.6)
        buf = np.zeros(secs(1.2))
        flutter(r, r.uniform(0.5, 0.9), r.uniform(14, 20), r.uniform(6, 9), r.uniform(2000, 2800), 1200,
                amp_env=lambda x: np.sin(np.pi * x), amp=0.12, circ_buf=buf)
        add(y, buf, secs(st))
    return reverb(y, make_ir(1.6, seed=712, predelay=0.015), wet=0.2)


def sfx_entity_flip():
    r = rng(801)
    n = secs(1.4)
    y = np.zeros(n)
    t = tvec(n)
    # wet peel as the card leaves whatever it was stuck to
    pe = np.sin(np.pi * np.linspace(0, 1, secs(0.16))) ** 0.7
    peel = crumple(r, 0.16, pe, rate=2500, fc_lo=500, fc_hi=2600, alpha=2.5, dms=(1, 5), echo=0.5, rustle=0.06)
    add(y, lp(peel, 2400) * 0.35, 0)
    add(y, droplet(r, 0.18, 520, 1250), secs(0.07))
    # big card swinging through the air: band sweeping up then down, flexing
    ns = secs(0.6)
    x = np.linspace(0, 1, ns)
    fc = 380 * (1 + 3.5 * np.sin(np.pi * x ** 0.8))
    env = np.sin(np.pi * x) ** 1.4 * (1 + 0.25 * np.sin(TAU * 9 * x * 0.6))
    add(y, swoosh(r, env, fc, width=0.45) * 0.9, secs(0.05))
    # thwap: lands flat - low slap, crackle, sticky smack
    tw = secs(0.6)
    add(y, thump(r, 0.6, f=220, dur=0.14, tau=0.03), tw)
    add(y, crumple(r, 0.04, ramp_env(secs(0.04), 0.0005, 0.008), rate=3000, fc_lo=1200, fc_hi=6000, echo=0.5,
                   rustle=0) * 0.5, tw)
    add(y, lp(r.standard_normal(secs(0.08)) * np.exp(-np.arange(secs(0.08)) / (SR * 0.018)), 1200) * 0.25, tw + secs(0.004))
    add(y, flap(r, 1300, 0.3, 18), tw + secs(0.03))
    add(y, flap(r, 1700, 0.15, 14), tw + secs(0.09))
    add(y, droplet(r, 0.12, 600, 1500), tw + secs(0.21))
    add(y, droplet(r, 0.07, 700, 1600), tw + secs(0.33))
    return y


def sfx_entity_lunge(seed, variant):
    def build():
        r = rng(seed)
        n = secs(1.1)
        y = np.zeros(n)
        # stop-motion frame tick right at the start
        add(y, ping(r, r.uniform(3000, 4200), 0.12, decay=0.008, dur=0.05), 0)
        # abrupt crumple: hits hard and decays (variant 2 jerks twice)
        jerks = [(0.0, 1.0)] if variant != 2 else [(0.0, 0.8), (0.17, 1.0)]
        cd = 0.45 if variant != 3 else 0.28
        for st, a in jerks:
            e = ramp_env(secs(cd), 0.002, 0.09 if variant != 3 else 0.06)
            c = crumple(r, cd, e, rate=r.uniform(2200, 3000), fc_lo=700, fc_hi=7500, alpha=1.6, dms=(0.5, 4.5),
                        echo=0.5, body=0.25, rustle=0.06)
            add(y, c * 0.7 * a, secs(st + 0.004))
            add(y, thump(r, 0.5 * a, f=150, dur=0.2, tau=0.04), secs(st + 0.004))
            # low sub push, felt more than heard
            ns = secs(0.18)
            ts = tvec(ns)
            sub = np.sin(TAU * np.cumsum(70 - 25 * ts / 0.18) / SR) * np.exp(-ts / 0.05) * (1 - np.exp(-ts / 0.003))
            add(y, sub * 0.35 * a, secs(st))
        # split-pin rattle: a little cascade of brass pings, decaying
        tt = r.uniform(0.015, 0.03)
        npins = r.integers(5, 9) + (3 if variant == 3 else 0)
        for i in range(npins):
            f0 = r.uniform(2200, 4800) if r.random() < 0.8 else r.uniform(1100, 1600)
            add(y, ping(r, f0, 0.22 * 0.82 ** i * r.uniform(0.6, 1.0), decay=r.uniform(0.03, 0.08)), secs(tt))
            tt += r.uniform(0.012, 0.05)
        return y
    return build


def sfx_entity_near():
    """3 s periodic texture: low rumble with sparse pin rattles and staple clicks."""
    L = 3.0
    N = secs(L)
    r = rng(901)
    t = tvec(N)
    rumble = circ_noise(N, band_shape(28, 110, -0.8), r)
    trem = 0.75 + 0.25 * np.sin(TAU * 7 * t / L * 3)  # 7 Hz shiver, whole cycles
    y = rumble * trem * 0.22
    k = 0.0
    while k < L:
        if r.random() < 0.8:
            f0 = r.uniform(900, 2200)
            add(y, lp(ping(r, f0, r.uniform(0.15, 0.4), decay=r.uniform(0.015, 0.05), dull=0.5), 4500), secs(k), circ=True)
        else:
            add(y, staple(r, 0.3), secs(k), circ=True)
        k += r.exponential(0.09) + 0.02
    return circ_filter(sos_hp(25), y)


def staple(r, amp):
    """Stapler: crisp through-paper snap, then the anvil clinch."""
    n = secs(0.25)
    y = np.zeros(n)
    add(y, grain(r, 5000, 0.8, 0.5), 0)
    add(y, ping(r, r.uniform(4200, 5200), 0.6, decay=0.012, dur=0.1), 0)
    add(y, thump(r, 0.35, f=420, dur=0.05, tau=0.008), secs(0.001))
    j = secs(r.uniform(0.028, 0.04))
    add(y, ping(r, r.uniform(3000, 3800), 0.45, decay=0.018, dur=0.12), j)
    add(y, grain(r, 2600, 1.5, 0.3), j)
    add(y, thump(r, 0.5, f=260, dur=0.07, tau=0.012), j)
    return y * amp


def sfx_staple_click():
    r = rng(951)
    return staple(r, 1.0)


def bird(r, notes, papery=0.3):
    """notes: list of (start_s, dur_s, f_start, f_end, amp, vibrato_hz)."""
    end = max(s + d for s, d, *_ in notes) + 0.05
    y = np.zeros(secs(end))
    for s, d, f0, f1, a, vib in notes:
        n = secs(d)
        x = np.linspace(0, 1, n)
        t = tvec(n)
        f = f0 * (f1 / f0) ** x * (1 + 0.03 * np.sin(TAU * vib * t))
        ph = TAU * np.cumsum(f) / SR
        env = np.sin(np.pi * x ** 0.7) ** 1.5
        rough = 1 + papery * lp(r.standard_normal(n), 400) * 3
        tone = (np.sin(ph) + 0.15 * np.sin(2 * ph)) * env * rough
        air = bp(r.standard_normal(n), 2500, 8000) * env * papery * 0.25
        add(y, (tone + air) * a, secs(s))
    return y


def sfx_bird_chirp_1():  # "tsee-u"
    return bird(rng(1001), [(0.0, 0.08, 4400, 6100, .8, 0), (0.15, 0.17, 5300, 3100, 1.0, 0)])


def sfx_bird_chirp_2():  # quick descending trill
    r = rng(1002)
    notes = [(i * 0.07, 0.045, 4300 - 60 * i, 3500 - 60 * i, 0.9 - 0.06 * i, 0) for i in range(7)]
    notes.append((0.52, 0.16, 3900, 2900, 0.7, 0))
    return bird(r, notes)


def sfx_bird_chirp_3():  # rising whistle and two ticks
    return bird(rng(1003), [(0.0, 0.32, 2800, 3700, 0.9, 28), (0.42, 0.03, 5200, 4300, 0.6, 0),
                            (0.5, 0.03, 5200, 4200, 0.5, 0)], papery=0.35)


def sfx_caught():
    """Paper crumpling into a tight ball, then dead silence."""
    r = rng(1101)
    total = 3.2
    cr = 1.85
    n = secs(total)
    y = np.zeros(n)
    nc = secs(cr)
    t = tvec(nc)
    env = np.clip(0.12 + 0.88 * (t / 1.3) ** 1.5, 0, 1) * (1 - 0.35 * np.clip((t - 1.45) / 0.35, 0, 1))
    drift = 1.0 - 0.5 * np.clip(t / cr, 0, 1)  # gets tighter / denser / lower
    c = crumple(r, cr, env, rate=2600, fc_lo=700, fc_hi=7000, alpha=1.6, dms=(0.4, 4), echo=0.55,
                body=0.3, rustle=0.07, fc_drift=drift)
    add(y, c[:nc] * 0.7, 0)
    # squeezing groans of the sheet folding over itself
    for st in (0.3, 0.8, 1.25):
        d = 0.35
        ns = secs(d)
        x = np.linspace(0, 1, ns)
        add(y, swoosh(r, np.sin(np.pi * x) ** 2, 500 * (0.7 ** x), width=0.4) * 0.6, secs(st))
    # final tight crunch, then nothing
    fin = secs(1.72)
    add(y, crumple(r, 0.12, ramp_env(secs(0.12), 0.001, 0.03), rate=4000, fc_lo=600, fc_hi=4500, echo=0.6,
                   body=0.5, rustle=0)[: secs(0.12)] * 0.9, fin)
    add(y, thump(r, 0.5, f=200, dur=0.1, tau=0.02), fin)
    cut = secs(cr)
    y[cut - secs(0.02):cut] *= np.cos(np.linspace(0, np.pi / 2, secs(0.02))) ** 2
    y[cut:] = 0.0
    return y


# ----------------------------------------------------------------------------
# registry: name -> (builder, kind, loop, level dB, trigger, description)
# level: music/amb = target RMS dBFS over the loop; sfx = target max 100 ms RMS.
# ----------------------------------------------------------------------------
SOUNDS = {
    "music_calm": (music_calm, "music", True, -25,
                   "Default exploration bed; always running when the entity is not hunting.",
                   "Slow felt-piano phrases with long gaps over a warm, slowly shifting Dm9-Bbmaj7-Fmaj9-G6/9-Dm9-Bbmaj7-Cadd9-Asus4 pad (D dorian, 60 bpm, 12 s per chord); occasional music-box notes; a few notes flat or sagging; faint tape wobble, hiss and a long soft reverb."),
    "music_dread": (music_dread, "music", True, -25,
                    "Crossfade in (sample-synced with music_calm) as dread rises / entity turns; can also sit under calm.",
                    "Low beating D-E-A cluster drone, the calm melody's first half at half speed an octave down and slightly flat, the calm melody reversed and drowned in reverb, sparse sagging music-box seconds/tritones, slow uneven breathing noise."),
    "amb_wind_paper": (amb_wind_paper, "amb", True, -30,
                       "Base outdoor bed everywhere in the forest.",
                       "Soft dark wind with slow gusts, a faint hollow whistle at gust peaks, and loose paper scraps fluttering past in the gusts, panned around."),
    "amb_leaves_rustle": (amb_leaves_rustle, "amb", True, -33,
                          "Layer near trees / under canopy; scale with tree density.",
                          "Clumps of paper leaves crackling and rustling, near and far, density following slow gusts, over a faint airy bed."),
    "amb_mist": (amb_mist, "amb", True, -34,
                 "Fade in inside fog banks.",
                 "Soft, slowly swelling airy hiss with a little low air, and very faint pitched 'bottle' resonances on D6 and A6 drifting in and out."),
    "sfx_step_paper_1": (sfx_step(1201), "sfx", False, -26, "Player footstep (randomise 1-4, vary pitch +-3%).",
                         "Soft heel thump plus crisp paper crackle, then a lighter toe crunch and grass swish."),
    "sfx_step_paper_2": (sfx_step(1202), "sfx", False, -26.5, "Player footstep.", "As step 1, different grain pattern."),
    "sfx_step_paper_3": (sfx_step(1203), "sfx", False, -26, "Player footstep.", "As step 1, different grain pattern."),
    "sfx_step_paper_4": (sfx_step(1204), "sfx", False, -27, "Player footstep.", "As step 1, slightly softer."),
    "sfx_petal_pickup": (sfx_petal_pickup, "sfx", False, -22, "Player catches / collects a coloured petal.",
                         "A tiny paper flick, then a soft glassy two-note chime (A6, E7) with a music-box shimmer."),
    "sfx_petal_drop": (sfx_petal_drop, "sfx", False, -24, "A petal falls / is lost / fades to grey.",
                       "Paper flutter slowing as it falls, with a soft tone gliding down a fourth (A5 to D5)."),
    "sfx_field_bloom": (sfx_field_bloom, "sfx", False, -21, "The colour field appears.",
                        "Pop-up book creases snapping open, a final soft pop, and a warm Dm9 chord swelling and brightening with a rising music-box arpeggio."),
    "sfx_field_dissolve": (sfx_field_dissolve, "sfx", False, -22, "The colour field dissolves as the player gets close.",
                           "The bloom chord loses its notes top-down, each sagging flat as it fades, while paper scraps rustle and flutter downward and thin out."),
    "sfx_entity_flip": (sfx_entity_flip, "sfx", False, -21, "Entity turns from smiling side to melting side.",
                        "A wet peel and plip, a big card whooshing over, then a flat slap with a sticky smack and two small drips."),
    "sfx_entity_lunge_1": (sfx_entity_lunge(1301, 1), "sfx", False, -20, "Entity stop-motion lunge (randomise 1-3).",
                           "Tick, abrupt crumple with a low push, and a short cascade of brass split-pin rattles."),
    "sfx_entity_lunge_2": (sfx_entity_lunge(1302, 2), "sfx", False, -20, "Entity lunge.",
                           "Same family, a double jerk (two crumples 170 ms apart)."),
    "sfx_entity_lunge_3": (sfx_entity_lunge(1303, 3), "sfx", False, -20, "Entity lunge.",
                           "Same family, shorter crumple and a longer pin rattle."),
    "sfx_entity_near": (sfx_entity_near, "sfx", True, -27, "Loop while the entity is within range; volume by distance.",
                        "Low shivering rumble under a restless patter of dull pin rattles and occasional staple clicks (seamless 3 s loop)."),
    "sfx_staple_click": (sfx_staple_click, "sfx", False, -22, "Staples / pins in the world (trees settling, entity twitch, UI).",
                         "A stapler: crisp metallic snap through paper, then the anvil clinch 30 ms later."),
    "sfx_bird_chirp_1": (sfx_bird_chirp_1, "sfx", False, -27, "Random ambient bird in the canopy.",
                         "Two-part 'tsee-u' chirp, slightly rough and papery."),
    "sfx_bird_chirp_2": (sfx_bird_chirp_2, "sfx", False, -27, "Random ambient bird.",
                         "Quick descending seven-note trill and a closing chirp."),
    "sfx_bird_chirp_3": (sfx_bird_chirp_3, "sfx", False, -27, "Random ambient bird.",
                         "Rising whistle with a flutter vibrato, then two ticks."),
    "sfx_caught": (sfx_caught, "sfx", False, -20, "The entity catches the player.",
                   "A whole sheet crumpling tighter and lower into a ball, a final crunch, then 1.35 s of dead silence."),
}


# ----------------------------------------------------------------------------
# finishing and export
# ----------------------------------------------------------------------------
def finish(name, x, kind, loop, level):
    x = np.asarray(x, dtype=np.float64)
    if kind == "sfx":
        if x.ndim == 2:
            x = x.mean(axis=1)
        if loop:
            x = x - x.mean()
        else:
            x = hp(x, 35)
            if name != "sfx_caught":
                # trim trailing near-silence
                env = np.abs(x)
                thr = env.max() * db(-70)
                last = np.nonzero(env > thr)[0][-1]
                x = x[: min(len(x), last + secs(0.03))]
            x = fade(x, 0.0005, 0.03 if name != "sfx_caught" else 0.0)
            # 2 ms of pre-roll so the codec's first block never starts on a transient
            x = np.concatenate([np.zeros(secs(0.002)), x])
        g = db(level) / (short_rms(x, 0.1).max() + 1e-12)
    else:
        x = x - x.mean(axis=0)
        x = x / (rms(x) + 1e-12)
        if kind == "amb":
            # beds sit under the game: tame stray crackles to at most ~18 dB above the RMS
            thr = db(18)
            x = x / (1 + (np.abs(x) / thr) ** 4) ** 0.25
        g = db(level) / (rms(x) + 1e-12)
    x = x * g
    pk = peak(x)
    if pk > db(-1.0):
        x *= db(-1.0) / pk
    return x


def encode(x, path_noext, loop):
    tmp = Path(tempfile.mkdtemp(prefix="gamenet_audio_"))
    try:
        wav = tmp / "x.wav"
        sf.write(wav, x.astype(np.float32), SR, subtype="FLOAT")
        if shutil.which("ffmpeg"):
            out = path_noext.with_suffix(".ogg")
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5",
                   "-fflags", "+bitexact", "-flags:a", "+bitexact"]
            if loop:
                cmd += ["-metadata", "LOOPSTART=0", "-metadata", f"LOOPLENGTH={len(x)}"]
            subprocess.run(cmd + [str(out)], check=True)
        else:
            out = path_noext.with_suffix(".wav")
            sf.write(out, x, SR, subtype="PCM_16")
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def write_readme(rows):
    lines = [
        "# GameNet audio",
        "",
        "Every sound here is synthesised from scratch by `src/make_audio.py` (numpy + scipy, fixed seeds,",
        "no samples, no external recordings). Re-run it to rebuild; run `src/check_audio.py` to analyse.",
        "",
        "```",
        "python assets/audio/src/make_audio.py            # everything (~5 min; music is the slow part)",
        "python assets/audio/src/make_audio.py --only music_calm sfx_caught",
        "python assets/audio/src/check_audio.py           # peaks, DC, loop seams, edges",
        "```",
        "",
        "## Conventions",
        "",
        "- Format: Ogg Vorbis q5, 44.1 kHz. Music + ambience stereo, SFX mono.",
        "- Music: D dorian, 60 bpm, both beds exactly 96.000 s (4,233,600 samples). Start them at the same",
        "  time and keep them running; crossfade with gains (equal-power) and they stay in sync and in key.",
        "- Loops are built circularly (wrapped tails, whole-cycle modulators, circular reverb), so the loop",
        "  point is continuous, not crossfaded. Loop files carry `LOOPSTART`/`LOOPLENGTH` tags.",
        "  In Web Audio use `AudioBufferSourceNode.loop = true` (not `<audio loop>`, which can gap).",
        "- Levels: music about -25 dBFS RMS, ambience -30 to -34 dBFS RMS, SFX normalised on their loudest",
        "  100 ms (-20 loud events ... -27 small ones). All peaks are at or below -1 dBFS.",
        "  Suggested starting mix gains: music 0.6, ambience 0.7, SFX 1.0.",
        "",
        "## Files",
        "",
        "| File | Duration | Loop | Intended trigger | How it sounds |",
        "|---|---|---|---|---|",
    ]
    for fname, dur, loop, trig, desc in rows:
        lines.append(f"| `{fname}` | {dur:.2f} s | {'yes' if loop else 'no'} | {trig} | {desc} |")
    lines += [
        "",
        "## Notes",
        "",
        "- Footsteps and lunges come in variants; randomise between them and add small pitch (+-3%) and",
        "  gain (+-2 dB) variation in the engine.",
        "- `sfx_entity_near` is a seamless 3 s loop; drive its gain from entity distance.",
        "- `sfx_caught` ends in deliberate digital silence (about 1.35 s); let it play out before cutting.",
        "- Sources and licences: see `CREDITS.md`.",
        "- After decoding in the browser, check `buffer.length` of a loop equals its `LOOPLENGTH` tag;",
        "  ffmpeg decodes them sample-exact.",
        "",
        "## Known weak spots (verified by analysis and spectrograms, not yet by ear)",
        "",
        "- Birds are pure synthesis (swept sines with a little noise): stylised, can read as toy/electronic.",
        "- The felt piano is an additive model: soft and pleasant but nearer a mellow celesta-piano than a",
        "  real felt piano (no pedal, damper or key noise).",
        "- The dread bed's breathing is band-passed noise; at high volume it can read as wind rather than breath.",
        "- Paper sounds (steps, crumples, lunges) are granular crackle models; convincing as paper, less so as grass.",
        "",
    ]
    (OUT_DIR / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="build only these names")
    ap.add_argument("--wav", action="store_true", help="also keep float WAV masters in src/_wav/")
    ap.add_argument("--readme", action="store_true", help="only rewrite README.md from existing files")
    args = ap.parse_args()
    names = [] if args.readme else (args.only or list(SOUNDS))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in names:
        fn, kind, loop, level, _, _ = SOUNDS[name]
        x = finish(name, fn(), kind, loop, level)
        out = encode(x, OUT_DIR / name, loop)
        if args.wav:
            wd = OUT_DIR / "src" / "_wav"
            wd.mkdir(exist_ok=True)
            sf.write(wd / f"{name}.wav", x.astype(np.float32), SR, subtype="FLOAT")
        print(f"{name:22s} {len(x) / SR:7.2f}s  peak {todb(peak(x)):6.1f} dBFS  rms {todb(rms(x)):6.1f} dBFS"
              f"  -> {out.name}", flush=True)
    rows = []
    for name, (fn, kind, loop, level, trig, desc) in SOUNDS.items():
        f = next((p for p in (OUT_DIR / f"{name}.ogg", OUT_DIR / f"{name}.wav") if p.exists()), None)
        if f is None:
            continue
        dur = sf.info(str(f)).duration if f.suffix == ".wav" else _probe_dur(f)
        rows.append((f.name, dur, loop, trig, desc))
    write_readme(rows)


def _probe_dur(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                              "default=nw=1:nk=1", str(path)], capture_output=True, text=True, check=True)
        return float(out.stdout.strip())
    except Exception:
        return float("nan")


if __name__ == "__main__":
    sys.exit(main())
