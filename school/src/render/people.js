// PEOPLE: painted cards standing in the school, always turned to face you (billboards). Their
// poses step at 12 fps, like stop-motion: every pose change is a jump, never a glide.
import * as THREE from 'three';
import { makePaperLit } from './paperlit.js';
import { Painter } from '../art/paint.js';

export function paintCard(w, h, seed, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(new Painter(c.getContext('2d'), seed));
  return c;
}

// a card mesh whose origin is at the feet. feetY = card pixel row of the feet; heightM = card height in metres
export function makeCard(canvas, heightM, feetY) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const w = heightM * (canvas.width / canvas.height);
  const geo = new THREE.PlaneGeometry(w, heightM).translate(0, heightM / 2 - heightM * (1 - feetY / canvas.height), 0);
  const mat = makePaperLit(t, { transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  const root = new THREE.Group();
  root.add(mesh);
  return { root, mesh, mat, tex: t, canvas };
}

const STEP = 1 / 12;

export class People {
  constructor(scene, cards, floorH) {
    this.scene = scene; this.floorH = floorH;
    this.hm = makeCard(cards.headmaster, 2.55, 1118);
    this.hm.root.visible = false;
    scene.add(this.hm.root);
    // the one who stands a step behind you on the thirteenth step
    this.follower = makeCard(cards.kids[1].front, 1.58, 616 * (cards.kids[1].front.height / 660));
    this.follower.root.visible = false;
    scene.add(this.follower.root);
    // the child at the end of the corridor, facing the wall (one of the painted children, from behind)
    this.appar = makeCard(cards.kids[0].back, 1.5, 616 * (cards.kids[0].back.height / 660));
    this.appar.root.visible = false; scene.add(this.appar.root);
    // the road-safety cut-out, a false scare
    this.cutout = makeCard(cards.cutout, 1.75, 960);
    this.cutout.root.visible = false; scene.add(this.cutout.root);
    this.cutoutAt = null;
    this.t = 0; this.acc = 0;
    this.hmPrev = null; this.walkPh = 0;
  }

  // a false scare: the cut-out, standing in the next dark stretch ahead
  showCutout(S, layout) {
    const P = S.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const d of [6, 5, 4]) {
      const x = P.x + fx * d, z = P.z + fz * d;
      if (layout.walkable(P.floor, x, z) && layout.segmentClear(P.floor, P.x, P.z, x, z)) { this.cutoutAt = { x, z, floor: P.floor, until: performance.now() + 40000 }; return; }
    }
  }

  // returns any extra lights (the light behind a glimpsed Headmaster)
  update(S, camera, dt) {
    this.acc += dt;
    const tick = this.acc >= STEP;
    if (tick) this.acc %= STEP;
    const extra = [];
    const face = (card) => { card.root.rotation.y = Math.atan2(camera.position.x - card.root.position.x, camera.position.z - card.root.position.z); };
    // the apparition
    const A = S.director?.apparition;
    this.appar.root.visible = !!A && A.floor === S.player.floor && S.phase === 'play';
    if (A) {
      this.appar.root.position.set(A.x, A.floor * this.floorH, A.z);
      // facing the wall: turned side-on to you, toward the nearest corridor wall
      this.appar.root.rotation.y = Math.atan2(camera.position.x - A.x, camera.position.z - A.z) + Math.PI;
      extra.push({ x: A.x, y: A.floor * this.floorH + 2.6, z: A.z, I: 0.55 }); // half in a pool of light
    }
    // the cut-out
    const C = this.cutoutAt;
    this.cutout.root.visible = !!C && performance.now() < C.until && C.floor === S.player.floor;
    if (this.cutout.root.visible) { this.cutout.root.position.set(C.x, C.floor * this.floorH, C.z); face(this.cutout); }
    const st = S.stairs, P = S.player, fol = this.follower;
    fol.root.visible = !!(st?.follower && S.phase === 'play');
    if (fol.root.visible) {
      const fx = -Math.sin(st.climbYaw), fz = -Math.cos(st.climbYaw);
      fol.root.position.set(P.x - fx * 0.95, P.y + 0.12, P.z - fz * 0.95); // one step down, face level with yours
      fol.root.rotation.y = Math.atan2(camera.position.x - fol.root.position.x, camera.position.z - fol.root.position.z);
    }
    // the Headmaster
    const H = S.headmaster, card = this.hm;
    const show = H.state && H.state !== 'absent' && H.floor === S.player.floor;
    card.root.visible = !!show;
    if (!show || S.phase !== 'play') { card.root.visible = false; this.hmPrev = null; return extra; }
    // a glimpse: lit from behind, so he reads as a black cut-out with a paper rim (research/05 R10)
    if (H.state === 'glimpse') {
      const dx = H.x - S.player.x, dz = H.z - S.player.z, d = Math.hypot(dx, dz) || 1;
      extra.push({ x: H.x + (dx / d) * 1.4, y: H.floor * this.floorH + 2.4, z: H.z + (dz / d) * 1.4, I: 1.3 });
    }
    if (tick) {
      // stop-motion: position and pose only change on the 12 fps beat
      const moved = this.hmPrev ? Math.hypot(H.x - this.hmPrev.x, H.z - this.hmPrev.z) : 0;
      this.walkPh += moved * 2.2;
      this.hmPrev = { x: H.x, z: H.z };
      card.root.position.set(H.x, H.floor * this.floorH, H.z);
      const sway = Math.sin(this.walkPh) * Math.min(1, moved * 20);
      const stoop = H.state === 'stoop' ? 0.35 : H.state === 'pinStar' ? 0.22 : 0;
      card.mesh.rotation.z = sway * 0.06;
      card.mesh.rotation.x = stoop;
      card.mesh.position.y = Math.abs(sway) * 0.05;
      card.root.rotation.y = Math.atan2(camera.position.x - H.x, camera.position.z - H.z);
    }
    return extra;
  }
}
