// STORY TIME (the infants room). She reads a story aloud, and the story is about you: each line is
// chosen from what you're doing right now. Find the picture book's missing page (in the toy box,
// under the carpet, in a cubby, or in a child's hands) and put it in her lap before she reaches the
// end. Run, and she skips ahead. The last line is always the same.

// lines by situation; past tense, about "the boy". Never explains, only notices.
import { STORY_LATE, storyTier } from '../../story.js';

export const STORY_LINES = {
  start: ['Once, there was a boy who came in late.', 'Once, a boy stood in the doorway, and nobody looked up.'],
  still: ['The boy stood very still, as if that would help.', 'He did not move. Neither did they.', 'The boy held his breath and listened to the ticking.'],
  walking: ['The boy walked between the little chairs.', 'His shoes were too loud on the floor.', 'He walked as if he knew where he was going. He did not.'],
  creeping: ['The boy crept low, the way you do when you are not allowed.', 'He crept, and the carpet whispered under him.'],
  running: ['The boy ran. Nobody runs in here.', 'He ran, and she turned the pages faster.'],
  nearToybox: ['He opened the toy box. Something inside was breathing.', 'The boy looked in the toy box, where the broken things go.'],
  nearCarpet: ['He lifted the edge of the carpet. It was warm underneath.', 'The boy knelt by the carpet, where the children sit.'],
  nearCubby: ['He reached into the cubbies, one name at a time.', 'The cubbies had names on them. One of them was his.'],
  nearChild: ['One little girl was holding something. She would not let go.', 'The boy leaned close to the child. The child leaned closer.'],
  hasPage: ['The boy had the page. He could feel her waiting.', 'He held the missing page against his chest.'],
  nearHer: ['He came close enough to see the book. Every page was him.', 'She smelled of chalk, and of something burnt.'],
  end: ['…and then she caught him.'],
  skip: ['…running, were we?'],
};

// the third line always tells you, in a child's words, where the page is (research/05 R24)
const HINTS = {
  toybox: 'The page was somewhere with the broken toys.',
  carpet: 'The page was somewhere soft, where the little ones sit.',
  cubby: 'The page was tucked away, where the names are written.',
  child: 'Somebody small was holding the page very, very tightly.',
};

export const story = {
  start(room, S, ctx) {
    const R = ctx.rules.lessons.story, f = room.frame;
    const at = (along, lat) => ({ x: f.cx + f.ix * (along - f.D / 2) + f.lx * lat, z: f.cz + f.iz * (along - f.D / 2) + f.lz * lat });
    // the reading corner at the front; hiding places around the room
    const spots = {
      toybox: at(1.0, f.W / 2 - 1.0),
      carpet: at(f.D - 2.4, 0),
      cubby: at(f.D * 0.5, -(f.W / 2 - 0.7)),
      child: room.students.length ? { x: room.students[0].x, z: room.students[0].z } : at(2, 0),
    };
    const hiddenIn = ctx.rng.weighted({ toybox: 1, carpet: 1, cubby: 1, child: 1 });
    room.lesson = { line: 0, lineT: 0.2, lineEvery: R.lineEvery, page: { hiddenIn, found: false, ...spots[hiddenIn] }, spots, skipCool: 0, said: [] };
    S.interact[`${room.id}:storyPage`] = { kind: 'storyPage', x: spots[hiddenIn].x, z: spots[hiddenIn].z, floor: room.floor, r: 1.4, room: room.id };
    S.interact[`${room.id}:lap`] = { kind: 'lap', x: room.teacher.x, z: room.teacher.z, floor: room.floor, r: 1.6, room: room.id };
  },

  situation(room, S) {
    const P = S.player, L = room.lesson;
    if (L.page.found) return Math.hypot(P.x - room.teacher.x, P.z - room.teacher.z) < 2.5 ? 'nearHer' : 'hasPage';
    if (P.run) return 'running';
    for (const k of ['toybox', 'carpet', 'cubby', 'child']) { const s = L.spots[k]; if (Math.hypot(P.x - s.x, P.z - s.z) < 2.2) return `near${k[0].toUpperCase()}${k.slice(1)}`; }
    if (Math.hypot(P.x - room.teacher.x, P.z - room.teacher.z) < 2.5) return 'nearHer';
    if (Math.hypot(P.vx, P.vz) < 0.2) return 'still';
    return P.crouch ? 'creeping' : 'walking';
  },

  read(room, S, ctx) {
    const L = room.lesson, R = ctx.rules.lessons.story;
    const last = L.line >= R.lines - 1;
    const kind = last ? 'end' : L.line === 0 ? 'start' : L.line === R.hintLine && !L.page.found ? 'hint' : this.situation(room, S);
    // the beginning and the end change as you learn what happened
    const late = (kind === 'start' || kind === 'end') && STORY_LATE[kind][storyTier(S.held.pages.length)];
    const pool = kind === 'hint' ? [HINTS[L.page.hiddenIn]] : late || STORY_LINES[kind];
    const text = pool[Math.floor(ctx.rng.next() * pool.length)];
    ctx.emit('storyLine', { room: room.id, n: L.line, of: R.lines, kind, text });
    L.line++;
    return last;
  },

  step(room, S, input, ctx) {
    const R = ctx.rules.lessons.story, L = room.lesson, P = S.player, DT = ctx.rules.DT, emit = ctx.emit;
    const u = P.used;
    if (u?.kind === 'storyPage' && !L.page.found) {
      L.page.found = true; P.carrying = 1;
      delete S.interact[`${room.id}:storyPage`];
      emit('storyPageFound', { room: room.id, where: L.page.hiddenIn });
    }
    if (u?.kind === 'lap' && L.page.found && P.carrying > 0) { emit('pageGiven', { room: room.id }); return 'success'; }
    // running makes her skip ahead
    L.skipCool = Math.max(0, L.skipCool - DT);
    if (P.run && L.skipCool <= 0) {
      L.line = Math.min(R.lines - 1, L.line + R.skip); L.lineT = Math.max(L.lineT, 1.5); L.skipCool = R.skipCool;
      emit('storySkip', { room: room.id, line: L.line });
      emit('storyLine', { room: room.id, n: L.line, of: R.lines, kind: 'skip', text: STORY_LINES.skip[0] });
    }
    L.lineT -= DT;
    if (L.lineT <= 0) {
      L.lineT = L.lineEvery;
      if (this.read(room, S, ctx)) return 'doom';
    }
    return undefined;
  },
};
