// CLASSROOM INTERIORS, built from the room state the engine rolled (S.rooms[id]): windows onto the
// night forest, the board, the alphabet frieze and the clock on the front wall, the drawings on the
// back wall, desks and chairs, a paper on every desk, the children and the teacher (painted cards),
// and the room's own ceiling tubes. Children are seen from behind or in front depending on where you
// stand; their poses step at 12 fps. The doom finale plays here too.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makePaperLit } from './paperlit.js';
import { hash32 } from '../../../engine/rng.js';

const STEP = 1 / 12;
const DS = THREE.DoubleSide;

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// a vertical quad in a room's frame: centre (along, lat), facing toward -along (n = -1) or +along / lat
function frameAt(f, along, lat) { return [f.cx + f.ix * (along - f.D / 2) + f.lx * lat, f.cz + f.iz * (along - f.D / 2) + f.lz * lat]; }

export class RoomView {
  constructor(scene, T, cards, rules) {
    this.scene = scene; this.T = T; this.rules = rules;
    this.views = new Map();
    const lit = (tex, o = {}) => makePaperLit(tex, { side: DS, ...o });
    const cardMat = (c) => makePaperLit(canvasTex(c), { transparent: true, side: DS });
    this.mats = {
      window: lit(T.window.tex), display: lit(T.display.tex), board: lit(canvasTex(cards.board)),
      frieze: lit(canvasTex(cards.frieze)), desk: lit(T.planks.tex, { color: 0xc9c2b4 }), deskDark: lit(null, { color: 0x3a3632 }),
      paper: lit(null, { color: 0xe8e4d8 }), apple: makePaperLit(null, { color: 0xb01c24 }),
      // every generated child: front, back and snapped, each its own material
      tFront: cardMat(cards.teacher), tBack: cardMat(cards.teacherBack),
    };
    this.cards = cards;
    this.cardMat = cardMat;
    this.kidMatCache = [];
    this.mats.hm = cardMat(cards.headmaster);
    this.mats.chalk = lit(null, { color: 0xf2efe6 });
    this.mats.gold = makePaperLit(null, { color: 0xe2b028 });
    this.mats.pass = lit(canvasTex(cards.passCard));
    this.mats.page = lit(canvasTex(cards.pageCard));
    this.mats.rug = lit(canvasTex(cards.rug));
    this.mats.hand = cardMat(cards.hand);
    this.hmGeo = new THREE.PlaneGeometry(2.55 * 640 / 1160, 2.55).translate(0, 2.55 / 2 - 2.55 * (1 - 1118 / 1160), 0);
    this.clockCanvas = document.createElement('canvas'); this.clockCanvas.width = this.clockCanvas.height = 160;
    this.clockTex = canvasTex(this.clockCanvas);
    this.mats.clock = makePaperLit(this.clockTex, { transparent: true, side: DS });
    this.clockMin = -1;
    const S = 1.58, T2 = 2.15;
    this.studentGeo = new THREE.PlaneGeometry(S * 420 / 660, S).translate(0, S / 2 - S * (1 - 616 / 660), 0);
    this.teacherGeo = new THREE.PlaneGeometry(T2 * 660 / 1000, T2).translate(0, T2 / 2 - T2 * (1 - 968 / 1000), 0);
    this.acc = 0; this.doom = null;
  }

  drawClock(minutes) {
    const c = this.clockCanvas.getContext('2d'), m = Math.floor(minutes);
    if (m === this.clockMin) return;
    this.clockMin = m;
    c.clearRect(0, 0, 160, 160);
    c.fillStyle = '#1a1816'; c.beginPath(); c.arc(80, 80, 76, 0, 7); c.fill();
    c.fillStyle = '#e4dfd2'; c.beginPath(); c.arc(80, 80, 66, 0, 7); c.fill();
    c.fillStyle = '#26231f'; c.font = 'bold 14px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; c.fillText(String(i), 80 + Math.cos(a) * 52, 80 + Math.sin(a) * 52); }
    const h = (m / 60) % 12, mm = m % 60;
    const hand = (ang, len, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(80, 80); c.lineTo(80 + Math.cos(ang) * len, 80 + Math.sin(ang) * len); c.stroke(); };
    hand((h / 12) * Math.PI * 2 - Math.PI / 2, 32, 6, '#1a1816');
    hand((mm / 60) * Math.PI * 2 - Math.PI / 2, 50, 3.5, '#1a1816');
    c.fillStyle = '#9a9690'; c.beginPath(); c.arc(80, 80, 5, 0, 7); c.fill();
    this.clockTex.needsUpdate = true;
  }

