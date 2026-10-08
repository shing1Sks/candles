// THE CLOCK: every wall clock in the school shows it. It creeps from 1:00 toward 3:30, home time,
// and jumps forward whenever the school notices you: a star earned, the Headmaster seeing you,
// a detention served, a lesson walked out on, a door that opened onto nothing. At 3:30 the bell.
export const clock = {
  id: 'clock',
  init(S, ctx) { S.clock.minutes = ctx.rules.clock.start; S.clock.bell = false; },
  step(S, input, ctx) {
    const C = ctx.rules.clock;
    if (S.phase !== 'play' && S.phase !== 'detention') return;
    const before = S.clock.minutes;
    S.clock.minutes += ctx.rules.DT * C.perSecond;
    for (const e of S.events) if (C.jumps[e.type]) S.clock.minutes += C.jumps[e.type];
    if (Math.floor(S.clock.minutes) !== Math.floor(before)) ctx.emit('clockMinute', { m: Math.floor(S.clock.minutes) });
    if (!S.clock.bell && S.clock.minutes >= C.bell) { S.clock.bell = true; ctx.emit('bell', {}); }
  },
};
