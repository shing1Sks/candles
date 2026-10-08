// CLASSROOMS. The first time a classroom door opens (or you walk in), the director rolls what's
// inside: lesson, teacher, twists, valuables. The interior (desks, children, the teacher's desk) is
// laid out from the room's own seed. Cross the threshold and the lesson starts; finish it for a
// star; leave mid-lesson and the door locks behind you; fail it and you're expelled.
import { hash32, makeRng } from '../rng.js';
import { rollRoom } from '../director.js';
import { award } from './stars.js';
import { handin } from './lessons/handin.js';
import { eyes } from './lessons/eyes.js';
import { story } from './lessons/story.js';

const SIDE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export const LESSONS = { handin, eyes, story };

// the first time you meet a lesson in a night, its rule is written on the board as a school rule
const RULES_ON_BOARD = {
  handin: 'WHEN THE CHALK STOPS, SO DO YOU.',
  eyes: 'EYES ON YOUR OWN PAPER. NO LOOKING UP.',
  story: 'FIND THE MISSING PAGE BEFORE THE END.',
};

// what the board says under the Wrong board twist: the truth, and the lie told instead
const HINTS = {
  handin: [['SHE TURNS WHEN THE CHALK STOPS', 'SHE ONLY TURNS IF YOU RUN'], ['COUNT THE PAPERS', 'ONE PAPER IS ENOUGH']],
  eyes: [['DO NOT LOOK UP', 'LOOK UP WHEN YOU HEAR YOUR NAME'], ['KEEP WRITING', 'STOP WHEN THE LIGHTS GO']],
  story: [['THE PAGE IS IN THE TOY BOX', 'THE PAGE IS UNDER THE CARPET'], ['DO NOT RUN', 'RUN AND SHE WILL STOP']],
};

// the rooms that aren't lessons: what the board says, and what the child left behind says to you.
// The lone child's line depends on how many pages you have: the story seeps out a line at a time.
const SCENE_BOARD = {
  empty: 'HOME TIME  3.30', aftermath: 'WHERE DID EVERYONE GO', loneChild: 'WAIT HERE FOR YOUR MUM', facingWall: 'FACE THE WALL. TOUCH NOTHING.',
};
export const LONE_LINES = [
  'Are you here for the concert? We’re not allowed in the Hall yet.',
  'Miss says they lock the doors so nobody wanders off during the songs.',
  'Can you smell bonfire? I can smell bonfire.',
  'He counted us all in. He never counted us out.',
  'You weren’t at the concert. Why weren’t you at the concert?',
  'You can go home. We can’t. That’s the rule.',
];

