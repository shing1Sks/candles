// Where the monster thinks you are: up to four guesses, each a place, how far you could have got from it (spread)
// and how much it believes it (w, summing to 1). Seeing you wipes them to one. Noises and the fuzzy sense add
// guesses; old ones fade and spread. A smart monster also moves its guesses the way you would go (toward the
// nearest lit candle), and loses faith in a guess it can see and you are not there.
import { KID } from '../rules.js';

const MAX = 4, MERGE = 2, MAX_SPREAD = 12, HALF_LIFE = 10;

// kind: what told it (sight, alert, ping, or the noise's kind); age: seconds since
function add(m, x, z, spread, strength, kind) {
  for (const b of m.beliefs) {
    if (Math.hypot(b.x - x, b.z - z) >= MERGE) continue;
    const c = b.conf + strength;
    b.x = (b.x * b.conf + x * strength) / c; b.z = (b.z * b.conf + z * strength) / c;
    b.spread = Math.min(b.spread, spread); b.conf = Math.min(1.5, b.conf + strength * 0.5); b.kind = kind; b.age = 0;
    return;
  }
  m.beliefs.push({ x, z, spread, conf: strength, w: 0, kind, age: 0 });
  if (m.beliefs.length > MAX) {
    m.beliefs.sort((a, b) => b.conf - a.conf);
    m.beliefs.length = MAX;
  }
}

export function updateBelief(G, m, obs, dt, persona) {
  if (obs.sees && obs.kid) {
    m.beliefs = [{ x: obs.kid.x, z: obs.kid.z, spread: 0.3, conf: 1, w: 1, kind: 'sight', age: 0, vx: obs.kid.vx, vz: obs.kid.vz }];
    return;
  }
  for (const a of obs.alerts) add(m, a.x, a.z, 0.3, 1, 'alert');
  for (const h of obs.heard) add(m, h.x, h.z, h.kind === 'kid' ? 1.5 : 0.5, h.kind === 'kid' ? 0.6 : 0.7, h.kind);
  if (obs.ping) add(m, obs.ping.x, obs.ping.z, 3, 0.5, 'ping');
  const self = obs.self, fade = 0.5 ** (dt / HALF_LIFE), smart = persona.smart > 0.5;
  for (const b of m.beliefs) {
    b.spread = Math.min(MAX_SPREAD, b.spread + KID.run * 0.6 * dt);
    b.conf *= fade; b.age = (b.age || 0) + dt;
    if (!smart) continue;
    // you would be heading for a candle: drift the guess toward the nearest lit one it can see from there
    let best = null, bd = Infinity;
    for (const c of G.candles) { if (!c.lit) continue; const d = Math.hypot(c.x - b.x, c.z - b.z); if (d < bd) { bd = d; best = c; } }
    if (best && bd > 0.5 && G.los(b.x, b.z, best.x, best.z)) { const s = Math.min(bd, 0.6 * dt); b.x += ((best.x - b.x) / bd) * s; b.z += ((best.z - b.z) / bd) * s; }
    // it can see the spot and you are not there
    if (Math.hypot(b.x - self.x, b.z - self.z) < 6 && G.los(self.x, self.z, b.x, b.z)) b.conf *= 0.2 ** dt;
  }
  const sum = m.beliefs.reduce((s, b) => s + b.conf, 0);
  for (const b of m.beliefs) b.w = sum > 0 ? b.conf / sum : 1 / m.beliefs.length;
}

// the guess it believes most
export const bestBelief = (m) => m.beliefs.reduce((a, b) => (!a || b.w > a.w ? b : a), null);
