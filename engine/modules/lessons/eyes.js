// EYES ON YOUR OWN PAPER. Sit at your desk and write (hold use) for sixty seconds of writing. Keep
// your eyes on your paper: look up for more than a breath and it's cheating. Things happen at the
// edge of your view while you write. Make a noise and the invigilator comes to stand by your desk.
const angLook = -0.61; // looking further down than this is "at your paper" (~35 degrees)

export const eyes = {
  start(room, S, ctx) {
    const R = ctx.rules.lessons.eyes;
    room.lesson = { written: 0, need: R.need, lookUpT: 0, nextEdge: ctx.rng.span(R.edgeEvery), sat: false, noiseT: 0, wroteS: 0, lieAt: undefined, lied: false };
    S.interact[`${room.id}:mydesk`] = { kind: 'mydesk', x: room.mydesk.seatX, z: room.mydesk.seatZ, floor: room.floor, r: 1.3, room: room.id };
  },

  step(room, S, input, ctx) {
    const R = ctx.rules.lessons.eyes, L = room.lesson, P = S.player, DT = ctx.rules.DT, emit = ctx.emit;
    const u = P.used;
    if (u?.kind === 'mydesk' && (S.interact[u.id]?.room ?? u.id) === room.id && !P.seated) {
      const f = room.frame;
      P.seated = room.id; P.x = room.mydesk.seatX; P.z = room.mydesk.seatZ; P.vx = P.vz = 0;
      P.yaw = Math.atan2(-f.ix, -f.iz); P.pitchMin = -1.1; P.pitch = -0.9; // eyes down, on your paper
      L.sat = true; L.grace = R.grace;
      delete S.interact[`${room.id}:mydesk`];
      emit('sat', { room: room.id });
      return undefined;
    }
    if (P.seated !== room.id) return undefined;
    L.grace = Math.max(0, (L.grace || 0) - DT);
    // looking up is cheating
    if (P.pitch > angLook && L.grace <= 0) {
      L.lookUpT += DT;
      if (L.lookUpT > R.lookUpLimit) { emit('lookedUp', { room: room.id }); return 'doom'; }
    } else {
      L.lookUpT = 0;
      if (input.useHeld) {
        L.written += DT;
        if (Math.floor(L.written) > L.wroteS) { L.wroteS = Math.floor(L.written); emit('writing', { room: room.id, written: L.wroteS, need: L.need }); }
      }
    }
    if (L.written >= L.need) return 'success';
    // one whisper, in her voice, tells you it's safe to look up. It isn't. (not the first time you meet the lesson)
    if (L.lieAt === undefined) L.lieAt = room.firstTime ? null : ctx.rng.span(R.lieAfter);
    if (L.lieAt !== null && !L.lied && L.written >= L.lieAt) { L.lied = true; emit('edgeThing', { room: room.id, kind: 'lie', text: 'You can look up now. He\u2019s gone.' }); }
    // things at the edge of your view
    L.nextEdge -= DT;
    if (L.nextEdge <= 0) { L.nextEdge = ctx.rng.span(R.edgeEvery); emit('edgeThing', { room: room.id, kind: ctx.rng.weighted(R.edge) }); }
    // noise brings the invigilator
    L.noiseT = Math.max(0, L.noiseT - DT);
    if (P.noise > R.noise && L.noiseT <= 0) { L.noiseT = 3; emit('invigilatorComes', { room: room.id }); }
    return undefined;
  },
};
