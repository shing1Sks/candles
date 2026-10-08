#!/usr/bin/env python3
"""Home Time - school sound set generator.

Synthesises every bed, loop and one-shot for the haunted paper school from
scratch (numpy + scipy). Nothing is sampled or downloaded; every sound is owned
by the project. Fixed seeds make the output deterministic.

    python assets/audio/school/src/make_school_audio.py              # build everything
    python assets/audio/school/src/make_school_audio.py --only shriek bell_loop
    python assets/audio/school/src/make_school_audio.py --wav        # also keep WAV masters in src/_wav/
    python assets/audio/school/src/check_school_audio.py            # analyse + assert

Output: assets/audio/school/<name>.ogg (Vorbis q5 via ffmpeg, 44.1 kHz, mono
except whisper_name which is stereo). Same house style as the forest set:
the paper / metal / reverb primitives are imported from assets/audio/src/make_audio.py.

Loops: every loop is built circularly - events that run past the loop end wrap
round to the start, noise beds are shaped in the FFT domain, tones and
modulators have whole cycles per loop, filters/resonators/reverb are applied
circularly. That is an exact crossfade of the loop's own tail into its head,
so the loop point is continuous. Loud events are kept a little away from the
seam so the first and last 50 ms sit at the same level.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent  # assets/audio/school
sys.dont_write_bytecode = True  # don't leave __pycache__ in the forest set's src/
sys.path.insert(0, str(HERE.parent.parent / "src"))

import make_audio as B  # noqa: E402  (house primitives)
from make_audio import (  # noqa: E402
    SR, TAU, add, band_shape, bp, circ_filter, circ_noise, circ_reverb, circ_smooth, circ_wobble, crumple, db,
    envelope, fade, flap, grain, hp, lp, make_ir, mtof, peak, ping, ramp_env, reverb, rms, rng, secs, short_rms,
    sos_bp, sos_hp, sos_lp, swoosh, thump, todb, tvec,
)

PEAK_CAP = -1.0  # dBFS, same as the forest set


# ----------------------------------------------------------------------------
# extra primitives: modal bodies, creaks, formant voices
# ----------------------------------------------------------------------------
def res_sos(f, T):
    """2-pole resonator at f Hz with a 60 dB decay time of T s. Impulse response ~ r^n sin((n+1)w)."""
    rr = np.exp(-6.91 / (T * SR))
    w = TAU * f / SR
    return np.array([[np.sin(w), 0.0, 0.0, 1.0, -2 * rr * np.cos(w), rr * rr]])


def modal(x, modes, circ=False, warm=4.0):
    """Excite a set of modes (f, T60, amp) with x."""
    y = np.zeros(len(x))
    for f, T, a in modes:
        if f > SR / 2 - 1000:
            continue
        s = res_sos(f, T)
        y += a * (circ_filter(s, x, warm) if circ else signal.sosfilt(s, x))
    return y


def pulse(width_ms, amp=1.0):
    w = max(2, int(width_ms * 1e-3 * SR))
    return amp * np.sin(np.pi * (np.arange(w) + 0.5) / w)


def strike(r, dur, modes, contact_ms=0.3, noise=0.3, noise_ms=2.0):
    """Impact: half-sine contact pulse (+ a little noisy roughness) into a modal body. Peak 1."""
    x = np.zeros(secs(dur))
    add(x, pulse(contact_ms), 0)
    if noise:
        m = max(4, secs(noise_ms / 1000))
        add(x, r.standard_normal(m) * np.exp(-np.arange(m) / (m / 4)) * noise, 0)
    y = modal(x, modes)
    return y / (peak(y) + 1e-9)


def creak(r, dur, rate_fn, amp_fn, modes, jitter=0.1, tail=0.25, bright=0.4):
    """Stick-slip creak: an impulse train (rate_fn(u) Hz, u = 0..1) ringing a modal body. Peak 1."""
    n = secs(dur + tail)
    x = np.zeros(n)
    t = 0.0
    while t < dur:
        u = t / dur
        a = amp_fn(u)
        i = secs(t)
        if a > 0.005 and i + 1 < n:
            x[i] += a * r.uniform(0.6, 1.0)
            x[i + 1] -= a * bright * r.uniform(0.5, 1.0)
        t += max(1.0 / rate_fn(u) * (1 + jitter * r.standard_normal()), 0.0008)
    y = modal(x, modes)
    return y / (peak(y) + 1e-9)


def click(r, amp, fc=4000, ms=0.8):
    return grain(r, fc, ms, amp)


def formant_gain(h, F, Bw):
    """Cascade formant magnitude at frequencies h for formant tracks F and bandwidths Bw (1 at DC)."""
    g = np.ones_like(h)
    for f, b in zip(F, Bw):
        g = g * (f * f / np.sqrt((f * f - h * h) ** 2 + (b * h) ** 2))
    return g


def _ctrl(n, ctrl):
    idx = np.arange(0, n, ctrl)
    if idx[-1] != n - 1:
        idx = np.append(idx, n - 1)
    return idx


def _tracks(F, idx, n):
    out = []
    for f in F:
        if np.ndim(f):
            out.append(np.asarray(f, float)[idx])
        else:
            out.append(np.full(len(idx), float(f)))
    return out


def voiced(f0, F, Bw, r, tilt=1.0, fmax=5000.0, ctrl=32):
    """Additive glottal voice: harmonics of f0 (per-sample Hz) shaped by formant tracks F."""
    n = len(f0)
    ph = TAU * np.cumsum(f0) / SR
    idx = _ctrl(n, ctrl)
    f0c = f0[idx]
    Fc = _tracks(F, idx, n)
    full = np.arange(n)
    y = np.zeros(n)
    K = int(fmax / max(float(f0.min()), 20.0))
    for k in range(1, K + 1):
        h = k * f0c
        a = k ** -tilt * formant_gain(h, Fc, Bw) * np.clip((fmax - h) / (0.2 * fmax), 0, 1)
        if a.max() < 1e-4:
            continue
        y += np.interp(full, idx, a) * np.sin(k * ph + r.uniform(0, TAU))
    return y


_FINE = None


def fine_bank():
    global _FINE
    if _FINE is None:
        fcs = np.geomspace(150, 9500, 64)
        _FINE = (fcs, [sos_bp(fc / 1.07, fc * 1.07) for fc in fcs])
    return _FINE


def noise_formant(n, F, Bw, r, tilt=0.0, ctrl=64, flat=False):
    """Whisper / breath: noise through a 64-band bank weighted by formant tracks (channel vocoder).
    flat=True normalises each frame's spectral envelope to the same power, so loudness follows
    the caller's amplitude envelope rather than the vowel."""
    fcs, bank = fine_bank()
    nz = r.standard_normal(n + secs(0.02))
    idx = _ctrl(n, ctrl)
    Fc = _tracks(F, idx, n)
    full = np.arange(n)
    G = [formant_gain(np.full(len(idx), fc), Fc, Bw) * (fc / 1000.0) ** tilt for fc in fcs]
    if flat:
        pw = np.sqrt(sum(g * g * fc for g, fc in zip(G, fcs)) / fcs.sum())
        G = [g / (pw + 1e-12) for g in G]
    y = np.zeros(n)
    for g, sos in zip(G, bank):
        y += signal.sosfilt(sos, nz)[secs(0.02):] * np.interp(full, idx, g)
    return y


def glide(x, fc):
    """Forward 2-pole smoothing of a control track (portamento), starting settled."""
    sos = signal.butter(2, fc, fs=SR, output="sos")
    return signal.sosfilt(sos, x, zi=signal.sosfilt_zi(sos) * x[0])[0]


def norm(x):
    return x / (peak(x) + 1e-12)


def nstd(x):
    return x / (np.std(x) + 1e-12)


def mono_rev(x, ir, wet):
    """Linear reverb, mono."""
    return reverb(x, ir, wet)


def circ_mono_rev(x, ir):
    """Circular reverb (wet only), mono."""
    return circ_reverb(x, ir).mean(axis=1)


def scale_rms(x, target):
    return x * db(target) / (rms(x) + 1e-12)


def scale_short(x, target, win=0.4):
    return x * db(target) / (short_rms(x, win).max() + 1e-12)


# shared rooms
def ir(name):
    """Synthetic rooms: hall (assembly hall), corridor, classroom, small."""
    spec = {"hall": (1.9, 1601, 0.03, 0.7), "corridor": (1.8, 1602, 0.018, 0.8),
            "classroom": (0.8, 1603, 0.008, 0.8), "small": (0.45, 1604, 0.004, 0.9),
            "hall_slow": (2.6, 1605, 0.04, 0.5), "next_room": (0.7, 1606, 0.006, 0.6)}
    t60, seed, pre, bright = spec[name]
    return make_ir(t60, seed=seed, predelay=pre, bright=bright)


# ----------------------------------------------------------------------------
# THE HYMN - children's choir on "ooh", heard through the school PA
# ----------------------------------------------------------------------------
# F major, 60 bpm, four lines of 16 beats. (midi, beats[, 'b' = sung a semitone flat]).
# One note per line is flattened: Ab, Db, Db, Eb - it is the tune, but slightly wrong.
HYMN_LINES = [
    [(65, 1), (65, 1), (69, 1), (72, 1), (74, 1.5), (72, .5), (69, 2), (70, 1), (69, 1, "b"), (67, 1), (65, 1), (67, 4)],
    [(69, 1), (69, 1), (70, 1), (72, 1), (74, 1, "b"), (72, 1), (69, 2), (67, 1), (69, 1), (70, 1), (67, 1), (65, 4)],
    [(72, 1), (72, 1), (74, 1, "b"), (72, 1), (70, 1), (69, 1), (67, 2), (69, 1), (70, 1), (72, 1), (69, 1), (67, 4)],
    [(65, 1), (69, 1), (72, 1), (77, 1), (76, 1, "b"), (74, 1), (72, 2), (70, 1), (69, 1), (67, 1), (67, 1), (65, None)],
]
F_MAJOR_PC = {5, 7, 9, 10, 0, 2, 4}


