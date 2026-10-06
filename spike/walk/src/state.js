// THE GAME STATE: the hub from the napkin sketch. Every system reads and writes this one object,
// and announces what happened as events. Dialogue, sound and the data twin all listen to events.

export function createState() {
  return {
    t: 0,                       // world time (advances in 12 fps stop-motion steps)
    player: {
      x: 0, z: 0, yaw: 0, pitch: -0.02, vx: 0, vz: 0,
      bob: 0, walk: 0, sprint: 0, reaching: false,
    },
    held: [],                   // colour index of each petal pinned to the back of your hand
    wind: 0.5, windAng: 0.6,    // strength and direction
    mist: 0, mistTarget: 0,     // 0 clear .. 1 thick fog bank
    dread: 0,                   // how present the entity is (0..1)
    shake: 0,
    dropped: null,              // the last petal you let go of: { x, z, colour, t }
    endings: 0, caught: 0,
    events: [],
  };
}

export function emit(S, type, data = {}) {
  S.events.push({ t: +S.t.toFixed(3), type, ...data });
}

export function forwardOf(p) { return [-Math.sin(p.yaw), -Math.cos(p.yaw)]; }
export function rightOf(p) { return [Math.cos(p.yaw), -Math.sin(p.yaw)]; }
// angle between where you look and a point (0 = dead ahead)
export function viewAngle(p, x, z) {
  const a = Math.atan2(x - p.x, -(z - p.z)) + p.yaw;
  return Math.atan2(Math.sin(a), Math.cos(a));
}
