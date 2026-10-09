"""Where does the frame go? Stand at one view, switch things off one at a time, read the fps.
python tools/perf.py [s] [l] [yaw]"""
import os as _os; PORT = _os.environ.get("WH_PORT", "5184")
import sys, time, json
from playwright.sync_api import sync_playwright
s, l, yaw = (sys.argv[1:4] + ['400', '1.5', '0'][len(sys.argv) - 1:])[:3]
T = {
  'baseline': ('', ''),
  'no shadows': ('__wh.renderer.shadowMap.enabled = false; __wh.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; })', '__wh.renderer.shadowMap.enabled = true; __wh.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; })'),
  'no fur': ('__wh.puppy.root.visible = false', '__wh.puppy.root.visible = true'),
  'scale 0.6': ('__wh.post.scale = 0.6; __wh.post.setSize(innerWidth, innerHeight)', '__wh.post.scale = 0.85; __wh.post.setSize(innerWidth, innerHeight)'),
  'no windows': ("__wh.scene.traverse(o => { if (o.material && o.material.type === 'ShaderMaterial' && o.geometry.attributes.aRoom) o.visible = false; })", "__wh.scene.traverse(o => { if (o.geometry && o.geometry.attributes && o.geometry.attributes.aRoom) o.visible = true; })"),
  'no beams': ("__wh.scene.traverse(o => { if (o.userData.mat) o.visible = false; })", ""),
  'no air': ('__wh.post.noAir = true', '__wh.post.noAir = false'),
  'no lamps': ('__wh.U.uLampCol.value.forEach(v => v.set(0,0,0)); __wh.rigOff = true', ''),
  'no trees': ("__wh.scene.traverse(o => { if (o.material && o.material.name === 'bark') o.visible = false; })", "__wh.scene.traverse(o => { if (o.material && o.material.name === 'bark') o.visible = true; })"),
}
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"]); pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.goto(f"http://localhost:{PORT}/?go&stats&fixres&s={s}&l={l}&yaw={yaw}")
    pg.wait_for_function("window.__wh && __wh.segs.size > 6", timeout=120000); time.sleep(4)
    for name, (on, off) in T.items():
        if on: pg.evaluate(on)
        time.sleep(3.2)
        f = pg.evaluate("__wh.fps()")
        print(f"{name:12s} {f:5.1f} fps")
        if off: pg.evaluate(off)
        time.sleep(0.5)
    b.close()
