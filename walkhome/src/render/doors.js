// FRONT DOORS. Any house with a garden gate, you can go up the path and ring the bell (E). A child
// would: someone grown-up might help. Nobody helps. Each house answers its own way, once:
//   nothing      the bell goes, the house listens, nothing comes
//   steps        someone inside comes down the hall to the door... and stops on the other side of it
//   knock        the bell, a long quiet, then three knocks back, from the inside, at your face
//   dog          something big behind the door goes mad
//   voice        through the letterbox, very quietly: "Go home."
//   porch        the porch light, on all night, goes off while you stand under it
// Ringing is noise: it carries down the street, and someone else hears it too.
import { at as roadAt, ROAD } from '../sim/road.js';
import { makeRng } from '../../../engine/rng.js';
import { caption } from './encounters.js';

const KINDS = ['nothing', 'steps', 'knock', 'dog', 'voice', 'steps', 'knock', 'nothing'];

export class Doors {
  constructor(town) {
    this.town = town; this.rung = new Set(); this.live = null;
    this.list = town.houses.filter((o) => !o.shop && !o.home && o.boundary !== 'none').map((o) => {
      const s = o.s + o.side * o.doorZ, p = roadAt(s, o.side * (ROAD.front - 0.05), 1.0);
      return { o, s, side: o.side, x: p.x, y: p.y, z: p.z, kind: makeRng('door:' + o.seed).pick(KINDS) };
    });
  }
  // the door you're standing at and facing, if any
  at(P, fwd) {
    if (Math.abs(P.l) < ROAD.front - 1.4) return null;
    for (const d of this.list) {
      if (Math.abs(d.s - P.s) > 2 || Math.sign(P.l) !== d.side) continue;
      const dx = d.x - P.x, dz = d.z - P.z, dist = Math.hypot(dx, dz);
      if (dist < 1.35 && (dx * fwd.x + dz * fwd.z) / dist > 0.5) return d;
    }
    return null;
  }
  ring(d, c) {
    const S = c.sound, pos = { x: d.x, y: 1.4, z: d.z };
    c.emit('ring', { x: d.x, z: d.z });
    S?.one('syn_bell', { pos, gain: 0.7, slice: false, verb: 0.25, ref: 2, muffle: 2200 });
    if (this.rung.has(d)) return; // each house only answers once; after that it's just a bell in an empty hall
    this.rung.add(d); this.live = { door: d, t: 0, done: false, fired: {} };
  }
  update(dt, c) {
    const L = this.live; if (!L) return;
    L.t += dt; const d = L.door, S = c.sound, pos = { x: d.x, y: 1.2, z: d.z }, inside = { x: d.x + (d.x - c.P.x) * 0.6, y: 1.0, z: d.z + (d.z - c.P.z) * 0.6 };
    const once = (k, t, f) => { if (L.t > t && !L.fired[k]) { L.fired[k] = true; f(); } };
    switch (d.kind) {
      case 'steps':
        for (let i = 0; i < 5; i++) once('s' + i, 2.2 + i * 0.62, () => S?.one('step_concrete', { pos: inside, gain: 0.25 + i * 0.08, rate: 0.82, verb: 0.3, ref: 2, muffle: 900 }));
        once('stop', 6.5, () => { c.D.fear = Math.min(1, c.D.fear + 0.35); c.emit('growl', { level: 0.4 }); });
        if (L.t > 9) L.done = true; break;
      case 'knock':
        once('k', 4.2, () => { S?.one('syn_knock', { pos, gain: 1.0, slice: false, verb: 0.1, ref: 2, muffle: 2000 }); c.emit('startle', { amount: 0.35 }); });
        if (L.t > 6) L.done = true; break;
      case 'dog':
        once('d', 1.6, () => { for (let k = 0; k < 3; k++) S?.one('dog_inside', { pos: inside, gain: 1, rate: 0.75, verb: 0.3, at: k * 0.4, muffle: 1500 }); c.emit('startle', { amount: 0.3 }); c.D.fear = Math.min(1, c.D.fear + 0.5); });
        if (L.t > 4) L.done = true; break;
      case 'voice':
        once('v', 3.5, () => { S?.one('step_leaves', { pos, gain: 0.3, rate: 0.6, verb: 0.05, muffle: 3000 }); caption('(through the letterbox, very quietly) "Go home."', 4); });
        if (L.t > 8) L.done = true; break;
      default:
        if (L.t > 6) L.done = true;
    }
    if (L.done) this.live = null;
  }
}
