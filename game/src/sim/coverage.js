// How often each rule in docs/mechanics.md happens in a game: one counter per case id, counted after every
// recorded step from the state after it, the events during it, and both inputs. The dataset's coverage report adds
// these up, so we can show the data teaches every rule (and every "nothing happens").
import { T } from './level.js';

// fixed facts of the board: true in every game, nothing to count
export const STATIC_CASES = ['G0', 'G1', 'G2', 'G3'];

const tf = Math.floor;
const ev = (type, f) => (G, E) => { let n = 0; for (const e of E) if (e.type === type && (!f || f(e))) n++; return n; };
const st = (f) => (G, E, ki, gi) => (f(G, E, ki, gi) ? 1 : 0);
const mode = (...m) => st((G) => m.includes(G.mind?.mode));
const under = (G) => { const t = G.L.at(tf(G.kid.x), tf(G.kid.z)); return t === T.TABLE || t === T.BED; };
const inWall = (G) => { const t = G.L.at(tf(G.kid.x), tf(G.kid.z)); return t === T.DUCT || t === T.CRACK; };
const dist = (G) => Math.hypot(G.kid.x - G.monster.x, G.kid.z - G.monster.z);

export const CASES = [
  { id: 'G4', detect: (G, E, ki, gi, row) => (row === 0 ? 1 : 0) },
  { id: 'G5', detect: ev('won') },
  { id: 'G6', detect: ev('caught') },
  { id: 'K1', detect: st((G) => G.kid.running) },
  { id: 'K2', detect: st((G, E, ki) => ki.creep && G.kid.speed > 0.1 && !G.kid.crawl) },
  { id: 'K3', detect: st((G) => G.kid.crawl && G.kid.speed > 0.1) },
  { id: 'K4', detect: st((G, E, ki) => Math.hypot(ki.mx, ki.mz) > 0.5 && G.kid.speed < 0.5 && G.kid.blowing < 0 && G.kid.hidden < 0) },
  { id: 'K5', detect: st((G) => G.kid.speed > 0.1) },
  { id: 'K6', detect: st((G) => G.kid.crawl && G.monster.awake && dist(G) < 3) }, // it is right there, crawling
  { id: 'C1', detect: ev('blowStart') },
  { id: 'C2', detect: ev('blowStop') },
  { id: 'C3', detect: st((G) => G.kid.blowing >= 0) },
  { id: 'C4', detect: ev('candleOut') },
  { id: 'C5', detect: st((G) => G.candles.filter((c) => !c.lit).length >= 2) },
  { id: 'C6', detect: ev('blowNothing') },
  { id: 'D1', detect: ev('door', (e) => e.by === 'kid') },
  { id: 'D2', detect: ev('door') },
  { id: 'D3', detect: ev('shutRefused') },
  { id: 'D4', detect: st((G) => G.doors.some((d) => !d.open && (Math.hypot(d.x - G.kid.x, d.z - G.kid.z) < 1 || Math.hypot(d.x - G.monster.x, d.z - G.monster.z) < 1.2))) },
  { id: 'D5', detect: ev('doorTry') },
  { id: 'W1', detect: ev('hide') },
  { id: 'W2', detect: (G, E) => ev('unhide')(G, E) + ev('unhideRefused')(G, E) },
  { id: 'W3', detect: ev('hideSeen') },
  { id: 'W4', detect: ev('checkOpen') },
  { id: 'W5', detect: ev('checkEmpty') },
  { id: 'N1', detect: st((G) => G.sense.heard.length > 0) },
  { id: 'N2', detect: ev('creak') },
  { id: 'N3', detect: ev('squeak') },
  { id: 'N4', detect: (G, E) => ev('pickup')(G, E) + ev('throw')(G, E) + ev('land')(G, E) },
  { id: 'N5', detect: ev('throwRefused') },
  { id: 'S1', detect: st((G) => G.monster.sees) },
  { id: 'S2', detect: st((G) => !!G.sense.ping) },
  { id: 'S3', detect: st((G) => G.sense.alertsSeen.length > 0) },
  { id: 'S4', detect: st((G) => G.sense.heard.length > 0 || G.sense.alertsSeen.length > 0) },
  { id: 'B0', detect: st((G) => !G.monster.awake) },
  { id: 'B1', detect: mode('chase') },
  { id: 'B2', detect: ev('lunge') },
  { id: 'B3', detect: st((G) => G.monster.lust > 0) },
  { id: 'B4', detect: ev('lost') },
  { id: 'B5', detect: mode('ambush') },
  { id: 'B6', detect: st((G) => under(G) && G.monster.sees) },
  { id: 'B7', detect: mode('breather') },
  { id: 'B8', detect: mode('hunt') },
  { id: 'B9', detect: mode('search') },
  { id: 'B10', detect: mode('patrol', 'guard', 'intercept') },
  { id: 'B11', detect: st((G) => G.monster.shoved) },
  { id: 'B12', detect: st((G) => G.monster.rage > 0) },
  { id: 'X1', detect: ev('caught', (e) => e.by === 'touch') },
  { id: 'X2', detect: ev('found') },
  { id: 'X3', detect: st((G) => inWall(G) && dist(G) < 1.2) },
  { id: 'X4', detect: st((G) => G.L.duct(Math.floor(G.monster.x), Math.floor(G.monster.z))) }, // it is in the vent duct
  { id: 'L1', detect: ev('beam') },
  { id: 'L2', detect: st((G) => G.beam.state === 'on') },
  { id: 'L3', detect: ev('beamSpot') },
  { id: 'H1', detect: st((G) => G.reach.cool >= 0) },
  { id: 'H2', detect: ev('grab') },
  { id: 'H3', detect: ev('grabbed') },
  { id: 'Z1', detect: st((G, E, ki, gi) => gi.run) },
  { id: 'Z2', detect: ev('yell') },
  { id: 'Z3', detect: ev('fury') },
  { id: 'Z4', detect: ev('tactic') },
];

// not rules but health checks on the data, counted the same way (keys start with _)
export const STATS = [
  // a standoff: the kid sitting still in cover with the monster awake right beside it (near-identical rows)
  { id: '_standoff', detect: st((G) => G.kid.crawl && G.kid.speed < 0.1 && G.monster.awake && dist(G) < 3) },
];

export function countCases(G, events, ki, gi, row, counts) {
  for (const c of CASES) {
    const n = c.detect(G, events, ki, gi, row);
    if (n) counts[c.id] = (counts[c.id] || 0) + n;
  }
  for (const c of STATS) if (c.detect(G, events, ki, gi, row)) counts[c.id] = (counts[c.id] || 0) + 1;
  return counts;
}
