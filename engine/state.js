// THE GAME STATE S: the hub from the napkin sketch. Plain JSON, so it can be hashed, snapshotted
// into the data twin, and (later) predicted by a model. Modules keep their state under their own key.

export function createState(seed, { night = 1, pagesFound = [] } = {}) {
  return {
    seed, night, tick: 0, t: 0,
    phase: 'play', // play | detention | expelled | home
    player: {
      x: 0, y: 0, z: 0, floor: 0, yaw: 0, pitch: 0, vx: 0, vz: 0,
      crouch: false, run: false, noise: 0, carrying: 0,
      seated: null, hidden: null, inStair: null, target: null,
    },
    held: { stars: 0, pass: 0, chalk: 0, pages: [...pagesFound] },
    clock: { minutes: 60, bell: false },
    layout: { epochs: {}, pinned: {}, entrances: {}, deadEndsSeen: {} },
    doors: {}, rooms: {}, lights: {}, interact: {},
    headmaster: {}, director: {}, stairs: {}, detention: {},
    events: [],
  };
}
