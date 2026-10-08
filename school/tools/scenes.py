"""Throwaway: drive the school app through scripted scenarios and screenshot each beat.

python school/tools/scenes.py <outdir> [scene ...]   (dev server must be running on :5182)
Steps: ("js", code) runs in the page, ("wait", s) sleeps, ("shot", name), ("until", js-condition).
Helpers available in the page: __gn (world, S, RULES, camera...), and the GN helpers defined in PRE.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)

# page helpers: teleport, face a point, find things in the layout
PRE = r"""
window.GN = {
  P: () => __gn.S.player,
  put(x, z, floor = 0, yaw = null) { const P = __gn.S.player; Object.assign(P, { x, z, floor, vx: 0, vz: 0 }); if (yaw !== null) P.yaw = yaw; },
  face(x, z) { const P = __gn.S.player; P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); },
  chunk(f, i, j) { return __gn.world.layout.chunk(f, i, j); },
  findStair() { for (let i = -9; i <= 9; i += 3) for (let j = -8; j <= 8; j += 2) { const c = __gn.world.layout.chunk(0, i, j); if (c.stair) return c; } return null; },
  out(side, k) { return { N: [0, -k], S: [0, k], E: [k, 0], W: [-k, 0] }[side]; },
};
"""

STAIR_IN = """(() => { const c = GN.findStair(), r = c.rooms.find((x) => x.kind === 'stair'), d = r.door, o = GN.out(d.side, 2.4);
  GN.put(d.x + o[0], d.z + o[1], 0); GN.face(d.x - o[0], d.z - o[1]); __gn.S.player.pitch = 0.12; })()"""
STAIR_UP = """(() => { const c = GN.findStair(), r = c.rooms.find((x) => x.kind === 'stair'), d = r.door, o = GN.out(d.side, 1);
  const s = r.x1 - r.x0, inn = [-o[0], -o[1]];
  // stand at the foot of flight 1, looking up it
  GN.put(d.x + inn[0] * 1.2, d.z + inn[1] * 1.2, 0); GN.face(d.x + inn[0] * 8, d.z + inn[1] * 8); __gn.S.player.pitch = 0.3; })()"""
CORRIDOR = "(() => { const P = __gn.S.player; P.yaw = 0; P.pitch = 0; })()"
EAST = "(() => { const P = __gn.S.player; P.yaw = -Math.PI / 2; P.pitch = 0; })()"
DOOR_OPEN = """(() => { const c = GN.chunk(0, 0, 0), r = c.rooms.find((x) => x.kind === 'classroom') || c.rooms[0], d = r.door, o = GN.out(d.side, 2.6);
  __gn.S.doors[d.id] = { open: true }; GN.put(d.x + o[0], d.z + o[1], 0); GN.face(d.x, d.z); })()"""

HM_ARRIVE = "(() => { const P = __gn.S.player; P.yaw = 0; P.pitch = 0; __gn.S.director.nextPatrol = 0.05; })()"
HM_FACE = "(() => { const H = __gn.S.headmaster, P = __gn.S.player; P.yaw = Math.atan2(-(H.x - P.x), -(H.z - P.z)); P.pitch = 0.05; })()"
HM_CLOSE = """(() => { const P = __gn.S.player; Object.assign(__gn.S.headmaster, { state: 'patrol', x: P.x, z: P.z - 7, floor: P.floor, yaw: 0, path: [], timer: 60 }); P.yaw = 0; P.pitch = 0.08; })()"""
HM_STOOP = """(() => { const P = __gn.S.player; __gn.S.held.pass = 1; Object.assign(__gn.S.headmaster, { state: 'chase', x: P.x, z: P.z - 2.4, floor: P.floor, yaw: 0, path: [], seenAt: __gn.S.t }); __gn.input.keys.add('KeyF'); })()"""

CLASS_IN = """(() => { let room = null; for (let i = 0; i <= 5 && !room; i++) for (let j = 0; j <= 5 && !room; j++) room = GN.chunk(0, i, j).rooms.find((r) => r.kind === 'classroom' && r.kit === 'standard') || null;
  window.__room = room; __gn.S.director.nextPatrol = 1e9; __gn.S.director.forceRoll = { lesson: 'handin', teacher: 'teacher', twists: [], valuables: {} };
  const d = room.door, o = GN.out(d.side, 0.4); __gn.S.doors[d.id] = { open: true };
  GN.put(d.x - o[0] * 2, d.z - o[1] * 2, 0); })()"""
CLASS_LOOK = """(() => { const st = __gn.S.rooms[__room.id], f = st.frame; const P = __gn.S.player;
  P.x = st.frame.cx - f.ix * (f.D / 2 - 0.9) + f.lx * 1.1; P.z = st.frame.cz - f.iz * (f.D / 2 - 0.9) + f.lz * 1.1;
  P.yaw = Math.atan2(-f.ix, -f.iz) + 0.12; P.pitch = -0.08; })()"""
CLASS_TURN = """(() => { const st = __gn.S.rooms[__room.id]; st.lesson.phase = 'look'; st.lesson.phaseT = 99; })()"""
CLASS_CARRY = """(() => { __gn.S.player.carrying = 4; __gn.S.held.stars = 5; })()"""
CLASS_DOOM = """(() => { const st = __gn.S.rooms[__room.id]; st.lesson.phase = 'chalk'; st.lesson.phaseT = 99; st.lesson.hymn = 0.02; })()"""

def class_in(lesson, twists="[]", kit="standard"):
    return f"""(() => {{ let room = null; for (let i = 0; i <= 6 && !room; i++) for (let j = 0; j <= 6 && !room; j++) room = GN.chunk(0, i, j).rooms.find((r) => r.kind === 'classroom' && r.kit === '{kit}') || null;
  window.__room = room; __gn.S.director.nextPatrol = 1e9; __gn.S.director.forceRoll = {{ lesson: '{lesson}', teacher: 'teacher', twists: {twists}, valuables: {{ drawer: true, pass: true, chalk: true, page: true }} }};
  const d = room.door, o = GN.out(d.side, 0.4); __gn.S.doors[d.id] = {{ open: true }};
  GN.put(d.x - o[0] * 2, d.z - o[1] * 2, 0); }})()"""
SIT = """(() => { const st = __gn.S.rooms[__room.id]; __gn.S.player.target = { kind: 'mydesk', id: st.id }; __gn.input.useEdge = true; })()"""
WRITE = """(() => { __gn.S.player.pitch = -0.85; __gn.input.mouse.add(0); })()"""
EDGE_HAND = """(() => { __gn.rooms.edgeThing(__gn.S, __room.id, 'hand'); })()"""
EDGE_STAND = """(() => { __gn.rooms.edgeThing(__gn.S, __room.id, 'standUp'); __gn.S.player.pitch = -0.5; })()"""
BACK_VIEW = """(() => { const st = __gn.S.rooms[__room.id], f = st.frame, P = __gn.S.player;
  P.x = f.cx - f.ix * (f.D / 2 - 1.0) - f.lx * 1.0; P.z = f.cz - f.iz * (f.D / 2 - 1.0) - f.lz * 1.0; P.yaw = Math.atan2(-f.ix, -f.iz) - 0.2; P.pitch = -0.05; })()"""
FRONT_VIEW = """(() => { const st = __gn.S.rooms[__room.id], f = st.frame, P = __gn.S.player;
  P.x = f.cx + f.ix * (f.D / 2 - 1.6); P.z = f.cz + f.iz * (f.D / 2 - 1.6); P.yaw = Math.atan2(f.ix, f.iz); P.pitch = -0.08; })()"""
PAGE = """(() => { const k = Object.keys(__gn.S.interact).find((x) => __gn.S.interact[x].kind === 'page'); __gn.S.player.target = { kind: 'page', id: k }; __gn.input.useEdge = true; })()"""

STAIR13 = """(() => { const c = GN.findStair(), r = c.rooms.find((x) => x.kind === 'stair'), d = r.door, o = GN.out(d.side, 1);
  const inn = [-o[0], -o[1]]; __gn.S.director.nextPatrol = 1e9;
  GN.put(d.x + inn[0] * 3.5, d.z + inn[1] * 3.5, 0); GN.face(d.x - o[0] * 9, d.z - o[1] * 9);
  __gn.S.stairs = { roomId: r.id, steps: 13, climbYaw: __gn.S.player.yaw, follower: true, onFlight: true, back: true };
  __gn.S.player.yaw += Math.PI; __gn.S.player.pitch = -0.1; })()"""
CAUGHT = """(() => { __gn.S.director.nextPatrol = 1e9; __gn.S.held.stars = 3; __gn.S.headmaster.caughtNow = true; })()"""
WRITE_LINES = """(() => { __gn.S.detention.snoreT = 999; __gn.input.keys.add('KeyE'); })()"""
BELL_CAUGHT = """(() => { __gn.S.clock.bell = true; __gn.S.headmaster.caughtNow = true; })()"""
HOME = """(() => { const S = __gn.S; S.held.stars = 12; S.director.forceReach = true; S.player.target = { kind: 'entrance', id: 'x' }; __gn.input.useEdge = true; })()"""
ENTRANCE = """(() => { const S = __gn.S, L = __gn.world.layout; S.held.stars = 12; S.director.nextPatrol = 1e9;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const c = L.chunk(0, i, j); if (c.deadEnd && !window.__de) window.__de = c; }
  const c = window.__de, d = c.deadEnd; S.layout.entrances[c.key] = true; S.interact[c.key + ':entrance'] = { kind: 'entrance', x: d.x, z: d.z, floor: 0, r: 1.8, chunk: c.key };
  const o = GN.out(d.side, 1); GN.put(d.x - o[0] * 5, d.z - o[1] * 5, 0); GN.face(d.x, d.z); S.player.pitch = 0.05; })()"""

GLIMPSE = """(() => { const S = __gn.S, P = S.player; S.clock.minutes = 100; S.director.tension = 25; S.director.nextPatrol = 1e9;
  P.yaw = -Math.PI / 2; P.pitch = 0; const dir = __gn.world.modules.find((m) => m.id === 'director');
  const hm = __gn.world.modules.find((m) => m.id === 'headmaster'); hm.arrive(S, { ...{ rng: __gn.world.streams.get('director'), emit: __gn.world.emit, layout: __gn.world.layout, rules: __gn.RULES, world: __gn.world } }, 'glimpse');
  const H = S.headmaster; P.yaw = Math.atan2(-(H.x - P.x), -(H.z - P.z)); })()"""
APPAR = """(() => { const S = __gn.S, P = S.player; S.director.nextPatrol = 1e9; P.yaw = -Math.PI / 2; P.pitch = 0;
  S.director.apparition = { kind: 'facingWall', x: P.x + 12, z: P.z + 0.6, floor: 0, t0: S.t, seen: false, seed: 1 }; })()"""
CUTOUT = """(() => { const S = __gn.S, P = S.player; S.director.nextPatrol = 1e9; P.yaw = -Math.PI / 2; P.pitch = 0; __gn.people.showCutout(S, __gn.world.layout); })()"""
LATE = """(() => { const S = __gn.S, P = S.player; S.clock.minutes = 165; S.director.nextPatrol = 1e9; P.yaw = 0; P.pitch = 0; })()"""

HALL = """(() => { const S = __gn.S, L = __gn.world.layout; S.director.nextPatrol = 1e9; let c = null;
  for (let r = 0; r <= 8 && !c; r++) for (let i = -r; i <= r && !c; i++) for (let j = -r; j <= r && !c; j++) { const k = L.chunk(0, i, j); if (k.deadEnd && k.wing === 'old') c = k; }
  (S.layout.hallDoors ??= {})[c.key] = true; S.interact[c.key + ':hall'] = { kind: 'hallDoor', x: c.deadEnd.x, z: c.deadEnd.z, floor: 0, r: 1.8, chunk: c.key };
  const d = c.deadEnd, o = GN.out(d.side, 1); GN.put(d.x - o[0] * 4.5, d.z - o[1] * 4.5, 0); GN.face(d.x, d.z); S.player.pitch = 0.08; })()"""
HALL_USE = """(() => { const S = __gn.S, k = Object.keys(S.layout.hallDoors)[0]; S.held.pages = [1, 2]; const d = __gn.world.layout.chunkByKey(k).deadEnd, o = GN.out(d.side, 1);
  GN.put(d.x - o[0] * 1.6, d.z - o[1] * 1.6, 0); GN.face(d.x, d.z); S.player.target = { kind: 'hallDoor', id: k + ':hall' }; __gn.input.useEdge = true; })()"""

SCENES = {
    "corridor": [("js", CORRIDOR), ("wait", 1.5), ("shot", "corridor_north"), ("js", EAST), ("wait", 1.0), ("shot", "corridor_east")],
    "door": [("js", DOOR_OPEN), ("wait", 2.0), ("shot", "door_open")],
    "stairs": [("js", STAIR_IN), ("wait", 1.5), ("shot", "stair_door"), ("js", STAIR_UP), ("wait", 1.5), ("shot", "stair_flight")],
    "hm": [("js", HM_ARRIVE), ("wait", 4.5), ("shot", "hm_lights_dying"), ("js", HM_FACE), ("wait", 0.3), ("shot", "hm_far"),
           ("js", HM_CLOSE), ("wait", 0.6), ("shot", "hm_close")],
    "stoop": [("js", HM_STOOP), ("wait", 1.3), ("shot", "hm_stoop")],
    "class": [("js", CLASS_IN), ("wait", 0.8), ("js", CLASS_LOOK), ("wait", 1.2), ("shot", "class_lesson"),
              ("js", CLASS_CARRY), ("wait", 0.8), ("shot", "class_carry"), ("js", CLASS_TURN), ("wait", 0.6), ("shot", "class_look")],
    "doom": [("js", CLASS_IN), ("wait", 0.8), ("js", CLASS_LOOK), ("wait", 1.0), ("js", CLASS_DOOM), ("wait", 0.4), ("shot", "doom_stand"),
             ("wait", 0.5), ("shot", "doom_snap"), ("wait", 0.5), ("shot", "doom_shriek"), ("wait", 2.4), ("shot", "doom_expelled")],
    "eyes": [("js", class_in("eyes")), ("wait", 0.8), ("js", SIT), ("wait", 0.4), ("js", WRITE), ("wait", 6), ("shot", "eyes_writing"),
             ("js", EDGE_HAND), ("wait", 0.3), ("shot", "eyes_hand"), ("js", EDGE_STAND), ("wait", 0.3), ("shot", "eyes_standup")],
    "story": [("js", class_in("story", "[]", "infants")), ("wait", 0.8), ("js", BACK_VIEW), ("wait", 2.5), ("shot", "story_room")],
    "visitor": [("js", class_in("handin", "['visitor', 'wrongBoard', 'turned']")), ("wait", 0.8), ("js", FRONT_VIEW), ("wait", 1.0), ("shot", "visitor_turned"),
                ("js", BACK_VIEW), ("wait", 0.6), ("shot", "visitor_board")],
    "page": [("js", class_in("handin")), ("wait", 0.8), ("js", PAGE), ("wait", 1.2), ("shot", "page_found")],
    "stairs13": [("js", STAIR13), ("wait", 0.8), ("shot", "stairs_follower")],
    "detention": [("js", CAUGHT), ("wait", 4.5), ("shot", "detention_wake"), ("js", WRITE_LINES), ("wait", 9), ("shot", "detention_lines")],
    "expelled": [("js", BELL_CAUGHT), ("wait", 3.5), ("shot", "expelled_card")],
    "home": [("js", ENTRANCE), ("wait", 1.5), ("shot", "entrance_doors"), ("js", HOME), ("wait", 2.5), ("shot", "home_flood"), ("wait", 2.5), ("shot", "home_card")],
    "glimpse": [("js", GLIMPSE), ("wait", 1.2), ("shot", "glimpse_far"), ("wait", 3.5), ("shot", "glimpse_gone")],
    "appar": [("js", APPAR), ("wait", 1.0), ("shot", "apparition")],
    "cutout": [("js", CUTOUT), ("wait", 1.0), ("shot", "cutout")],
    "late": [("js", LATE), ("wait", 1.5), ("shot", "late_corridor"), ("js", "__gn.S.player.yaw = -Math.PI / 2"), ("wait", 1.0), ("shot", "late_corridor_east")],
    "rooms": [x for sc in ["empty", "aftermath", "loneChild", "facingWall"] for x in (("js", class_in("handin").replace("valuables:", f"scene: '{sc}', valuables:")), ("wait", 0.8), ("js", BACK_VIEW), ("wait", 1.2), ("shot", f"scene_{sc}"), ("js", FRONT_VIEW), ("wait", 1.0), ("shot", f"scene_{sc}_front"), ("js", "(() => { const st = __gn.S.rooms[__room.id], f = st.frame, P = __gn.S.player; P.x = f.cx - f.ix * (f.D / 2 - 3.2); P.z = f.cz - f.iz * (f.D / 2 - 3.2); P.yaw = Math.atan2(f.ix, f.iz); P.pitch = 0; })()"), ("wait", 1.0), ("shot", f"scene_{sc}_back"), ("js", "(() => { const S = __gn.S, d = __room.door, o = GN.out(d.side, 3); GN.put(d.x + o[0], d.z + o[1], 0); })()"), ("wait", 0.5), ("js", "(() => { const S = __gn.S; for (const id of Object.keys(S.rooms)) delete S.rooms[id]; })()"), ("wait", 0.3))],
    "hall": [("js", HALL), ("wait", 1.5), ("shot", "hall_far"), ("js", HALL_USE), ("wait", 1.2), ("shot", "hall_near")],
    "doomv": [x for les, kit in [("eyes", "standard"), ("story", "infants")] for x in (("js", class_in(les, "[]", kit)), ("wait", 0.8), ("js", FRONT_VIEW), ("wait", 0.8), ("js", "__gn.rooms.startDoom(__room.id)"), ("wait", 0.4), ("shot", f"doom_{les}_a"), ("wait", 0.9), ("shot", f"doom_{les}_b"), ("js", "(() => { __gn.rooms.doom = null; const d = __room.door, o = GN.out(d.side, 3); GN.put(d.x + o[0], d.z + o[1], 0); })()"), ("wait", 0.5), ("js", "(() => { for (const id of Object.keys(__gn.S.rooms)) delete __gn.S.rooms[id]; })()"), ("wait", 0.3))],
    "trueEnd": [("js", HALL), ("wait", 1.0), ("js", HALL_USE.replace("S.held.pages = [1, 2]", "S.held.pages = [1, 2, 3, 4, 5]")), ("wait", 2.5), ("shot", "true_1"), ("wait", 4.5), ("shot", "true_2"), ("wait", 11), ("shot", "true_flood")],
    "walk": [("js", "__gn.input.keys.add('KeyW')"), ("wait", 3), ("js", "__gn.input.keys.delete('KeyW')"), ("shot", "walked")],
}

# wing_<name>[_<minutes>]: stand in a junction of that wing and look down an arm
# anom_<kind>[_<minutes>]: force that anomaly into the chunk you're in, look at it from both ends
def GOTO_WING(w, minutes):
    return f"""(() => {{ const S = __gn.S, L = __gn.world.layout; S.clock.minutes = {minutes}; S.director.nextPatrol = 1e9;
  let best = null; for (let r = 0; r <= 8 && !best; r++) for (let i = -r; i <= r && !best; i++) for (let j = -r; j <= r && !best; j++) {{ const c = L.chunk(0, i, j); if (c.wing === '{w}' && c.corridors.length >= 4) best = c; }}
  const c = best; GN.put(c.x0 + 12, c.z0 + 12, 0); const arm = c.corridors.find((k) => k.arm); const P = S.player;
  P.yaw = {{ N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }}[arm.arm]; P.pitch = 0; window.__c = c; }})()"""
def ANOM(kind, minutes):
    return f"""(() => {{ const S = __gn.S, P = S.player; S.clock.minutes = {minutes}; S.director.nextPatrol = 1e9; S.director.apparition = null;
  const c = __gn.world.layout.chunkAt(P.floor, P.x, P.z); S.layout.anomalies[c.key + '@' + c.epoch] = {{ kind: '{kind}', tier: 2, seed: 77, room: (c.rooms.find((r) => r.kind === 'classroom') || {{}}).id }};
  window.__c = c; P.x = c.x0 + 12; P.z = c.z0 + 12; }})()"""
# walk 3 m into each arm and look down it (what you actually see as you pass)
def ARM(side):
    return f"""(() => {{ const c = window.__c, P = __gn.S.player, k = c.corridors.find((x) => x.arm === '{side}');
  const v = {{ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }}['{side}'];
  if (!k) {{ P.x = c.x0 + 12; P.z = c.z0 + 12; }} else {{ P.x = c.x0 + 12 + v[0] * 3.2; P.z = c.z0 + 12 + v[1] * 3.2; }}
  P.yaw = {{ N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 }}['{side}']; P.pitch = 0.08; }})()"""
LOOK_ARMS = [x for d in "NESW" for x in (("js", ARM(d)), ("wait", 1.0), ("shot", "{n}_" + d))]
def dyn(name):
    parts = name.split("_"); minutes = int(parts[2]) if len(parts) > 2 else 100
    js = GOTO_WING(parts[1], minutes) if parts[0] == "wing" else ANOM(parts[1], minutes)
    return [("js", js), ("wait", 0.5)] + [(k, a.format(n=name) if isinstance(a, str) and k == "shot" else a) for k, a in LOOK_ARMS]

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0", "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"])
    seed = next((a.split("=", 1)[1] for a in sys.argv[2:] if a.startswith("seed=")), "11")
    names = [a for a in sys.argv[2:] if not a.startswith("seed=")] or list(SCENES)
    for name in names:
        pg = b.new_page(viewport={"width": 1280, "height": 760})
        errs = []
        pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
        pg.on("console", lambda m: m.type == "error" and "404" not in m.text and errs.append(m.text))
        pg.goto(f"http://localhost:5182/?auto&seed={seed}")
        pg.wait_for_function("window.__gn && window.__fps", timeout=240000)
        pg.evaluate(PRE)
        for kind, arg in (SCENES[name] if name in SCENES else dyn(name)):
            if kind == "js": pg.evaluate(arg)
            elif kind == "wait": time.sleep(arg)
            elif kind == "shot": pg.screenshot(path=str(OUT / f"{arg}.png"))
            elif kind == "until":
                try: pg.wait_for_function(arg, timeout=60000, polling=100)
                except Exception: print("  timeout waiting for", arg); break
        info = pg.evaluate("[window.__fps, __gn.renderer.info.render.calls, __gn.renderer.info.render.triangles, __gn.S.player.floor, +__gn.S.player.y.toFixed(2)]")
        print(name, "fps/calls/tris/floor/y:", info, "errors:", errs[:4])
        pg.close()
    b.close()
