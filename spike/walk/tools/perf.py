import time
from playwright.sync_api import sync_playwright
JS = """(()=>{const g=__gn; const T={sort:0,render:0,n:0};
const su=g.sprites.update.bind(g.sprites); g.sprites.update=(c)=>{const a=performance.now(); su(c); T.sort+=performance.now()-a;};
const rr=g.renderer.render; g.renderer.render=(s,c)=>{const a=performance.now(); rr(s,c); T.render+=performance.now()-a; T.n++;};
window.__T=T;})()"""
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=0,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    pg = b.new_page(viewport={"width": 1280, "height": 760})
    pg.goto("http://localhost:5181/?auto")
    pg.wait_for_function("window.__gn", timeout=180000)
    time.sleep(3)
    pg.evaluate(JS)
    time.sleep(5)
    print(pg.evaluate("({fps: window.__fps, items: __gn.sprites.items.size, calls: __gn.renderer.info.render.calls, tris: __gn.renderer.info.render.triangles, sortMs: (__T.sort/__T.n).toFixed(2), renderMs:(__T.render/__T.n).toFixed(2), n: __T.n, chunks: __gn.world.chunks.size})"))
    b.close()
