// WANDER: explores. Walks to random places along the corridors, sometimes opens a classroom door and
// looks in, hides in a locker when the Headmaster arrives, drops a star when he chases.
import { NO_INPUT } from '../world.js';
import { steerTo, face, dist, detention, headmasterReflex, leaveRoom } from './steer.js';

export const wander = {
  init() { return { goal: null, path: null }; },

  act(S, L, rng, mem, events) {
    const P = S.player;
    if (S.phase === 'detention') return detention(S, rng);
    if (S.phase !== 'play') return { ...NO_INPUT };
    const reflex = headmasterReflex(S, L, rng, mem, events);
    if (reflex) return reflex;
    // a door in front of you: sometimes open it
    if (P.target?.kind === 'door' && !S.doors[P.target.id]?.open && !mem.triedDoor?.[P.target.id]) {
      (mem.triedDoor ??= {})[P.target.id] = true;
      if (rng.chance(0.5)) return { ...NO_INPUT, use: true };
    }
    if (!mem.goal || dist(P, mem.goal) < 1 || (mem.stuck = (mem.stuck || 0) + 1) > 60 * 25) {
      const { nodes } = L.nav(P.floor);
      const near = [...nodes.values()].filter((n) => { const d = dist(P, n); return d > 6 && d < 34; });
      mem.goal = near.length ? near[Math.floor(rng.next() * near.length)] : { x: P.x + rng.range(-10, 10), z: P.z + rng.range(-10, 10) };
      mem.stuck = 0;
    }
    // looked in; back out the way you came
    if (P.room && !mem.goal.inRoom) { const out = leaveRoom(S, L, mem); if (out) return out; }
    return steerTo(S, L, mem.goal, mem, { run: rng.chance(0.002) ? !mem.run : mem.run });
  },
};
