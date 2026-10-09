// RARE NIGHTS (research/07 phase 8). About one night in three, once, somewhere in the first ten
// minutes, something happens that you won't see again for a while (the kinds you've seen are held
// back, like the anomalies). Each is its own small situation:
//   procession  a crocodile of children, two by two, crosses the corridor ahead in silence (or walks
//               away from you down it); the last one stops and looks at you. Walk toward them and they're gone.
//   fireDrill   the fire bell, emergency lights everywhere, a stampede of feet you never see running
//               through you. While it rings nobody can hear you: the one safe time to run.
//   register    the PA calls the register. The answers stop before the end of it.
//   sanctuary   one corridor ahead with every light on and a radio playing. He won't come while you
//               stand in it; leave, and its lights go out behind you.
import { hash32 } from '../rng.js';

export const RARE_KINDS = ['procession', 'fireDrill', 'register', 'sanctuary'];

// the register: [seconds after it starts, the line]; the class answers less and less
export const REGISTER = [
  [0, 'Good afternoon, children. The register.'], [4, 'Alice Barton.  “Here, Miss.”'], [7, 'Daniel Cole.  “Here, Miss.”'],
  [10, 'Jenny Ford.  “Here.”'], [13, 'Michael Hart.'], [16, 'Michael Hart.'], [19, 'Sarah Lyle.'], [22, 'Peter Moss.'],
  [26, 'Thank you. Everybody is in the Hall.'], [31, '…Everybody but one.'],
];
const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

