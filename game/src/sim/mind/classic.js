// Classic: the monster's original brain, now a player on the giant's controller. It guards the candles that are
// still lit, runs to every sound, cuts round to the far end of the vent you keep using, opens (or smashes) the
// doors you shut on it, looks in wardrobes, and lunges when it is close. It knows only what it senses.
// It is the reference the new personas are measured against.
import { MON, BEAM, REACH } from '../rules.js';
import { T } from '../level.js';
import { clearLine } from '../grid.js';
import { steer, aim, snap, randomSpot, ambushSpot, passageExit, wardrobeNear, pickGuard, doorAhead, tileOf } from './nav.js';

export function createClassic() {
  return {
    path: null, goal: null, pathT: 0, wantX: 0, wantZ: 0,
    lostT: 0, chaseT: 0, gapUses: {}, linger: 0, searchLeft: 0, searchAt: null, huntAt: null, ambushAt: null, spot: null,
    guardId: -1, lastHint: null, checked: {}, checkW: -1, checking: false, stallT: 0, pending: null, wasAct: 'none',
    nextLight: BEAM.first, nextReach: -1,
  };
}

function setMode(G, mind, mode) {
  if (mind.mode === mode) return;
  mind.mode = mode; mind.modeT = 0; mind.path = null; mind.goal = null; mind.linger = 0; mind.stallT = 0; mind.checking = false;
  G.events.push({ type: 'mode', mode });
}
function check(G, mind, w) { setMode(G, mind, 'check'); mind.checkW = w.id; }

// how far through its schedule the giant's tools are: all candles lit .. one left
function interval(G, every) {
  const left = G.candles.filter((c) => c.lit).length, f = (left - 1) / Math.max(1, G.candles.length - 1);
  return every[1] + (every[0] - every[1]) * f;
}