def third_below(m):
    below = sorted([k for k in range(m - 6, m) if k % 12 in F_MAJOR_PC], reverse=True)
    return below[1]


def hymn_parts():
    """-> soprano, alto1, alto2 as lists of (start_beat, beats or None, midi, line_end)."""
    sop, a1, a2 = [], [], []
    beat = 0.0
    for line in HYMN_LINES:
        for j, note in enumerate(line):
            m, d = note[0], note[1]
            flat = len(note) > 2
            end = j == len(line) - 1
            sop.append((beat, d, m - (1 if flat else 0), end))
            if d is None:
                n1, n2 = 60, 57          # final chord: F4 over C4 and A3
            elif end and m == 65:
                n1 = n2 = 57             # F major cadence (A3 under F4)
            else:
                n1 = n2 = third_below(m)  # parallel thirds, from the *unflattened* note
            a1.append((beat, d, n1, end))
            a2.append((beat, d, n2, end))
            if d is not None:
                beat += d
    return sop, a1, a2


def choir_voice(r, part, n, tempo, lead, transpose, detune, vib_rate, vib_depth, fscale, lag, gain):
    t = tvec(n)
    midi = np.full(n, np.nan)
    amp = np.zeros(n)
    scoop = np.zeros(n)
    for sb, d, m, end in part:
        on = max(0.0, lead + sb * tempo + lag + r.normal(0, 0.022))
        off = n / SR if d is None else on + d * tempo + (-0.45 * tempo if end else 0.06)
        i0, i1 = secs(on), min(n, secs(off))
        midi[i0:] = m + transpose
        pos = (sb % 16) / 16
        dyn = 0.84 + 0.16 * np.sin(np.pi * pos)
        amp[i0:i1] += envelope(i1 - i0, 0.08, 0.3 if end else 0.11) * dyn
        if r.random() < 0.55:  # children scoop up into some notes
            k = min(secs(0.3), n - i0)
            scoop[i0:i0 + k] -= r.uniform(0.15, 0.45) * np.exp(-np.arange(k) / (SR * 0.05))
    midi[np.isnan(midi)] = midi[~np.isnan(midi)][0]
    midi = glide(midi, 9.0)
    vib_amt = 0.6 + 0.4 * np.sin(TAU * r.uniform(0.07, 0.2) * t + r.uniform(0, TAU))
    vib = vib_depth / 100 * np.sin(TAU * vib_rate * t + r.uniform(0, TAU)) * vib_amt
    drift = sum(np.sin(TAU * r.uniform(0.04, 0.25) * t + r.uniform(0, TAU)) for _ in range(3)) * 0.03
    f0 = mtof(midi + scoop + detune / 100 + vib + drift)
    F1 = np.maximum(440 * fscale, f0 * 1.08)  # 'oo' with F1 tuned up to the note on high pitches
    y = voiced(f0, [F1, 1050 * fscale, 2750 * fscale, 3900 * fscale], [90, 110, 180, 260], r, tilt=1.1, fmax=5200)
    breath = bp(r.standard_normal(n), 1800, 6000) * 0.035
    return (nstd(y) + breath) * amp * gain