  sync(S, layout) {
    const P = S.player, keep = new Set();
    for (const st of Object.values(S.rooms)) {
      if (!st.frame || st.floor !== P.floor) continue;
      const f = st.frame;
      if (Math.hypot(f.cx - P.x, f.cz - P.z) > 34) continue;
      keep.add(st.id);
      const v = this.views.get(st.id);
      if (v && v.builtState !== st.state && (st.state === 'running' || v.builtState === 'idle')) { this.scene.remove(v.group); v.dispose(); this.views.delete(st.id); }
      if (!this.views.has(st.id)) { const nv = this.build(st, layout); nv.builtState = st.state; this.views.set(st.id, nv); }
    }
    for (const [id, v] of this.views) if (!keep.has(id)) { this.scene.remove(v.group); v.dispose(); this.views.delete(id); }
  }

  build(st, layout) {
    const f = st.frame, g = new THREE.Group(), y0 = st.floor * this.rules.layout.floorH, M = this.mats;
    const h = (...a) => hash32(st.id, ...a);
    const geos = [];
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); geos.push(geo); return m; };
    // a quad lying on a wall: centre (along, lat), size w x hgt, normal along the given frame axis
    const wallPlane = (along, lat, w, y, hgt, normal, mat) => {
      const geo = new THREE.PlaneGeometry(w, hgt);
      const m = add(geo, mat);
      const [x, z] = frameAt(f, along, lat);
      m.position.set(x, y0 + y, z);
      const [nx, nz] = normal === 'back' ? [-f.ix, -f.iz] : normal === 'front' ? [f.ix, f.iz] : normal === 'left' ? [-f.lx, -f.lz] : [f.lx, f.lz];
      m.rotation.y = Math.atan2(nx, nz);
      return m;
    };
    const D = f.D, W = f.W, e = 0.07;
    // windows down one side wall, onto the night and the forest
    const winSide = h('win') % 2 ? 1 : -1;
    for (const a of [D * 0.3, D * 0.68]) wallPlane(a, winSide * (W / 2 - e), 2.0, 1.85, 1.7, winSide > 0 ? 'left' : 'right', M.window);
    // the front wall: board, frieze, clock
    const boardCard = st.roll.lesson === 'eyes' ? this.cards.boardEyes : st.roll.lesson === 'story' ? this.cards.boardStory : this.cards.board;
    let boardMat = st.roll.lesson === 'handin' ? M.board : (this.boardMats ??= new Map()).get(st.roll.lesson) || (() => { const bm = makePaperLit(canvasTex(boardCard), { side: DS }); this.boardMats.set(st.roll.lesson, bm); return bm; })();
    const still = st.scene && st.scene !== 'lesson';
    if (still && st.board?.hint) {
      // a room that isn't a lesson: the board wiped, one line chalked big
      const bc = document.createElement('canvas'); bc.width = boardCard.width; bc.height = boardCard.height;
      const bx = bc.getContext('2d'); bx.drawImage(boardCard, 0, 0);
      bx.fillStyle = 'rgba(20,24,22,0.97)'; bx.fillRect(34, 30, bc.width - 68, bc.height - 60);
      for (let k = 0; k < 9; k++) { bx.fillStyle = `rgba(200,200,190,${0.03 + (k % 3) * 0.015})`; bx.fillRect(60 + k * 120, 50 + (k % 4) * 50, 220, 70); } // old wipe marks
      bx.fillStyle = 'rgba(236,233,224,0.92)'; bx.font = '64px "Segoe Print", "Comic Sans MS", cursive'; bx.textAlign = 'center'; bx.textBaseline = 'middle';
      bx.fillText(st.board.hint, bc.width / 2, bc.height / 2);
      boardMat = makePaperLit(canvasTex(bc), { side: DS }); geos.push({ dispose: () => boardMat.map.dispose() });
    } else if (st.board?.hint || st.board?.rule) {
      // the rule (the first time you meet this lesson tonight) and any hint, chalked under the headline
      const bc = document.createElement('canvas'); bc.width = boardCard.width; bc.height = boardCard.height;
      const bx = bc.getContext('2d'); bx.drawImage(boardCard, 0, 0);
      bx.fillStyle = 'rgba(14,13,12,0.92)'; bx.fillRect(40, 214, bc.width - 80, 104);
      bx.fillStyle = 'rgba(236,233,224,0.9)'; bx.font = '40px "Segoe Print", "Comic Sans MS", cursive'; bx.textAlign = 'center';
      if (st.board.rule) bx.fillText(st.board.rule, bc.width / 2, 256);
      if (st.board.hint) bx.fillText(st.board.hint, bc.width / 2, 306);
      boardMat = makePaperLit(canvasTex(bc), { side: DS }); geos.push({ dispose: () => boardMat.map.dispose() });
    }
    wallPlane(D - e, 0, 4.0, 1.55, 1.13, 'back', boardMat);
    wallPlane(D - e, 0, Math.min(W - 0.6, 7.2), 2.55, 0.42, 'back', M.frieze);
    wallPlane(D - e - 0.01, W / 2 - 0.9, 0.5, 2.5, 0.5, 'back', M.clock);
    // the back wall: the class's drawings, beside the door
    wallPlane(e, -(W / 4 + 0.35), Math.min(3.0, W / 2 - 1.0), 1.65, 1.0, 'front', M.display);

    // furniture: desks (top + legs block), chairs, the teacher's desk; merged per material
    const tops = [], darks = [];
    const box = (along, lat, sa, sl, ya, yb, list, rot = 0) => {
      const geo = new THREE.BoxGeometry(Math.abs(f.ix) * sa + Math.abs(f.lx) * sl, yb - ya, Math.abs(f.iz) * sa + Math.abs(f.lz) * sl);
      if (rot) geo.rotateY(rot);
      geo.translate(...(() => { const x = f.cx + f.ix * (along - D / 2) + f.lx * lat, z = f.cz + f.iz * (along - D / 2) + f.lz * lat; return [x, y0 + (ya + yb) / 2, z]; })());
      list.push(geo);
    };
    const toFrame = (x, z) => ({ along: (x - f.cx) * f.ix + (z - f.cz) * f.iz + D / 2, lat: (x - f.cx) * f.lx + (z - f.cz) * f.lz });
    st.desks.forEach((d, i) => {
      const q = toFrame(d.x, d.z), s = toFrame(d.seatX, d.seatZ), mess = st.mess?.[i];
      if (mess) {
        // the aftermath: shoved about, some knocked over, chairs flung
        const a = q.along + mess.dx, l = q.lat + mess.dz, r = mess.rot;
        if (mess.over) { box(a, l, 0.06, 0.64, 0, 0.48, tops, r); box(a + 0.3, l, 0.6, 0.06, 0.0, 0.06, darks, r); }
        else { box(a, l, 0.48, 0.64, 0.6, 0.66, tops, r); box(a + 0.18, l, 0.06, 0.6, 0.12, 0.6, darks, r); }
        box(s.along - mess.dz, s.lat + mess.dx * 1.5, 0.38, 0.36, 0, 0.04, tops, -r * 2);
        box(s.along - mess.dz - 0.2, s.lat + mess.dx * 1.5, 0.3, 0.32, 0, 0.3, darks, -r * 2);
        return;
      }
      box(q.along, q.lat, 0.48, 0.64, 0.6, 0.66, tops);
      box(q.along + 0.18, q.lat, 0.06, 0.6, 0.12, 0.6, darks);
      if (st.scene === 'empty') {
        // home time: every chair turned up on its desk
        box(q.along, q.lat, 0.36, 0.38, 1.02, 1.06, tops);
        box(q.along, q.lat, 0.3, 0.32, 1.06, 1.42, darks);
        box(q.along + 0.17, q.lat, 0.04, 0.38, 0.68, 1.02, tops);
        return;
      }
      box(s.along, s.lat, 0.36, 0.38, 0.36, 0.4, tops);
      box(s.along - 0.17, s.lat, 0.04, 0.38, 0.4, 0.74, tops);
      box(s.along, s.lat, 0.3, 0.32, 0, 0.36, darks);
    });
    // the aftermath's papers, all over the floor
    for (const [i, p] of (st.litter || []).entries()) {
      const geo = new THREE.PlaneGeometry(0.3, 0.22); geo.rotateX(-Math.PI / 2); geo.rotateY((h('litter', i) % 628) / 100);
      const m = add(geo, M.paper); m.position.set(p.x, y0 + 0.006 + i * 0.0004, p.z);
    }
    const td = toFrame(st.teacher.deskX, st.teacher.deskZ);
    box(td.along, td.lat, 0.7, 1.5, 0.7, 0.78, tops);
    box(td.along, td.lat, 0.64, 1.44, 0, 0.7, darks);
    add(mergeGeometries(tops), M.desk);
    add(mergeGeometries(darks), M.deskDark);
    const apple = add(new THREE.SphereGeometry(0.055, 10, 8), M.apple);
    { const [x, z] = frameAt(f, td.along - 0.15, td.lat + 0.5); apple.position.set(x, y0 + 0.84, z); }

    // papers on the desks
    const papers = new Map();
    for (const s of st.students) {
      const q = toFrame(s.deskX, s.deskZ);
      const geo = new THREE.PlaneGeometry(0.3, 0.22); geo.rotateX(-Math.PI / 2);
      const m = add(geo, M.paper);
      const [x, z] = frameAt(f, q.along, q.lat + 0.05);
      m.position.set(x, y0 + 0.665, z); m.rotation.y = (h(s.id) % 40 - 20) / 100;
      papers.set(s.id, m);
    }
    // the children and the teacher
    // each child is one of the painted variants: early in the night only ordinary ones; later about
    // one in four has a single wrong thing about them (research/05 R17)
    // (the children are still being painted in the background: use whichever are ready)
    while (this.kidMatCache.length < this.cards.kids.length) { const v = this.cards.kids[this.kidMatCache.length]; this.kidMatCache.push({ front: this.cardMat(v.front), back: this.cardMat(v.back), snap: this.cardMat(v.snap), spec: v.spec }); }
    const ready = this.kidMatCache, normal = ready.filter((v) => !v.spec.wrong), wrong0 = ready.filter((v) => v.spec.wrong), wrong = wrong0.length ? wrong0 : normal;
    const late = (st.rolledAt ?? 60) >= 90;
    const kids = st.students.map((s) => {
      const r = h(s.id, 'kid');
      const pool = late && r % 4 === 0 ? wrong : normal;
      const kv = pool[(r >>> 3) % pool.length];
      const m = new THREE.Mesh(this.studentGeo, kv.back); g.add(m);
      m.scale.set(kv.spec.height, kv.spec.height, 1);
      m.position.set(s.x, y0 - (s.wall ? 0 : 0.22), s.z);
      return { s, m, kv, jit: (h(s.id, 'j') % 100) / 100 };
    });
    // which teacher this room has: one of the painted ones (more arrive as they're painted)
    let teacher = null, tMats = { front: M.tFront, back: M.tBack }, tCard = null;
    if (st.roll.teacher !== 'none') {
      const ts = this.cards.teachers || [];
      const tv = ts.length ? ts[h('teacher') % ts.length] : null;
      tCard = tv?.front;
      if (tv && tv.i !== 0) { this.teacherMats ??= new Map(); if (!this.teacherMats.has(tv.i)) this.teacherMats.set(tv.i, { front: this.cardMat(tv.front), back: this.cardMat(tv.back) }); tMats = this.teacherMats.get(tv.i); }
      teacher = new THREE.Mesh(this.teacherGeo, tMats.back); g.add(teacher); teacher.position.set(st.teacher.x, y0, st.teacher.z);
      teacher.scale.setScalar(0.94 + (h('tscale') % 14) / 100);
    }

    // Eyes On Your Own Paper: your own paper, filling up as you write
    let myPaper = null;
    if (st.roll.lesson === 'eyes') {
      const c = document.createElement('canvas'); c.width = 256; c.height = 184;
      const tex = canvasTex(c), mat = makePaperLit(tex, { side: DS });
      const geo = new THREE.PlaneGeometry(0.36, 0.26); geo.rotateX(-Math.PI / 2);
      const m = add(geo, mat);
      const q = toFrame(st.mydesk.x, st.mydesk.z);
      const [x, z] = frameAt(f, q.along, q.lat); m.position.set(x, y0 + 0.667, z); m.rotation.y = Math.atan2(-f.ix, -f.iz);
      myPaper = { c, tex, shown: -1 };
    }
    // Story Time: a rug at the front, the toy box, the cubbies; the page where it was hidden
    const props = [];
    if (st.roll.lesson === 'story' && st.lesson) {
      const L = st.lesson, rugGeo = new THREE.PlaneGeometry(3.2, 2.2); rugGeo.rotateX(-Math.PI / 2);
      const rug = add(rugGeo, M.rug); rug.position.set(L.spots.carpet.x, y0 + 0.01, L.spots.carpet.z); rug.rotation.y = Math.atan2(f.lx, f.lz);
      const tq = toFrame(L.spots.toybox.x, L.spots.toybox.z), cq = toFrame(L.spots.cubby.x, L.spots.cubby.z), pl = [];
      box(tq.along, tq.lat, 0.6, 0.9, 0, 0.55, pl); box(cq.along, cq.lat, 2.6, 0.4, 0, 1.05, pl);
      add(mergeGeometries(pl), M.desk);
      const pg = new THREE.PlaneGeometry(0.3, 0.22); pg.rotateX(-Math.PI / 2);
      const pageMesh = add(pg, M.page);
      const where = L.page.hiddenIn, ys = { toybox: 0.57, carpet: 0.02, cubby: 1.07, child: 0.66 }[where];
      pageMesh.position.set(L.page.x, y0 + ys, L.page.z);
      props.push({ key: `${st.id}:storyPage`, m: pageMesh });
    }
    // valuables, shown while they're still there
    const loot = [
      ['drawer', () => { const geo = new THREE.PlaneGeometry(0.1, 0.1); return add(geo, M.gold); }, 0.62],
      ['pass', () => { const geo = new THREE.PlaneGeometry(0.2, 0.15); geo.rotateX(-Math.PI / 2); return add(geo, M.pass); }, 0.79],
      ['chalk', () => { const geo = new THREE.BoxGeometry(0.08, 0.02, 0.02); return add(geo, M.chalk); }, 0.96],
      ['page', () => { const geo = new THREE.PlaneGeometry(0.3, 0.22); geo.rotateX(-Math.PI / 2); return add(geo, M.page); }, 0.012],
    ];
    for (const [kind, make, y] of loot) {
      if (!st.roll.valuables?.[kind]) continue;
      const key = `${st.id}:v:${kind}`, m = make();
      m.userData.key = key; m.position.y = y0 + y; m.visible = false;
      props.push({ key, m, follow: true });
    }
    // the visitor: the Headmaster, sitting at the back, watching
    let visitor = null;
    if (st.visitor) { visitor = new THREE.Mesh(this.hmGeo, M.hm); g.add(visitor); visitor.position.set(st.visitor.x, y0 - 0.45, st.visitor.z); }
    // a hand that comes to rest on the desk beside yours (Eyes)
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), M.hand); hand.visible = false; g.add(hand); geos.push(hand.geometry);

    // the room's ceiling tubes
    const lightsOut = st.roll.twists.includes('lightsOut');
    const tubes = [];
    for (const [a, l] of [[0.3, -0.25], [0.3, 0.25], [0.7, -0.25], [0.7, 0.25]]) {
      const [x, z] = frameAt(f, D * a, W * l), r = h('tube', a, l) % 100;
      const geo = new THREE.PlaneGeometry(1.3, 0.2); geo.rotateX(Math.PI / 2);
      // most of a classroom's tubes are dead: the board lamp and the moon do the work (research/05 R9)
      // (an empty room is the one place with every light on: a breath, research/05 R5)
      const base = st.scene === 'empty' ? 0.55 : lightsOut ? 0 : r < 70 ? 0 : 0.5 + (r % 5) * 0.06;
      const mat = new THREE.MeshBasicMaterial({ color: base > 0 ? 0xf2eedc : 0x2a2826, side: DS });
      const m = add(geo, mat); m.position.set(x, y0 + 3.18, z); m.rotation.y = Math.atan2(f.lx, f.lz);
      tubes.push({ x, y: y0 + 3.12, z, I: base, flicker: r >= 25 && r < 33, ph: r / 10 });
    }
    { const [x, z] = frameAt(f, D - 0.7, 0); tubes.push({ x, y: y0 + 2.9, z, I: lightsOut ? 0.8 : 0.6, flicker: false, ph: 0 }); } // the board lamp
    // staging: light the thing you're meant to find (the lone child; the line at the back wall, flickering)
    if (st.scene === 'loneChild' && st.students[0]) { const c = st.students[0]; tubes.push({ x: c.x, y: y0 + 2.6, z: c.z, I: 0.55, flicker: false, ph: 0 }); }
    if (st.scene === 'facingWall') { const [x, z] = frameAt(f, 1.4, 0); tubes.push({ x, y: y0 + 2.8, z, I: 0.75, flicker: true, ph: 2 }); }
    if (st.scene === 'aftermath') { const [x, z] = frameAt(f, D * 0.5, 0); tubes.push({ x, y: y0 + 2.9, z, I: 0.5, flicker: true, ph: 5 }); }
    // moonlight through the windows: two weak, cold pools along the window wall
    for (const a of [D * 0.3, D * 0.68]) { const [x, z] = frameAt(f, a, winSide * (W / 2 - 1.2)); tubes.push({ x, y: y0 + 1.6, z, I: 0.14, flicker: false, ph: 0 }); }
    this.scene.add(g);
    return { group: g, papers, kids, teacher, tMats, tCard, tubes, st, myPaper, props, visitor, hand, edge: null, dispose: () => geos.forEach((q) => q.dispose()) };
  }

  startDoom(id) { this.doom = { id, t: 0 }; }

  // Eyes: something happens just at the edge of where you're looking
  edgeThing(S, id, kind) {
    const v = this.views.get(id);
    if (!v) return;
    const P = S.player, f = v.st.frame;
    if (kind === 'standUp') {
      let best = null, bd = 1e9;
      for (const k of v.kids) { const d = Math.hypot(k.s.x - P.x, k.s.z - P.z); if (d < bd && d > 0.5) { bd = d; best = k; } }
      if (best) { best.lift = 0.35; v.edge = { kind, t: 3, kid: best }; }
    } else if (kind === 'hand') {
      const y0 = v.st.floor * this.rules.layout.floorH;
      v.hand.position.set(P.x + f.lx * 0.62 + f.ix * 0.05, y0 + 0.68, P.z + f.lz * 0.62 + f.iz * 0.05);
      v.hand.rotation.set(-Math.PI / 2, 0, Math.atan2(f.ix, f.iz));
      v.hand.visible = true; v.edge = { kind, t: 2.5 };
    } else if (kind === 'flicker') {
      for (const tb of v.tubes) tb.flickerUntil = performance.now() + 1800;
      v.edge = { kind, t: 1.8 };
    }
  }

  // per frame: who faces where, papers, the teacher turning, stop-motion poses, the doom; returns lights
  update(S, camera, dt, t) {
    this.drawClock(S.clock.minutes);
    this.acc += dt;
    const tick = this.acc >= STEP;
    if (tick) this.acc %= STEP;
    if (this.doom) this.doom.t += dt;
    const lights = [], M = this.mats, cam = camera.position;
    for (const v of this.views.values()) {
      const st = v.st, L = st.lesson, f = st.frame, running = st.state === 'running';
      const nowMs = performance.now();
      // the doom is different for each lesson: Eyes ends with every light dying, Story Time with them stuttering
      const dT = this.doom && this.doom.id === st.id ? this.doom.t : -1, dk = st.roll.lesson;
      for (const tb of v.tubes) {
        const hard = (tb.flickerUntil && nowMs < tb.flickerUntil) || (dk === 'story' && dT > 0.3);
        let I = (tb.flicker && Math.sin(t * 11 + tb.ph) > 0.4) || (hard && Math.sin(t * 37 + tb.ph) > -0.2) ? tb.I * 0.15 : tb.I;
        if (dk === 'eyes' && dT > 0.7) I = 0;
        lights.push({ x: tb.x, y: tb.y, z: tb.z, I });
      }
      for (const [id, m] of v.papers) m.visible = st.students.find((s) => s.id === id)?.paper === 'desk' && st.state !== 'done';
      const doomT = this.doom && this.doom.id === st.id ? this.doom.t : -1;
      for (const pr of v.props) {
        const it = S.interact[pr.key];
        pr.m.visible = !!it;
        if (it && pr.follow) pr.m.position.set(it.x, pr.m.position.y, it.z);
      }
      if (v.myPaper && L) {
        const n = Math.floor((L.written || 0) / 2);
        if (n !== v.myPaper.shown) {
          v.myPaper.shown = n;
          const c = v.myPaper.c.getContext('2d');
          c.fillStyle = '#e6e2d6'; c.fillRect(0, 0, 256, 184);
          c.strokeStyle = 'rgba(120,130,150,0.5)'; for (let y = 22; y < 184; y += 14) { c.beginPath(); c.moveTo(8, y); c.lineTo(248, y); c.stroke(); }
          c.strokeStyle = 'rgba(30,30,40,0.85)'; c.lineWidth = 1.6;
          for (let k = 0; k < n; k++) { const row = Math.floor(k / 3), col = k % 3, y = 20 + row * 14; let x = 14 + col * 78; c.beginPath(); c.moveTo(x, y); for (let q = 0; q < 12; q++) { x += 5.5; c.lineTo(x, y - 3 - Math.sin(q * 1.7 + k) * 3); } c.stroke(); }
          v.myPaper.tex.needsUpdate = true;
        }
      }
      // things at the edge of your view
      if (v.edge) {
        v.edge.t -= dt;
        if (v.edge.t <= 0) { if (v.edge.kid) v.edge.kid.lift = 0; v.hand.visible = false; v.edge = null; }
      }
      if (v.visitor) v.visitor.rotation.y = Math.atan2(cam.x - st.visitor.x, cam.z - st.visitor.z);
      if (!tick) continue;
      for (const k of v.kids) {
        const toCam = (cam.x - k.s.x) * f.ix + (cam.z - k.s.z) * f.iz; // > 0: you're in front of them
        const facing = k.s.faceBack || k.s.wall ? -1 : 1;
        let front = toCam * facing > 0 || k.s.tracking || (k.s.wall && st.turned);
        let mat = front ? k.kv.front : k.kv.back, y = k.s.wall ? 0 : -0.22 * k.kv.spec.height, rz = 0;
        if (L?.headsUp > 0 && !front) { y += 0.04; }
        if (st.state === 'done') { y -= 0.05; rz = 0.25 * (k.jit - 0.5); } // the class asleep at their desks
        if (doomT >= 0 && dk === 'eyes') {
          mat = k.kv.front;                              // every head turned to you, still in their seats
        } else if (doomT >= 0) {
          y = 0; mat = k.kv.front;                       // all stand, in one frame, smiling
          if (doomT > (dk === 'story' ? 1.0 : 0.55)) { mat = k.kv.snap; rz = (Math.random() - 0.5) * 0.04; } // heads snap down
        }
        y += k.lift || 0;
        if (k.lift) mat = k.kv.front;
        k.m.material = mat; k.m.position.y = st.floor * this.rules.layout.floorH + y; k.m.rotation.z = rz;
        k.m.rotation.y = Math.atan2(cam.x - k.s.x, cam.z - k.s.z);
      }
      if (v.teacher) {
        const looking = running && (L?.phase === 'look');
        v.teacher.material = st.state === 'still' ? (st.turned ? v.tMats.front : v.tMats.back) : looking || !running || doomT >= 0 ? v.tMats.front : v.tMats.back;
        // the warning before she turns: the chalk slows (still writing, stiller), then her shoulder lifts
        const turning = running && L?.phase === 'turn', slowing = running && L?.phase === 'slow';
        v.teacher.rotation.z = turning ? -0.09 : slowing ? 0.01 : !looking && running ? Math.sin(t * 9) * 0.015 : 0;
        v.teacher.position.y = st.floor * this.rules.layout.floorH + (turning ? 0.06 : 0);
        // after the second strike she comes toward you, a step at a time
        if (L?.approach && running) {
          const P = S.player, tx = v.teacher.position.x, tz = v.teacher.position.z, d = Math.hypot(P.x - tx, P.z - tz);
          if (d > 1.6) { v.teacher.position.x += ((P.x - tx) / d) * 0.05; v.teacher.position.z += ((P.z - tz) / d) * 0.05; }
        }
        v.teacher.rotation.y = Math.atan2(cam.x - v.teacher.position.x, cam.z - v.teacher.position.z);
      }
    }
    return lights;
  }
}
