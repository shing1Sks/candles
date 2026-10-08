// THE BOY. Moves, looks, bumps into walls, climbs the stairs, makes noise, hides, and uses things.
// "use" works on whatever was in reach at the end of the previous tick (S.player.target), so a
// script or a test can set the target directly. Other modules see this tick's use in S.player.used.
import { RULES } from '../rules.js';

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export function spawnPoint(layout) {
  const c = layout.chunk(0, 0, 0), C = RULES.layout.chunk;
  return { x: c.x0 + C / 2, z: c.z0 + C / 2, floor: 0 };
}

export const player = {
  id: 'player',

  init(S, ctx) {
    const sp = spawnPoint(ctx.layout);
    Object.assign(S.player, { x: sp.x, z: sp.z, floor: sp.floor, y: 0, yaw: 0, pitch: 0, stepDist: 0, room: null, used: null, showWas: false });
  },

  step(S, input, ctx) {
    const P = S.player, R = ctx.rules.player, L = ctx.layout, emit = ctx.emit, DT = ctx.rules.DT;
    P.used = null;

    // look
    P.yaw += input.look?.yaw ?? 0;
    P.pitch = Math.max(P.pitchMin ?? -R.pitchMax, Math.min(R.pitchMax, P.pitch + (input.look?.pitch ?? 0)));
    if (S.phase !== 'play') { P.noise = 0; P.vx = P.vz = 0; return; }

    // drop a star / show the hall pass
    if (input.drop) {
      if (S.held.stars > 0) { S.held.stars--; emit('starDropped', { x: P.x, z: P.z, floor: P.floor, held: S.held.stars }); }
      else emit('dropEmpty');
    }
    const showing = !!input.show && S.held.pass > 0;
    if (input.show && !P.showWas && S.held.pass <= 0) emit('showEmpty');
    if (showing && !P.showing) emit('showPass');
    P.showing = showing;
    P.showWas = !!input.show;

    // use
    if (input.use) {
      const t = P.target;
      if (P.hidden) { emit('unhide', { id: P.hidden }); P.hidden = null; }
      else if (!t) emit('useNothing');
      else {
        P.used = t;
        emit('use', { kind: t.kind, id: t.id });
        if (t.kind === 'locker') { P.hidden = t.id; P.vx = P.vz = 0; emit('hide', { id: t.id }); }
      }
    }

    // move
    if (P.hidden || P.seated) {
      P.vx = P.vz = 0; P.noise = 0; P.run = false;
    } else {
      const crouch = !!input.crouch, carrying = P.carrying > 0;
      const run = !!input.run && !crouch && !carrying;
      const speed = crouch ? R.crouch : carrying ? R.carry : run ? R.run : R.walk;
      let mx = input.move?.x ?? 0, mz = input.move?.z ?? 0;
      const ml = Math.hypot(mx, mz);
      if (ml > 1) { mx /= ml; mz /= ml; }
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      const wx = rx * mx - fx * mz, wz = rz * mx - fz * mz;
      const k = Math.min(1, DT * 8);
      P.vx += (wx * speed - P.vx) * k;
      P.vz += (wz * speed - P.vz) * k;
      this.moveTo(S, L, R, P.x + P.vx * DT, P.z + P.vz * DT);
      const v = Math.hypot(P.vx, P.vz), moving = v > 0.2;
      P.crouch = crouch;
      P.run = run && moving;
      P.noise = moving ? R.noise[crouch ? 'crouch' : run ? 'run' : 'walk'] : 0;
      P.stepDist += v * DT;
      const every = R.stepEvery[crouch ? 'crouch' : run ? 'run' : 'walk'];
      if (moving && P.stepDist >= every) { P.stepDist = 0; emit('step', { floor: P.floor, run: P.run, crouch }); }
    }

    // where am I: room, stairs, floor
    const room = L.roomAt(P.floor, P.x, P.z);
    const roomId = room ? room.id : null;
    if (roomId !== P.room) { if (P.room) emit('roomLeave', { id: P.room }); if (roomId) emit('roomEnter', { id: roomId }); P.room = roomId; }
    const H = ctx.rules.layout.floorH;
    if (room && room.kind === 'stair') {
      const y = L.stairHeight(room, P.x, P.z), f = y >= H / 2 ? 1 : 0;
      P.y = y; P.inStair = room.id;
      if (f !== P.floor) { emit('floorChange', { from: P.floor, to: f }); P.floor = f; P.room = L.roomAt(f, P.x, P.z)?.id ?? null; }
    } else { P.inStair = null; P.y = P.floor * H; }

    P.target = findTarget(S, L, R);
  },

  // circle vs wall boxes, then never into unwalkable space (slide along one axis if needed)
  moveTo(S, L, R, nx, nz) {
    const P = S.player, r = R.radius;
    for (let pass = 0; pass < 2; pass++) {
      for (const w of [...L.wallsNear(P.floor, nx, nz, r + 0.6), ...furniture(S)]) {
        const qx = Math.max(w.x0, Math.min(nx, w.x1)), qz = Math.max(w.z0, Math.min(nz, w.z1));
        const dx = nx - qx, dz = nz - qz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-9) { nx = qx + (dx / d) * r; nz = qz + (dz / d) * r; continue; }
        // centre inside the box: out along the shallowest side
        const pen = [[nx - w.x0 + r, -1, 0], [w.x1 - nx + r, 1, 0], [nz - w.z0 + r, 0, -1], [w.z1 - nz + r, 0, 1]].sort((a, b) => a[0] - b[0])[0];
        nx += pen[1] * pen[0]; nz += pen[2] * pen[0];
      }
    }
    const ok = (x, z) => L.walkable(P.floor, x, z);
    const x0 = P.x, z0 = P.z;
    if (ok(nx, nz)) { P.x = nx; P.z = nz; }
    else if (ok(nx, P.z)) { P.x = nx; }
    else if (ok(P.x, nz)) { P.z = nz; }
    // velocity is what actually happened: pushing against a desk or a wall is standing still
    const DT = RULES.DT;
    P.vx = (P.x - x0) / DT; P.vz = (P.z - z0) / DT;
  },
};

