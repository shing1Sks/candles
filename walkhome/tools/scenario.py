"""Scripted playtests: a list of steps run against the live game.
python tools/scenario.py <outdir> <scenario>       (npm run dev on :5184)
Steps: ("js", code) | ("wait", s) | ("shot", name) | ("hold", keys, s)  (hold keys like "KeyW,ShiftLeft" for s seconds)
       ("look", yaw, pitch) sets the view | ("log", js) prints a value
"""
import os as _os; PORT = _os.environ.get("WH_PORT", "5184")
import base64, sys, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
STATE = "JSON.stringify({s:+__wh.player.s.toFixed(1), l:+__wh.player.l.toFixed(1), dog:__wh.dog.state, dfear:+__wh.dog.fear.toFixed(2), tall: __wh.tall.active ? [__wh.tall.mode, +__wh.tall.s.toFixed(1), +__wh.tall.l.toFixed(1), __wh.tall.seen] : null, dir:[__wh.director.phase, +__wh.director.fear.toFixed(2)], fps:+__wh.fps().toFixed(0), ev: __wh.events.splice(0).map(e=>e.name).filter(n=>!/sniff|pee|tug|call|happy/.test(n)).join(',')})"
TRACK = "window.__track = setInterval(() => { const T = __wh.tall, P = __wh.player, c = __wh.camera.position; if (!T.active) return; P.yaw = Math.atan2(-(T.x - P.x), -(T.z - P.z)); P.pitch = Math.atan2(T.y + 2.3 - c.y, Math.hypot(T.x - P.x, T.z - P.z)); }, 30)"
TSTATE = "JSON.stringify({t:+__wh.director.t.toFixed(1), d:+Math.hypot(__wh.tall.x-__wh.player.x, __wh.tall.z-__wh.player.z).toFixed(1), act:__wh.tall.active, mode:__wh.tall.mode, seen:__wh.tall.seen, lit:__wh.tall.lit, heavy:+__wh.tall.heavy.toFixed(2), lid:+__wh.post.U.uLid.value.toFixed(2), dying:__wh.lampState.filter(L=>L.dying>0).map(L=>L.id), ph:__wh.director.phase, ev:__wh.events.splice(0).map(e=>e.name).filter(n=>!/sniff|pee|tug|call|happy|step/.test(n)).join(',')})"
SCEN = {
  # he comes; you turn and hold him with your eyes. Do the lamps, the blink and the flicker move him?
  "stare": [
    ("js", "__wh.put(420, 3.2, 0, -0.1); __wh.director.glimpse = 'done'; __wh.director.nextVisit = 0; __wh.director.visits = 1;"),
    ("wait", 1.5), ("log", TSTATE), ("js", TRACK), ("wait", 0.5), ("shot", "a_first"),
  ] + sum([[("wait", 1.0), ("log", TSTATE)] + ([("shot", f"b_{i:02d}")] if i % 3 == 0 else []) for i in range(26)], []),
  # the hands and Biscuit, close: walking, looking down, stroking, running, carrying, pulling
  "hands": [("js", "__wh.put(20, 3.4, 0, -0.1)"), ("wait", 2), ("hold", "KeyW", 3), ("shot", "a_walk"), ("look", 0, -0.45), ("wait", 1.5), ("shot", "b_down"),
            ("hold", "KeyF", 3.5), ("js", "__wh.input.keys.add('KeyF')"), ("wait", 0.5), ("shot", "c_pet"), ("wait", 0.6), ("shot", "c_pet2"), ("js", "__wh.input.keys.delete('KeyF')"),
            ("look", 0, -0.1), ("hold", "KeyW,ShiftLeft", 2.2), ("js", "__wh.input.keys.add('KeyW'); __wh.input.keys.add('ShiftLeft')"), ("wait", 0.3), ("shot", "d_run"), ("js", "__wh.input.keys.clear()"),
            ("wait", 2), ("js", "__wh.dog.x = __wh.player.x + 0.3; __wh.dog.z = __wh.player.z - 0.6; __wh.input.edges.add('KeyE')"), ("wait", 1.0), ("shot", "e_carry"), ("js", "__wh.input.edges.add('KeyE')"),
            ("wait", 1.0), ("js", "__wh.dog.state = 'lured'; __wh.dog.lured = {x: __wh.player.x - 6, z: __wh.player.z - 4}"), ("wait", 2.5), ("shot", "f_pull"), ("js", "__wh.dog.lured = null"),
            ("look", 1.2, -0.2), ("wait", 1.0), ("shot", "g_side"), ("look", 3.14, -0.1), ("wait", 1.0), ("shot", "h_lookback")],
  # crouch behind a parked car while he hunts you: does he search, and give up?
  "hide": [("js", "__wh.put(420, 3, 0, 0); __wh.deck.nextS = 99999; __wh.director.glimpse = 'done'; __wh.director.nextVisit = 99999"), ("wait", 2),
           ("js", "(() => { const c = __wh.ectx.obstacles.find(o => o.car && Math.hypot(o.x - __wh.player.x, o.z - __wh.player.z) < 40) || __wh.ectx.obstacles.find(o => o.car); const P = __wh.player; P.x = c.x + 1.25; P.z = c.z; window.__car = c; const T = __wh.tall; T.active = true; T.mode = 'hunt'; T.knows = 1; T.x = P.x + 0.5; T.z = P.z + 22; T.y = P.y; __wh.director.visits = 2; })()"),
           ("js", "__wh.input.keys.add('KeyC'); __wh.player.yaw = 3.14; __wh.player.pitch = 0.1"), ("wait", 1), ("log", "JSON.stringify({hidden: __wh.post.U.uHide.value.toFixed(2)})"), ("shot", "a_hide"),
          ] + sum([[("wait", 1.5), ("log", "JSON.stringify({t:+__wh.director.t.toFixed(1), d:+Math.hypot(__wh.tall.x-__wh.player.x, __wh.tall.z-__wh.player.z).toFixed(1), act:__wh.tall.active, mode:__wh.tall.mode, knows:+__wh.tall.knows.toFixed(2), lost:+(__wh.tall.lostFor||0).toFixed(1), seen:__wh.tall.seen, ph:__wh.director.phase, dfear:+__wh.dog.fear.toFixed(2), ev:__wh.events.splice(0).map(e=>e.name).filter(n=>!/sniff|pee|tug|call|happy|step/.test(n)).join(',')})")] + ([("shot", f"b_{i:02d}")] if i % 4 == 0 else []) for i in range(18)], []),
  # walk up a garden path and ring the bell, at three houses
  "bell": sum([[("js", f"(() => {{ const d = __wh.doors.list.filter(d => d.s > 60)[{k}]; window.__d = d; const p = d; __wh.put(d.s, d.side * 6.6, 0, 0); const P = __wh.player; P.yaw = Math.atan2(-(d.x - P.x), -(d.z - P.z)); P.pitch = 0.15; }})()"), ("wait", 1.5),
                ("log", "JSON.stringify({kind: __wh.doors.list.filter(d => d.s > 60)[" + str(k) + "].kind, at: !!__wh.doors.at(__wh.player, __wh.camera.getWorldDirection(new __wh.camera.position.constructor()))})"), ("shot", f"door{k}"),
                ("js", "__wh.input.edges.add('KeyE')"), ("wait", 7), ("log", "JSON.stringify({ev: __wh.events.splice(0).map(e => e.name).filter(n => !/sniff|step/.test(n)).join(','), cap: document.getElementById('caption').textContent, carried: __wh.dog.carried})")] for k in range(4)], []),
  # he's ahead, standing in the road: walk toward him and past him, keeping your eyes on him
  "ahead": [("js", "__wh.put(560, 3.2, 0, -0.05); __wh.deck.nextS = 99999; __wh.director.glimpse = 'done'; __wh.director.visits = 2; __wh.director.lastAhead = false; __wh.director.nextVisit = 99999"), ("wait", 2),
            ("js", "(() => { const T = __wh.tall, P = __wh.player; const p = { s: P.s + 30, l: 0.6 }; T.active = true; T.mode = 'stalk'; T.knows = 0.5; const q = __wh.town && null; })(); (() => { const P = __wh.player, T = __wh.tall; const r = __wh.lampState.find(L => L.s > P.s + 25 && L.s < P.s + 45 && L.on); const s = r ? r.s + 0.5 : P.s + 32; const a = { x: 0, z: 0 }; T.x = (r ? r.x : P.x) - (r ? r.side * 2.6 : 0); T.z = -s; T.y = P.y; T.s = s; T.blink = 0; T.heavy = 0; T.seenFor = 0; })()"),
            ("js", TRACK), ("wait", 0.8), ("shot", "a_ahead")]
           + sum([[("hold", "KeyW", 2.0), ("log", TSTATE)] + ([("shot", f"b_{i:02d}")] if i % 2 == 1 else []) for i in range(10)], []),
  # stand still a long while: he lies down; kneel and stroke him: he rolls over
  "belly": [("js", "__wh.put(40, 3.4, 0, -0.1); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.nextOmen = 99999; __wh.director.glimpse = 'done'"), ("hold", "KeyW", 2), ("wait", 17),
            ("js", "(() => { const P = __wh.player, D = __wh.dog; P.yaw = Math.atan2(-(D.x - P.x), -(D.z - P.z)); P.pitch = -0.5; })()"), ("wait", 0.5), ("shot", "a_lying"), ("log", "JSON.stringify({lie: __wh.dog.lie, st: __wh.dog.state})"),
            ("js", "__wh.input.keys.add('KeyF')"), ("wait", 7), ("shot", "b_belly"), ("log", "JSON.stringify({belly: __wh.dog.belly, pet: __wh.dog.petting, lie: __wh.dog.lie})"), ("wait", 2), ("shot", "c_belly2"), ("js", "__wh.input.keys.clear()")],
  # a slow human-paced walk: stop, look about, walk on. What happens in 4 minutes?
  "human": [("js", "__wh.put(2, 3.4, 0, -0.1)")] + sum([[("hold", "KeyW", 7), ("look", 3.0, -0.05), ("wait", 1.5), ("log", TSTATE), ("look", 0.0, -0.1), ("wait", 2.0), ("log", TSTATE)] for i in range(22)], []),
  # walk up the long street; the director sends him; look back now and then
  "visit": [
    ("js", "__wh.put(300, 3, 0, -0.1); __wh.director.glimpse = 'done'; __wh.director.nextVisit = 0;"),
    ("wait", 1), ("log", STATE),
    ("hold", "KeyW", 6), ("log", STATE), ("shot", "a_walking"),
    ("look", 3.14, -0.05), ("wait", 0.6), ("log", STATE), ("shot", "b_lookback"),
    ("look", 0, -0.1), ("hold", "KeyW", 8), ("log", STATE),
    ("look", 3.14, -0.05), ("wait", 0.6), ("log", STATE), ("shot", "c_lookback2"),
    ("look", 0, -0.1), ("hold", "KeyW", 8), ("log", STATE),
    ("look", 3.14, -0.05), ("wait", 0.6), ("log", STATE), ("shot", "d_lookback3"),
    ("look", 0, -0.1), ("hold", "KeyW", 10), ("log", STATE), ("shot", "e_ahead"),
    ("look", 3.14, -0.05), ("wait", 0.6), ("log", STATE), ("shot", "f_lookback4"),
  ],
  # each encounter, forced: walk into it and take pictures
  "gnome": [("js", "__wh.put(40, 3.4, 0, -0.08); __wh.deck.nextS = 9999; __wh.deck.force('gnome', __wh.ectx)"), ("wait", 1), ("shot", "a_first"), ("hold", "KeyW", 13), ("look", 3.14, -0.15), ("wait", 0.5), ("shot", "b_back"), ("look", 0, -0.08), ("wait", 0.6), ("shot", "c_ahead_moved"), ("hold", "KeyW", 9), ("look", 0, -0.08), ("wait", 0.5), ("shot", "d_ahead"), ("log", "JSON.stringify(__wh.deck.active && __wh.deck.active.stage)")],
  "models": [
    ("js", "__wh.put(60, 2.0, 0, -0.08); __wh.deck.nextS = 9999; __wh.deck.force('cat', __wh.ectx)"), ("wait", 0.5), ("js", "(() => { const g = __wh.deck.active.g; __wh.put(__wh.deck.active.s - 4, 2.2, 0, 0); })()"), ("wait", 0.8), ("lookat", "__wh.deck.active.g.position"), ("wait", 0.4), ("shot", "cat"),
    ("js", "__wh.deck.force('neighbour', __wh.ectx)"), ("wait", 0.3), ("js", "(() => { const g = __wh.deck.active.g; __wh.put(__wh.deck.active.s - 5, 2.6, 0, 0); })()"), ("wait", 0.8), ("lookat", "{x: __wh.deck.active.g.position.x, y: __wh.deck.active.g.position.y + 1.3, z: __wh.deck.active.g.position.z}"), ("wait", 0.4), ("shot", "neighbour"),
    ("js", "__wh.put(660, 2.6, 0, 0); __wh.deck.force('van', __wh.ectx)"), ("wait", 0.5), ("js", "__wh.put(__wh.deck.active.s - 14, 2.6, 0, 0)"), ("wait", 1.5), ("lookat", "__wh.deck.active.g.position"), ("wait", 0.4), ("shot", "van"),
    ("js", "__wh.put(700, -2.5, 0, 0); __wh.deck.force('phone', __wh.ectx)"), ("wait", 0.5), ("js", "__wh.put(__wh.deck.active.s - 6, -2.2, 0, 0)"), ("wait", 1.5), ("lookat", "{x: __wh.deck.active.g.position.x, y: __wh.deck.active.g.position.y + 1.2, z: __wh.deck.active.g.position.z}"), ("wait", 0.4), ("shot", "phone"),
    ("js", "__wh.put(400, 3.8, 0, 0); __wh.deck.force('bigDog', __wh.ectx); __wh.deck.active.state = 'lunge'; __wh.deck.active.t = 0.5"), ("wait", 0.1), ("js", "__wh.put(__wh.deck.active.s - 3, 3.2, 0, 0)"), ("wait", 0.6), ("lookat", "{x: __wh.deck.active.g.position.x, y: __wh.deck.active.g.position.y + 0.9, z: __wh.deck.active.g.position.z}"), ("wait", 0.2), ("shot", "bigdog"),
    ("js", "__wh.put(40, 3.0, 0, 0); __wh.deck.force('gnome', __wh.ectx)"), ("wait", 0.5), ("js", "__wh.put(__wh.deck.active.s - 3, 3.6, 0, 0)"), ("wait", 0.8), ("lookat", "{x: __wh.deck.active.g.position.x, y: __wh.deck.active.g.position.y + 0.3, z: __wh.deck.active.g.position.z}"), ("wait", 0.3), ("shot", "gnome"),
  ],
  "cat": [("js", "__wh.put(60, 3.2, 0, -0.02); __wh.deck.nextS = 9999; __wh.deck.force('cat', __wh.ectx)"), ("wait", 1), ("hold", "KeyW", 9), ("shot", "a"), ("hold", "KeyW", 3), ("shot", "b")],
  "door": [("js", "__wh.put(300, 2.4, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('door', __wh.ectx)"), ("wait", 1), ("hold", "KeyW", 7), ("shot", "a_open"), ("hold", "KeyW", 8), ("shot", "b")],
  "neighbour": [("js", "__wh.put(200, 2.8, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('neighbour', __wh.ectx)"), ("wait", 1), ("hold", "KeyW", 9), ("shot", "a"), ("hold", "KeyW", 7), ("look", 0.4, 0.05), ("wait", 0.3), ("shot", "b_close")],
  "van": [("js", "__wh.put(660, 2.6, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('van', __wh.ectx)"), ("wait", 1), ("hold", "KeyW", 18), ("shot", "a_parked"), ("hold", "KeyW", 22), ("look", 3.14, 0), ("wait", 0.5), ("shot", "b_following"), ("log", "JSON.stringify(__wh.deck.active && __wh.deck.active.state)")],
  "phone": [("js", "__wh.put(700, -2.5, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('phone', __wh.ectx)"), ("wait", 1), ("hold", "KeyW", 12), ("shot", "a")],
  "bigDog": [("js", "__wh.put(400, 3.8, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('bigDog', __wh.ectx); __wh.deck.active.side = 1"), ("wait", 0.5), ("hold", "KeyW", 14), ("look", -1.2, 0), ("wait", 0.2), ("shot", "a")],
  "car": [("js", "__wh.put(400, 3.4, 0, 0); __wh.deck.nextS = 9999; __wh.deck.force('car', __wh.ectx)"), ("wait", 5), ("shot", "a"), ("wait", 4), ("shot", "b")],
  "waves": [("js", "__wh.put(360, 0.5, 0, 0.05); __wh.deck.nextS = 9999; __wh.deck.force('lightsOut', __wh.ectx)"), ("wait", 1), ("shot", "a"), ("wait", 7), ("shot", "b")],
  "ending": [("js", "__wh.put(1588, 0.3, 0, 0.05); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 2), ("shot", "a_approach"), ("hold", "KeyW", 9), ("wait", 1.5), ("shot", "b_door"), ("wait", 3), ("shot", "c_in"), ("wait", 6), ("shot", "d_still"), ("wait", 12), ("shot", "e_credits"), ("log", "__wh.ending.state")],
  "tallclose": [
    ("js", "__wh.put(352, 2.4, 0, -0.05); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 2),
    ("js", "(() => { const L = __wh.lampState.filter(l => l.s < 350 && l.on).pop(); const T = __wh.tall; T.active = true; T.mode = 'stalk'; T.knows = 0; const p = { x: L.x - L.side * 1.2, z: L.z }; T.x = p.x; T.z = p.z; T.y = 0; T.s = L.s; __wh.put(L.s + 8, 2.0, 0, 0); })()"),
    ("wait", 1.5), ("lookat", "{x: __wh.tall.x, y: 2.4, z: __wh.tall.z}"), ("wait", 0.8), ("shot", "a_8m"),
    ("js", "(() => { const T = __wh.tall; __wh.put(T.s + 4, T.l + 0.3, 0, 0); })()"), ("wait", 1.0), ("lookat", "{x: __wh.tall.x, y: 2.7, z: __wh.tall.z}"), ("wait", 0.8), ("shot", "b_4m"),
    ("js", "(() => { const T = __wh.tall; __wh.lampState.forEach(l => { if (Math.abs(l.s - T.s) < 30) l.on = 0; }); })()"), ("wait", 1.0), ("shot", "c_dark"),
  ],
  "catch": [
    ("js", "__wh.put(352, 2.4, 0, -0.05); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 2),
    ("js", "(() => { const T = __wh.tall, P = __wh.player; T.active = true; T.mode = 'hunt'; T.knows = 1; T.x = P.x + 0.3; T.z = P.z + 2.2; T.y = P.y; })()"),
    ("wait", 0.35), ("shot", "a_catch"), ("wait", 0.3), ("log", "(() => { const h = __wh.tallView.head.getWorldPosition(__wh.camera.position.clone()), c = __wh.camera.position; const f = new __wh.camera.position.constructor(); __wh.camera.getWorldDirection(f); return JSON.stringify({head: [h.x - c.x, h.y - c.y, h.z - c.z].map(v => +v.toFixed(2)), fwd: [f.x, f.y, f.z].map(v => +v.toFixed(2))}); })()"), ("shot", "b_catch"), ("wait", 1.0), ("shot", "c_black"), ("wait", 3.5), ("shot", "d_wake"),
  ],
  "carry": [
    ("js", "__wh.put(60, 2.6, 0, -0.1); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 1.5),
    ("js", "__wh.dog.carried = true; __wh.player.carrying = true"), ("wait", 1.2), ("shot", "a_carry"),
    ("hold", "KeyF", 1.2), ("shot", "b_pet"), ("look", 0, -0.45), ("wait", 0.5), ("shot", "c_down"),
    ("js", "__wh.dog.carried = false; __wh.player.carrying = false; __wh.dog.x = __wh.player.x + 0.3; __wh.dog.z = __wh.player.z - 0.9"), ("look", 0, -0.55), ("wait", 0.4), ("hold", "KeyF", 1.0), ("shot", "d_pet_ground"),
  ],
  "moments": [
    ("js", "__wh.put(60, 3.6, 0, -0.35); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 1.5),
    ("js", "__wh.dog.x = __wh.player.x + 0.2; __wh.dog.z = __wh.player.z - 1.3; __wh.dog.yaw = 2.2; __wh.dog.state = 'scratch'; __wh.dog.st = 0"), ("wait", 0.8), ("shot", "a_scratch"),
    ("js", "__wh.dog.state = 'yawn'; __wh.dog.st = 0"), ("wait", 0.9), ("shot", "b_yawn"),
    ("js", "__wh.dog.state = 'shake'; __wh.dog.st = 0"), ("wait", 0.45), ("shot", "c_shake"),
    ("js", "__wh.dog.state = 'sneeze'; __wh.dog.st = 0"), ("wait", 0.55), ("shot", "d_sneeze"),
  ],
  "lost": [
    ("js", "__wh.put(352, 3.6, 0, -0.05); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'"), ("wait", 2),
    ("js", "(() => { const T = __wh.tall, P = __wh.player; T.active = true; T.mode = 'hunt'; T.knows = 1; T.x = P.x + 0.3; T.z = P.z + 2.2; T.y = P.y; })()"),
    ("wait", 6.5), ("log", "JSON.stringify({lost: __wh.dog.lost, s: __wh.player.s})"), ("look", 0, -0.35), ("wait", 0.4), ("shot", "a_wake_empty_lead"),
    ("look", 0, -0.02), ("hold", "KeyW", 12), ("shot", "b_search"), ("log", "JSON.stringify({lost: !!__wh.dog.lost, d: Math.hypot(__wh.dog.x - __wh.player.x, __wh.dog.z - __wh.player.z).toFixed(1)})"),
    ("lookat", "{x: __wh.dog.x, y: 0.3, z: __wh.dog.z}"), ("wait", 0.4), ("shot", "c_see_him"),
    ("js", "(() => { const D = __wh.dog, P = __wh.player; __wh.put(P.s, P.l, P.yaw, P.pitch); })()"), ("hold", "KeyW", 9), ("log", "JSON.stringify({lost: !!__wh.dog.lost, state: __wh.dog.state})"), ("shot", "d_found"),
  ],
  "alley": [
    ("js", "__wh.put(380, 3.6, 0, 0.02); __wh.deck.nextS = 99999; __wh.director.nextVisit = 99999; __wh.director.glimpse = 'done'; __wh.deck.force('alley', __wh.ectx)"), ("wait", 1.5),
    ("log", "JSON.stringify({s: __wh.deck.active && __wh.deck.active.s, side: __wh.deck.active && __wh.deck.active.side})"),
    ("lookat", "{x: __wh.deck.active.M.x, y: 2.2, z: __wh.deck.active.M.z}"), ("wait", 0.6), ("shot", "a_alley"),
    ("look", 0, 0.0), ("wait", 0.8), ("lookat", "{x: __wh.deck.active ? __wh.deck.active.M.x : 0, y: 2.2, z: __wh.deck.active ? __wh.deck.active.M.z : 0}"), ("wait", 0.3), ("shot", "b_gone"),
  ],
  "glimpse": [
    ("js", "__wh.put(140, 2, 0, -0.05);"), ("wait", 1), ("hold", "KeyW", 9), ("log", STATE), ("shot", "a"), ("hold", "KeyW", 4), ("log", STATE), ("shot", "b"),
  ],
}
steps = SCEN[sys.argv[2]]
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=False, args=["--window-position=-2400,0"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e) + " | " + str(getattr(e, "stack", ""))[:600]))
    pg.goto(f"http://localhost:{PORT}/?go&shots&stats")
    pg.wait_for_function("window.__wh && __wh.segs.size > 3", timeout=120000)
    pg.evaluate("__wh.input.enabled = true")
    for st in steps:
        k = st[0]
        if k == "js": pg.evaluate(st[1])
        elif k == "wait": time.sleep(st[1])
        elif k == "log": print(pg.evaluate(st[1]))
        elif k == "lookat": pg.evaluate("(() => { const o = " + st[1] + ", P = __wh.player, c = __wh.camera.position; P.yaw = Math.atan2(-(o.x - P.x), -(o.z - P.z)); P.pitch = Math.atan2((o.y ?? c.y) - c.y, Math.hypot(o.x - P.x, o.z - P.z)); })()")
        elif k == "look": pg.evaluate(f"__wh.player.yaw = __wh.player.yaw0 = (__wh.player.yaw0 ?? __wh.player.yaw) + 0; __wh.player.yaw = {st[1]}; __wh.player.pitch = {st[2]};")
        elif k == "hold":
            keys = st[1].split(",")
            for kk in keys: pg.evaluate(f"__wh.input.keys.add('{kk}')")
            time.sleep(st[2])
            for kk in keys: pg.evaluate(f"__wh.input.keys.delete('{kk}')")
        elif k == "shot":
            url = pg.evaluate("__wh.renderer.domElement.toDataURL('image/png')")
            (OUT / f"{st[1]}.png").write_bytes(base64.b64decode(url.split(",", 1)[1]))
    print("errors:", errs[:6])
    b.close()
