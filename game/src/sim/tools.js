// The giant's own tools, used from its controller: the searchlight from its eye, and its hand reaching into the
// house. The giant chooses when and where; the world keeps the warnings, the cooldowns and the fairness.
import { BEAM, REACH, GIANT } from './rules.js';
import { T } from './level.js';
import { alert } from './senses.js';
import { caught } from './game.js';

export function createTools() {
  return {
    beam: { state: 'idle', cool: BEAM.first, t: 0, x: 0, z: 0, dx: 1, dz: 0, spotted: false },
    reach: { state: 'idle', cool: -1, t: 0, x: 0, z: 0 }, // cool -1: not armed until two candles are out
  };
}

// you are safe from the light and the hand in a wardrobe, a vent, a crack, or under a table or bed
export function covered(G) {
  const k = G.kid, t = G.L.at(Math.floor(k.x), Math.floor(k.z));
  return k.hidden >= 0 || t === T.DUCT || t === T.CRACK || t === T.TABLE || t === T.BED;
}

// the gap between uses shrinks as candles go out (at most the old schedule's shortest gap)
function gapFor(G, every) {
  const left = G.candles.filter((c) => c.lit).length, f = (left - 1) / Math.max(1, G.candles.length - 1);
  return (every[1] + (every[0] - every[1]) * f) * GIANT.cool;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function stepTools(G, gi, dt) {
  stepBeam(G, gi, dt);
  stepReach(G, gi, dt);
}

function stepBeam(G, gi, dt) {
  const B = G.beam, k = G.kid;
  B.t += dt;
  if (B.state === 'idle') {
    B.cool -= dt;
    if (!gi.light || B.cool > 0 || G.reach.state !== 'idle') return;
    B.x = clamp(gi.ax ?? k.x, 2, G.L.w - 2); B.z = clamp(gi.az ?? k.z, 2, G.L.h - 2);
    const a = G.rand() * Math.PI * 2; B.dx = Math.cos(a); B.dz = Math.sin(a);
    B.state = 'warn'; B.t = 0; B.spotted = false; B.cool = gapFor(G, BEAM.every);
    G.events.push({ type: 'beam', x: B.x, z: B.z });
  } else if (B.state === 'warn') {
    if (B.t > BEAM.warn) { B.state = 'on'; B.t = 0; }
  } else {
    // it drifts the way the giant's right stick pushes it
    const lx = gi.lx || 0, lz = gi.lz || 0, ln = Math.hypot(lx, lz);
    if (ln > 0.1) { B.dx += (lx / ln - B.dx) * dt * 0.6; B.dz += (lz / ln - B.dz) * dt * 0.6; }
    const n = Math.hypot(B.dx, B.dz) || 1;
    B.x = clamp(B.x + (B.dx / n) * BEAM.drift * dt, 1, G.L.w - 1); B.z = clamp(B.z + (B.dz / n) * BEAM.drift * dt, 1, G.L.h - 1);
    if (!B.spotted && Math.hypot(k.x - B.x, k.z - B.z) < BEAM.radius && !covered(G)) {
      B.spotted = true;
      G.events.push({ type: 'beamSpot' });
      alert(G, k.x, k.z, 'beam');
    }
    if (B.t > BEAM.on) { B.state = 'idle'; B.t = 0; }
  }
}

// idle -> shadow (it is coming) -> down -> hold (the grab) -> up
function stepReach(G, gi, dt) {
  const R = G.reach, k = G.kid;
  const out = G.candles.filter((c) => !c.lit).length;
  if (out < REACH.after) return;
  if (R.cool < 0) R.cool = REACH.first;
  R.t += dt;
  if (R.state === 'idle') {
    R.cool = Math.max(0, R.cool - dt);
    if (!gi.reach || R.cool > 0 || G.beam.state !== 'idle') return;
    R.x = clamp(gi.ax ?? k.x, 1.5, G.L.w - 1.5); R.z = clamp(gi.az ?? k.z, 1.5, G.L.h - 1.5);
    R.state = 'shadow'; R.t = 0; R.cool = gapFor(G, REACH.every);
    G.events.push({ type: 'reach', x: R.x, z: R.z });
  } else if (R.state === 'shadow') {
    if (R.t > REACH.shadow) { R.state = 'down'; R.t = 0; }
  } else if (R.state === 'down') {
    if (R.t > REACH.down) {
      R.state = 'hold'; R.t = 0;
      G.events.push({ type: 'grab', x: R.x, z: R.z });
      if (Math.hypot(k.x - R.x, k.z - R.z) < REACH.radius && !covered(G)) {
        G.events.push({ type: 'grabbed' });
        caught(G, 'grab');
      }
    }
  } else if (R.state === 'hold') {
    if (R.t > REACH.hold) { R.state = 'up'; R.t = 0; }
  } else if (R.t > REACH.up) { R.state = 'idle'; R.t = 0; }
}