export function thinkClassic(G, mind, obs, dt) {
  const self = obs.self, gi = { mx: 0, mz: 0, run: false, lunge: false, use: false, bash: false, yell: false, light: false, reach: false, ax: 0, az: 0, lx: 0, lz: 0, why: '' };
  mind.modeT += dt; mind.wantX = 0; mind.wantZ = 0;
  if (self.shoved) { mind.path = null; mind.pathT = 0; } // stuck on a corner: plan again

  // what it heard or sensed this tick: an alert first, your own noise, then any other noise; else the fuzzy sense
  let hint = obs.alerts.length ? obs.alerts[obs.alerts.length - 1] : null;
  const yours = obs.heard.find((h) => h.kind === 'kid');
  if (!hint && yours) hint = yours;
  for (const h of obs.heard) if (h.kind !== 'kid' && !(mind.mode === 'chase' && obs.sees)) hint = h;
  if (!hint && obs.ping) hint = { ...obs.ping, fuzzy: true };
  if (hint) { hint = snap(G, hint); mind.lastHint = hint; }

  if (!self.awake) { if (hint && !hint.fuzzy) mind.pending = hint; mind.mode = 'sleep'; return gi; }
  if (mind.mode === 'sleep') { setMode(G, mind, 'patrol'); if (!hint && mind.pending) hint = mind.pending; mind.pending = null; }

  const k = obs.kid, sees = obs.sees, act = self.act;
  const d = k ? Math.hypot(k.x - self.x, k.z - self.z) : Infinity;
  if (sees) { mind.lastSeen = { x: k.x, z: k.z, vx: k.vx, vz: k.vz, t: obs.t }; mind.lastHint = mind.lastSeen; }
  if (mind.wasAct === 'recover' && act === 'none' && !sees) mind.lostT = 0; // after a missed lunge, look again
  mind.wasAct = act;
  const lunging = act === 'windup' || act === 'lunge' || act === 'recover';
  const busy = mind.mode === 'chase' || mind.mode === 'breather' || lunging;
  const fury = self.rage > 0 ? MON.rageBoost : 0;

  // pressure: close and on you for too long, it backs off for a while (Alien's menace gauge)
  mind.menace = d < 8 && (sees || mind.mode === 'chase') ? mind.menace + dt : Math.max(0, mind.menace - dt * 0.5);
  if (mind.menace > MON.menaceMax && act !== 'lunge' && act !== 'windup') {
    mind.menace = 0; setMode(G, mind, 'breather');
    const ref = mind.lastHint || self;
    const far = G.candles.filter((c) => c.lit).sort((a, b) => Math.hypot(b.x - ref.x, b.z - ref.z) - Math.hypot(a.x - ref.x, a.z - ref.z))[0];
    mind.spot = far ? randomSpot(G, mind, far.x, far.z, 2) : randomSpot(G, mind, self.x, self.z, 6);
  }

  // you slipping through the same gap again and again: stop following, wait at the other end
  if (obs.gapSeen >= 0 && mind.mode === 'chase') {
    const p = obs.gapSeen;
    mind.gapUses[p] = (mind.gapUses[p] || 0) + 1; mind.chaseT = 0;
    if (mind.gapUses[p] >= MON.sameGap) { setMode(G, mind, 'ambush'); mind.ambushAt = passageExit(G, mind, self, p); mind.gapUses[p] = 0; }
  }

  if (obs.hideSeen >= 0 && mind.mode !== 'check') check(G, mind, G.wardrobes[obs.hideSeen]);
  if (sees && !busy && mind.mode !== 'check') { setMode(G, mind, 'chase'); mind.chaseT = 0; mind.gapUses = {}; }
  else if (hint && !busy && mind.mode !== 'check' && !(mind.mode === 'ambush' && hint.fuzzy)) { setMode(G, mind, 'hunt'); mind.huntAt = hint; }
  else if (hint && mind.mode === 'chase' && !sees && !hint.fuzzy) mind.lastSeen = { x: hint.x, z: hint.z, vx: 0, vz: 0, t: obs.t };

  switch (mind.mode) {
    case 'chase': {
      if (lunging) {
        // crouching, lunging, recovering: keep the stick on you (the body sets the pace)
        const at = sees ? k : mind.lastSeen;
        aim(mind, self, at.x, at.z, MON.chase);
        break;
      }
      if (sees) {
        mind.lostT = 0; mind.chaseT += dt;
        const dot = ((k.x - self.x) * self.hx + (k.z - self.z) * self.hz) / (d || 1);
        if (d < MON.lungeRange && self.cool <= 0 && dot > 0.8 && clearLine(G.L, self.x, self.z, k.x, k.z, MON.radius * 0.7, G.monBlocked)) {
          gi.lunge = true; aim(mind, self, k.x, k.z, MON.chase);
          break;
        }
        const kt = G.L.at(tileOf(k.x), tileOf(k.z));
        mind.stallT = (kt === T.TABLE || kt === T.BED) && self.speed < 0.4 ? mind.stallT + dt : 0;
        if (mind.stallT > 2) {
          const amb = ambushSpot(G, mind, self, { x: k.x, z: k.z, vx: 0, vz: 0 });
          if (amb) { setMode(G, mind, 'ambush'); mind.ambushAt = amb; break; }
        }
        const lead = Math.min(0.5, d / 8);
        steer(G, mind, self, k.x + k.vx * lead, k.z + k.vz * lead, Infinity, dt);
      } else {
        mind.lostT += dt;
        const at = mind.lastSeen, left = steer(G, mind, self, at.x, at.z, Infinity, dt);
        if (left < 0.6 || mind.lostT > 2.5) {
          G.events.push({ type: 'lost' });
          const amb = ambushSpot(G, mind, self, at), w = wardrobeNear(G, mind, at.x, at.z, 2.5);
          if (w) check(G, mind, w);
          else if (amb) { setMode(G, mind, 'ambush'); mind.ambushAt = amb; }
          else { setMode(G, mind, 'search'); mind.searchAt = snap(G, { x: at.x + at.vx * 1.2, z: at.z + at.vz * 1.2 }); mind.searchLeft = 3; }
        }
      }
      break;
    }
    case 'breather': {
      const left = steer(G, mind, self, mind.spot.x, mind.spot.z, MON.hunt, dt);
      if (mind.modeT > MON.breather || (left < 0.5 && mind.modeT > MON.breather * 0.6)) { setMode(G, mind, 'patrol'); mind.spot = null; }
      break;
    }
    case 'hunt': {
      const left = steer(G, mind, self, mind.huntAt.x, mind.huntAt.z, MON.hunt + fury, dt);
      if (left < 0.7 || mind.modeT > 12) { setMode(G, mind, 'search'); mind.searchAt = mind.huntAt; mind.searchLeft = 3; }
      break;
    }
    case 'ambush': {
      const left = steer(G, mind, self, mind.ambushAt.x, mind.ambushAt.z, MON.chase, dt);
      if (left < 0.4) {
        mind.linger += dt;
        if (mind.linger > 4.5) { mind.linger = 0; setMode(G, mind, 'search'); mind.searchAt = mind.ambushAt; mind.searchLeft = 2; }
      }
      if (mind.modeT > 10) { setMode(G, mind, 'search'); mind.searchAt = mind.ambushAt; mind.searchLeft = 2; }
      break;
    }
    case 'check': {
      const w = G.wardrobes[mind.checkW];
      if (mind.checking) {
        // looking inside; when the doors close again it has its answer (if you were in there, the game is over)
        if (act === 'none') { mind.checked[w.id] = obs.t; setMode(G, mind, 'search'); mind.searchAt = { x: w.fx, z: w.fz }; mind.searchLeft = 2; }
        break;
      }
      const left = steer(G, mind, self, w.fx, w.fz, mind.modeT < 0.1 ? MON.hunt : MON.hunt + fury, dt);
      if (left < 0.75) { mind.wantX = 0; mind.wantZ = 0; if (act === 'none') { gi.use = true; mind.checking = true; } }
      else if (mind.modeT > 12) { setMode(G, mind, 'search'); mind.searchAt = { x: w.fx, z: w.fz }; mind.searchLeft = 1; }
      break;
    }
    case 'search': {
      if (!mind.goal || mind.linger > 1.2) {
        if (mind.searchLeft-- <= 0) { setMode(G, mind, 'patrol'); break; }
        mind.linger = 0;
        const w = wardrobeNear(G, mind, mind.searchAt.x, mind.searchAt.z, MON.checkNear);
        if (w && mind.rand() < MON.checkChance) { check(G, mind, w); break; }
        const s = randomSpot(G, mind, mind.searchAt.x, mind.searchAt.z, 3.5);
        mind.goal = s; mind.path = null;
        mind.spot = s;
      }
      const left = steer(G, mind, self, mind.spot.x, mind.spot.z, MON.patrol + 0.4, dt);
      if (left < 0.5 || mind.modeT > 20) mind.linger += dt;
      break;
    }
    case 'patrol': {
      if (!mind.spot || mind.linger > 2.2) { mind.linger = 0; mind.spot = pickGuard(G, mind) || { x: self.x, z: self.z }; mind.path = null; }
      const left = steer(G, mind, self, mind.spot.x, mind.spot.z, MON.patrol, dt);
      if (left < 0.5 || mind.modeT > 25) mind.linger += dt;
      break;
    }
  }

  // the stick: up to hunt speed as is; faster needs run, against the run cap (chase + bloodlust + rage)
  const want = Math.hypot(mind.wantX, mind.wantZ);
  if (want > 1e-6) {
    const runCap = MON.chase + self.lust + (self.rage > 0 ? MON.rageBoost : 0);
    const run = want > MON.hunt + 1e-6, mag = Math.min(1, want / (run ? runCap : MON.hunt));
    gi.run = run; gi.mx = (mind.wantX / want) * mag; gi.mz = (mind.wantZ / want) * mag;
    // a shut door in the way: open it, or smash through when chasing
    const dr = act === 'none' && !gi.lunge && !gi.use ? doorAhead(G, self, mind.wantX, mind.wantZ) : null;
    if (dr) { if (mind.mode === 'chase') gi.bash = true; else gi.use = true; }
  }

  tools(G, mind, obs, gi);

  mind.target = mind.mode === 'chase' ? mind.lastSeen : mind.mode === 'hunt' ? mind.huntAt : mind.mode === 'ambush' ? mind.ambushAt
    : mind.mode === 'check' ? { x: G.wardrobes[mind.checkW].fx, z: G.wardrobes[mind.checkW].fz } : mind.spot;
  const h = mind.lastHint;
  mind.beliefs = h ? [{ x: h.x, z: h.z, spread: h.fuzzy ? MON.pingErr : 0.5, w: 1 }] : [];
  return gi;
}

