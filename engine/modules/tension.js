// TENSION: scored at the end of every tick, from everything that happened in it (research/05 R1, R2).
//   + the Headmaster in sight (+4/s), near and audible (+2/s), lights dying toward you (+1.5/s)
//   + a lesson running (+0.5/s), being in the dark (+0.5/s), and bumps for scares, strikes, and the
//     small things: a sound somewhere, the PA, a corridor gone wrong, a room that isn't a lesson
//   - decay: slow while it's quiet (-0.35/s) so small things can build; faster once it's high
//     (-1.5/s from 40); -4/s in an aftermath
// (the playtest reel of 2026-10-08 showed a wandering player at tension 0 for five minutes straight)
// Phases by threshold: calm < 20 <= unease < 40 <= dread < 60 <= hunt < 80 <= peak. A peak, or
// escaping (losing him, finishing a lesson, a hall pass, a dropped star), forces an AFTERMATH:
// 45-60 s of relief, when nothing big may happen and he leaves.
import { litNear } from '../lights.js';
import { headmaster } from './headmaster.js';

const BUMPS = {
  hmSee: 15, followerAppears: 15, seenMoving: 8, strike: 8, apparition: 6, falseScare: 6, hmLightDie: 1.5, edgeThing: 2, lockedIn: 6, exitFail: 10, theyTurn: 14,
  loneChildSpeaks: 6, sceneEnter: 2, ambient: 2.5, anomalyNear: 4, pa: 3, hallDoor: 4, hmArrive: 6, apparitionGone: 3,
};
const ESCAPES = new Set(['hmLose', 'lessonSuccess', 'hmStoop', 'hmPinStar', 'runAlong']);

export const tension = {
  id: 'tension',
  init() {},
  step(S, input, ctx) {
    const D = S.director, R = ctx.rules.director, DT = ctx.rules.DT, P = S.player, H = S.headmaster;
    if (S.phase !== 'play') return;
    let rate = D.phase === 'aftermath' ? -R.decayAftermath : D.tension >= R.decayFastAbove ? -R.decay : -R.decayQuiet;
    const active = H.state && H.state !== 'absent' && H.floor === P.floor;
    if (active) {
      const d = Math.hypot(H.x - P.x, H.z - P.z);
      if (H.state === 'chase' && S.t - (H.seenAt ?? -1e9) < 1) rate += 4;
      else if (d < 14) rate += 2;
      if (H.killQueue?.length && (H.state === 'approach' || H.state === 'glimpse')) rate += 1.5;
    }
    const st = P.room && S.rooms[P.room];
    if (st?.state === 'running') rate += 0.5;
    if (S.tick % 30 === 0) D.dark = !litNear(S, ctx.layout, P.floor, P.x, P.z);
    if (D.dark && !P.room) rate += R.darkRate;
    let bump = 0, escaped = false;
    for (const e of S.events) { bump += BUMPS[e.type] || 0; if (ESCAPES.has(e.type)) escaped = true; }
    // silence builds: after a while with nothing happening, the quiet itself starts to press
    D.quietT = bump > 0 ? 0 : (D.quietT ?? 0) + DT;
    if (D.quietT > R.silenceAfter && D.phase !== 'aftermath') rate += R.silenceRate;
    for (const e of S.events) if (e.type === 'hmSee') ctx.world.modules.find((m) => m.id === 'director')?.log(S, 'chase', 'headmaster');
    D.tension = Math.max(R.floorPerMinute * Math.max(0, S.clock.minutes - 60), Math.min(100, D.tension + rate * DT + bump));

    // phases
    const was = D.phase;
    if (D.phase === 'aftermath') {
      D.aftermathT -= DT;
      if (D.aftermathT <= 0) D.phase = phaseOf(D.tension);
    } else {
      const ph = phaseOf(D.tension);
      if (ph === 'peak') D.peakT += DT; else D.peakT = 0;
      const peaked = was === 'peak' && (D.peakT >= R.peakHold || D.tension < R.peakExit);
      if (peaked || (escaped && D.tension >= R.escapeAftermathAbove)) {
        D.phase = 'aftermath'; D.aftermathT = ctx.rng.span(R.aftermath); D.peakT = 0;
        if (H.state && H.state !== 'absent' && H.state !== 'chase' && H.state !== 'leave') headmaster.leave(S, ctx);
      } else D.phase = ph;
    }
    if (D.phase !== was) ctx.emit('phase', { phase: D.phase, from: was, tension: Math.round(D.tension) });
  },
};

export function phaseOf(t) { return t >= 80 ? 'peak' : t >= 60 ? 'hunt' : t >= 40 ? 'dread' : t >= 20 ? 'unease' : 'calm'; }
