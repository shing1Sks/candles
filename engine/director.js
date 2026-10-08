// THE DIRECTOR: the night's conductor (research/05 R1-R5, R37, R38). It reads the tension (scored at
// the end of every tick by the tension module) and decides what is allowed to happen next:
//   - the Headmaster's visits: none in Act I; glimpses first in Act II; patrols after; never in an
//     aftermath. It sends him to your part of the school, never to you: he finds you himself.
//   - ambient life: unexplained sounds around the school, more in calm, none at a peak
//   - apparitions: a child at the end of a corridor, facing the wall, gone when you look away
//   - false scares: a release after a long build that nothing paid off
//   - the scare ledger: every scare logged with its time; spacing rules refuse what comes too soon
// It also asks the school to forget chunks behind you, and rolls what's behind classroom doors.
import { headmaster } from './modules/headmaster.js';
import { forgetTick } from './layout/forget.js';
import { actOf } from './lights.js';
import { rollAnomaliesNear } from './anomalies.js';
import { paLine } from './story.js';
import { hash32 } from './rng.js';

export const PHASES = ['calm', 'unease', 'dread', 'hunt', 'peak', 'aftermath'];

export const director = {
  id: 'director',

  init(S, ctx) {
    const R = ctx.rules.director;
    Object.assign(S.director, {
      nextPatrol: ctx.rng.span(R.firstVisit), forgetT: ctx.rules.layout.forget.every, lastRoll: null, patrols: 0, glimpses: 0,
      tension: 0, phase: 'calm', peakT: 0, aftermathT: 0, act: 1,
      ledger: [], nextAmbient: ctx.rng.span(R.ambientEvery.calm), apparition: null, buildT: 0,
      restoreT: 0,
    });
  },

  // may a scare of this kind happen now? (spacing rules from research/05 §2)
  mayScare(S, kind) {
    const D = S.director, sp = DIRECTOR_SPACING, t = S.t;
    if (D.phase === 'aftermath' && kind !== 'ambient') return false;
    const last = (kinds) => { let m = -1e9; for (const e of D.ledger) if (kinds.includes(e.kind) && e.t > m) m = e.t; return m; };
    if (kind === 'stinger' || kind === 'chase') return t - last(['stinger', 'chase']) >= sp.big;
    if (kind === 'false') return t - last(['false']) >= sp.false && t - last(['stinger', 'chase']) >= 30;
    if (kind === 'glimpse') return t - last(['glimpse']) >= sp.glimpse;
    if (kind === 'visit') return D.phase !== 'peak';
    return true;
  },

  log(S, kind, what) {
    const D = S.director;
    D.ledger.push({ t: +S.t.toFixed(2), kind, what });
    if (D.ledger.length > 40) D.ledger.shift();
  },

  step(S, input, ctx) {
    const D = S.director, R = ctx.rules, DR = R.director, DT = R.DT;
    const act = actOf(S.clock.minutes);
    if (S.phase !== 'play') { D.act = act; return; }
    // the school's own voice: the PA, a little into the night and as each act begins
    if ((D.paAct ?? 0) < act && (act > 1 || S.t > 12)) { D.paAct = act; ctx.emit('pa', { act, text: paLine(act, S.held.pages.length) }); this.log(S, 'ambient', 'pa'); }
    D.act = act;
    const H = S.headmaster, absent = !H.state || H.state === 'absent';

    // one glimpse of him in Act I, a few minutes in: far off, then gone. Ten minutes is too long not to
    // know he exists (the visits proper start in Act II)
    if (D.act === 1 && absent && !D.firstGlimpse && !S.player.room && S.tick % 60 === 0 && ['calm', 'unease'].includes(D.phase)) {
      D.firstGlimpseAt ??= DR.firstGlimpse[0] + (hash32(S.seed, 'firstGlimpse') % 1000) / 1000 * (DR.firstGlimpse[1] - DR.firstGlimpse[0]);
      if (S.t >= D.firstGlimpseAt && this.mayScare(S, 'glimpse') && headmaster.arrive(S, ctx, 'glimpse')) { D.firstGlimpse = true; this.log(S, 'glimpse', 'headmaster'); }
    }
    // the Headmaster's visits
    if (absent && D.phase !== 'aftermath' && D.act >= 2) {
      D.nextPatrol -= DT * (D.act >= 3 ? 1.4 : 1);
      if (D.nextPatrol <= 0 && this.mayScare(S, 'visit')) {
        const mode = D.act === 2 && D.glimpses < DR.glimpsesBeforePatrol ? 'glimpse' : 'patrol';
        D.nextPatrol = ctx.rng.span(R.headmaster.every) * (S.clock.minutes >= R.headmaster.lateAt ? R.headmaster.lateFactor : 1);
        if (headmaster.arrive(S, ctx, mode)) { if (mode === 'glimpse') D.glimpses++; else D.patrols++; this.log(S, mode === 'glimpse' ? 'glimpse' : 'visit', 'headmaster'); }
      }
    }
    // lights the Headmaster killed come back, one by one, a while after he has gone
    if (absent && H.killed?.length) {
      D.restoreT -= DT;
      if (D.restoreT <= 0) { delete S.lights[H.killed.pop()]; D.restoreT = D.phase === 'aftermath' ? 0.5 : 1.2; }
    }

    // ambient life: positional, mostly unexplained; more in calm, never at a peak
    D.nextAmbient -= DT;
    if (D.nextAmbient <= 0) {
      const every = DR.ambientEvery[D.phase] || null;
      D.nextAmbient = every ? ctx.rng.span(every) : 5;
      if (every) {
        // never the same sound as one of the last three
        D.recentAmbient ??= [];
        const all = DR.ambient.filter((a) => a.acts.includes(D.act)), fresh = all.filter((a) => !D.recentAmbient.includes(a.kind)), pool = fresh.length ? fresh : all;
        const a = pool[Math.floor(ctx.rng.next() * pool.length)];
        D.recentAmbient.push(a.kind); if (D.recentAmbient.length > 3) D.recentAmbient.shift();
        const ang = ctx.rng.range(0, Math.PI * 2), r = ctx.rng.range(7, 20);
        ctx.emit('ambient', { kind: a.kind, x: S.player.x + Math.cos(ang) * r, z: S.player.z + Math.sin(ang) * r, floor: S.player.floor + (a.above ? 1 : 0) });
        this.log(S, a.tell ? 'tell' : 'ambient', a.kind);
      }
    }

    // a build that nothing paid off ends in a false scare (once in a while)
    D.buildT = D.tension >= DR.falseAfterTension ? D.buildT + DT : 0;
    if (D.buildT >= DR.falseAfterBuild && absent && this.mayScare(S, 'false')) {
      const kind = ctx.rng.pick(DR.falseScares);
      ctx.emit('falseScare', { kind, x: S.player.x, z: S.player.z });
      this.log(S, 'false', kind);
      D.buildT = 0;
    }

    // apparitions: a child at the end of the corridor, facing the wall; gone once you look away
    this.stepApparition(S, ctx);

    // the corridors around you decide how wrong they are, before you can see down them
    rollAnomaliesNear(S, ctx.layout, ctx.world.streams.get('anomaly'), Math.min(4, D.act + (S.held.pages.length >= 3 ? 1 : 0)), ctx.emit);

    D.forgetT -= DT;
    if (D.forgetT <= 0) {
      D.forgetT = R.layout.forget.every;
      for (const key of forgetTick(S, ctx.layout, ctx.rng, R)) ctx.emit('forgot', { key });
    }
  },

  stepApparition(S, ctx) {
    const D = S.director, P = S.player, L = ctx.layout, DR = ctx.rules.director;
    const A = D.apparition;
    if (A) {
      const dx = A.x - P.x, dz = A.z - P.z, d = Math.hypot(dx, dz);
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const inView = d > 0.1 && (dx * fx + dz * fz) / d > Math.cos(0.6) && L.segmentClear(P.floor, P.x, P.z, A.x, A.z);
      if (inView) A.seen = true;
      if ((A.seen && !inView) || d < 3 || S.t - A.t0 > 40 || P.floor !== A.floor) {
        D.apparition = null;
        ctx.emit('apparitionGone', { kind: A.kind, x: A.x, z: A.z, seen: A.seen });
      }
      return;
    }
    if (D.act < 1 || !['unease', 'dread', 'calm'].includes(D.phase) || P.room) return;
    if (S.t < DR.firstApparition || !this.mayScare(S, 'glimpse')) return;
    if (!ctx.rng.chance(DR.apparitionPerSecond * ctx.rules.DT)) return;
    // somewhere 10-18 m ahead, down a clear line of sight
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const dist of [16, 13, 10]) {
      const x = P.x + fx * dist, z = P.z + fz * dist;
      if (!L.walkable(P.floor, x, z) || !L.segmentClear(P.floor, P.x, P.z, x, z)) continue;
      D.apparition = { kind: 'facingWall', x, z, floor: P.floor, t0: S.t, seen: false, seed: Math.floor(ctx.rng.next() * 1e6) };
      ctx.emit('apparition', { kind: 'facingWall', x, z });
      this.log(S, 'glimpse', 'facingWall');
      return;
    }
  },
};

