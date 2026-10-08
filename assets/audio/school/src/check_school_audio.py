#!/usr/bin/env python3
"""Analyse and assert the Home Time school audio (decoded through ffmpeg, i.e. what the game hears).

    python assets/audio/school/src/check_school_audio.py [--png DIR]

Per file: duration, channels, peak dBFS, RMS dBFS, loudest 100 ms. For loops also the
seam: RMS of the first and last 50 ms (must be within 6 dB of each other; levels more
than 20 dB under the file's RMS count as 'silent' and are clamped to that floor) and the
sample jump across the loop point vs the file's own 99.9th-percentile sample step.

Asserts: every listed file exists, hymn_70s is 70.0 +- 0.05 s, loops are seamless,
all peaks <= -0.5 dBFS, 44.1 kHz, total folder size < 12 MB. Exit code 1 on failure.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 44100
AUDIO = Path(__file__).resolve().parent.parent  # assets/audio/school

LOOPS = ["corridor_hum", "room_tone", "bell_loop", "pencils_loop", "keys_loop", "light_buzz_loop",
         "story_murmur_loop", "snore_loop"]
ONESHOTS = ["hymn_70s", "hymn_slow",
            "chalk_squeak_1", "chalk_squeak_2", "chalk_squeak_3", "chalk_stop",
            "paper_pick_1", "paper_pick_2", "paper_pick_3", "desk_lid", "chair_scrape",
            "door_open", "door_shut", "door_lock", "locker_open", "locker_shut",
            "cane_tap_1", "cane_tap_2", "cane_tap_3", "hm_step_1", "hm_step_2", "hm_step_3", "hm_step_4",
            "light_clunk", "shriek", "crack_chorus", "whisper_name", "stamp", "stinger_rush", "page_turn"]
STEREO = {"whisper_name"}
PEAK_MAX = -0.5       # dBFS
SEAM_DB = 6.0         # max level difference first vs last 50 ms
SEAM_FLOOR = 20.0     # dB under file RMS counted as silence
MAX_MB = 12.0


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


def rms(x):
    return float(np.sqrt((x ** 2).mean()))


def short_max(x, n):
    m = (x ** 2).mean(axis=1)
    c = np.cumsum(np.concatenate([[0], m]))
    return float(np.sqrt(np.maximum((c[n:] - c[:-n]) / n, 0)).max()) if len(m) > n else rms(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", help="write waveform + spectrogram PNGs here")
    args = ap.parse_args()
    fails = []
    total = 0
    print(f"{'file':22s} {'dur s':>8s} ch {'peak':>6s} {'rms':>6s} {'max100':>6s}   loop seam: first50/last50 dB, diff, jump/step")
    for name in ONESHOTS + LOOPS:
        f = AUDIO / f"{name}.ogg"
        if not f.exists():
            fails.append(f"{name}: missing")
            print(f"{name + '.ogg':22s} MISSING")
            continue
        total += f.stat().st_size
        x, sr = decode(f)
        dur = len(x) / sr
        pk = db(np.abs(x).max())
        r = db(rms(x))
        line = f"{f.name:22s} {dur:8.3f} {x.shape[1]:2d} {pk:6.1f} {r:6.1f} {db(short_max(x, int(0.1 * sr))):6.1f}"
        if sr != SR:
            fails.append(f"{name}: sample rate {sr}")
        want_ch = 2 if name in STEREO else 1
        if x.shape[1] != want_ch:
            fails.append(f"{name}: {x.shape[1]} channels, expected {want_ch}")
        if pk > PEAK_MAX:
            fails.append(f"{name}: peak {pk:.2f} dBFS > {PEAK_MAX}")
        if name == "hymn_70s" and abs(dur - 70.0) > 0.05:
            fails.append(f"{name}: duration {dur:.3f} s, expected 70.0 +- 0.05")
        if name in LOOPS:
            n = int(0.05 * sr)
            floor = r - SEAM_FLOOR
            a, b = max(db(rms(x[:n])), floor), max(db(rms(x[-n:])), floor)
            jump = np.abs(x[0] - x[-1]).max()
            step = np.percentile(np.abs(np.diff(x, axis=0)), 99.9)
            ratio = jump / (step + 1e-12)
            line += f"   {a:6.1f} / {b:6.1f}  {abs(a - b):4.1f}  {ratio:5.2f}"
            if abs(a - b) > SEAM_DB:
                fails.append(f"{name}: loop edges differ by {abs(a - b):.1f} dB")
            if ratio > 1.0:
                fails.append(f"{name}: sample jump at loop point {ratio:.2f} x p99.9 step")
        print(line)
        if args.png:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            out = Path(args.png)
            out.mkdir(parents=True, exist_ok=True)
            m = x.mean(axis=1)
            fig, ax = plt.subplots(2, 1, figsize=(12, 5), sharex=True)
            t = np.arange(len(m)) / sr
            step_ = max(1, len(m) // 40000)
            ax[0].plot(t[::step_], m[::step_], lw=0.4)
            ax[0].set_ylim(-1, 1)
            ax[1].specgram(m, NFFT=2048 if len(m) > sr * 5 else 512, Fs=sr, cmap="magma", vmin=-140)
            ax[1].set_ylim(0, 12000)
            ax[0].set_title(f.name)
            fig.tight_layout()
            fig.savefig(out / f"{name}.png", dpi=80)
            plt.close(fig)
    mb = total / 1e6
    print(f"\n{len(ONESHOTS + LOOPS)} files expected, {mb:.2f} MB total")
    if mb > MAX_MB:
        fails.append(f"total size {mb:.2f} MB > {MAX_MB} MB")
    if fails:
        print("\nFAILED:")
        for s in fails:
            print("  - " + s)
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
