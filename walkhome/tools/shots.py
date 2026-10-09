"""Playtest camera: open the game, stand at places along the road, screenshot, report fps and errors.

python tools/shots.py <outdir> [view ...]     (npm run dev on :5184)
A view is  name:s:l:yaw:pitch[:fear][:wait]   e.g.  start:2:3.6:0:0   back:40:2:3.14:0:0.8
With no views, a default tour of the road.
"""
import os as _os; PORT = _os.environ.get("WH_PORT", "5184")
import base64, sys, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
TOUR = ["start:2:3.6:0:-0.02", "garden:30:4.4:-1.2:0.1", "upstreet:80:1.2:0:0.05", "look_back:120:-2:3.14:0", "long:330:2:0:0.05",
        "high:700:2.5:0.2:0.02", "park:1050:1:0:0", "bridge:1100:0:0:0", "hill:1330:1:0:0.1"]
views = sys.argv[2:] or TOUR
q = "go&shots&stats&fixres"
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    pg.goto(f"http://localhost:{PORT}/?{q}")
    pg.wait_for_function("window.__wh && __wh.segs.size > 3", timeout=120000)
    time.sleep(2)
    for v in views:
        parts = v.split(":")
        name, s, l, yaw, pitch = parts[0], float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        fear = float(parts[5]) if len(parts) > 5 else 0
        wait = float(parts[6]) if len(parts) > 6 else 2.5
        pg.evaluate(f"__wh.fear.force = {fear} || undefined; __wh.put({s}, {l}, {yaw}, {pitch}); __wh.dog.x = __wh.player.x + Math.cos(__wh.player.yaw)*0.5 - Math.sin(__wh.player.yaw)*2.2; __wh.dog.z = __wh.player.z - Math.sin(__wh.player.yaw)*0.5 - Math.cos(__wh.player.yaw)*2.2;")
        time.sleep(wait)
        url = pg.evaluate("__wh.renderer.domElement.toDataURL('image/png')")
        (OUT / f"{name}.png").write_bytes(base64.b64decode(url.split(",", 1)[1]))
        info = pg.evaluate("({fps: __wh.fps(), calls: __wh.renderer.info.render.calls, tris: __wh.renderer.info.render.triangles, segs: __wh.segs.size})")
        print(name, json.dumps(info))
    print("errors:", errs[:8], "(total", len(errs), ")")
    b.close()
