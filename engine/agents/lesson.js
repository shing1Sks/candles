// LESSON: does lessons by their rules. Finds a classroom it hasn't finished, opens the door, walks in,
// and plays the lesson: collects papers and freezes when the chalk stops (Hand In Your Work), sits
// and writes with its eyes down (Eyes On Your Own Paper), searches the hiding places and gives her
// the page (Story Time). It makes a deliberate mistake now and then (p = 0.1 per decision).
import { NO_INPUT } from '../world.js';
import { steerTo, face, dist, detention, headmasterReflex, leaveRoom } from './steer.js';

const MISTAKE = 0.1;

export const lesson = {
  init() { return { goal: null, path: null }; },

  act(S, L, rng, mem, events) {
    const P = S.player;
    if (S.phase === 'detention') return detention(S, rng);
    if (S.phase !== 'play') return { ...NO_INPUT };
    for (const e of events) if (e.type === 'chalkStop') mem.slip = !mem.noMistakes && rng.chance(MISTAKE);
    const st = P.room && S.rooms[P.room];
    if (st && st.state === 'running') return this.inLesson(S, L, rng, mem, st);
    const reflex = headmasterReflex(S, L, rng, mem, events);
    if (reflex) return reflex;
    // finished in here: out, and on to the next one
    if (st && st.state !== 'idle' && st.state !== 'running') return leaveRoom(S, L, mem) || this.findClass(S, L, rng, mem);
    return this.findClass(S, L, rng, mem);
  },

  // walk to the nearest classroom nobody has finished, open it, go in
  findClass(S, L, rng, mem) {
    const P = S.player, C = 24;
    if (!mem.target || (S.rooms[mem.target.id] && S.rooms[mem.target.id].state !== 'idle') || S.doors[mem.target.door.id]?.locked) { // (done, abandoned, or a room with no lesson in it)
      mem.target = null;
      let best = null, bd = 1e9;
      const pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        for (const r of L.chunk(P.floor, pi + di, pj + dj).rooms) {
          if (r.kind !== 'classroom') continue;
          const st = S.rooms[r.id];
          if (st && st.state !== 'idle') continue;
          if (S.doors[r.door.id]?.locked) continue;
          const d = Math.hypot(r.door.x - P.x, r.door.z - P.z);
          if (d < bd) { bd = d; best = r; }
        }
      }
      if (!best) return steerTo(S, L, { x: P.x + 24, z: P.z }, mem); // nothing near: move along
      mem.target = best;
    }
    const r = mem.target, d = r.door, o = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[d.side];
    const outside = { x: d.x + o[0] * 0.8, z: d.z + o[1] * 0.8 }, inside = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, inRoom: true };
    if (S.doors[d.id]?.open) return steerTo(S, L, dist(P, outside) < 0.9 || P.room === r.id ? inside : outside, mem);
    if (dist(P, outside) > 0.35) return steerTo(S, L, outside, mem);
    if (P.target?.kind === 'door' && P.target.id === d.id) return { ...NO_INPUT, use: true };
    return face(S, d.x, d.z, false);
  },

  inLesson(S, L, rng, mem, st) {
    const P = S.player, les = st.lesson;
    if (st.roll.lesson === 'handin') {
      if (les.phase === 'look' && !mem.slip) return { ...NO_INPUT };
      const left = st.students.filter((s) => s.paper === 'desk');
      if (!left.length) {
        if (P.target?.kind === 'desk') return { ...NO_INPUT, use: true };
        return this.approach(S, L, mem, { x: st.teacher.deskX, z: st.teacher.deskZ }, 0.9);
      }
      const s = left.reduce((a, b) => (dist(P, a) < dist(P, b) ? a : b));
      return { ...steerTo(S, L, s, mem), useHeld: true }; // sweep them up while walking past
    }
    if (st.roll.lesson === 'eyes') {
      if (!P.seated) {
        if (P.target?.kind === 'mydesk') return { ...NO_INPUT, use: true };
        return this.approach(S, L, mem, { x: st.mydesk.seatX, z: st.mydesk.seatZ }, 0.5);
      }
      const look = mem.slip && !mem.noMistakes && rng.chance(0.01) ? 0.1 : -0.9;
      return { ...NO_INPUT, useHeld: true, look: { yaw: 0, pitch: Math.max(-0.1, Math.min(0.1, look - P.pitch)) } };
    }
    // story: search the hiding places in order, then give her the page
    if (!les.page.found) {
      if (P.target?.kind === 'storyPage') return { ...NO_INPUT, use: true };
      const order = ['toybox', 'carpet', 'cubby', 'child'];
      mem.spot ??= 0;
      const spot = les.spots[order[mem.spot % 4]];
      if (dist(P, spot) < 1.0) mem.spot++;
      return this.approach(S, L, mem, spot, 0.6, { crouch: true });
    }
    if (P.target?.kind === 'lap') return { ...NO_INPUT, use: true };
    return this.approach(S, L, mem, st.teacher, 1.0);
  },

  // walk up to a point, then face it
  approach(S, L, mem, p, stop, opts = {}) {
    if (dist(S.player, p) > stop) return steerTo(S, L, p, mem, opts);
    return face(S, p.x, p.z, false, opts);
  },
};
