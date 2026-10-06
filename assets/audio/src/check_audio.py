#!/usr/bin/env python3
"""Analyse the exported GameNet audio (decoded through ffmpeg, i.e. what the game hears).

    python assets/audio/src/check_audio.py [--png DIR]

Per file: duration, channels, peak, clipping, RMS, loudest 100 ms, DC offset,
first/last sample, and for loops a seam test: the sample jump across the loop
point vs the file's own 99.9th-percentile sample step, and the high-frequency
(>6 kHz) energy in a 5 ms window straddling the seam vs the file's median, which
is where a click would show. --png writes spectrograms for eyeballing.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
AUDIO = Path(__file__).resolve().parent.parent
LOOPS = {"music_calm", "music_dread", "amb_wind_paper", "amb_leaves_rustle", "amb_mist", "sfx_entity_near"}


def decode(path):
    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,sample_rate",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout)["streams"][0]
    ch = int(info["channels"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, ch)
    return x, int(info["sample_rate"])


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def short_max(m, n):
    c = np.cumsum(np.concatenate([[0], m ** 2]))
    return np.sqrt(np.maximum((c[n:] - c[:-n]) / n, 0)).max()


def seam(x):
    """(jump / p99.9 step, HF energy at seam vs median in dB)."""
    jump = np.abs(x[0] - x[-1]).max()
    step = np.percentile(np.abs(np.diff(x, axis=0)), 99.9)
    sos = signal.butter(4, 6000, "highpass", fs=SR, output="sos")
    w = 4096
    wrapped = np.concatenate([x[-w:], x[:w]], axis=0)
    h = signal.sosfilt(sos, np.concatenate([x[-3 * w:], x[:w]], axis=0), axis=0)[2 * w:]  # warm filter
    win = int(0.005 * SR)
    e_seam = np.sqrt((h[w - win // 2: w + win // 2] ** 2).mean())
    hh = signal.sosfilt(sos, x, axis=0)
    segs = hh[: len(hh) // win * win].reshape(-1, win, x.shape[1])
    e_all = np.sqrt((segs ** 2).mean(axis=(1, 2)))
    del wrapped
    # percentile rank of the seam window among all 5 ms windows (a click would sit at ~100)
    return jump / (step + 1e-12), db(e_seam) - db(np.median(e_all)), 100 * (e_all < e_seam).mean()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", help="write spectrogram PNGs here")
    args = ap.parse_args()
    files = sorted(list(AUDIO.glob("*.ogg")) + list(AUDIO.glob("*.wav")))
    bad = 0
    total = 0
    print(f"{'file':24s} {'dur':>7s} ch {'peak':>6s} clip {'rms':>6s} {'max100':>6s} {'dc':>8s} "
          f"{'first':>7s} {'last':>7s}  seam(jump/step, HF dB vs median, HF percentile)")
    for f in files:
        total += f.stat().st_size
        x, sr = decode(f)
        assert sr == SR
        name = f.stem
        pk = np.abs(x).max()
        clip = int((np.abs(x) >= 0.999).sum())
        mono = np.sqrt((x ** 2).mean(axis=1))
        dc = np.abs(x.mean(axis=0)).max()
        first, last = np.abs(x[0]).max(), np.abs(x[-1]).max()
        line = (f"{f.name:24s} {len(x) / SR:7.3f} {x.shape[1]:2d} {db(pk):6.1f} {clip:4d} "
                f"{db(np.sqrt((x ** 2).mean())):6.1f} {db(short_max(mono, int(0.1 * SR))):6.1f} {dc:8.1e} "
                f"{first:7.4f} {last:7.4f}")
        flags = []
        if pk > 10 ** (-1 / 20) + 1e-3:
            flags.append("PEAK>-1dB")
        if clip:
            flags.append("CLIP")
        if dc > 1e-3:
            flags.append("DC")
        if name in LOOPS:
            j, hf, pct = seam(x)
            line += f"  {j:5.2f} {hf:+5.1f} (p{pct:.0f})"
            if j > 1.0 or (hf > 6 and pct > 99.5):
                flags.append("SEAM?")
        else:
            if first > 0.01 or last > 0.01:
                flags.append("EDGE")
        if flags:
            bad += 1
            line += "  <-- " + ",".join(flags)
        print(line)
        if args.png:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            out = Path(args.png)
            out.mkdir(parents=True, exist_ok=True)
            m = x.mean(axis=1)
            fig, ax = plt.subplots(2, 1, figsize=(12, 5), sharex=True)
            t = np.arange(len(m)) / SR
            ax[0].plot(t[::20], m[::20], lw=0.4)
            ax[0].set_ylim(-1, 1)
            ax[1].specgram(m, NFFT=2048 if len(m) > SR * 5 else 512, Fs=SR, noverlap=None, cmap="magma",
                           vmin=-140)
            ax[1].set_ylim(0, 12000)
            ax[0].set_title(f.name)
            fig.tight_layout()
            fig.savefig(out / f"{name}.png", dpi=80)
            plt.close(fig)
    print(f"\n{len(files)} files, {total / 1e6:.2f} MB total, {bad} flagged")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
