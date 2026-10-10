// What the monster may know, and nothing more. The world fills this in at the end of every tick; the giant's mind
// reads it (observe) before it presses its buttons on the next. It never sees through walls; it hears noises
// (fainter through walls); every few seconds it gets a fuzzy sense of where you are; a candle going out or the
// searchlight catching you tell it exactly where.
import { MON, CANDLE } from './rules.js';
import { T } from './level.js';
import { lightAt } from './light.js';

const tileOf = Math.floor;

export function createSense() {
  return {
    pingT: MON.pingEvery[0] * 0.5, heard: [], alerts: [], alertsSeen: [], ping: null, hideSeen: -1, gapSeen: -1,
    lastSeen: null, lastSeenT: -99, sightT: 0, unseenT: 0, kidGap: -1, wake: false,
  };
}

// a candle going out, or the searchlight catching you: the giant is told exactly where
export function alert(G, x, z, kind) {
  G.sense.alerts.push({ x, z, kind });
  G.sense.wake = true;
}

export function canSee(G) {
  const k = G.kid, M = G.monster, L = G.L, d = Math.hypot(k.x - M.x, k.z - M.z);
  if (k.hidden >= 0) return false; // in a wardrobe
  if (L.sightBlocked(tileOf(k.x), tileOf(k.z))) return false; // in a vent or a crack
  const under = L.at(tileOf(k.x), tileOf(k.z));
  if ((under === T.TABLE || under === T.BED) && d > MON.hiddenSeen) return false;
  const range = lightAt(G, k.x, k.z) > CANDLE.litAt ? MON.sightLit : MON.sightDark;
  if (d > range) return false;
  const dot = ((k.x - M.x) * M.hx + (k.z - M.z) * M.hz) / (d || 1);
  if (dot < MON.fov && d > MON.sightClose) return false;
  return G.los(M.x, M.z, k.x, k.z);
}

// End of a tick: what it saw, heard and sensed this tick. It piles up until its mind next looks (observe), so a
// mind that decides every few ticks still hears everything.
export function sense(G, dt, hidNow) {
  const S = G.sense, M = G.monster, k = G.kid, L = G.L;
  const alerts = S.alerts, heard = []; // raised during this tick
  S.alerts = [];
  const sees = M.awake && canSee(G);
  if (sees) {
    if (!M.sees && G.t - S.lastSeenT > 3) G.events.push({ type: 'spotted' });
    S.lastSeen = { x: k.x, z: k.z, vx: k.vx, vz: k.vz }; S.lastSeenT = G.t;
    S.sightT += dt; S.unseenT = 0;
  } else if ((S.unseenT += dt) > 1) S.sightT = 0;
  M.sees = sees;
  // the kid slipping into a gap: it saw that if it had sight a moment ago. Taking a gap breaks bloodlust.
  const kp = L.passageAt(tileOf(k.x), tileOf(k.z));
  if (kp >= 0 && kp !== S.kidGap) {
    S.sightT = 0;
    if (G.t - S.lastSeenT < 0.5) S.gapSeen = kp; // it saw you go in
  }
  S.kidGap = kp;
  // seen getting into a wardrobe
  if (hidNow >= 0 && G.t - S.lastSeenT < 1.5) {
    const w = G.wardrobes[hidNow];
    if (Math.hypot(w.fx - S.lastSeen.x, w.fz - S.lastSeen.z) < 3) S.hideSeen = w.id;
  }
  // hearing: your own running, crawling and blowing (it hears roughly where), and every other noise exactly
  const d = Math.hypot(k.x - M.x, k.z - M.z);
  if (k.noise > 0) {
    const r = G.los(M.x, M.z, k.x, k.z) ? k.noise : k.noise * 0.6;
    if (d < r) heard.push({ x: k.x + (G.rand() - 0.5), z: k.z + (G.rand() - 0.5), kind: 'kid' });
  }
  for (const n of G.noises) {
    const nd = Math.hypot(n.x - M.x, n.z - M.z), r = G.los(M.x, M.z, n.x, n.z) ? n.r : n.r * 0.65;
    if (nd < r) heard.push({ x: n.x, z: n.z, kind: n.kind });
  }
  // the fuzzy sense of you, when nothing else told it anything this tick
  S.pingT -= dt;
  if (!alerts.length && !heard.length && S.pingT <= 0) {
    const left = G.candles.filter((c) => c.lit).length, f = (left - 1) / Math.max(1, G.candles.length - 1);
    S.pingT = (MON.pingEvery[1] + (MON.pingEvery[0] - MON.pingEvery[1]) * f) * (0.8 + G.rand() * 0.4);
    const a = G.rand() * Math.PI * 2, e = G.rand() * MON.pingErr;
    S.ping = { x: k.x + Math.cos(a) * e, z: k.z + Math.sin(a) * e };
  }
  S.heard.push(...heard); S.alertsSeen.push(...alerts);
}

// What the giant's mind gets to know now. Reading it takes what piled up since the last look.
export function observe(G) {
  const M = G.monster, S = G.sense, k = G.kid, B = G.beam, R = G.reach;
  const out = G.candles.filter((c) => !c.lit).length;
  const heard = S.heard, alerts = S.alertsSeen, ping = S.ping, hideSeen = S.hideSeen, gapSeen = S.gapSeen;
  S.heard = []; S.alertsSeen = []; S.ping = null; S.hideSeen = -1; S.gapSeen = -1;
  return {
    t: G.t,
    self: { x: M.x, z: M.z, hx: M.hx, hz: M.hz, vx: M.vx, vz: M.vz, act: M.act, actT: M.actT, speed: M.speed, awake: M.awake, shoved: M.shoved, cool: M.cool, yellCool: M.yellCool, rage: M.rage, lust: M.lust },
    sees: M.sees, kid: M.sees ? { x: k.x, z: k.z, vx: k.vx, vz: k.vz } : null,
    lastSeen: S.lastSeen, lastSeenT: S.lastSeenT,
    heard, ping, alerts, hideSeen, gapSeen,
    candles: G.candles, doors: G.doors, wardrobes: G.wardrobes, candlesOut: out,
    canLight: B.state === 'idle' && B.cool <= 0,
    canReach: out >= 2 && R.state === 'idle' && R.cool >= 0 && R.cool <= 0 && B.state === 'idle',
    beam: { state: B.state, x: B.x, z: B.z, spotted: B.spotted }, reach: { state: R.state, x: R.x, z: R.z },
  };
}