const DIRECTOR_SPACING = { big: 180, false: 240, glimpse: 120 };

// What's behind a classroom door. Never the same lesson + twists as the room before.
export function rollRoom(S, room, rng, rules) {
  const C = rules.classroom;
  if (S.director.forceRoll) { const f = S.director.forceRoll; delete S.director.forceRoll; S.director.lastRoll = sigOf(f); return structuredClone(f); }
  const lesson = room.kit === 'infants' ? 'story' : rng.weighted(C.lessonP);
  const teacher = lesson === 'story' ? 'teacher' : rng.weighted(C.teacherP);
  let n = Number(rng.weighted(C.twistN)) + (S.clock.minutes >= C.lateAt ? 1 : 0);
  n = Math.min(C.maxTwists, n);
  const pool = C.twists.slice(), twists = [];
  while (twists.length < n && pool.length) twists.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  const roll = { lesson, teacher, twists, valuables: {} };
  // same as last time: keep the lesson, bend it with one more (or a different) twist
  if (sigOf(roll) === S.director.lastRoll) {
    const spare = C.twists.filter((t) => !twists.includes(t));
    if (spare.length && twists.length < C.maxTwists) twists.push(rng.pick(spare));
    else if (spare.length) twists[0] = rng.pick(spare);
    else twists.pop();
  }
  // the scene behind the door: a lesson, or something else (the infants' room is always Story Time)
  roll.scene = room.kit === 'infants' ? 'lesson' : rng.weighted(C.sceneP[Math.min(2, actOf(S.clock.minutes) - 1)]);
  if (roll.scene !== 'lesson' && S.director.lastRoll?.startsWith(`${roll.scene}|`)) roll.scene = 'lesson'; // never two alike in a row
  if (roll.scene !== 'lesson') { roll.teacher = roll.scene === 'facingWall' ? 'teacher' : 'none'; roll.twists = []; }
  for (const [k, p] of Object.entries(roll.scene === 'empty' ? C.emptyValuables : C.valuables)) roll.valuables[k] = rng.chance(p);
  // a child chalked arrows to this door: the page is in here, and so is something worse
  const warned = Object.values(S.layout.anomalies || {}).some((a) => a?.kind === 'arrowDoor' && a.room === room.id);
  if (warned) {
    roll.scene = 'lesson'; roll.teacher = 'teacher';
    roll.valuables.page = true;
    const twists = roll.twists;
    const spare = C.twists.filter((t) => !twists.includes(t));
    if (spare.length) twists.push(rng.pick(spare));
    roll.warned = true;
  }
  S.director.lastRoll = sigOf(roll);
  return roll;
}

const sigOf = (r) => `${r.scene || 'lesson'}|${r.lesson}|${r.twists.slice().sort().join(',')}`;
