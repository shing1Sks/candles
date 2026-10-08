// shared by the lesson tests: open the first ordinary classroom next to spawn, force its roll,
// and step the player inside so the lesson starts
import { createWorld, stepWorld, NO_INPUT } from '../world.js';

// (the third argument is the twists, or { scene, twists, valuables } for the rooms that aren't lessons)
export function enterClass(seed, lesson, opts = []) {
  const o = Array.isArray(opts) ? { twists: opts } : opts;
  const w = createWorld({ seed });
  w.S.director.nextPatrol = 1e9; // no Headmaster unless a test asks for him
  const want = lesson === 'story' ? (r) => r.kind === 'classroom' && r.kit === 'infants' : (r) => r.kind === 'classroom' && r.kit !== 'infants';
  let room = null;
  for (let i = 0; i <= 6 && !room; i++) for (let j = 0; j <= 6 && !room; j++) room = w.layout.chunk(0, i, j).rooms.find(want) || null;
  if (!room) throw new Error(`no ${lesson} room found for seed ${seed}`);
  w.S.director.forceRoll = { lesson, teacher: 'teacher', twists: o.twists || [], valuables: o.valuables || {}, ...(o.scene ? { scene: o.scene } : {}) };
  w.S.doors[room.door.id] = { open: true };
  Object.assign(w.S.player, { x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2, floor: 0 }); // step inside
  stepWorld(w, NO_INPUT);
  return { w, room: w.S.rooms[room.id], layoutRoom: room };
}
