"""Throwaway: the sameness grid (research/07 phase 7). Drop the camera into N random corridors (any
wing, any time of night), look down an arm, and tile the frames into one image. If two tiles could
be swapped without anyone noticing, the school is still too uniform.

python school/tools/sameness.py <out.jpg> [n=12] [seed=11]   (dev server on :5182)
"""
import sys, time, random
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

out = Path(sys.argv[1]); n = int(sys.argv[2]) if len(sys.argv) > 2 else 12; seed = sys.argv[3] if len(sys.argv) > 3 else "11"
rnd = random.Random(int(seed))
tiles = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    pg = b.new_page(viewport={"width": 960, "height": 540})
    pg.goto(f"http://localhost:5182/?auto&seed={seed}")
    pg.wait_for_function("window.__gn && window.__fps", timeout=240000)
    pg.evaluate("document.getElementById('controls').style.display = 'none'; document.getElementById('hands').style.display = 'none'")
    for k in range(n):
        i, j, minutes = rnd.randint(-12, 12), rnd.randint(-12, 12), rnd.choice([65, 100, 140, 185])
        info = pg.evaluate(f"""(() => {{ const S = __gn.S, L = __gn.world.layout, c = L.chunk(0, {i}, {j}); S.clock.minutes = {minutes}; S.director.nextPatrol = 1e9;
          const arms = c.corridors.filter((x) => x.arm), k = arms[{k} % arms.length], v = {{ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }}[k.arm];
          Object.assign(S.player, {{ x: c.x0 + 12 + v[0] * 2, z: c.z0 + 12 + v[1] * 2, floor: 0, pitch: 0.04, yaw: {{ N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }}[k.arm] }});
          const a = S.layout.anomalies?.[c.key + '@' + c.epoch]; return c.wing + ' ' + Math.floor({minutes} / 60) + ':' + String({minutes} % 60).padStart(2, '0') + (a ? ' ' + a.kind : ''); }})()""")
        time.sleep(1.4)
        path = out.parent / f"_same_{k}.png"
        pg.screenshot(path=str(path))
        tiles.append((path, info))
        print(k, info, flush=True)
    b.close()
cols = 4; rows = (len(tiles) + cols - 1) // cols
W = Image.new("RGB", (cols * 480, rows * 270))
from PIL import ImageDraw
for idx, (p, info) in enumerate(tiles):
    im = Image.open(p).resize((480, 270)); ImageDraw.Draw(im).text((8, 6), info, fill=(230, 220, 200))
    W.paste(im, ((idx % cols) * 480, (idx // cols) * 270)); p.unlink()
W.save(out, quality=82)
print("saved", out)