def hymn(tempo=1.0, transpose=0.0, seed=1500, slow=False):
    r = rng(seed)
    lead = 0.6
    total = lead + 69.4 * tempo   # 70.000 s at tempo 1
    n = secs(total)
    fade_len = 6.0 * tempo
    sop, a1, a2 = hymn_parts()
    choir = np.zeros(n)
    voices = [(sop, 1.0)] * 9 + [(a1, 0.55)] * 3 + [(a2, 0.55)] * 2
    for v, (part, g) in enumerate(voices):
        detune = -22.0 if v == 4 else r.normal(0, 9)   # one child sings a little flat throughout
        choir += choir_voice(r, part, n, tempo, lead, transpose, detune,
                             vib_rate=r.uniform(4.6, 5.8) * (0.8 if slow else 1.0),
                             vib_depth=r.uniform(10, 22) * (1.3 if slow else 1.0),
                             fscale=r.uniform(0.96, 1.08), lag=r.uniform(-0.015, 0.045), gain=g)
    if slow:  # lights-out: a slow, slightly seasick tape wow
        k = max(1, round(0.23 * total))
        choir = circ_wobble(choir, [(k, 14, 0.0), (max(1, round(1.7 * total)), 3, 0.5)])
    # sung in the assembly hall
    wet = 0.45 if slow else 0.35
    y = mono_rev(choir, ir("hall_slow" if slow else "hall"), wet)
    # ... heard through the corridor speaker
    y = norm(y)
    hi = 3200 if slow else 4000
    sp = bp(y, 300, hi, order=3)
    sp = sp + 0.35 * bp(sp, 1100, 2400, order=1)   # cheap cone presence bump
    drive = 2.0 if slow else 1.6
    sp = np.tanh(drive * norm(sp)) / np.tanh(drive)
    # speaker crackle and hiss: dust ticks, a few louder pops, faint hiss
    imp = np.zeros(n)
    k = r.random(n) < 9.0 / SR
    imp[k] = r.choice([-1, 1], k.sum()) * np.minimum(0.25, 0.012 * (r.pareto(1.8, k.sum()) + 1))
    k = r.random(n) < 0.25 / SR
    imp[k] += r.choice([-1, 1], k.sum()) * r.uniform(0.08, 0.18, k.sum())
    crackle = bp(imp, 300, hi + 1500, order=2) * 3.0
    hiss = bp(r.standard_normal(n), 400, hi + 1000) * 0.006
    out = sp * 0.5 + crackle + hiss
    # PA switched on, then the final chord held and faded over the last 6 s (x tempo)
    out[:secs(0.02)] *= np.linspace(0, 1, secs(0.02))
    nf = secs(fade_len)
    out[-nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 2
    out[-1] = 0.0
    return out


def hymn_70s():
    return hymn()


def hymn_slow():
    return hymn(tempo=1 / 0.85, transpose=-1.5, seed=1500, slow=True)


# ----------------------------------------------------------------------------
# BEDS / LOOPS (all circular)
# ----------------------------------------------------------------------------
def tube_hum(N, r, t, level=1.0):
    hum = np.zeros(N)
    for f, a in [(50, .18), (100, 1.0), (150, .22), (200, .5), (250, .08), (300, .28), (400, .14),
                 (500, .07), (600, .06), (700, .03), (800, .03), (1000, .015), (1200, .01)]:
        mod = 0.85 + 0.15 * circ_smooth(N, 0.15, r)
        hum += a * mod * np.sin(TAU * f * t + r.uniform(0, TAU))
    s100 = np.sin(TAU * 100 * t)
    sizzle = circ_noise(N, band_shape(2500, 8000, 0), r) * (0.5 + 0.5 * s100) ** 8
    return (hum + 0.12 * sizzle) * level


def corridor_hum():
    L = 20.0
    N = secs(L)
    r = rng(2101)
    t = tvec(N)
    hum = scale_rms(tube_hum(N, r, t), -33)
    air = circ_noise(N, band_shape(60, 1500, -0.9), r) * (0.85 + 0.15 * circ_smooth(N, 0.08, r))
    air = scale_rms(air, -38)
    # distant building creaks (wood + a little metal), placed away from the seam
    cr = np.zeros(N)
    for st in (3.6 + r.uniform(-.3, .3), 10.2 + r.uniform(-.3, .3), 15.4 + r.uniform(-.3, .3)):
        d = r.uniform(0.6, 1.4)
        r0, r1 = r.uniform(18, 35), r.uniform(40, 90)
        c = creak(r, d, lambda u, r0=r0, r1=r1: r0 + (r1 - r0) * np.sin(np.pi * u) ** 0.7,
                  lambda u: np.sin(np.pi * u) ** 1.5 * (0.7 + 0.3 * np.sin(TAU * 4 * u) ** 2),
                  [(180, .08, 1), (330, .06, .8), (560, .05, .6), (910, .04, .4), (1500, .03, .2)])
        add(cr, lp(c, 1500) * r.uniform(0.6, 1.0), secs(st), circ=True)
    cr = cr * 0.35 + circ_mono_rev(cr, ir("corridor")) * 1.2
    cr = scale_short(cr, -36)
    return circ_filter(sos_hp(30), hum + air + cr)


def room_tone():
    L = 20.0
    N = secs(L)
    r = rng(2201)
    t = tvec(N)
    air = scale_rms(circ_noise(N, band_shape(35, 2200, -1.1), r) * (0.9 + 0.1 * circ_smooth(N, 0.05, r)), -40)
    hiss = scale_rms(circ_noise(N, band_shape(2000, 9000, -0.5), r), -58)
    far = scale_rms(np.sin(TAU * 100 * t) + 0.5 * np.sin(TAU * 200 * t + 1.0) + 0.2 * np.sin(TAU * 50 * t), -57)
    ticks = np.zeros(N)
    tc = 1.0
    while True:
        tc += r.uniform(2.5, 5.0)
        if tc > 18.2:
            break
        tt = tc
        for _ in range(r.integers(1, 5)):
            a = r.uniform(0.4, 1.0)
            if r.random() < 0.25:  # deeper pipe 'tonk'
                y = strike(r, 0.5, [(260, .25, 1), (610, .15, .6), (1130, .08, .3)], contact_ms=1.0) * a * 0.6
            else:
                y = lp(ping(r, r.uniform(1400, 3200), a, decay=r.uniform(0.006, 0.02), dur=0.15, dull=0.5), 5000)
                add(y, thump(r, 0.3 * a, f=400, dur=0.04, tau=0.004), 0)
            add(ticks, y, secs(tt), circ=True)
            tt += r.uniform(0.08, 0.7)
    ticks = ticks + circ_mono_rev(ticks, ir("classroom")) * 0.5
    ticks = scale_short(ticks, -40 + 13, win=0.1)
    return circ_filter(sos_hp(25), air + hiss + far + ticks)


def bell_loop():
    L = 8.0
    N = secs(L)
    r = rng(2301)
    rate = 21.0
    ns = int(rate * L)
    exc = np.zeros(N)
    for k in range(ns):
        pos = (k + r.uniform(-0.08, 0.08)) * L / ns
        add(exc, pulse(0.25, r.uniform(0.75, 1.0)), secs(pos) % N, circ=True)
    f0 = 1210.0
    modes = [(f0, 1.1, 1.0), (f0 * 1.003, 1.0, 0.6), (f0 * 0.52, 0.5, 0.25), (f0 * 1.5, 0.4, 0.15),
             (f0 * 2.76, 0.7, 0.55), (f0 * 2.766, 0.65, 0.3), (f0 * 3.6, 0.3, 0.12),
             (f0 * 5.40, 0.35, 0.35), (f0 * 5.43, 0.3, 0.2), (f0 * 8.93, 0.2, 0.2)]
    ring = norm(modal(exc, modes, circ=True))
    chatter = norm(modal(exc, [(260, .02, 1), (610, .015, .6), (2400, .006, .5), (4700, .004, .3)], circ=True))
    y = ring + 0.35 * chatter
    y = np.tanh(2.2 * norm(y))  # harsh, slightly overdriven
    y = y + 0.25 * nstd(circ_mono_rev(y, ir("corridor"))) * np.std(y)
    return circ_filter(sos_hp(80), y)


def pencils_loop():
    L = 10.0
    N = secs(L)
    r = rng(2401)
    out = np.zeros(N)
    for w in range(14):
        d = r.uniform(0, 1)
        env = np.zeros(N)
        t = r.uniform(0, L)
        end = t + L
        while t < end:
            te = t + r.uniform(0.5, 1.6)  # a word: several strokes
            while t < te:
                sd = r.uniform(0.05, 0.22)
                n = secs(sd)
                x = np.linspace(0, 1, n)
                add(env, np.sin(np.pi * x) ** 0.6 * r.uniform(0.5, 1.0), secs(t), circ=True)
                t += sd + r.uniform(0.008, 0.07)
            t += r.uniform(0.15, 1.3)
        fc = r.uniform(2200, 4200)
        nz = r.standard_normal(N)
        rough = 1 + 0.5 * nstd(circ_filter(sos_lp(120), r.standard_normal(N)))
        scratch = nstd(circ_filter(sos_bp(fc * 0.55, fc * 1.8), nz)) * env * np.abs(rough)
        k = r.random(N) < 2500 / SR
        imp = np.zeros(N)
        imp[k] = r.choice([-1, 1], k.sum()) * np.minimum(r.pareto(2.0, k.sum()) + 1, 5.0)
        grit = nstd(circ_filter(sos_bp(2500, 8000), imp)) * env ** 1.5
        body = nstd(circ_filter(sos_lp(500), r.standard_normal(N))) * env
        wr = scratch + 0.6 * grit + 0.12 * body
        wr = circ_filter(sos_lp(9000 - 6000 * d), wr) / (1 + 2.5 * d)
        out += wr
    out = out + 0.3 * circ_mono_rev(out, ir("classroom"))
    return circ_filter(sos_hp(120), out)


def keys_loop():
    L = 6.0
    N = secs(L)
    r = rng(2501)
    out = np.zeros(N)
    step, nsteps, t0 = 0.75, 8, 0.12
    gait = np.zeros(N)
    for k in range(nsteps):
        ts = t0 + k * step
        add(gait, np.exp(-np.arange(secs(0.6)) / (SR * 0.16)), secs(ts), circ=True)
        tt = ts
        for i in range(r.integers(7, 13)):  # keys swing and hit on the heel strike
            f0 = r.uniform(2400, 7200) if r.random() < 0.8 else r.uniform(1300, 2000)
            a = 0.9 * 0.85 ** i * r.uniform(0.5, 1.0)
            add(out, ping(r, f0, a, decay=r.uniform(0.02, 0.09), dur=0.3, dull=r.uniform(0.5, 1.0)), secs(tt), circ=True)
            tt += r.uniform(0.004, 0.03)
        tt = ts + r.uniform(0.24, 0.32)
        for i in range(r.integers(3, 7)):  # swing back
            a = 0.4 * 0.8 ** i * r.uniform(0.5, 1.0)
            add(out, ping(r, r.uniform(2400, 6500), a, decay=r.uniform(0.02, 0.07), dur=0.3), secs(tt), circ=True)
            tt += r.uniform(0.006, 0.035)
    # restless tinkle between the steps, denser near each step
    t = 0.0
    while t < L:
        g = gait[secs(t) % N]
        if r.random() < 0.3 + 0.7 * min(1, g):
            add(out, ping(r, r.uniform(3000, 7500), r.uniform(0.03, 0.1), decay=r.uniform(0.01, 0.04), dur=0.15),
                secs(t), circ=True)
        t += r.exponential(1 / 30)
    # the ring itself (lower, duller) and trouser cloth
    ringk = np.zeros(N)
    for k in range(nsteps):
        add(ringk, lp(ping(r, r.uniform(1100, 1500), 0.3, decay=0.12, dur=0.5, dull=0.3), 3000),
            secs(t0 + k * step + 0.01), circ=True)
    cloth = nstd(circ_noise(N, band_shape(400, 2500, -0.5), r)) * (0.2 + gait) * 0.012
    y = out + ringk + cloth
    y = y + 0.18 * circ_mono_rev(y, ir("corridor"))
    return circ_filter(sos_hp(200), y)


def light_buzz_loop():
    L = 6.0
    N = secs(L)
    r = rng(2601)
    t = tvec(N)
    s100 = np.sin(TAU * 100 * t)
    buzz = circ_filter(sos_lp(4500), np.tanh(3.5 * s100 + 0.6 * np.sin(TAU * 200 * t + 0.7)))
    sizzle = nstd(circ_noise(N, band_shape(2500, 9000, 0), r)) * (0.5 + 0.5 * s100) ** 6 * 0.15
    floor = 0.12 * np.sin(TAU * 100 * t + 0.3) + 0.05 * np.sin(TAU * 50 * t)  # ballast keeps humming
    gate = np.ones(N)
    restrikes = []
    for st, d in [(0.8 + r.uniform(0, .2), r.uniform(0.35, 0.6)), (2.5 + r.uniform(0, .2), r.uniform(0.7, 1.0)),
                  (4.3 + r.uniform(0, .2), r.uniform(0.3, 0.45))]:
        tt = st
        while tt < st + d:
            per = 1 / r.uniform(7, 16)
            off = per * r.uniform(0.3, 0.75)
            i0, i1 = secs(tt), secs(tt + off)
            gate[i0:i1] = r.uniform(0.0, 0.3)
            restrikes.append(tt + off)
            tt += per
    # one full dropout, then a flash on re-strike
    do = 3.6 + r.uniform(0, 0.15)
    gate[secs(do):secs(do + 0.28)] = 0.0
    gate[secs(do + 0.28):secs(do + 0.36)] = 1.35
    restrikes.append(do + 0.28)
    gate = circ_filter(sos_lp(400), gate)
    gate = gate * (1 - 0.12 * circ_smooth(N, 3, r))
    clicks = np.zeros(N)
    for tr in restrikes:
        if r.random() < 0.6:
            y = ping(r, r.uniform(2800, 4200), r.uniform(0.3, 0.7), decay=0.01, dur=0.08, dull=0.7)
            add(y, click(r, 0.4, 5000), 0)
            add(clicks, y, secs(tr), circ=True)
    y = (0.5 * buzz + sizzle) * gate + floor + 0.25 * clicks
    y = y + 0.15 * circ_mono_rev(y, ir("corridor"))
    return circ_filter(sos_hp(40), y)


VOWELS = {"a": (850, 1220, 2810), "e": (600, 2050, 2850), "i": (330, 2650, 3200), "o": (520, 920, 2800),
          "u": (380, 1000, 2700), "@": (560, 1600, 2750), "ae": (750, 1800, 2900)}


def murmur_phrase(r, dur, f_hi):
    n = secs(dur)
    t = tvec(n)
    x = t / dur
    bounds = [0.0]
    while bounds[-1] < dur - 0.12:
        bounds.append(bounds[-1] + r.uniform(0.13, 0.3))
    bounds[-1] = dur
    tracks = [np.zeros(n) for _ in range(3)]
    amp = np.zeros(n)
    bump = np.zeros(n)
    fric = np.zeros(n)
    keys = list(VOWELS)
    for a, b in zip(bounds[:-1], bounds[1:]):
        i0, i1 = secs(a), min(n, secs(b))
        v = VOWELS[keys[r.integers(len(keys))]]
        for j in range(3):
            tracks[j][i0:i1] = v[j] * r.uniform(0.95, 1.05)
        stress = r.random() < 0.3
        amp[i0:i1] += envelope(i1 - i0, 0.03, 0.06) * r.uniform(0.6, 1.0) * (1.3 if stress else 1.0)
        if stress:
            c = (i0 + i1) / 2 / SR
            bump += 0.12 * np.exp(-((t - c) / 0.07) ** 2)
        if r.random() < 0.35:
            m = min(secs(r.uniform(0.05, 0.09)), n - i0)
            fric[i0:i0 + m] += np.sin(np.linspace(0, np.pi, m)) * r.uniform(0.15, 0.3)
    tracks = [glide(tr, 18.0) for tr in tracks]
    f0 = f_hi * (1 - 0.25 * x) * (1 - 0.12 * np.clip((x - 0.75) / 0.25, 0, 1))
    f0 = f0 * (1 + bump + 0.01 * nstd(lp(r.standard_normal(n), 6)))
    v = nstd(voiced(f0, tracks + [3900], [90, 120, 170, 250], r, tilt=1.2, fmax=4500)) * amp
    v += nstd(bp(r.standard_normal(n), 3000, 7000)) * fric
    return fade(v, 0.04, 0.06)


def story_murmur_loop():
    L = 12.0
    N = secs(L)
    r = rng(2701)
    durs = [r.uniform(1.9, 2.8) for _ in range(4)]
    pauses = np.array([r.uniform(0.4, 0.9) for _ in range(4)])
    pauses *= (L - sum(durs)) / pauses.sum()
    voice = np.zeros(N)
    t = pauses[-1] / 2  # the seam falls in the middle of a pause
    for d, p in zip(durs, pauses):
        add(voice, murmur_phrase(r, d, r.uniform(205, 235)), secs(t), circ=True)
        t += d + p
    room = voice + 0.6 * circ_mono_rev(voice, ir("next_room"))
    wall = circ_filter(sos_lp(700, 4), room)
    wall = circ_filter(sos_hp(100), wall) + 0.05 * circ_filter(sos_bp(1000, 2500), room)
    bed = scale_rms(circ_noise(N, band_shape(40, 900, -1.0), r), todb(rms(wall)) - 20)
    return wall + bed


def snore_breath(r, t_in, t_out, depth=1.0):
    n = secs(t_in)
    x = np.linspace(0, 1, n)
    env = np.sin(np.pi * x ** 0.85) ** 1.3
    fr = 30 + 14 * np.sin(np.pi * x) * depth + 2.5 * nstd(lp(r.standard_normal(n), 4))
    ph = np.cumsum(fr) / SR
    pulses = (0.5 + 0.5 * np.cos(TAU * ph)) ** 6
    rattle = nstd(bp(r.standard_normal(n) * (0.2 + pulses), 90, 1400))
    tone = nstd(voiced(fr, [380, 950, 2300], [140, 180, 260], r, tilt=1.4, fmax=1800))
    sn = lp((rattle + 0.7 * tone) * env, 2200)
    n2 = secs(t_out)
    x2 = np.linspace(0, 1, n2)
    env2 = (1 - np.exp(-x2 * 12)) * (1 - x2) ** 1.5
    ex = nstd(noise_formant(n2, [600, 1500, 2600], [250, 300, 400], r, tilt=-0.5)) * env2 * 0.4
    ex += nstd(lp(r.standard_normal(n2), 300)) * env2 * 0.25
    add(ex, flap(r, 600, 0.25, 25), 0)  # soft lip 'puh'
    return sn, ex


def snore_loop():
    L = 8.0
    N = secs(L)
    r = rng(2801)
    y = np.zeros(N)
    for st, ti, te, dp in [(0.35, 1.75, 1.5, 1.0), (4.3, 1.85, 1.45, 1.25)]:
        sn, ex = snore_breath(r, ti, te, dp)
        add(y, sn, secs(st), circ=True)
        add(y, ex, secs(st + ti + 0.12), circ=True)
    y = y + 0.25 * circ_mono_rev(y, ir("classroom"))
    bed = scale_rms(circ_noise(N, band_shape(40, 1500, -1.0), r), todb(rms(y)) - 24)
    return circ_filter(sos_hp(35), y + bed)


# ----------------------------------------------------------------------------
# ONE-SHOTS
# ----------------------------------------------------------------------------
BOARD = [(170, .05, .5), (410, .04, .4), (1250, .02, .8), (2550, .015, .6), (4100, .01, .4)]


def chalk(seed, strokes, squeals):
    """strokes: list of (start, dur); squeals: list of (start, dur, f)."""
    def build():
        r = rng(seed)
        end = max(s + d for s, d in strokes) + 0.4
        n = secs(end)
        y = np.zeros(n)
        for st, d in strokes:
            m = secs(d)
            x = np.linspace(0, 1, m)
            speed = np.sin(np.pi * x) ** 0.5 * (0.8 + 0.2 * np.sin(TAU * r.uniform(2, 5) * x))
            # stick-slip chatter: chalk grabs and releases the board
            imp = np.zeros(m)
            t = 0.0
            while t < d:
                u = speed[min(secs(t), m - 1)]
                imp[min(secs(t), m - 1)] += u * r.uniform(0.4, 1.0) * r.choice([-1, 1])
                t += 1 / (120 + 380 * u) * r.uniform(0.6, 1.4)
            chat = norm(modal(imp, BOARD))
            fr = nstd(bp(r.standard_normal(m), 1200, 7000)) * speed * (1 + 0.6 * nstd(lp(r.standard_normal(m), 60)))
            grit = crumple(r, d, speed, rate=900, fc_lo=1800, fc_hi=8000, alpha=1.9, dms=(0.3, 1.5), echo=0.2,
                           rustle=0)[:m]
            s = 0.8 * chat + 0.12 * fr + 0.8 * norm(grit) * 0.6
            add(y, fade(s, 0.004, 0.01), secs(st))
        for st, d, f in squeals:
            m = secs(d)
            tt = tvec(m)
            ff = f * (1 + 0.025 * nstd(lp(r.standard_normal(m), 25)) + 0.04 * np.sin(TAU * 31 * tt))
            ph = TAU * np.cumsum(ff) / SR
            sq = np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.25 * np.sin(3 * ph + 1.1)
            e = np.minimum(1, tt / 0.012) * np.minimum(1, (d - tt) / 0.03) * (0.6 + 0.4 * np.abs(nstd(lp(r.standard_normal(m), 40))))
            add(y, np.tanh(1.5 * sq) * e * 0.55, secs(st))
        return mono_rev(y, ir("classroom"), 0.18)
    return build


def chalk_stop():
    r = rng(3101)
    y = np.zeros(secs(0.45))
    add(y, strike(r, 0.2, [(620, .04, 1), (1450, .03, .7), (2300, .02, .5), (3900, .01, .3)], contact_ms=0.4) * 0.7, 0)
    add(y, thump(r, 0.35, f=300, dur=0.05, tau=0.006), 0)
    add(y, click(r, 0.3, 4500), 0)
    m = secs(0.07)
    sc = nstd(bp(r.standard_normal(m), 1500, 6000)) * np.sin(np.linspace(0, np.pi, m)) ** 0.7 * 0.12
    add(y, sc, secs(0.06))
    add(y, strike(r, 0.1, [(1450, .02, 1), (3100, .01, .5)], contact_ms=0.3) * 0.15, secs(0.135))
    return mono_rev(y, ir("classroom"), 0.15)


def paper_pick(seed, length):
    def build():
        r = rng(seed)
        n = secs(length + 0.15)
        y = np.zeros(n)
        # slide on the desk
        ns = secs(r.uniform(0.07, 0.13))
        x = np.linspace(0, 1, ns)
        add(y, swoosh(r, np.sin(np.pi * x) ** 1.2, 2600 * (1.3 ** x), width=0.5) * 0.6, 0)
        # lifted: the sheet flexes and crackles, a soft air 'whomp'
        st = secs(r.uniform(0.05, 0.1))
        d = length - 0.12
        e = np.sin(np.pi * np.linspace(0, 1, secs(d)) ** 0.6) ** 1.5
        add(y, crumple(r, d, e, rate=r.uniform(450, 800), fc_lo=1200, fc_hi=6500, alpha=2.0, dms=(0.5, 3.0),
                       echo=0.3, rustle=0.05) * 0.55, st)
        add(y, flap(r, r.uniform(1000, 1600), 0.35, r.uniform(16, 26)), st + secs(r.uniform(0.04, 0.12)))
        add(y, flap(r, r.uniform(1400, 2200), 0.15, 12), st + secs(d * r.uniform(0.6, 0.9)))
        return y
    return build


DESK = [(110, .12, .9), (180, .1, 1.0), (260, .09, .8), (410, .07, .7), (650, .05, .5), (980, .04, .4),
        (1500, .03, .3), (2300, .02, .2)]


def desk_lid():
    r = rng(3301)
    n = secs(1.9)
    y = np.zeros(n)
    # lift: small knock, hinge creak, contents shuffle
    add(y, strike(r, 0.3, DESK, contact_ms=1.5) * 0.25, 0)
    c = creak(r, 0.42, lambda u: 70 + 60 * u, lambda u: np.sin(np.pi * u) ** 0.8,
              [(900, .03, 1), (1900, .02, .7), (3100, .015, .4), (300, .05, .5)])
    add(y, c * 0.18, secs(0.05))
    for k in range(4):
        add(y, lp(ping(r, r.uniform(1500, 3000), 0.08, decay=0.02, dull=0.4), 4000), secs(0.15 + 0.08 * k + r.uniform(0, .04)))
    # dropped shut
    sl = secs(0.95)
    add(y, strike(r, 0.9, DESK, contact_ms=0.6, noise=0.6) * 1.0, sl)
    add(y, thump(r, 0.8, f=90, dur=0.25, tau=0.04), sl)
    add(y, click(r, 0.6, 3000, 2.0), sl)
    add(y, ping(r, 1900, 0.12, decay=0.03, dull=0.6), sl + secs(0.004))  # hinge clank
    tt = 0.012
    for k in range(r.integers(6, 10)):  # pencils and rulers jump inside
        add(y, lp(ping(r, r.uniform(1200, 3500), 0.15 * 0.8 ** k, decay=r.uniform(0.01, 0.03), dull=0.4), 4500),
            sl + secs(tt))
        tt += r.uniform(0.01, 0.035)
    return mono_rev(y, ir("classroom"), 0.2)


CHAIR = [(240, .03, 1), (520, .025, .8), (880, .02, .7), (1350, .018, .5), (2100, .012, .35), (3200, .008, .2)]


def chair_scrape():
    r = rng(3401)
    d = 0.8
    n = secs(d + 0.3)
    m = secs(d)
    x = np.linspace(0, 1, m)
    speed = np.clip(np.sin(np.pi * x ** 0.8) ** 0.7 * (1 + 0.15 * nstd(lp(r.standard_normal(m), 8))), 0, None)
    y = np.zeros(n)
    for leg in range(3):
        imp = np.zeros(m)
        t = r.uniform(0, 0.01)
        while t < d:
            u = speed[min(secs(t), m - 1)]
            if u > 0.05:
                imp[min(secs(t), m - 1)] += u * r.uniform(0.5, 1.0)
            t += 1 / (60 + 150 * u + 15 * leg) * r.uniform(0.7, 1.3)
        add(y, norm(modal(imp, [(f * (1 + 0.05 * leg), T, a) for f, T, a in CHAIR])) * (1 - 0.25 * leg), 0)
    fr = nstd(bp(r.standard_normal(m), 800, 4000)) * speed ** 1.5 * 0.25
    rum = nstd(lp(r.standard_normal(m), 200)) * speed * 0.2
    add(y, fr + rum, 0)
    return mono_rev(y, ir("classroom"), 0.18)


DOOR = [(95, .15, .8), (150, .12, 1.0), (240, .1, .8), (390, .08, .6), (610, .06, .5), (980, .04, .35), (1600, .03, .2)]
HINGE = [(310, .06, .6), (640, .05, .9), (1150, .04, 1.0), (1790, .03, .7), (2600, .02, .4), (3700, .012, .2)]


def latch(r, amp=1.0):
    y = np.zeros(secs(0.3))
    add(y, ping(r, 2500, 0.5, decay=0.02, dull=0.6), 0)
    add(y, thump(r, 0.3, f=500, dur=0.04, tau=0.005), 0)
    m = secs(0.04)
    add(y, nstd(bp(r.standard_normal(m), 2000, 5000)) * np.sin(np.linspace(0, np.pi, m)) * 0.08, secs(0.01))
    add(y, ping(r, 1800, 0.6, decay=0.03, dull=0.7), secs(0.09))
    add(y, thump(r, 0.4, f=350, dur=0.05, tau=0.006), secs(0.09))
    return y * amp


def door_open():
    r = rng(3501)
    n = secs(2.6)
    y = np.zeros(n)
    add(y, latch(r, 0.8), 0)
    c = creak(r, 1.7, lambda u: 35 + 95 * np.sin(np.pi * u ** 0.8) ** 0.8 + 12 * np.sin(TAU * 3 * u),
              lambda u: np.sin(np.pi * u) ** 0.6 * (0.6 + 0.4 * np.sin(TAU * 2.2 * u + 1) ** 2), HINGE, jitter=0.12)
    add(y, c * 0.55, secs(0.25))
    ns = secs(1.5)
    xx = np.linspace(0, 1, ns)
    add(y, lp(swoosh(r, np.sin(np.pi * xx) ** 2, 350 * (1.5 ** xx), width=0.5), 600) * 0.35, secs(0.3))
    return mono_rev(y, ir("classroom"), 0.22)


def door_shut():
    r = rng(3511)
    n = secs(1.8)
    y = np.zeros(n)
    ns = secs(0.28)
    xx = np.linspace(0, 1, ns)
    add(y, lp(swoosh(r, xx ** 2, 300 * (2 ** xx), width=0.5), 900) * 0.4, 0)
    c = creak(r, 0.18, lambda u: 70 + 50 * u, lambda u: np.sin(np.pi * u), HINGE)
    add(y, c * 0.12, secs(0.05))
    im = secs(0.28)
    add(y, strike(r, 1.2, DOOR, contact_ms=1.2, noise=0.5) * 1.0, im)
    add(y, thump(r, 1.0, f=80, dur=0.3, tau=0.05), im)
    add(y, click(r, 0.4, 2500, 2.5), im)
    add(y, latch(r, 0.7)[secs(0.08):], im + secs(0.008))
    for k in range(r.integers(5, 9)):  # the glass pane and frame rattle
        add(y, ping(r, r.uniform(2800, 5200), 0.12 * 0.8 ** k, decay=r.uniform(0.01, 0.03), dull=0.8),
            im + secs(0.01 + 0.012 * k + r.uniform(0, 0.01)))
    return mono_rev(y, ir("corridor"), 0.3)


def door_lock():
    r = rng(3521)
    n = secs(1.3)
    y = np.zeros(n)
    # key slides in: pin ticks + scrape
    m = secs(0.22)
    add(y, nstd(bp(r.standard_normal(m), 3000, 7000)) * np.sin(np.linspace(0, np.pi, m)) * 0.06, secs(0.02))
    t = 0.03
    for k in range(5):
        add(y, ping(r, r.uniform(3500, 6000), 0.25, decay=0.008, dur=0.05, dull=0.7), secs(t))
        t += r.uniform(0.03, 0.05)
    add(y, ping(r, 2200, 0.3, decay=0.02, dull=0.6), secs(0.26))  # seated
    # turn: friction, ratchet ticks
    m = secs(0.25)
    add(y, nstd(bp(r.standard_normal(m), 1500, 4000)) * np.sin(np.linspace(0, np.pi, m)) ** 0.7 * 0.08, secs(0.45))
    for k in range(3):
        add(y, ping(r, r.uniform(2500, 3500), 0.2, decay=0.01, dur=0.06, dull=0.6), secs(0.48 + 0.07 * k))
    # bolt throws home
    bt = secs(0.72)
    add(y, strike(r, 0.4, [(680, .06, 1), (1450, .05, .7), (2300, .03, .5), (3400, .02, .3)], contact_ms=0.5) * 0.8, bt)
    add(y, thump(r, 0.7, f=200, dur=0.08, tau=0.012), bt)
    add(y, click(r, 0.4, 3500), bt)
    add(y, ping(r, 3100, 0.12, decay=0.01, dur=0.05), bt + secs(0.11))
    return mono_rev(y, ir("corridor"), 0.2)


LOCKER = [(140, .3, .7), (155, .3, .6), (230, .25, 1.0), (240, .25, .6), (370, .2, .8), (395, .2, .5), (520, .15, .6),
          (560, .15, .5), (810, .1, .5), (830, .1, .4), (1210, .12, .4), (1780, .08, .3), (2500, .05, .2), (3600, .03, .15)]


def locker_open():
    r = rng(3601)
    n = secs(1.3)
    y = np.zeros(n)
    add(y, ping(r, 1600, 0.45, decay=0.02, dull=0.6), 0)
    add(y, ping(r, 3300, 0.25, decay=0.015), secs(0.004))
    add(y, thump(r, 0.2, f=400, dur=0.04, tau=0.005), 0)
    wob = strike(r, 1.0, LOCKER, contact_ms=2.0, noise=0.1)
    tt = tvec(len(wob))
    add(y, wob * (1 + 0.3 * np.sin(TAU * 7 * tt) * np.exp(-tt / 0.3)) * 0.35, secs(0.01))
    c = creak(r, 0.35, lambda u: 220 + 90 * u, lambda u: np.sin(np.pi * u), [(2050, .02, 1), (3500, .015, .6), (1200, .03, .4)])
    add(y, c * 0.1, secs(0.15))
    d = 0.3
    add(y, crumple(r, d, np.sin(np.pi * np.linspace(0, 1, secs(d))), rate=350, fc_lo=1200, fc_hi=5000,
                   rustle=0.05) * 0.2, secs(0.12))
    add(y, flap(r, 1300, 0.2, 20), secs(0.25))
    add(y, strike(r, 0.6, LOCKER, contact_ms=1.5) * 0.25, secs(0.68))  # bumps open against the next locker
    return mono_rev(y, ir("corridor"), 0.22)


def locker_shut():
    r = rng(3611)
    n = secs(1.6)
    y = np.zeros(n)
    im = secs(0.04)
    clang = strike(r, 1.4, LOCKER, contact_ms=0.6, noise=0.5)
    tt = tvec(len(clang))
    add(y, clang * (1 + 0.35 * np.sin(TAU * 9 * tt) * np.exp(-tt / 0.25)), im)
    add(y, thump(r, 0.6, f=150, dur=0.12, tau=0.02), im)
    add(y, click(r, 0.4, 4000, 1.5), im)
    add(y, ping(r, 2800, 0.4, decay=0.02, dull=0.7), im + secs(0.02))  # latch catches
    add(y, crumple(r, 0.06, ramp_env(secs(0.06), 0.001, 0.015), rate=3000, fc_lo=1200, fc_hi=6000, echo=0.4,
                   rustle=0.02) * 0.35, im)
    for k in range(4):
        add(y, flap(r, r.uniform(1200, 2000), 0.12 * 0.7 ** k, 14), im + secs(0.05 + 0.06 * k))
    return mono_rev(y, ir("corridor"), 0.3)


def cane_tap(seed, bounce=False, f_scale=1.0):
    def build():
        r = rng(seed)
        n = secs(0.8)
        y = np.zeros(n)
        cane = [(1700 * f_scale, .012, 1), (3900 * f_scale, .008, .7), (6200 * f_scale, .005, .4)]
        floor = [(380, .03, .6), (720, .025, .5), (1250, .02, .4)]
        for st, a in ([(0.0, 1.0), (0.072, 0.35)] if bounce else [(0.0, 1.0)]):
            add(y, strike(r, 0.2, cane, contact_ms=0.15, noise=0.4) * a, secs(st))
            add(y, strike(r, 0.2, floor, contact_ms=0.4) * 0.45 * a, secs(st))
            add(y, thump(r, 0.35 * a, f=220, dur=0.05, tau=0.006), secs(st))
            add(y, click(r, 0.5 * a, 5000, 0.5), secs(st))
        return mono_rev(y, ir("corridor"), 0.32)
    return build


def hm_step(seed, heel_f=110, scuff=False, creaky=False, slap_t=0.11):
    def build():
        r = rng(seed)
        n = secs(1.0)
        y = np.zeros(n)
        floor = [(300, .04, 1), (620, .03, .7), (1100, .025, .5), (1900, .015, .35), (3100, .01, .2)]
        add(y, strike(r, 0.3, floor, contact_ms=0.35, noise=0.5), 0)
        add(y, thump(r, 0.75, f=heel_f, dur=0.15, tau=0.025), 0)
        add(y, click(r, 0.6, 3500, 0.7), 0)
        ss = secs(slap_t + r.uniform(-0.015, 0.015))
        m = secs(0.012)
        add(y, lp(r.standard_normal(m) * np.exp(-np.arange(m) / (m / 5)), 3500) * 0.6, ss)
        add(y, thump(r, 0.45, f=160, dur=0.08, tau=0.012), ss)
        add(y, strike(r, 0.15, floor, contact_ms=1.0) * 0.25, ss)
        if creaky:
            c = creak(r, 0.12, lambda u: 180 + 60 * u, lambda u: np.sin(np.pi * u), [(900, .02, 1), (1700, .015, .6)])
            add(y, c * 0.07, secs(0.05))
        if scuff:
            d = 0.05
            add(y, crumple(r, d, np.sin(np.pi * np.linspace(0, 1, secs(d))), rate=500, fc_lo=2000, fc_hi=6000,
                           rustle=0.08) * 0.15, ss)
        return hp(mono_rev(y, ir("corridor"), 0.35), 70)  # keep the corridor tail from booming
    return build


def light_clunk():
    r = rng(3801)
    n = secs(1.9)
    t = tvec(n)
    y = np.zeros(n)
    tc = 0.12
    ic = secs(tc)
    # hum running, then cut: dies in ~0.4 s and sags in pitch as the ballast lets go
    tt = np.maximum(t - tc, 0)
    fsag = 1 - 0.08 * (1 - np.exp(-tt / 0.3))
    ph = TAU * 100 * np.cumsum(fsag) / SR
    hum = np.sin(ph) + 0.5 * np.sin(2 * ph + 1) + 0.25 * np.sin(3 * ph + 2) + 0.15 * np.sin(4 * ph)
    hum *= np.where(t < tc, 1.0, np.exp(-tt / 0.12)) * np.minimum(1, t / 0.03)
    y += hum * 0.22
    # the relay: hard snap into a metal box, contact bounce, heavy armature thump
    box = [(240, .06, .8), (530, .05, 1), (1180, .04, .7), (2300, .03, .5), (3700, .015, .3)]
    add(y, strike(r, 0.4, box, contact_ms=0.2, noise=0.6), ic)
    add(y, strike(r, 0.3, box, contact_ms=0.2) * 0.35, ic + secs(0.012))
    add(y, strike(r, 0.3, box, contact_ms=0.2) * 0.15, ic + secs(0.031))
    add(y, thump(r, 0.9, f=85, dur=0.2, tau=0.04), ic)
    add(y, click(r, 0.7, 4500, 0.6), ic)
    add(y, ping(r, 4200, 0.04, decay=0.03, dull=0.5), secs(0.7))  # the tube ticks as it cools
    return mono_rev(y, ir("corridor"), 0.25)


def shriek():
    r = rng(3901)
    dur = 1.5
    n = secs(dur)
    t = tvec(n)
    x = t / dur
    f0 = 430 + 700 * (1 - np.exp(-t / 0.28)) + 260 * x ** 2
    f0 = f0 * (1 + 0.018 * nstd(lp(r.standard_normal(n), 35)) + 0.03 * np.sin(TAU * 6.5 * t) * (x > 0.15))
    F = [950 + 150 * x, 1500 + 900 * x, 3000 + 300 * x, 4100, 5200]
    Bw = [160, 200, 260, 320, 420]
    v1 = nstd(voiced(f0, F, Bw, r, tilt=0.55, fmax=10000))
    v2 = nstd(voiced(f0 * 1.013, F, Bw, r, tilt=0.6, fmax=10000))
    sub = nstd(voiced(f0 * 0.5, [700, 1300, 2600], [200, 250, 300], r, tilt=0.8, fmax=6000))
    shimmer = 1 + 0.45 * nstd(lp(r.standard_normal(n), 90))
    voice = (v1 + 0.7 * v2 + 0.45 * sub) * shimmer
    voice = voice + 0.35 * voice * np.sin(TAU * np.cumsum(f0 * 0.5 + 37) / SR)  # inhuman ring-mod growl
    breath = nstd(noise_formant(n, F, Bw, r, tilt=0.3))
    env = (1 - np.exp(-t / 0.005)) * (1 - 0.15 * x)
    nc = secs(0.12)
    env[-nc:] *= np.cos(np.linspace(0, np.pi / 2, nc)) ** 2  # choked off
    body = norm((voice + 0.55 * breath) * env)
    # paper tearing right through it
    dt = 0.9
    te = np.minimum(1, tvec(secs(dt)) / 0.01) * (1 - 0.4 * np.linspace(0, 1, secs(dt))) * np.linspace(1, 0, secs(dt)) ** 0.3
    tear = norm(crumple(r, dt, te, rate=7000, fc_lo=1200, fc_hi=9500, alpha=1.5, dms=(0.2, 1.4), echo=0.6,
                        body=0.2, rustle=0.2))
    ns = secs(0.5)
    xs = np.linspace(0, 1, ns)
    rip = norm(swoosh(r, np.sin(np.pi * xs ** 0.4) ** 1.5, 1800 * (3.9 ** xs), width=0.35))
    # the hit under it
    nh = secs(0.6)
    th = tvec(nh)
    sub_hit = np.sin(TAU * np.cumsum(30 + 28 * np.exp(-th / 0.12)) / SR) * np.exp(-th / 0.14) * (1 - np.exp(-th / 0.002))
    hit = sub_hit.copy()
    add(hit, 0.8 * thump(r, 1.0, f=140, dur=0.25, tau=0.05), 0)
    hit = norm(hit)
    y = np.zeros(n + secs(0.05))
    add(y, body, 0)
    add(y, tear * 0.6, secs(0.01))
    add(y, rip * 0.45, secs(0.02))
    add(y, hit * 0.9, 0)
    y = np.tanh(3.0 * norm(y))
    return hp(y, 45)


def crack_chorus():
    r = rng(4001)
    n = secs(1.05)
    y = np.zeros(n)
    for _ in range(48):  # paper necks snapping, almost together
        st = 0.004 + 0.12 * r.beta(1.3, 2.5)
        a = min(1.0, 0.35 * (r.pareto(2.0) + 1)) * r.uniform(0.6, 1.0)
        i = secs(st)
        add(y, grain(r, r.uniform(2500, 7500), r.uniform(0.3, 1.0), a), i)
        add(y, grain(r, r.uniform(700, 1800), r.uniform(2, 6), a * 0.6), i)
        add(y, thump(r, a * 0.25, f=r.uniform(500, 900), dur=0.03, tau=0.004), i)
        for _ in range(r.integers(1, 4)):
            add(y, grain(r, r.uniform(1500, 6000), r.uniform(0.5, 2), a * r.uniform(0.2, 0.5)), i + secs(r.uniform(0.001, 0.012)))
    d = 0.16
    add(y, crumple(r, d, ramp_env(secs(d), 0.003, 0.05), rate=5000, fc_lo=800, fc_hi=7000, alpha=1.6, dms=(0.3, 3),
                   echo=0.5, body=0.3, rustle=0.1) * 0.5, 0)
    add(y, thump(r, 0.35, f=160, dur=0.15, tau=0.03), secs(0.01))
    # the paper bodies settle
    d = 0.85
    tt = tvec(secs(d))
    se = np.exp(-tt / 0.25) * np.minimum(1, tt / 0.03)
    settle = crumple(r, d, se, rate=300, fc_lo=1500, fc_hi=6000, alpha=2.4, dms=(0.5, 3), echo=0.3, rustle=0.04)
    settle[:len(se)] *= se  # each crackle also gets quieter, not just sparser
    add(y, settle * 0.4, secs(0.15))
    for k in range(4):
        add(y, flap(r, r.uniform(900, 1700), 0.12 * 0.75 ** k, r.uniform(14, 24)), secs(0.2 + 0.12 * k + r.uniform(0, .05)))
    y = mono_rev(y, ir("small"), 0.08)
    # tame the few tallest crack peaks so the burst can sit louder (soft knee at 35% of peak)
    y = norm(y)
    thr = 0.35
    return y / (1 + (np.abs(y) / thr) ** 4) ** 0.25


def whisper_name():
    r = rng(4101)
    dur = 1.2
    n = secs(dur)
    # keyframes: time, F1, F2, F3, F4, amp
    kf = np.array([
        [0.00, 600, 1700, 2700, 3700, 0.0],
        [0.06, 600, 1700, 2700, 3700, 0.15],   # breath in on 'h'
        [0.18, 950, 1350, 2650, 3700, 1.0],    # 'ah'
        [0.42, 900, 1250, 2600, 3600, 0.85],
        [0.50, 420, 1550, 2600, 3600, 0.25],   # 'l/n'
        [0.58, 420, 2150, 3000, 3900, 0.8],    # 'ee'
        [0.85, 400, 2250, 3050, 3950, 0.55],
        [1.05, 600, 1700, 2700, 3700, 0.15],   # trailing breath
        [1.20, 600, 1700, 2700, 3700, 0.0],
    ])
    t = tvec(n)
    F = [np.interp(t, kf[:, 0], kf[:, j]) for j in range(1, 5)]
    amp = glide(np.interp(t, kf[:, 0], kf[:, 5]), 25.0)
    w = nstd(noise_formant(n, F, [160, 200, 280, 350], r, tilt=-0.2, flat=True)) * amp
    # 'sh' fricative onset and the breath on the ear
    m = secs(0.13)
    sh = nstd(bp(r.standard_normal(m), 2200, 6500)) * np.sin(np.linspace(0, np.pi, m)) ** 1.5 * 0.5
    add(w, sh, secs(0.03))
    w += nstd(lp(r.standard_normal(n), 300)) * amp * 0.35
    w = fade(w, 0.01, 0.08)
    # close to the ear, slightly right: level + tiny delay + head shadow on the left
    pa = (0.3 + 1) * np.pi / 4
    right = w * np.sin(pa)
    left = np.concatenate([np.zeros(secs(0.00025)), lp(w, 4500)])[:n] * np.cos(pa)
    out = np.stack([left, right], axis=1)
    return out


def stamp():
    r = rng(4201)
    n = secs(0.9)
    y = np.zeros(n)
    ns = secs(0.04)
    xx = np.linspace(0, 1, ns)
    add(y, swoosh(r, xx ** 2, 900 * (1.5 ** xx), width=0.5) * 0.15, 0)
    im = secs(0.04)
    add(y, strike(r, 0.5, [(190, .08, 1), (420, .05, .7), (860, .03, .4)], contact_ms=3.0, noise=0.1) * 0.8, im)
    add(y, thump(r, 0.9, f=170, dur=0.15, tau=0.025), im)
    add(y, flap(r, 1600, 0.35, 10), im)
    add(y, crumple(r, 0.03, ramp_env(secs(0.03), 0.0005, 0.006), rate=2500, fc_lo=1500, fc_hi=6000, rustle=0) * 0.3, im)
    # rubber peels off the paper
    add(y, lp(crumple(r, 0.04, np.sin(np.pi * np.linspace(0, 1, secs(0.04))), rate=3000, fc_lo=800, fc_hi=3000,
                      rustle=0.05), 3000) * 0.18, im + secs(0.13))
    # the sheet settles
    d = 0.3
    add(y, crumple(r, d, np.exp(-tvec(secs(d)) / 0.1), rate=300, fc_lo=1500, fc_hi=6000, alpha=2.3, rustle=0.03) * 0.12,
        im + secs(0.2))
    add(y, flap(r, 1300, 0.08, 18), im + secs(0.26))
    return mono_rev(y, ir("classroom"), 0.15)


def stinger_rush():
    r = rng(4301)
    dur = 1.2
    n = secs(dur)
    t = tvec(n)
    env = np.minimum(1, t / 0.03) * (0.35 + 0.65 * np.exp(-t / 0.3)) * np.minimum(1, (dur - t) / 0.35)
    roar = norm(crumple(r, dur, env, rate=9000, fc_lo=400, fc_hi=9000, alpha=1.4, dms=(0.5, 6), echo=0.7, body=0.5,
                        rustle=0.25)[:n])
    low = nstd(lp(r.standard_normal(n), 400) + 0.7 * bp(r.standard_normal(n), 80, 300)) * env
    nh = secs(0.9)
    th = tvec(nh)
    boom = np.sin(TAU * np.cumsum(32 + 30 * np.exp(-th / 0.1)) / SR) * np.exp(-th / 0.25) * (1 - np.exp(-th / 0.002))
    y = np.zeros(n + secs(0.05))
    add(y, roar, 0)
    add(y, norm(low) * 0.5, 0)
    add(y, norm(boom) * 1.0, 0)
    add(y, thump(r, 0.8, f=150, dur=0.25, tau=0.05), 0)
    add(y, click(r, 0.6, 3000, 2.0), 0)
    y = np.tanh(2.5 * norm(y))
    return hp(y, 30)


def page_turn():
    r = rng(4401)
    n = secs(1.4)
    y = np.zeros(n)
    d = 0.22
    add(y, crumple(r, d, np.sin(np.pi * np.linspace(0, 1, secs(d))), rate=400, fc_lo=2000, fc_hi=6000, alpha=2.0,
                   rustle=0.03) * 0.35, 0)
    ns = secs(0.75)
    xx = np.linspace(0, 1, ns)
    fc = 1500 * (2.3 ** np.sin(np.pi * xx * 0.9))
    add(y, swoosh(r, np.sin(np.pi * xx) ** 1.2, fc, width=0.5) * 0.7, secs(0.12))
    add(y, crumple(r, 0.75, np.sin(np.pi * xx) ** 2, rate=180, fc_lo=1500, fc_hi=5000, alpha=2.2, rustle=0.02) * 0.25,
        secs(0.12))
    fl = secs(0.88)
    add(y, flap(r, 1300, 0.5, 20), fl)
    add(y, thump(r, 0.12, f=300, dur=0.05, tau=0.008), fl)
    add(y, crumple(r, 0.03, ramp_env(secs(0.03), 0.0005, 0.008), rate=2000, fc_lo=1500, fc_hi=5000, rustle=0) * 0.2, fl)
    add(y, flap(r, 1700, 0.15, 14), fl + secs(0.07))
    return y


# ----------------------------------------------------------------------------
# registry: name -> (builder, kind, loop, level dB, trigger, description)
# kind: music (RMS, exact length), bed (loop, RMS over the loop), sfx (max 100 ms RMS)
# ----------------------------------------------------------------------------
SOUNDS = {
    "hymn_70s": (hymn_70s, "music", False, -24,
                 "Plays over the PA at the start of each run (the 70-second 'home time' countdown).",
                 "Children's choir on 'ooh' (9 sopranos + 5 altos in thirds, detuned, gentle vibrato, scoops, timing drift) singing a four-line F-major hymn with one note per line sung a semitone flat (Ab, Db, Db, Eb); hall reverb, band-limited 300-4000 Hz through a cheap overdriven speaker with dust crackle and hiss; final F chord held over the last 6 s and faded. Exactly 70.000 s."),
    "hymn_slow": (hymn_slow, "music", False, -25,
                  "'Lights out' version: replace hymn_70s when the school goes dark.",
                  "The same hymn re-sung 15% slower and 1.5 semitones lower, wider vibrato, a slow seasick tape wow, longer darker hall, duller (300-3200 Hz) and more overdriven speaker. Final chord fades over the last ~7 s."),
    "corridor_hum": (corridor_hum, "bed", True, -32, "Base bed in corridors.",
                     "Fluorescent tube hum (50 Hz mains, strong 100 Hz and harmonics, faint ballast sizzle, slowly breathing), soft ventilation air, three distant wooden building creaks in a long corridor reverb."),
    "room_tone": (room_tone, "bed", True, -40, "Base bed inside classrooms at night.",
                  "Almost-silence: low air, faint far hum through the wall, and an old radiator ticking in small irregular clusters with the odd deeper pipe 'tonk'."),
    "bell_loop": (bell_loop, "bed", True, -22, "The school bell ringing (loop for as long as it rings).",
                  "Old electric bell: a striker hammering a ~1.2 kHz gong 21 times a second, beating metallic partials, armature chatter, overdriven and harsh, light corridor reverb."),
    "pencils_loop": (pencils_loop, "bed", True, -32, "A class (of paper children) writing; scale with how many are writing.",
                     "Fourteen pencils near and far scratching words in strokes on paper: band-noise friction, gritty graphite ticks, a little desk body, small classroom reverb."),
    "keys_loop": (keys_loop, "bed", True, -28, "The Headmaster walking (attach to him; gain by distance).",
                  "A heavy bunch of keys jangling at a slow walking pace (8 steps per 6 s): a cluster of key hits on each heel strike, a smaller swing-back, restless tinkle between, the duller ring, a faint cloth swish."),
    "light_buzz_loop": (light_buzz_loop, "bed", True, -30, "A failing ceiling light; attach to the fitting.",
                        "Harsh 100 Hz tube buzz with arcing sizzle that stutters off and on in three bursts, drops out once and re-strikes with a flash, starter ticks on re-strike; the ballast hum stays underneath."),
    "story_murmur_loop": (story_murmur_loop, "bed", True, -32, "Story time heard through a classroom wall.",
                          "A woman reading aloud in four phrases with falling intonation - formant-synthesised babble, no real words - in the next room, through a wall (low-passed at 700 Hz), unintelligible."),
    "snore_loop": (snore_loop, "bed", True, -30, "Something asleep (the Headmaster in his office?).",
                   "Two slow deep snores: a fluttering soft-palate rattle on the in-breath, an airy nasal exhale with a lip 'puh', quiet room between."),
    "chalk_squeak_1": (chalk(3001, [(0.0, 0.32), (0.4, 0.18), (0.62, 0.45)], []), "sfx", False, -22,
                       "Teacher writing on the board (randomise 1-3).", "Three chalk strokes: gritty stick-slip chatter on the board, dry and scratchy."),
    "chalk_squeak_2": (chalk(3002, [(0.0, 0.25), (0.3, 0.5), (0.9, 0.2), (1.15, 0.35)], [(0.42, 0.22, 2650)]), "sfx", False,
                       -22, "Teacher writing.", "Four strokes; the second one squeals briefly."),
    "chalk_squeak_3": (chalk(3003, [(0.0, 0.6), (0.7, 0.3), (1.1, 0.8), (2.0, 0.25)], [(0.1, 0.35, 3150), (1.35, 0.5, 2400)]),
                       "sfx", False, -21, "Teacher writing (the nasty one).", "Long strokes with two full squeals - the one that sets your teeth on edge."),
    "chalk_stop": (chalk_stop, "sfx", False, -25, "Teacher stops writing / puts the chalk down (a cue to hide).",
                   "Chalk set down on the wooden ledge: a small hard tap, a tiny scrape, a tick as it settles."),
    "paper_pick_1": (paper_pick(3201, 0.35), "sfx", False, -27, "Picking up a sheet (randomise 1-3).",
                     "Slide off the desk, a quick crackle and a soft air 'whomp' as the sheet flexes."),
    "paper_pick_2": (paper_pick(3202, 0.5), "sfx", False, -27, "Picking up a sheet.", "As 1, slower lift, more crackle."),
    "paper_pick_3": (paper_pick(3203, 0.42), "sfx", False, -27, "Picking up a sheet.", "As 1, different crackle pattern."),
    "desk_lid": (desk_lid, "sfx", False, -19, "Opening/searching a desk.",
                 "Lid lifted with a small knock and a hinge creak, contents shuffle, then dropped: a hollow wooden slam, hinge clank, pencils jumping inside."),
    "chair_scrape": (chair_scrape, "sfx", False, -22, "A chair moves (by itself).",
                     "Three chair legs juddering across a wooden floor (stick-slip chatter) with friction noise."),
    "door_open": (door_open, "sfx", False, -22, "Classroom door opens.",
                  "Handle and latch clack, then a long old-hinge creak that rises and wavers, with the door's air."),
    "door_shut": (door_shut, "sfx", False, -18, "Classroom door shuts.",
                  "Swing air, short creak, a heavy wooden thud, the latch catching and the glass pane rattling, corridor reverb."),
    "door_lock": (door_lock, "sfx", False, -23, "A door is locked (you are locked in).",
                  "Key sliding in over the pins, seated tick, a turn with friction and ratchet ticks, the bolt clunking home."),
    "locker_open": (locker_open, "sfx", False, -23, "Opening a locker (hiding place).",
                    "Thin latch clack, a wobbling sheet-metal (paper-ish) door with a small squeak and paper rustle, bumping against its neighbour."),
    "locker_shut": (locker_shut, "sfx", False, -19, "Locker slammed / closing yourself in.",
                    "Thin, wobbling metal clang with the latch catching, a papery crunch and flutter."),
    "cane_tap_1": (cane_tap(3701), "sfx", False, -21, "The Headmaster's cane on the floor (randomise 1-3).",
                   "Hard wooden tap on a hard floor, ringing down the corridor."),
    "cane_tap_2": (cane_tap(3702, f_scale=1.12), "sfx", False, -21, "Cane tap.", "As 1, a slightly higher, harder knock."),
    "cane_tap_3": (cane_tap(3703, bounce=True, f_scale=0.92), "sfx", False, -21, "Cane tap.",
                   "As 1, a lower knock with a small bounce."),
    "hm_step_1": (hm_step(3711), "sfx", False, -21, "Headmaster footsteps (cycle 1-4, slow).",
                  "Leather heel click and thud, then the sole slap, in the corridor."),
    "hm_step_2": (hm_step(3712, heel_f=100, scuff=True), "sfx", False, -21, "Headmaster footstep.",
                  "Heavier, with a gritty scuff."),
    "hm_step_3": (hm_step(3713, heel_f=120, creaky=True, slap_t=0.13), "sfx", False, -21.5, "Headmaster footstep.",
                  "With a small leather creak, later sole slap."),
    "hm_step_4": (hm_step(3714, heel_f=105, scuff=True, creaky=True, slap_t=0.095), "sfx", False, -21,
                  "Headmaster footstep.", "Scuff and creak, quick roll."),
    "light_clunk": (light_clunk, "sfx", False, -19, "A ceiling light dies.",
                    "Tube hum, then a heavy relay clunk with contact bounce; the hum sags and dies in ~0.4 s, a cooling tick."),
    "shriek": (shriek, "sfx", False, -11, "THE jump scare: the teacher shrieks.",
               "Instant attack: a rising (430 Hz to ~1.4 kHz), jittery, doubled formant scream with a sub-octave growl, ring-mod edge and breath, paper tearing through it, a sub hit underneath, heavily overdriven, choked off at 1.5 s."),
    "crack_chorus": (crack_chorus, "sfx", False, -16, "All the paper children turn their heads at once.",
                     "~50 dry paper-neck cracks inside 120 ms over a crumple burst and a low mass thump, then a soft paper settle."),
    "whisper_name": (whisper_name, "sfx", False, -24, "Someone whispers your name, right behind you (stereo, slightly right).",
                     "Breathy unvoiced two-syllable whisper ('sh/h-ah . l-ee'), unclear, close to the ear, breath on the ear, panned right with a tiny interaural delay."),
    "stamp": (stamp, "sfx", False, -21, "Gold-star reward stamped on your sheet.",
              "Rubber stamp thumped onto paper on a desk, a sticky peel, the sheet settling."),
    "stinger_rush": (stinger_rush, "sfx", False, -12, "Generic jump-scare stinger (something rushes you).",
                     "Violent roar of crumpling paper with a low body, a dropping sub boom and hit, overdriven."),
    "page_turn": (page_turn, "sfx", False, -27, "A page of the register / storybook turns.",
                  "Corner lifted with small crackles, a slow sliding bend, then the page flops over and settles."),
}


# ----------------------------------------------------------------------------
# finishing and export
# ----------------------------------------------------------------------------
def finish(name, x, kind, loop, level):
    x = np.asarray(x, dtype=np.float64)
    if kind == "sfx" and not loop:
        x = hp(x, 35)
        env = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
        last = np.nonzero(env > env.max() * db(-70))[0][-1]
        x = x[: min(len(x), last + secs(0.03))]
        x = fade(x, 0.0005, 0.03)
        pre = np.zeros((secs(0.002),) + x.shape[1:])
        x = np.concatenate([pre, x])
        g = db(level) / (short_rms(x, 0.1).max() + 1e-12)
    else:
        x = x - x.mean(axis=0)
        g = db(level) / (rms(x) + 1e-12)
    x = x * g
    pk = peak(x)
    if pk > db(PEAK_CAP):
        x *= db(PEAK_CAP) / pk
    return x


def write_readme(rows):
    lines = [
        "# Home Time - school audio",
        "",
        "Original sound set for the haunted paper school. Every file is synthesised from scratch by",
        "`src/make_school_audio.py` (numpy + scipy, fixed seeds, no samples, no recordings, no downloads).",
        "It reuses the forest set's paper / metal / reverb primitives from `../src/make_audio.py`.",
        "",
        "```",
        "python assets/audio/school/src/make_school_audio.py               # everything (~4 min; the hymns are the slow part)",
        "python assets/audio/school/src/make_school_audio.py --only shriek bell_loop",
        "python assets/audio/school/src/check_school_audio.py              # durations, peaks, RMS, loop seams",
        "```",
        "",
        "## Conventions",
        "",
        "- Ogg Vorbis q5, 44.1 kHz, mono (only `whisper_name` is stereo). Same as the forest set.",
        "- Loops are built circularly: anything that runs past the end wraps round to the start, noise",
        "  beds are FFT-shaped, tones have whole cycles per loop, filters / resonators / reverb run",
        "  circularly. That is an exact crossfade of the loop's own tail into its head, so the seam is",
        "  continuous. Loud events are kept away from the seam. Loop files carry `LOOPSTART`/`LOOPLENGTH`",
        "  tags. In Web Audio use `AudioBufferSourceNode.loop = true`.",
        "- `hymn_70s` is exactly 70.000 s (3,087,000 samples) and is NOT a loop; nor is `hymn_slow`.",
        "- Levels: hymns -24/-25 dBFS RMS; beds -22 (bell) ... -40 (room tone) dBFS RMS; SFX normalised on",
        "  their loudest 100 ms (-27 small ... -11 for the shriek). All peaks at or below -1 dBFS.",
        "  Suggested starting gains: hymn 0.7, beds 0.7, SFX 1.0; duck everything under `shriek`.",
        "",
        "## Files",
        "",
        "| File | Duration | Loop | What it is for | How it sounds |",
        "|---|---|---|---|---|",
    ]
    for fname, dur, loop, trig, desc in rows:
        lines.append(f"| `{fname}` | {dur:.2f} s | {'yes' if loop else 'no'} | {trig} | {desc} |")
    lines += [
        "",
        "## Notes",
        "",
        "- Variants (chalk, paper_pick, cane_tap, hm_step): randomise and add +-3% pitch, +-2 dB gain.",
        "- `hymn_70s` and `hymn_slow` are the same arrangement; to switch at 'lights out', crossfade at the",
        "  same musical position (time x 1/0.85).",
        "- Sources and licence: see `../CREDITS.md`.",
        "",
        "## Known weak spots (checked by analysis and spectrograms, not yet by ear)",
        "",
        "- The choir is additive formant synthesis: through the band-limited speaker it reads as a distant",
        "  'ooh' choir, but up close it is purer and more organ-like than real children.",
        "- `story_murmur_loop` and `whisper_name` are formant babble: they read as voice-like through the",
        "  wall / as a whisper, but have no real consonant articulation.",
        "- `shriek` is a synthetic scream; it is loud, harsh and wrong, but not a convincing human scream.",
        "- `snore_loop` is a noise-flutter model; at high gain it can sound more like a growl than a snore.",
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
        out = B.encode(x, OUT_DIR / name, loop)
        if args.wav:
            wd = HERE / "_wav"
            wd.mkdir(exist_ok=True)
            sf.write(wd / f"{name}.wav", x.astype(np.float32), SR, subtype="FLOAT")
        print(f"{name:20s} {len(x) / SR:7.3f}s  peak {todb(peak(x)):6.1f} dBFS  rms {todb(rms(x)):6.1f} dBFS"
              f"  -> {out.name}", flush=True)
    rows = []
    for name, (fn, kind, loop, level, trig, desc) in SOUNDS.items():
        f = OUT_DIR / f"{name}.ogg"
        if f.exists():
            rows.append((f.name, B._probe_dur(f), loop, trig, desc))
    write_readme(rows)


if __name__ == "__main__":
    sys.exit(main())
