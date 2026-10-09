"""Throwaway: render each style mockup and save it.  python shot.py <outdir> [style ...]  (npm run dev on :5183)"""
import base64, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
styles = sys.argv[2:] or ["retro", "diorama", "torch", "silhouette"]
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    for st in styles:
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:5183/?style={st}")
        pg.wait_for_function("document.body.dataset.ready === '1'", timeout=240000)
        url = pg.evaluate("__shot()")
        (out / (st.replace("&", "_").replace("=", "-") + ".png")).write_bytes(base64.b64decode(url.split(",", 1)[1]))
        print(st, "errors:", errs[:3])
    b.close()
