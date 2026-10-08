// THE DATA TWIN, v2: the whole night as data, filled from the engine's own state (not from meshes),
// one line every 5th engine step (12 per second). Each line holds every module's stream: the
// player and their input, what they hold, the clock, the Headmaster, the rooms that matter right
// now (the one you're in, and any lesson running), the director, the stairs, detention, and every
// event since the last line. Schema notes: research/01_data_twin.md (v2 section).
const r3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
const round = (o) => {
  if (Array.isArray(o)) return o.map(round);
  if (o && typeof o === 'object') { const out = {}; for (const [k, v] of Object.entries(o)) out[k] = round(v); return out; }
  return r3(o);
};

export const TWIN_EVERY = 5; // engine steps per twin line (60 Hz / 5 = 12 Hz)

export function snapshot(S, input, events, night = S.night) {
  const P = S.player, H = S.headmaster;
  const rooms = {};
  for (const [id, st] of Object.entries(S.rooms)) {
    if (id !== P.room && st.state !== 'running') continue;
    rooms[id] = {
      kit: st.kit, roll: st.roll, state: st.state, lesson: st.lesson,
      students: st.students?.map((s) => ({ id: s.id, x: s.x, z: s.z, paper: s.paper, tracking: s.tracking, faceBack: s.faceBack })),
      teacher: st.teacher, visitor: st.visitor ?? null, board: st.board ?? null,
    };
  }
  return round({
    t: S.t, tick: S.tick, night, seed: S.seed,
    input: { move: input.move, look: input.look, run: input.run, crouch: input.crouch, use: input.use, useHeld: input.useHeld, drop: input.drop, show: input.show },
    player: { x: P.x, y: P.y, z: P.z, floor: P.floor, yaw: P.yaw, pitch: P.pitch, vx: P.vx, vz: P.vz, crouch: P.crouch, run: P.run, noise: P.noise, carrying: P.carrying, seated: P.seated, hidden: P.hidden, room: P.room, inStair: P.inStair, target: P.target },
    held: S.held,
    clock: S.clock,
    headmaster: { state: H.state, x: H.x, z: H.z, floor: H.floor, yaw: H.yaw, killed: H.killed?.length ?? 0 },
    rooms,
    director: { nextPatrol: S.director.nextPatrol, lastRoll: S.director.lastRoll, patrols: S.director.patrols },
    stairs: S.stairs, detention: S.detention, layout: { entrances: Object.keys(S.layout.entrances), pinned: Object.keys(S.layout.pinned) },
    phase: S.phase,
    events,
  });
}
