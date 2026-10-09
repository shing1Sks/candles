// THE LAST BELL (research/07 phase 8). Every night opens on an ordinary school: for a few seconds the
// corridors are lit end to end and there are children somewhere in the building. Then the bell goes,
// they stop mid-sound, and the lights go out bank by bank from the far end toward you (dayLit in
// lights.js). Wrongness needs a baseline, so the corridor you start in stays ordinary until Act II:
// fully lit, nothing wrong with it (S.director.canonical).
import { actOf } from '../lights.js';

export const opening = {
  id: 'opening',

  init(S, ctx) {
    const R = ctx.rules.opening, P = S.player, [i, j] = ctx.layout.chunkIJ(P.x, P.z);
    S.director.canonical = { [`${P.floor}:${i}:${j}`]: true };
    S.opening = { phase: 'day', bellAt: R.bellAt, sweep: R.sweep, from: null };
  },

  step(S, input, ctx) {
    const O = S.opening, P = S.player;
    if (O.phase === 'day' && S.t >= O.bellAt) {
      O.phase = 'sweep'; O.from = { x: +P.x.toFixed(2), z: +P.z.toFixed(2), floor: P.floor };
      ctx.emit('lastBell', { ...O.from, night: S.night });
    } else if (O.phase === 'sweep' && S.t >= O.bellAt + O.sweep) {
      O.phase = 'night';
      ctx.emit('lightsDown', {});
    }
    if (S.director.canonical && actOf(S.clock.minutes) >= 2) S.director.canonical = null;
  },
};