// desks and the teacher's desk in the room you're in are solid
export function furniture(S) {
  const st = S.player.room && S.rooms[S.player.room];
  if (!st || !st.desks) return [];
  const f = st.frame, box = (x, z, along, across) => {
    const hx = Math.abs(f.ix) * along + Math.abs(f.lx) * across, hz = Math.abs(f.iz) * along + Math.abs(f.lz) * across;
    return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
  };
  const out = st.desks.map((d) => box(d.x, d.z, 0.24, 0.32));
  if (st.teacher) out.push(box(st.teacher.deskX, st.teacher.deskZ, 0.38, 0.75));
  return out;
}

// the nearest usable thing in reach, roughly in front of you
export function findTarget(S, L, R) {
  const P = S.player, cands = [];
  const C = RULES.layout.chunk, keys = new Set();
  for (const [dx, dz] of [[0, 0], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    const c = L.chunkAt(P.floor, P.x + dx, P.z + dz);
    if (keys.has(c.key)) continue;
    keys.add(c.key);
    for (const r of c.rooms) if (r.kind !== 'stair') cands.push({ kind: 'door', id: r.door.id, x: r.door.x, z: r.door.z });
    for (const k of c.lockers) {
      const [vx, vz] = SIDE_VEC[k.face];
      cands.push({ kind: 'locker', id: k.id, x: (k.x0 + k.x1) / 2 + vx * 0.25, z: (k.z0 + k.z1) / 2 + vz * 0.25 });
    }
  }
  for (const [id, it] of Object.entries(S.interact)) if ((it.floor ?? P.floor) === P.floor) cands.push({ ...it, id });
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, bd = Infinity;
  for (const c of cands) {
    const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
    if (d > (c.r ?? R.reach)) continue;
    if (d > 0.15) {
      const cos = (dx * fx + dz * fz) / d;
      if (cos < Math.cos(R.reachCone)) continue;
    }
    if (d < bd) { bd = d; best = { kind: c.kind, id: c.id }; }
  }
  return best;
}
