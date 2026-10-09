"""Play a whole night with the bot and print its timeline.
python tools/night.py [timescale] [maxminutes] [seed] [outdir]"""
import os as _os; PORT = _os.environ.get("WH_PORT", "5184")
import sys, time, json, base64
from pathlib import Path
from playwright.sync_api import sync_playwright
ts = float(sys.argv[1]) if len(sys.argv) > 1 else 2.5
maxm = float(sys.argv[2]) if len(sys.argv) > 2 else 12
seed = sys.argv[3] if len(sys.argv) > 3 else 'biscuit'
out = Path(sys.argv[4]) if len(sys.argv) > 4 else None
if out: out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"]); pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200] + " | " + str(getattr(e, "stack", ""))[:300]))
    pg.goto(f"http://localhost:{PORT}/?go&shots&stats&bot&ts={ts}&seed={seed}" + (f"&s={sys.argv[5]}" if len(sys.argv) > 5 else ""))
    pg.wait_for_function("window.__wh && __wh.segs.size >= 3", timeout=120000)
    t0 = time.time(); k = 0; shot = 0
    while time.time() - t0 < maxm * 60:
        time.sleep(10)
        st = pg.evaluate("({ state: __wh.ending.state, s: __wh.player.s, log: __wh.bot.log.splice(0), deck: __wh.deck.log.splice(0), dir: __wh.director.ledger.splice(0) })")
        for e in st['log']: print(json.dumps(e))
        for e in st['deck']: print('   ENC', e)
        for e in st['dir']: print('   DIR', e)
        if out and k % 2 == 0:
            url = pg.evaluate("__wh.renderer.domElement.toDataURL('image/jpeg', 0.7)"); (out / f"{shot:03d}_s{int(st['s'])}.jpg").write_bytes(base64.b64decode(url.split(',', 1)[1])); shot += 1
        k += 1
        if st['state'] != 'waiting': print('HOME at', round(time.time() - t0), 's real'); time.sleep(4); break
    print('errors:', errs[:5])
    b.close()