// The searchlight and the hand on the old schedule, aimed where it last had a sense of you.
function tools(G, mind, obs, gi) {
  const t = obs.t, at = mind.lastHint || obs.self;
  if (obs.beam.state === 'on') {
    const tgt = obs.sees ? obs.kid : at, dx = tgt.x - obs.beam.x, dz = tgt.z - obs.beam.z, n = Math.hypot(dx, dz) || 1;
    gi.lx = dx / n; gi.lz = dz / n;
  }
  if (t >= mind.nextLight && obs.canLight && obs.reach.state === 'idle') {
    const a = mind.rand() * Math.PI * 2, e = 2 + mind.rand() * 4;
    gi.light = true; gi.ax = at.x + Math.cos(a) * e; gi.az = at.z + Math.sin(a) * e;
    mind.nextLight = t + BEAM.warn + BEAM.on + interval(G, BEAM.every) * (0.8 + mind.rand() * 0.4);
    return;
  }
  if (obs.candlesOut >= REACH.after && mind.nextReach < 0) mind.nextReach = t + REACH.first;
  if (mind.nextReach >= 0 && t >= mind.nextReach && obs.canReach) {
    const a = mind.rand() * Math.PI * 2, e = mind.rand() * REACH.aim;
    gi.reach = true; gi.ax = at.x + Math.cos(a) * e; gi.az = at.z + Math.sin(a) * e;
    mind.nextReach = t + REACH.shadow + REACH.down + REACH.hold + REACH.up + interval(G, REACH.every) * (0.8 + mind.rand() * 0.4);
  }
}
