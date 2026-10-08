// HAND IN YOUR WORK. Collect every student's paper (hold use near the desks) and put the stack on her
// desk before the hymn ends. While the chalk squeaks she faces the board. Before she turns there are
// always three beats (research/05 R20): the chalk slows and scrapes, her shoulder lifts, then she
// looks. Move while she looks and it's a strike: the class's heads lift and the hymn loses ten
// seconds; the second strike, she starts toward you; the third is DOOM. The first time you meet this
// lesson in a night, the rule is on the board and her first look forgives you.
export const handin = {
  start(room, S, ctx) {
    const R = ctx.rules.lessons.handin;
    room.lesson = {
      hymn: Math.min(R.hymn, R.hymnBase + R.hymnPerStudent * room.students.length) + (room.roll.twists.includes('lightsOut') ? R.lightsOutBonus : 0),
      phase: 'chalk', phaseT: ctx.rng.span(R.chalk) + (room.firstTime ? 2 : 0), seenThisLook: false, headsUp: 0, strikes: 0, approach: false, forgiven: false,
    };
    ctx.emit('chalkStart', { room: room.id });
  },

  // returns 'success' | 'doom' | undefined
  step(room, S, input, ctx) {
    const R = ctx.rules.lessons.handin, L = room.lesson, P = S.player, DT = ctx.rules.DT, emit = ctx.emit;
    // what you did this tick comes first: a stack delivered on the hymn's last tick still counts
    const u = P.used;
    const take = (s) => {
      s.paper = 'taken'; P.carrying++;
      if (!s.finished) s.tracking = true;
      delete S.interact[s.id];
      emit('paperTaken', { room: room.id, studentId: s.id, unfinished: !s.finished, carrying: P.carrying });
    };
    if (u?.kind === 'paper') { const s = room.students.find((x) => x.id === u.id); if (s && s.paper === 'desk') take(s); }
    // holding use sweeps up every paper within reach as you walk past: no aiming at each child
    if (input.useHeld || input.use) for (const s of room.students) if (s.paper === 'desk' && Math.hypot(s.x - P.x, s.z - P.z) <= R.sweep) take(s);
    if (u?.kind === 'desk' && (S.interact[u.id]?.room ?? u.id) === room.id) {
      if (P.carrying >= room.students.length) { P.carrying = 0; emit('stackDelivered', { room: room.id }); return 'success'; }
      emit('stackShort', { room: room.id, have: P.carrying, need: room.students.length });
    }

    L.hymn -= DT;
    if (L.hymn <= 0) return 'doom';
    if (L.headsUp > 0) L.headsUp -= DT;

    L.phaseT -= DT;
    const first = room.firstTime && !L.forgiven;
    if (L.phase === 'chalk' && L.phaseT <= 0) {
      L.phase = 'slow'; L.phaseT = first ? R.firstSlow : R.slow;
      emit('chalkSlow', { room: room.id });
    } else if (L.phase === 'slow' && L.phaseT <= 0) {
      L.phase = 'turn'; L.phaseT = first ? R.firstTurn : R.turn;
      emit('teacherTurning', { room: room.id });
    } else if (L.phase === 'turn' && L.phaseT <= 0) {
      L.phase = 'look'; L.phaseT = ctx.rng.span(R.look); L.seenThisLook = false;
      emit('chalkStop', { room: room.id });
      emit(room.roll.teacher === 'none' ? 'studentsLook' : 'teacherLooks', { room: room.id });
    } else if (L.phase === 'look') {
      if (!L.seenThisLook && !P.hidden && Math.hypot(P.vx, P.vz) > R.moveThreshold) {
        L.seenThisLook = true;
        if (first) { L.forgiven = true; emit('nearlySeen', { room: room.id }); }
        else {
          L.strikes++;
          emit('strike', { room: room.id, n: L.strikes });
          emit('seenMoving', { room: room.id });
          if (L.strikes >= R.strikes) return 'doom';
          L.hymn -= R.seenCost; L.headsUp = R.headsUp;
          if (L.strikes === 2) { L.approach = true; emit('teacherApproaches', { room: room.id }); }
          emit('hymnCut', { room: room.id, hymn: L.hymn });
        }
      }
      if (L.phaseT <= 0) { L.phase = 'chalk'; L.phaseT = ctx.rng.span(R.chalk); emit('chalkStart', { room: room.id }); }
    }
    return undefined;
  },
};
