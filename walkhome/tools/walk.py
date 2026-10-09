"""Playtest by walking: open the game with the autopilot (or a scripted input) and take a frame
every few seconds, logging the boy, Biscuit, the director and the frame rate.

python tools/walk.py <outdir> [seconds_between] [count] [extra query] [js to run first]
"""
import base64, sys, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
every = float(sys.argv[2]) if len(sys.argv) > 2 else 3
count = int(sys.argv[3]) if len(sys.argv) > 3 else 6
extra = sys.argv[4] if len(sys.argv) > 4 else ""
pre = sys.argv[5] if len(sys.argv) > 5 else ""
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e) + " | " + str(getattr(e, "stack", ""))[:600]))
    pg.on("console", lambda m: errs.append(m.type + ": " + m.text[:200]) if m.type == "error" and "404" not in m.text else None)
    pg.goto(f"http://localhost:5184/?go&shots&stats&auto{('&' + extra) if extra else ''}")
    pg.wait_for_function("window.__wh && __wh.segs.size > 3", timeout=120000)
    if pre: pg.evaluate(pre)
    for i in range(count):
        time.sleep(every)
        url = pg.evaluate("__wh.renderer.domElement.toDataURL('image/png')")
        (OUT / f"{i:02d}.png").write_bytes(base64.b64decode(url.split(",", 1)[1]))
        info = pg.evaluate("""({ s: +__wh.player.s.toFixed(1), l: +__wh.player.l.toFixed(2), dog: __wh.dog.state, carried: __wh.dog.carried, fear: +__wh.dog.fear.toFixed(2), tension: +__wh.dog.tension.toFixed(2),
            fps: +__wh.fps().toFixed(0), scale: __wh.post.scale, calls: __wh.renderer.info.render.calls, ev: __wh.events.splice(0).map(e => e.name).join(',') ,
            dir: __wh.director ? __wh.director.phase + ' ' + __wh.director.fear.toFixed(2) : '' })""")
        print(i, json.dumps(info))
    print("errors:", errs[:6])
    b.close()
