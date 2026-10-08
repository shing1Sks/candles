// LIGHT, as game state (research/05 R9, R12). Every ceiling tube's strength is decided here, so the
// engine knows where it's dark (tension, the Headmaster's reveals) and the renderer only draws it.
//   - the night's act: 1 Normal (1:00-1:30), 2 Wrong (-2:15), 3 Hunted (-3:00), 4 Unravel (3:00+)
//   - each chunk has a lighting state, rolled per act: full / patchy / dead / emergency / flicker
//   - in patchy corridors, ~30% of tubes are dead at 1:00, rising to ~60% by 3:00
//   - the Headmaster's kills (S.lights) dim on top
import { hash32 } from './rng.js';

export const actOf = (minutes) => (minutes < 90 ? 1 : minutes < 135 ? 2 : minutes < 180 ? 3 : 4);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function chunkLightState(S, c) {
  if (S.clock.bell) return 'flicker';
  const h = hash32(S.seed, 'lightstate', c.key, c.epoch) % 100, act = actOf(S.clock.minutes);
  if (S.director?.canonical?.[c.key]) return 'full'; // the opening's baseline corridors
  if (act === 1) return h < 15 ? 'full' : 'patchy';
  if (act === 2) return h < 12 ? 'dead' : 'patchy';
  if (act === 3) return h < 18 ? 'dead' : h < 26 ? 'emergency' : 'patchy';
  return h < 20 ? 'dead' : h < 30 ? 'emergency' : 'patchy';
}

// { I: 0..1.2, flicker, state } for one tube of chunk c
export function lightLevel(S, c, l) {
  const state = chunkLightState(S, c);
  const h = (hash32(S.seed, 'tube', l.id) % 1000) / 10; // 0..100, fixed per tube
  const deadPct = 30 + 30 * clamp01((S.clock.minutes - 60) / 120);
  let I = 0, flicker = false;
  if (state === 'full') I = 0.6 + (Math.floor(h) % 7) * 0.05;
  else if (state === 'patchy' || state === 'flicker') {
    if (h >= deadPct) { I = 0.55 + (Math.floor(h) % 7) * 0.06; flicker = h < deadPct + 8; }
  }
  if (state === 'flicker') flicker = true;
  const over = S.lights[l.id];
  if (over !== undefined) I *= over;
  return { I, flicker, state };
}

// is there a live tube within r metres (same floor)? the cheap "am I in the dark" question
export function litNear(S, layout, floor, x, z, r = 4.5) {
  for (const [dx, dz] of [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]) {
    const c = layout.chunkAt(floor, x + dx, z + dz);
    for (const l of c.lights) if (Math.hypot(l.x - x, l.z - z) < r && lightLevel(S, c, l).I > 0.25) return true;
  }
  return false;
}
