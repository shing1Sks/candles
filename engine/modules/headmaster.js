// THE HEADMASTER. He arrives somewhere out of sight, and the lights between him and you die one by
// one toward you. He patrols, walks to noises, and when he sees you he comes for you. Out of sight
// for long enough, he loses you. A hall pass makes him stoop into your face and go. A dropped star
// stops him while he pins it to his coat. He catches you within a metre.
//   absent -> approach -> patrol <-> chase -> (catch | lose) ... -> leave -> absent
//   and from any of those: stoop (hall pass), pinStar (dropped star)

const ACTIVE = new Set(['approach', 'patrol', 'chase']);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const headingTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz)); // the player's yaw convention

export const headmaster = {
  id: 'headmaster',

  init(S) {
    Object.assign(S.headmaster, { state: 'absent', x: 0, z: 0, floor: 0, yaw: 0, path: [], timer: 0, seenAt: -1e9, heardAt: -1e9, lastSeen: null, killQueue: [], killed: [], killT: 0, restoreT: 0, stateT: 0, caughtNow: false });
  },

  // called by the director. 'patrol': appear 30-50 m away along the corridors, out of sight, and come
  // to your part of the school. 'glimpse': stand still in plain sight far down a corridor, backlit, for
  // a few seconds; then the light over him dies and he's gone (research/05 R6).
  arrive(S, ctx, mode = 'patrol') {
    const H = S.headmaster, P = S.player, L = ctx.layout, R = ctx.rules.headmaster, C = ctx.rules.layout.chunk;
    if (mode === 'glimpse') return this.arriveGlimpse(S, ctx);
    // make sure the neighbourhood exists so there is somewhere to come from
    const pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) L.chunk(P.floor, pi + di, pj + dj);
    const { nodes } = L.nav(P.floor);
    const cands = [];
    for (const [id, n] of nodes) {
      const d = Math.hypot(n.x - P.x, n.z - P.z);
      if (d < R.spawnDist[0] - 10 || d > R.spawnDist[1] + 10) continue;
      if (L.segmentClear(P.floor, P.x, P.z, n.x, n.z)) continue; // never in plain view
      cands.push({ id, ...n, score: Math.abs(d - (R.spawnDist[0] + R.spawnDist[1]) / 2) });
    }
    if (!cands.length) return false;
    cands.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1));
    const pick = cands[Math.floor(ctx.rng.next() * Math.min(4, cands.length))];
    const path = L.path(P.floor, { x: pick.x, z: pick.z }, { x: P.x, z: P.z }) || [];
    Object.assign(H, { state: 'approach', x: pick.x, z: pick.z, floor: P.floor, path, stateT: 0, timer: ctx.rng.span(R.patrolFor), killT: 0, caughtNow: false });
    H.yaw = path.length > 1 ? headingTo(H.x, H.z, path[1].x, path[1].z) : 0;
    // the tubes along his way to you, nearest him first, within sight of you
    const lights = [];
    for (const key of L.generated) {
      const [f, i, j] = key.split(':').map(Number);
      if (f !== P.floor) continue;
      for (const l of L.chunk(f, i, j).lights) {
        if (Math.hypot(l.x - P.x, l.z - P.z) > R.killRadius) continue;
        let best = Infinity, along = 0, acc = 0;
        for (let k = 1; k < path.length; k++) {
          const a = path[k - 1], b = path[k], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
          const t = Math.max(0, Math.min(1, ((l.x - a.x) * dx + (l.z - a.z) * dz) / (len * len)));
          const d = Math.hypot(a.x + dx * t - l.x, a.z + dz * t - l.z);
          if (d < best) { best = d; along = acc + t * len; }
          acc += len;
        }
        if (best < 1.2 && S.lights[l.id] !== 0) lights.push({ id: l.id, along });
      }
    }
    lights.sort((a, b) => a.along - b.along || (a.id < b.id ? -1 : 1));
    H.killQueue = lights.map((l) => l.id);
    ctx.emit('hmArrive', { x: H.x, z: H.z, floor: H.floor, mode: 'patrol' });
    return true;
  },

  arriveGlimpse(S, ctx) {
    const H = S.headmaster, P = S.player, L = ctx.layout, R = ctx.rules.headmaster, C = ctx.rules.layout.chunk;
    if (P.room) return false;
    const pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) L.chunk(P.floor, pi + di, pj + dj);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let best = null, bs = -1e9;
    for (const n of L.nav(P.floor).nodes.values()) {
      const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz);
      if (d < R.glimpseDist[0] || d > R.glimpseDist[1]) continue;
      if (!L.segmentClear(P.floor, P.x, P.z, n.x, n.z)) continue;
      const score = (dx * fx + dz * fz) / d + ctx.rng.next() * 0.3;
      if (score > bs) { bs = score; best = n; }
    }
    if (!best) return false;
    Object.assign(H, { state: 'glimpse', x: best.x, z: best.z, floor: P.floor, path: [], stateT: 0, timer: R.glimpseHold, killQueue: [], caughtNow: false });
    H.yaw = Math.atan2(-(P.x - H.x), -(P.z - H.z));
    ctx.emit('hmArrive', { x: H.x, z: H.z, floor: H.floor, mode: 'glimpse' });
    return true;
  },

  // the end of a glimpse: the nearest light to him dies, and he is not there any more
  vanish(S, ctx) {
    const H = S.headmaster, L = ctx.layout;
    let near = null, nd = 1e9;
    const c = L.chunkAt(H.floor, H.x, H.z);
    for (const l of c.lights) { const d = Math.hypot(l.x - H.x, l.z - H.z); if (d < nd) { nd = d; near = l; } }
    if (near && nd < 5) { S.lights[near.id] = 0; H.killed.push(near.id); ctx.emit('hmLightDie', { lightId: near.id }); }
    this.setState(H, 'absent');
    ctx.emit('hmVanish', { x: H.x, z: H.z });
  },

  step(S, input, ctx) {
    const H = S.headmaster, P = S.player, R = ctx.rules.headmaster, L = ctx.layout, DT = ctx.rules.DT, emit = ctx.emit;
    if (H.state === 'absent' || !H.state || S.phase !== 'play') return;
    H.stateT += DT;
    const bell = !!S.clock.bell;
    const dist = Math.hypot(P.x - H.x, P.z - H.z);
    const sameFloor = P.floor === H.floor && S.phase === 'play';

    // lights die toward you while he approaches and patrols
    if (H.killQueue.length && (H.state === 'approach' || H.state === 'patrol' || H.state === 'chase')) {
      H.killT -= DT;
      if (H.killT <= 0) {
        const id = H.killQueue.shift();
        S.lights[id] = 0; H.killed.push(id); H.killT = R.lightEvery;
        emit('hmLightDie', { lightId: id });
      }
    }

    // a hall pass, shown close enough, ends it
    if (ACTIVE.has(H.state) && sameFloor && P.showing && dist <= R.passDist && S.held.pass > 0) {
      S.held.pass--; P.showing = false;
      this.setState(H, 'stoop'); H.timer = R.stoop;
      emit('hmStoop', { x: H.x, z: H.z });
    }
    // a star dropped where he can see it stops him
    const drop = S.events.find((e) => e.type === 'starDropped');
    if (drop && ACTIVE.has(H.state) && Math.hypot(drop.x - H.x, drop.z - H.z) < R.sight.dist) {
      H.resume = H.state === 'chase' ? 'chase' : 'patrol';
      this.setState(H, 'pinStar'); H.timer = R.pinStar;
      emit('hmPinStar', { x: drop.x, z: drop.z });
    }

    if (H.state === 'glimpse') {
      H.timer -= DT;
      H.yaw = Math.atan2(-(P.x - H.x), -(P.z - H.z));
      if (H.timer <= 0 || dist < R.glimpseFlee || !sameFloor) this.vanish(S, ctx);
      return;
    }
    if (H.state === 'stoop') { H.timer -= DT; if (H.timer <= 0) this.leave(S, ctx); return; }
    if (H.state === 'pinStar') { H.timer -= DT; if (H.timer <= 0) { this.setState(H, H.resume || 'patrol'); H.seenAt = S.t; } return; }
    if (H.state === 'leave') { this.stepLeave(S, ctx); return; }

    // hiding while he's watching doesn't work
    for (const e of S.events) {
      if (e.type === 'hide' && S.t - H.seenAt < 2) P.hiddenSeen = true;
      if (e.type === 'unhide') P.hiddenSeen = false;
    }

    // senses
    const visible = sameFloor && !(P.hidden && !P.hiddenSeen);
    let sees = false;
    if (visible && dist <= R.sight.dist) {
      const ang = Math.abs(angDiff(headingTo(H.x, H.z, P.x, P.z), H.yaw));
      const inCone = ang <= R.sight.half || (H.state === 'chase' && ang <= Math.PI / 2);
      if (inCone && L.segmentClear(H.floor, H.x, H.z, P.x, P.z)) sees = true;
      else if (inCone && P.room && dist < 5) sees = this.throughWindow(S, L);
    }
    if (P.hidden && P.hiddenSeen && sameFloor) sees = true; // he watched you go in
    if (sees) {
      H.lastSeen = { x: P.x, z: P.z };
      if (H.state !== 'chase') { this.setState(H, 'chase'); emit('hmSee', { x: P.x, z: P.z }); }
      H.seenAt = S.t;
    } else if (sameFloor && !P.hidden && P.noise > R.hear.noise && dist <= R.hear.dist) {
      H.lastNoise = { x: P.x, z: P.z };
      if (S.t - H.heardAt > 1) emit('hmHear', { x: P.x, z: P.z });
      H.heardAt = S.t;
      if (H.state !== 'chase') { H.path = L.path(H.floor, H, H.lastNoise) || []; this.setState(H, 'patrol'); }
    }

    // catch
    if (H.state === 'chase' && sameFloor && dist <= R.catch && (sees || P.hiddenSeen)) {
      emit('hmCatch', { x: H.x, z: H.z, bell });
      H.caughtNow = true;
      this.restoreAll(S);
      this.setState(H, 'absent');
      return;
    }

    if (H.state === 'chase') {
      const speed = bell ? R.chaseBell : R.chase;
      const goal = sees ? { x: P.x, z: P.z } : H.lastSeen;
      if (goal) this.walkToward(S, L, goal, speed, DT);
      if (!sees && S.t - H.seenAt > R.loseAfter && !bell) {
        emit('hmLose', {});
        this.setState(H, 'patrol');
        const back = S.clock.minutes >= R.doublesBackAt ? { x: P.x, z: P.z } : H.lastSeen;
        H.path = back ? (L.path(H.floor, H, back) || []) : [];
      }
      return;
    }

    // approach / patrol: follow the path; patrol times out (never after the bell)
    this.followPath(S, R.patrol, DT);
    if (H.state === 'approach' && (dist < 14 || H.path.length <= 1)) this.setState(H, 'patrol');
    if (H.state === 'patrol') {
      if (!bell) H.timer -= DT;
      if (H.path.length <= 1) {
        // herded, not homing: somewhere in your part of the school (your chunk or a neighbour), or a noise he heard
        const C = ctx.rules.layout.chunk, ci = Math.floor(P.x / C) + ctx.rng.int(-1, 1), cj = Math.floor(P.z / C) + ctx.rng.int(-1, 1);
        const goal = H.lastNoise || { x: ci * C + C / 2, z: cj * C + C / 2 };
        H.path = L.path(H.floor, H, goal) || [];
        H.lastNoise = null;
      }
      if (S.clock.minutes >= R.checksLockersAt) this.checkLockers(S, ctx);
      if (H.timer <= 0) this.leave(S, ctx);
    }
  },

  setState(H, s) { H.state = s; H.stateT = 0; },

  // later in the night he opens some of the lockers he walks past
  checkLockers(S, ctx) {
    const H = S.headmaster, R = ctx.rules.headmaster, c = ctx.layout.chunkAt(H.floor, H.x, H.z);
    H.checked ??= {};
    for (const k of c.lockers) {
      if (H.checked[k.id]) continue;
      if (Math.hypot((k.x0 + k.x1) / 2 - H.x, (k.z0 + k.z1) / 2 - H.z) > 1.2) continue;
      H.checked[k.id] = true;
      if (!ctx.rng.chance(R.lockerCheckP)) continue;
      ctx.emit('hmOpenLocker', { id: k.id });
      if (S.player.hidden === k.id) { ctx.emit('hmCatch', { x: H.x, z: H.z, locker: k.id }); H.caughtNow = true; this.restoreAll(S); this.setState(H, 'absent'); }
    }
  },

  // through the little window of a closed door: you must be in its 1.2 m strip, he close outside
  throughWindow(S, L) {
    const P = S.player, H = S.headmaster, room = L.roomById(P.room);
    if (!room || S.doors[room.door.id]?.open) return false;
    const d = room.door, ns = d.side === 'N' || d.side === 'S';
    const lateralP = ns ? Math.abs(P.x - d.x) : Math.abs(P.z - d.z);
    const lateralH = ns ? Math.abs(H.x - d.x) : Math.abs(H.z - d.z);
    const outH = ns ? Math.abs(H.z - d.z) : Math.abs(H.x - d.x);
    return lateralP <= 0.6 && lateralH <= 1.2 && outH < 3;
  },

  walkToward(S, L, goal, speed, DT) {
    const H = S.headmaster;
    let target = goal;
    if (!L.segmentClear(H.floor, H.x, H.z, goal.x, goal.z)) {
      if (!H.path.length || H.pathGoal?.x !== goal.x || H.pathGoal?.z !== goal.z) { H.path = L.path(H.floor, H, goal) || []; H.pathGoal = { ...goal }; }
      if (H.path.length > 1) target = H.path[1];
    }
    const dx = target.x - H.x, dz = target.z - H.z, d = Math.hypot(dx, dz);
    if (d < 1e-6) { if (H.path.length > 1) H.path.shift(); return; }
    H.yaw = headingTo(H.x, H.z, target.x, target.z);
    const stepLen = Math.min(d, speed * DT);
    H.x += (dx / d) * stepLen; H.z += (dz / d) * stepLen;
    if (d <= speed * DT && H.path.length > 1 && target === H.path[1]) H.path.shift();
  },

  followPath(S, speed, DT) {
    const H = S.headmaster;
    let budget = speed * DT;
    while (budget > 0 && H.path.length > 1) {
      const n = H.path[1], dx = n.x - H.x, dz = n.z - H.z, d = Math.hypot(dx, dz);
      if (d > 1e-6) H.yaw = headingTo(H.x, H.z, n.x, n.z);
      if (d <= budget) { H.x = n.x; H.z = n.z; H.path.shift(); budget -= d; }
      else { H.x += (dx / d) * budget; H.z += (dz / d) * budget; budget = 0; }
    }
  },

  leave(S, ctx) {
    const H = S.headmaster, P = S.player, L = ctx.layout;
    this.setState(H, 'leave');
    H.killQueue = [];
    H.restoreT = 0;
    // walk away from you, down whichever corridor goes furthest
    const { nodes } = L.nav(H.floor);
    let far = null, fd = -1;
    for (const n of nodes.values()) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d > fd && d < 60) { fd = d; far = n; } }
    H.path = far ? (L.path(H.floor, H, far) || []) : [];
  },

  stepLeave(S, ctx) {
    const H = S.headmaster, R = ctx.rules.headmaster, DT = ctx.rules.DT;
    this.followPath(S, R.patrol, DT);
    H.restoreT -= DT;
    if (H.killed.length && H.restoreT <= 0) { delete S.lights[H.killed.pop()]; H.restoreT = R.restoreEvery; }
    // gone once he's out of your sight and well away, or after a while of walking off
    const d = Math.hypot(S.player.x - H.x, S.player.z - H.z);
    const unseen = H.floor !== S.player.floor || !ctx.layout.segmentClear(H.floor, H.x, H.z, S.player.x, S.player.z);
    const gone = (d > R.leaveDist && unseen) || H.path.length <= 1 || H.stateT > R.leaveMax;
    if (!H.killed.length && gone) { this.setState(H, 'absent'); ctx.emit('hmLeave', {}); }
  },

  restoreAll(S) {
    const H = S.headmaster;
    for (const id of H.killed) delete S.lights[id];
    H.killed = []; H.killQueue = [];
  },
};