// desks in rows facing the board (on the wall opposite the door), the teacher's desk at the front
export function makeInterior(seed, room, roll, rules, S0 = { clock: { minutes: 60 } }) {
  const rng = makeRng(hash32(seed, 'interior', room.id));
  const [ix, iz] = SIDE_VEC[room.door.side].map((v) => -v); // from the door wall toward the board
  const lx = -iz, lz = ix;                                      // across the room
  const D = ix ? room.x1 - room.x0 : room.z1 - room.z0;         // depth, door wall to board
  const Wd = ix ? room.z1 - room.z0 : room.x1 - room.x0;        // width across
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const at = (along, lat) => ({ x: cx + ix * (along - D / 2) + lx * lat, z: cz + iz * (along - D / 2) + lz * lat });
  const [cols, rows] = rules.classroom.grid[room.kit] || [3, 3];
  const desks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const along = D - 3.0 - r * 1.45, lat = ((c + 0.5) / cols - 0.5) * (Wd - 1.8);
    if (along < 1.4) continue;
    desks.push({ ...at(along, lat), seat: at(along - 0.55, lat), row: r, col: c });
  }
  if (roll.twists.includes('oneTooMany')) {
    // one desk too many, squeezed in at the back
    const along = Math.max(1.3, D - 3.0 - rows * 1.45), lat = (rng.next() - 0.5) * (Wd - 2);
    desks.push({ ...at(along, lat), seat: at(along - 0.5, lat), row: rows, col: -1, extra: true });
  }
  const mine = desks.filter((d) => !d.extra)[Math.floor(rng.next() * desks.filter((d) => !d.extra).length)];
  const hl = rules.lessons.handin;
  // fewer children early in the night, a full class later (research/05 R21); empty desks stay empty
  const cap = S0.clock.minutes < 90 ? rules.classroom.studentsByAct[0] : S0.clock.minutes < 135 ? rules.classroom.studentsByAct[1] : rules.classroom.studentsByAct[2];
  const others = desks.filter((d) => d !== mine);
  const want = Math.min(others.length, cap[0] + Math.floor(rng.next() * (cap[1] - cap[0] + 1)));
  const filled = new Set();
  while (filled.size < want) filled.add(others[Math.floor(rng.next() * others.length)]);
  if (roll.twists.includes('oneTooMany')) filled.add(desks.find((d) => d.extra));
  let students = others.filter((d) => filled.has(d)).map((d, k) => ({
    id: `${room.id}:s${k}`, x: d.seat.x, z: d.seat.z, deskX: d.x, deskZ: d.z,
    finished: rng.next() >= hl.unfinishedP, paper: 'desk', tracking: false, faceBack: roll.twists.includes('turned'),
  }));
  const scene = roll.scene || 'lesson';
  const extra = {};
  if (scene === 'empty' || scene === 'aftermath') students = [];
  if (scene === 'aftermath') {
    // the desks shoved about as if everyone left at once; papers all over the floor
    extra.mess = desks.map(() => ({ rot: (rng.next() - 0.5) * 0.9, dx: (rng.next() - 0.5) * 0.5, dz: (rng.next() - 0.5) * 0.5, over: rng.next() < 0.18 }));
    extra.litter = Array.from({ length: 14 }, () => at(0.8 + rng.next() * (D - 2.2), (rng.next() - 0.5) * (Wd - 1)));
  }
  if (scene === 'loneChild') {
    // one child, front row, still facing the board
    const front = desks.filter((d) => d.row === 0 && d !== mine);
    const d = front[Math.floor(rng.next() * front.length)] || others[0];
    students = [{ id: `${room.id}:s0`, x: d.seat.x, z: d.seat.z, deskX: d.x, deskZ: d.z, finished: true, paper: 'none', tracking: false, faceBack: false, lone: true }];
  }
  if (scene === 'facingWall') {
    // the class standing in a line along the back wall, noses to it
    const n = Math.min(10, Math.max(5, want));
    students = Array.from({ length: n }, (_, k) => {
      const p = at(0.55, ((k + 0.5) / n - 0.5) * (Wd - 1.2));
      return { id: `${room.id}:s${k}`, x: p.x, z: p.z, deskX: p.x, deskZ: p.z, finished: true, paper: 'none', tracking: false, faceBack: false, wall: true };
    });
  }
  const side = rng.next() < 0.5 ? -1 : 1;
  const tdesk = at(D - 1.9, -side * Wd * 0.28), tpos = scene === 'facingWall' ? at(0.5, side * (Wd / 2 - 0.45)) : at(D - 0.9, side * Wd * 0.18);
  return {
    frame: { ix, iz, lx, lz, D, W: Wd, cx, cz },
    desks: desks.map((d) => ({ x: d.x, z: d.z, seatX: d.seat.x, seatZ: d.seat.z, extra: !!d.extra, mine: d === mine })),
    mydesk: { x: mine.x, z: mine.z, seatX: mine.seat.x, seatZ: mine.seat.z },
    students,
    teacher: { x: tpos.x, z: tpos.z, deskX: tdesk.x, deskZ: tdesk.z, facing: scene === 'facingWall' ? 'wall' : 'board' },
    scene, ...extra,
  };
}

