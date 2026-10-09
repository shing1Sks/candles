"""Turntable shots of one model: python tools/studio.py <outdir> puppy|tall [pose js]"""
import os as _os; PORT = _os.environ.get("WH_PORT", "5184")
import sys, time, base64
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True); kind = sys.argv[2]; pose = sys.argv[3] if len(sys.argv) > 3 else ''
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"]); pg = b.new_page(viewport={"width": 960, "height": 720})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200]) if 'studio mode' not in str(e) else None)
    pg.goto(f"http://localhost:{PORT}/?studio={kind}"); pg.wait_for_function("window.__studio", timeout=60000); time.sleep(1.5)
    if pose: pg.evaluate(pose)
    for i in range(pg.evaluate("__studio.views")):
        pg.evaluate(f"__studio.setView({i})"); time.sleep(0.6)
        (out / f"{kind}_{i}.png").write_bytes(base64.b64decode(pg.evaluate("__studio.shot()").split(',', 1)[1]))
    print('errors', errs); b.close()
