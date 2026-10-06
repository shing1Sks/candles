"""Throwaway: drive the walk prototype through scripted scenarios and screenshot each beat.

python tools/scenes.py <outdir> [scene ...]   (dev server must be running on :5181)
Each scene is a list of steps: ("js", code) runs in the page, ("wait", s) sleeps, ("shot", name).
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
FACE = "(()=>{const g=__gn,e=g.entity,P=g.S.player; P.yaw=-Math.atan2(e.x-P.x, -(e.z-P.z));})()"
AWAY = "(()=>{const g=__gn,e=g.entity,P=g.S.player; P.yaw=-Math.atan2(e.x-P.x, -(e.z-P.z))+Math.PI;})()"
SCENES = {
    "forest": ("auto", [("wait", 6), ("shot", "forest")]),
    "petals": ("auto=still", [("wait", 9), ("shot", "petals_drift"),
                              ("js", "__gn.S.held=[0,1,2,3,4,0,2,1]"), ("wait", 1), ("shot", "petals_hand")]),
    "bloom": ("auto=still", [("js", "__gn.S.held=[0,1,2,3,4,0,2,1]; __gn.field.bloom(__gn.S)"), ("wait", 0.6), ("shot", "bloom_release"), ("wait", 3), ("shot", "bloom_field")]),
    "reached": ("auto=still", [("js", "__gn.S.held=[0,1,2,3,4,0,2,1]; __gn.field.bloom(__gn.S); __gn.field.reachChance=1"), ("wait", 3),
                               ("js", "const g=__gn,P=g.S.player; P.x=g.field.centre.x+2.5; P.z=g.field.centre.y+2.5; P.yaw=Math.atan2(2.5,2.5)"),
                               ("wait", 3), ("shot", "reached_flood"), ("wait", 4), ("shot", "reached_card")]),
    "turn": ("auto=still", [("js", "const R=__gn.RULES.entity; R.kinds={peek:1,wave:0,behind:0}; R.turnChance=1; R.lookToNotice=0.2; __gn.entity.exposure=3; __gn.entity.timer=0"),
                            ("until", "(__gn.S.player.yaw+=0.04, __gn.entity.state==='peek')"), ("js", FACE), ("wait", 0.1), ("shot", "turn_peek"), ("until", "__gn.entity.state==='emerge'"), ("wait", 1.2), ("js", FACE), ("shot", "turn_emerge"),
                            ("until", "__gn.entity.state==='hunt'"), ("js", FACE), ("wait", 0.1), ("shot", "turn_back")]),
    "hunt": ("auto=still", [("js", "const R=__gn.RULES.entity; R.kinds={peek:1,wave:0,behind:0}; R.turnChance=1; R.lookToNotice=0.2; __gn.entity.exposure=3; __gn.entity.timer=0"),
                            ("until", "(__gn.S.player.yaw+=0.04, __gn.entity.state==='peek')"), ("js", FACE), ("until", "__gn.entity.state==='hunt'"), ("js", AWAY), ("wait", 3), ("js", FACE), ("wait", 0.15), ("shot", "hunt_closer"),
                            ("js", "__gn.S.held=[1,2,3]; __gn.petals.drop(__gn.S)"), ("until", "__gn.entity.state==='remember'"), ("wait", 1.5), ("js", FACE), ("wait", 0.1), ("shot", "hunt_remember")]),
    "caught": ("auto=still", [("js", "const R=__gn.RULES.entity; R.kinds={peek:1,wave:0,behind:0}; R.turnChance=1; R.lookToNotice=0.2; __gn.entity.exposure=3; __gn.entity.timer=0"),
                              ("until", "(__gn.S.player.yaw+=0.04, __gn.entity.state==='peek')"), ("js", FACE), ("until", "__gn.entity.state==='hunt'"),
                              ("js", "__gn.RULES.entity.catchDist=40"), ("wait", 0.9), ("shot", "caught_crumple"), ("wait", 4.5), ("shot", "caught_woke")]),
    "sadface": ("auto=still", [("js", "const e=__gn.entity,P=__gn.S.player; __gn.RULES.entity.lungeWhileWatched=0; __gn.RULES.entity.lungeEveryWatched=[99,99]; e.appear(P.x, P.z-4.2, 'hunt', 'back'); e.huntT=0; e.huntFrom=__gn.S.t; e.lungeT=99; P.yaw=0; P.pitch=0.12"), ("wait", 1.0), ("shot", "sadface")]),
    "mist": ("auto=still", [("js", "__gn.mist.timer=0; __gn.S.mist=0.9"), ("wait", 6), ("shot", "mist")]),
    "sprint": ("auto=still", [("js", "__gn.keys.add('KeyW'); __gn.keys.add('ShiftLeft'); __gn.S.held=[0,1,2,3]"), ("wait", 2.2), ("shot", "sprint"),
                              ("js", "__gn.keys.delete('ShiftLeft')"), ("wait", 1.5), ("shot", "walk"),
                              ("js", "__gn.keys.delete('KeyW'); __gn.setReach(true)"), ("wait", 1.2), ("shot", "reach")]),
}

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    for name in sys.argv[2:] or SCENES:
        mode, steps = SCENES[name]
        pg = b.new_page(viewport={"width": 1280, "height": 760})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        pg.on("console", lambda m: m.type == "error" and "404" not in m.text and errs.append(m.text))
        pg.goto(f"http://localhost:5181/?{mode}")
        pg.wait_for_function("window.__gn", timeout=180000)
        time.sleep(1.5)
        for kind, arg in steps:
            if kind == "js": pg.evaluate(arg)
            elif kind == "wait": time.sleep(arg)
            elif kind == "shot": pg.screenshot(path=str(OUT / f"{arg}.png"))
            elif kind == "until":
                try: pg.wait_for_function(arg, timeout=60000, polling=100)
                except Exception: print("  timeout waiting for", arg, pg.evaluate("[__gn.entity.state, __gn.entity.timer]")); break
        ev = pg.evaluate("[window.__fps, __gn.renderer.info.render.calls, __gn.entity.state, __gn.field.phase, __gn.S.held.length]")
        print(name, "fps/calls/entity/field/held:", ev, "errors:", errs[:3])
        pg.close()
    b.close()
