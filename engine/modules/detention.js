// CAUGHT: the screen crumples and you wake in detention, at a desk facing the board, the Headmaster
// asleep at his. Write "I will not leave" five times. When the snoring stops, stop writing: if he
// hears the chalk, you start again. After five lines: "Run along." Your stars stay behind.
// Caught after the final bell there is no detention. You are expelled.
import { detentionLine } from '../story.js';

export const detention = {
  id: 'detention',
  init(S) { S.detention = { lines: 0, writeT: 0, snore: true, snoreT: 0 }; },
  step(S, input, ctx) {
    const D = ctx.rules.detention, H = S.headmaster;
    if (H.caughtNow) {
      H.caughtNow = false;
      Object.assign(H, { state: 'absent', path: [], killQueue: [] });
      for (const id of H.killed || []) delete S.lights[id];
      H.killed = [];
      if (S.clock.bell) { S.phase = 'expelled'; ctx.emit('expelled', { why: 'caught' }); return; }
      if (S.phase !== 'play') return;
      S.phase = 'detention';
      Object.assign(S.player, { hidden: null, seated: null, carrying: 0, vx: 0, vz: 0, showing: false });
      delete S.player.pitchMin;
      S.detention = { lines: 0, writeT: 0, snore: true, snoreT: ctx.rng.span(D.snoreEvery), need: D.lines, text: detentionLine(S.held.pages.length) };
      ctx.emit('detentionStart', {});
      return;
    }
    if (S.phase !== 'detention') return;
    const T = S.detention, DT = ctx.rules.DT;
    T.snoreT -= DT;
    if (T.snoreT <= 0) {
      T.snore = !T.snore;
      T.snoreT = T.snore ? ctx.rng.span(D.snoreEvery) : D.quiet;
      ctx.emit(T.snore ? 'snoreStart' : 'snoreStop', {});
    }
    if (!input.useHeld) return;
    if (!T.snore) {
      if (T.lines > 0 || T.writeT > 0) { T.lines = 0; T.writeT = 0; ctx.emit('linesReset', {}); }
      return;
    }
    T.writeT += DT;
    if (T.writeT >= D.lineSecs) {
      T.writeT = 0; T.lines++;
      ctx.emit('lineWritten', { n: T.lines });
      if (T.lines >= D.lines) this.runAlong(S, ctx);
    }
  },

  // out into a fresh corridor, four chunks along, on the ground floor
  runAlong(S, ctx) {
    const C = ctx.rules.layout.chunk, P = S.player;
    const i = Math.floor(P.x / C) + 4, j = Math.floor(P.z / C);
    const c = ctx.layout.chunk(0, i, j);
    Object.assign(P, { x: c.x0 + C / 2, z: c.z0 + C / 2, floor: 0, y: 0, room: null, inStair: null, target: null });
    S.held.stars = 0;
    S.phase = 'play';
    ctx.emit('runAlong', { x: P.x, z: P.z });
  },
};
