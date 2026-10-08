"""Throwaway: let a scripted agent play the real game in a browser for N minutes; report errors and fps.

python school/tools/soak.py [agent] [minutes] [seed]   (dev server on :5182)
"""
import sys, time
from playwright.sync_api import sync_playwright

agent = sys.argv[1] if len(sys.argv) > 1 else "lesson"
minutes = float(sys.argv[2]) if len(sys.argv) > 2 else 5
seed = sys.argv[3] if len(sys.argv) > 3 else "11"
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    pg = b.new_page(viewport={"width": 1280, "height": 760})
    errs, fps, calls = [], [], []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and "404" not in m.text and errs.append(m.text))
    pg.goto(f"http://localhost:5182/?agent={agent}&seed={seed}")
    pg.wait_for_function("window.__gn && window.__fps", timeout=240000)
    t0 = time.time()
    while time.time() - t0 < minutes * 60:
        time.sleep(10)
        f, c, ph, st, cm = pg.evaluate("[window.__fps, __gn.renderer.info.render.calls, __gn.S.phase, __gn.S.held.stars, +__gn.S.clock.minutes.toFixed(1)]")
        fps.append(f); calls.append(c)
        print(f"  t={int(time.time()-t0)}s fps={f} calls={c} phase={ph} stars={st} clock={cm}", flush=True)
    pg.screenshot(path=str(__import__("pathlib").Path(__import__("tempfile").gettempdir()) / "soak_last.png"))
    print("fps min/avg:", min(fps), round(sum(fps) / len(fps)), "calls max:", max(calls), "errors:", errs[:5])
    b.close()
