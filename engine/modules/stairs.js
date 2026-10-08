// THE THIRTEENTH STEP. On a flight with thirteen steps, never look back. Turn around once and
// someone is standing one step behind you; turn around again before you are off the stairs and
// they have you. Leaving the stairwell lets them go.
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export const stairs = {
  id: 'stairs',
  init(S) { S.stairs = { roomId: null, steps: 12, climbYaw: 0, follower: false, onFlight: false, back: false }; },
  step(S, input, ctx) {
    if (S.phase !== 'play') return;
    const P = S.player, L = ctx.layout, st = S.stairs;
    for (const e of S.events) if (e.type === 'roomLeave' && e.id === st.roomId) Object.assign(st, { roomId: null, follower: false, onFlight: false, back: false });
    if (P.inStair) {
      const room = L.roomById(P.inStair), c = L.chunkAt(P.floor, P.x, P.z);
      const { u, v, s } = L.stairUV(room, P.x, P.z);
      st.roomId = room.id;
      st.steps = c.stair?.steps ?? 12;
      st.onFlight = v > 1 && v < s - 2;
      // flight 1 climbs away from the door wall, flight 2 climbs back toward it
      const inward = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] }[room.door.side];
      const dir = u < s / 2 ? inward : [-inward[0], -inward[1]];
      st.climbYaw = Math.atan2(-dir[0], -dir[1]);
    }
    if (!st.onFlight || st.steps !== 13) { st.back = false; return; }
    const back = Math.abs(angDiff(P.yaw, st.climbYaw)) > ctx.rules.stairs.turnLimit;
    if (back && !st.back) {
      if (!st.follower) { st.follower = true; ctx.emit('followerAppears', { room: st.roomId }); }
      else { ctx.emit('followerCatch', { room: st.roomId }); S.headmaster.caughtNow = true; }
    }
    st.back = back;
  },
};
