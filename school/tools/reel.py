"""Throwaway: a playtest reel. A scripted agent plays the real game; a frame every few seconds, tiled
with the clock, the director's phase and tension, and the latest events, so a stretch of night can be
judged at a glance (pacing: does something happen? does tension build and release?).

python school/tools/reel.py <out.jpg> [agent=wander] [minutes=5] [every=20] [seed=11] [start clock minutes=60]
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

out = Path(sys.argv[1]); agent = sys.argv[2] if len(sys.argv) > 2 else "wander"
minutes = float(sys.argv[3]) if len(sys.argv) > 3 else 5; every = float(sys.argv[4]) if len(sys.argv) > 4 else 20
seed = sys.argv[5] if len(sys.argv) > 5 else "11"; start = int(sys.argv[6]) if len(sys.argv) > 6 else 60
tiles = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    pg = b.new_page(viewport={"width": 960, "height": 540})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://localhost:5182/?agent={agent}&seed={seed}")
    pg.wait_for_function("window.__gn && window.__fps", timeout=240000)
    pg.evaluate("""window.__evlog = []; __gn.onEvent((e) => { if (!['step', 'use', 'useNothing', 'writing', 'clockMinute', 'paperTaken'].includes(e.type)) { __evlog.push(e.type + (e.kind ? ':' + e.kind : '') + (e.mode ? ':' + e.mode : '') + (e.scene ? ':' + e.scene : '')); if (__evlog.length > 6) __evlog.shift(); } });
      document.getElementById('controls').style.display = 'none';""")
    pg.evaluate(f"__gn.S.clock.minutes = {start}")
    t0 = time.time(); k = 0
    while time.time() - t0 < minutes * 60:
        time.sleep(every)
        info = pg.evaluate("""(() => { const S = __gn.S, D = S.director; const m = S.clock.minutes; return [Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0'), D.phase, Math.round(D.tension), S.phase, S.held.stars, S.player.room ? (S.rooms[S.player.room]?.scene || S.rooms[S.player.room]?.roll?.lesson) : '', __evlog.slice(-4).join(' ')]; })()""")
        path = out.parent / f"_reel_{k}.png"; pg.screenshot(path=str(path)); tiles.append((path, info)); k += 1
        print(int(time.time() - t0), info, flush=True)
    b.close()
cols = 4; rows = (len(tiles) + cols - 1) // cols
W = Image.new("RGB", (cols * 480, rows * 270))
for i, (p, info) in enumerate(tiles):
    im = Image.open(p).resize((480, 270)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 480, 30), fill=(0, 0, 0)); d.text((6, 2), f"{info[0]} {info[1]} t={info[2]} {info[3]} *{info[4]} {info[5]}", fill=(240, 220, 160)); d.text((6, 16), info[6][:80], fill=(200, 200, 200))
    W.paste(im, ((i % cols) * 480, (i // cols) * 270)); p.unlink()
W.save(out, quality=80)
print("saved", out, "errors:", errs[:3])