export const rare = {
  id: 'rare',

  init(S, ctx) {
    const R = ctx.rules.rare, h = hash32(S.seed, 'rare');
    let kind = S.layout.forceRare || null;
    if (!kind && h % 1000 < R.chance * 1000) {
      const seen = S.layout.seenRare || [], fresh = RARE_KINDS.filter((k) => !seen.includes(k)), pool = fresh.length ? fresh : RARE_KINDS;
      kind = pool[(h >>> 10) % pool.length];
    }
    const at = S.layout.forceRare ? 1 : R.window[0] + ((h >>> 20) % 1000) / 1000 * (R.window[1] - R.window[0]);
    S.rare = kind ? { kind, at: +at.toFixed(2), phase: 'wait' } : null;
  },

  step(S, input, ctx) {
    const X = S.rare, P = S.player;
    if (!X || X.phase === 'done' || S.phase !== 'play') return;
    if (X.phase === 'wait') {
      const H = S.headmaster, D = S.director;
      if (S.t < X.at || S.tick % 30 !== 0 || P.room || P.inStair || P.hidden) return;
      if ((H.state && H.state !== 'absent') || !['calm', 'unease', 'dread'].includes(D.phase)) return;
      if (S.opening && S.opening.phase !== 'night') return;
      if (this.start[X.kind].call(this, S, ctx)) { X.phase = 'on'; X.t0 = S.t; ctx.emit('rare', { kind: X.kind, ...this.where(X) }); }
      return;
    }
    this.run[X.kind].call(this, S, ctx, S.t - X.t0);
  },

  where(X) { return X.line ? { x: X.line.x, z: X.line.z } : X.zone ? { x: X.zone.cx, z: X.zone.cz } : {}; },

  end(S, ctx, extra = {}) { S.rare.phase = 'done'; ctx.emit('rareEnd', { kind: S.rare.kind, ...extra }); },

  start: {
    // a crossing ahead whose side arms are both open: they cross from one to the other
    procession(S, ctx) {
      const P = S.player, L = ctx.layout, R = ctx.rules.rare.procession, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      for (const dist of [9, 13, 17, 21, 25]) {
        const c = L.chunkAt(P.floor, P.x + fx * dist, P.z + fz * dist), cx = c.x0 + 12, cz = c.z0 + 12;
        const d = Math.hypot(cx - P.x, cz - P.z);
        if (d < 8 || d > 26 || !L.segmentClear(P.floor, P.x, P.z, cx, cz)) continue;
        // across your line of sight: the axis more perpendicular to the way you're looking
        const across = Math.abs(fx) > Math.abs(fz) ? ['N', 'S'] : ['W', 'E'];
        if (!c.ports[across[0]] || !c.ports[across[1]]) continue;
        const [px, pz] = SIDE_VEC[across[1]];
        S.rare.line = { x: cx, z: cz, floor: P.floor, px, pz, from: -R.span, span: R.span, n: R.n, gap: R.gap, speed: R.speed, across: true };
        return true;
      }
      // no crossing: the lights blink, and they're standing in your own corridor, all of them, the
      // nearest a few metres away; then they walk away from you into the dark
      const span = R.span + 2, far = span + 5;
      if (!L.segmentClear(P.floor, P.x, P.z, P.x + fx * (far + span), P.z + fz * (far + span))) return false;
      S.rare.line = { x: +(P.x + fx * far).toFixed(2), z: +(P.z + fz * far).toFixed(2), floor: P.floor, px: +fx.toFixed(3), pz: +fz.toFixed(3), from: -span + (Math.ceil(R.n / 2) - 1) * R.gap, span, n: R.n, gap: R.gap, speed: R.speed, across: false };
      return true;
    },
    fireDrill(S) { S.rare.rushAt = 5; return true; },
    register(S) { S.rare.next = 0; return true; },
    // the next chunk ahead, through an open port
    sanctuary(S, ctx) {
      const P = S.player, L = ctx.layout, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const here = L.chunkAt(P.floor, P.x, P.z);
      const side = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 'E' : 'W') : (fz > 0 ? 'S' : 'N');
      if (!here.ports[side]) return false;
      const [vx, vz] = SIDE_VEC[side], c = L.chunk(P.floor, here.i + vx, here.j + vz);
      if (S.director.canonical?.[c.key]) return false;
      S.rare.zone = { key: c.key, cx: c.x0 + 12, cz: c.z0 + 12, floor: P.floor };
      return true;
    },
  },

  run: {
    procession(S, ctx, t) {
      const X = S.rare, A = X.line, P = S.player, R = ctx.rules.rare.procession;
      const last = A.from + t * A.speed - (pairsOf(A) - 1) * A.gap; // where the last pair is along the line
      // the last one stops in the middle and looks at you, then goes on
      if (!X.turned && (A.across ? last >= 0 : t >= R.lookAfter)) { X.turned = S.t; ctx.emit('processionLooks', { x: A.x, z: A.z }); }
      if (X.turned && S.t - X.turned < R.look) A.from -= A.speed * ctx.rules.DT; // everyone waits for her
      const near = Math.hypot(A.x - P.x, A.z - P.z) < R.vanish || P.floor !== A.floor;
      if (near || last > A.span + 1) this.end(S, ctx, { vanished: near });
    },
    fireDrill(S, ctx, t) {
      const X = S.rare, R = ctx.rules.rare.fireDrill;
      S.player.noise = 0; // nobody can hear anything over the bell
      if (X.rushAt && t >= X.rushAt) { X.rushAt = null; ctx.emit('drillRush', { yaw: S.player.yaw }); }
      if (t >= R.secs) this.end(S, ctx, { text: 'Everyone went out. Nobody came back in.' });
    },
    register(S, ctx, t) {
      const X = S.rare;
      while (X.next < REGISTER.length && t >= REGISTER[X.next][0]) ctx.emit('registerLine', { text: REGISTER[X.next][1], n: X.next++ });
      if (X.next >= REGISTER.length && t >= REGISTER[REGISTER.length - 1][0] + 4) this.end(S, ctx);
    },
    sanctuary(S, ctx, t) {
      const X = S.rare, P = S.player, c = ctx.layout.chunkAt(P.floor, P.x, P.z);
      const inside = c.key === X.zone.key && P.floor === X.zone.floor;
      if (inside && !X.inside) ctx.emit('sanctuaryEnter', {});
      if (X.inside && !inside) { X.inside = false; this.end(S, ctx, { left: true }); return; }
      X.inside = inside;
      if (!X.entered && inside) X.entered = true;
      if (!X.entered && t > ctx.rules.rare.sanctuary.wait) this.end(S, ctx, { left: false });
    },
  },
};

// two by two: child k walks in pair floor(k / 2), on the left or the right
export const pairsOf = (A) => Math.ceil(A.n / 2);

// is chunk c the lit corridor of a sanctuary night?
export const sanctuaryLit = (S, c) => S.rare?.kind === 'sanctuary' && S.rare.phase === 'on' && S.rare.zone?.key === c.key;
// is the fire bell ringing?
export const drillOn = (S) => S.rare?.kind === 'fireDrill' && S.rare.phase === 'on';