export const classroom = {
  id: 'classroom',
  init() {},

  create(S, ctx, room) {
    const roll = rollRoom(S, room, ctx.world.streams.get('director'), ctx.rules);
    const inside = makeInterior(S.seed, room, roll, ctx.rules, S);
    const st = { id: room.id, kit: room.kit, floor: room.id.split(':')[0] | 0, doorId: room.door.id, roll, ...inside, lesson: null, state: 'idle', rolledAt: S.clock.minutes };
    S.rooms[room.id] = st;
    ctx.emit('roomRoll', { id: room.id, roll });
    return st;
  },

  start(S, ctx, st) {
    if (st.scene && st.scene !== 'lesson') {
      // nothing to do in here but look, and take what's left: no lesson, no locked door
      st.state = 'still';
      st.board = { hint: SCENE_BOARD[st.scene], truthful: true, rule: null };
      this.placeValuables(S, st);
      ctx.emit('sceneEnter', { id: st.id, scene: st.scene });
      return;
    }
    st.state = 'running';
    const f = st.floor;
    if (st.roll.lesson === 'handin') {
      for (const s of st.students) S.interact[s.id] = { kind: 'paper', x: s.x, z: s.z, floor: f, r: 1.15, room: st.id };
      S.interact[`${st.id}:desk`] = { kind: 'desk', x: st.teacher.deskX, z: st.teacher.deskZ, floor: f, r: 1.5, room: st.id };
    }
    const lc = this.ctxFor(ctx, st);
    S.director.taught ??= {};
    st.firstTime = !S.director.taught[st.roll.lesson];
    S.director.taught[st.roll.lesson] = true;
    LESSONS[st.roll.lesson]?.start(st, S, lc);
    const tw = st.roll.twists;
    if (tw.includes('lockedIn')) { S.doors[st.doorId] = { ...(S.doors[st.doorId] || {}), open: false, locked: true }; ctx.emit('doorClose', { id: st.doorId }); ctx.emit('lockedIn', { id: st.id }); }
    if (tw.includes('visitor')) {
      const f = st.frame, lat = (lc.rng.next() - 0.5) * (f.W - 2.4);
      st.visitor = { x: f.cx + f.ix * (0.9 - f.D / 2) + f.lx * lat, z: f.cz + f.iz * (0.9 - f.D / 2) + f.lz * lat };
    }
    st.board = { hint: null, truthful: true, rule: st.firstTime ? RULES_ON_BOARD[st.roll.lesson] : null };
    if (tw.includes('wrongBoard')) {
      const [truth, lie] = lc.rng.pick(HINTS[st.roll.lesson] || HINTS.handin);
      const truthful = lc.rng.chance(ctx.rules.twists.wrongBoard.truthful);
      if (st.roll.lesson === 'story' && truth.includes('TOY BOX')) {
        // name the real hiding place, or a wrong one
        const where = st.lesson.page.hiddenIn, places = ['toybox', 'carpet', 'cubby', 'child'];
        const words = { toybox: 'IN THE TOY BOX', carpet: 'UNDER THE CARPET', cubby: 'IN A CUBBY', child: 'WITH A CHILD' };
        const shown = truthful ? where : lc.rng.pick(places.filter((p) => p !== where));
        st.board = { hint: `THE PAGE IS ${words[shown]}`, truthful };
      } else st.board = { hint: truthful ? truth : lie, truthful };
      st.board.rule = st.firstTime ? RULES_ON_BOARD[st.roll.lesson] : null;
    }
    this.placeValuables(S, st);
    ctx.emit('lessonStart', { id: st.id, lesson: st.roll.lesson, twists: st.roll.twists, teacher: st.roll.teacher });
  },

  // things worth taking, and where they are: they stay after the lesson
  placeValuables(S, st) {
    const v = st.roll.valuables || {}, f = st.frame, fl = st.floor;
    const at = (along, lat) => ({ x: f.cx + f.ix * (along - f.D / 2) + f.lx * lat, z: f.cz + f.iz * (along - f.D / 2) + f.lz * lat });
    const put = (kind, p) => { S.interact[`${st.id}:v:${kind}`] = { kind, x: p.x, z: p.z, floor: fl, r: 1.25, room: st.id, loot: true }; };
    const toBack = { x: st.teacher.deskX - f.ix * 0.6, z: st.teacher.deskZ - f.iz * 0.6 };
    if (v.drawer) put('drawer', toBack);
    if (v.pass) put('pass', { x: st.teacher.deskX + f.lx * 0.5 - f.ix * 0.5, z: st.teacher.deskZ + f.lz * 0.5 - f.iz * 0.5 });
    if (v.chalk) put('chalk', at(f.D - 0.6, 0.6));
    if (v.page && !S.director.pageGiven && S.held.pages.length < 5) put('page', at(0.7, f.W / 2 - 0.8)); // dropped in the back corner
  },

  takeValuable(S, ctx, st, u) {
    const it = S.interact[u.id];
    if (!it || !it.loot || it.room !== st.id) return;
    const emit = ctx.emit;
    if (u.kind === 'drawer') {
      // the drawer only opens while she is not watching
      const watched = st.state === 'running' && st.roll.teacher !== 'none' && (st.lesson?.phase === 'look' || (st.roll.lesson !== 'handin' && st.roll.lesson !== 'story'));
      if (watched) { emit('drawerStuck', { room: st.id }); return; }
      delete S.interact[u.id]; emit('drawerOpened', { room: st.id }); award(S, ctx, 'drawer');
    } else if (u.kind === 'pass') { delete S.interact[u.id]; S.held.pass++; emit('passTaken', { room: st.id }); }
    else if (u.kind === 'chalk') { delete S.interact[u.id]; S.held.chalk++; emit('chalkTaken', { room: st.id }); }
    else if (u.kind === 'page') {
      delete S.interact[u.id];
      let n = 1; while (S.held.pages.includes(n)) n++;
      S.held.pages.push(n); S.director.pageGiven = true;
      emit('pageFound', { n, room: st.id });
    }
  },

  // each room's lesson draws from its own stream, so rooms don't shift each other's dice
  ctxFor(ctx, st) { return { ...ctx, rng: ctx.world.streams.get(`lesson:${st.id}`) }; },

  end(S, ctx, st, how) {
    for (const id of Object.keys(S.interact)) if (S.interact[id].room === st.id && !S.interact[id].loot) delete S.interact[id];
    if (S.player.seated === st.id) { S.player.seated = null; delete S.player.pitchMin; S.player.pitch = Math.max(S.player.pitch, -ctx.rules.player.pitchMax); }
    if (how !== 'abandoned' && S.doors[st.doorId]?.locked) S.doors[st.doorId].locked = false;
    if (how === 'caught') { st.state = 'abandoned'; S.player.carrying = 0; ctx.emit('lessonCaught', { id: st.id }); return; }
    if (how === 'success') {
      st.state = 'done';
      S.player.carrying = 0;
      ctx.emit('lessonSuccess', { id: st.id, lesson: st.roll.lesson });
      award(S, ctx, st.roll.lesson);
    } else if (how === 'doom') {
      st.state = 'doom';
      S.phase = 'expelled';
      ctx.emit('lessonDoom', { id: st.id, lesson: st.roll.lesson, teacher: st.roll.teacher });
    } else {
      st.state = 'abandoned';
      S.player.carrying = 0;
      S.doors[st.doorId] = { ...(S.doors[st.doorId] || {}), open: false, locked: true };
      ctx.emit('lessonAbandoned', { id: st.id });
      ctx.emit('doorClose', { id: st.doorId });
    }
  },

  step(S, input, ctx) {
    const L = ctx.layout;
    const classOf = (id) => { const r = L.roomById(id); return r && r.kind === 'classroom' ? r : null; };
    for (const e of S.events) {
      if (e.type === 'doorOpen') { const r = classOf(e.id); if (r && !S.rooms[r.id]) this.create(S, ctx, r); }
      if (e.type === 'roomEnter') {
        const r = classOf(e.id);
        if (!r) continue;
        const st = S.rooms[r.id] || this.create(S, ctx, r);
        if (st.state === 'idle') this.start(S, ctx, st);
      }
      if (e.type === 'roomLeave') { const st = S.rooms[e.id]; if (st && st.state === 'running') this.end(S, ctx, st, 'abandoned'); }
    }
    if (S.phase !== 'play') return;
    // a door you're walking up to has already decided what's behind it, so you can hear it first
    if (S.tick % 15 === 0 && !S.director.forceRoll && !S.player.room) {
      const P = S.player, c = L.chunkAt(P.floor, P.x, P.z);
      for (const r of c.rooms) if (r.kind === 'classroom' && !S.rooms[r.id] && Math.hypot(r.door.x - P.x, r.door.z - P.z) < ctx.rules.classroom.preRoll) this.create(S, ctx, r);
    }
    const st = S.player.room && S.rooms[S.player.room];
    if (!st) return;
    const u = S.player.used;
    if (u && S.interact[u.id]?.loot) {
      this.takeValuable(S, ctx, st, u);
      // the class facing the wall: touch anything and they all turn round
      if (st.scene === 'facingWall' && !st.turned && !S.interact[u.id]) { st.turned = true; ctx.emit('theyTurn', { room: st.id }); }
    }
    if (st.state === 'still' && st.scene === 'loneChild' && !st.spoke) {
      const c = st.students[0], P = S.player;
      if (c && Math.hypot(c.x - P.x, c.z - P.z) < 1.8) {
        st.spoke = true; c.tracking = true;
        ctx.emit('loneChildSpeaks', { room: st.id, text: LONE_LINES[Math.min(LONE_LINES.length - 1, S.held.pages.length)] });
      }
    }
    if (st.state !== 'running') return;
    if (st.visitor) {
      const V = ctx.rules.twists.visitor, P = S.player;
      if (P.noise > V.noise && Math.hypot(P.x - st.visitor.x, P.z - st.visitor.z) < V.dist) {
        ctx.emit('hmCatch', { visitor: true, room: st.id });
        S.headmaster.caughtNow = true;
        this.end(S, ctx, st, 'caught');
        return;
      }
    }
    const out = LESSONS[st.roll.lesson]?.step(st, S, input, this.ctxFor(ctx, st));
    if (out) this.end(S, ctx, st, out);
  },
};
