"""Throwaway: render the concept sheet in a real (headed) browser and save every card as it's shown.

python spike/concepts/shot.py <outdir> [set] [only]   (serve.py must be running on :5180)
"""
import base64, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
qs = f"?set={sys.argv[2] if len(sys.argv) > 2 else 'school'}" + (f"&only={sys.argv[3]}" if len(sys.argv) > 3 else "")
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"])
    pg = b.new_page(viewport={"width": 1500, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:5180/{qs}")
    pg.wait_for_function("document.body.dataset.ready === '1'", timeout=300000)
    cards = pg.evaluate("[...document.querySelectorAll('figure canvas')].map(c => c.toDataURL('image/png'))")
    names = pg.evaluate("[...document.querySelectorAll('figure figcaption')].map(c => c.dataset.name)")
    for i, (url, name) in enumerate(zip(cards, names)):
        (out / f"{(name or str(i)).replace('/', '_')}.png").write_bytes(base64.b64decode(url.split(",", 1)[1]))
    pg.screenshot(path=str(out / "_sheet.png"), full_page=True)
    print("cards:", names, "errors:", errs)
    b.close()
