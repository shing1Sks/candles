// The two pieces on the board.
// The kid: a small child in pyjamas with a big head and messy hair - runs, creeps crouched, crawls on hands
// and knees, leans in and puffs to blow a candle, trembles and keeps glancing at the monster when it is near.
// The monster: the giant in miniature - a hunched, furry spine, a toothed jaw, the eye on its stalk, long
// arms that drag their claws, short legs that plant their feet. It crouches before it lunges, reaches into
// wardrobes, pushes at doors.
import * as THREE from 'three';
import { mat } from './shade.js';
import { fur, ik, bone, place } from './rig.js';

const UP = new THREE.Vector3(0, 1, 0);

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}
function pivot(x, y, z, ...children) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  children.forEach((c) => g.add(c));
  return g;
}
function shadowBlob(r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01;
  return m;
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

// ------------------------------------------------------------------ the kid
export function createKid() {
  const pj = mat({ color: 0.74 }), pjDark = mat({ color: 0.5 }), skin = mat({ color: 0.86 }), hair = mat({ color: 0.1 }), dark = mat({ color: 0.03 }), sock = mat({ color: 0.9 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(shadowBlob(0.24), body);
  const hips = pivot(0, 0.42, 0);
  body.add(hips);
  hips.add(part(new THREE.SphereGeometry(0.11, 14, 10), pj, 0, 0.02, 0));
  const chest = pivot(0, 0.04, 0);
  hips.add(chest);
  const torso = part(new THREE.CapsuleGeometry(0.115, 0.17, 6, 14), pj, 0, 0.17, 0);
  torso.scale.set(1, 1, 0.82);
  chest.add(torso);
  // collar and three buttons
  const collar = part(new THREE.TorusGeometry(0.07, 0.022, 6, 16), pjDark, 0, 0.33, 0.005);
  collar.rotation.x = Math.PI / 2 - 0.15;
  chest.add(collar);
  for (let i = 0; i < 3; i++) chest.add(part(new THREE.SphereGeometry(0.012, 6, 5), pjDark, 0, 0.27 - i * 0.07, 0.098 - i * 0.004));
  // head: big, a mess of hair, ears, eyes with a glint, a small mouth that rounds to blow
  const head = pivot(0, 0.43, 0);
  chest.add(head);
  const skull = part(new THREE.SphereGeometry(0.155, 20, 16), skin, 0, 0.0, 0);
  skull.scale.set(1, 1.04, 0.98);
  head.add(skull);
  const cap = part(new THREE.SphereGeometry(0.162, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 0.012, -0.012);
  cap.rotation.x = -0.32;
  head.add(cap);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.3, tuft = part(new THREE.ConeGeometry(0.035, 0.09, 5), hair);
    tuft.position.set(Math.cos(a) * 0.1, 0.11 + (i % 3) * 0.015, Math.sin(a) * 0.08 - 0.04);
    tuft.rotation.set(Math.sin(a) * 0.9 - 0.4, 0, -Math.cos(a) * 0.9);
    head.add(tuft);
  }
  for (const s of [-1, 1]) {
    head.add(part(new THREE.SphereGeometry(0.035, 8, 6), skin, s * 0.152, -0.01, -0.005));
    head.add(part(new THREE.SphereGeometry(0.024, 10, 8), dark, s * 0.055, 0.0, 0.135));
    head.add(part(new THREE.SphereGeometry(0.007, 6, 5), mat({ color: 0, emis: 0.7 }), s * 0.05, 0.008, 0.155));
    head.add(part(new THREE.BoxGeometry(0.045, 0.008, 0.01), hair, s * 0.055, 0.04, 0.137)); // brows
  }
  const mouth = part(new THREE.SphereGeometry(0.018, 10, 8), dark, 0, -0.07, 0.138);
  mouth.scale.set(1.3, 0.5, 0.5);
  head.add(mouth);
  const cheeks = [-1, 1].map((s) => { const c = part(new THREE.SphereGeometry(0.04, 10, 8), skin, s * 0.075, -0.045, 0.1); head.add(c); return c; });
  // arms and legs: two pivots each
  const limb = (r, len, m) => { const g = new THREE.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2 - r * 0.5, 0); return new THREE.Mesh(g, m); };
  const arms = [-1, 1].map((s) => {
    const sh = pivot(s * 0.145, 0.29, 0);
    sh.add(limb(0.036, 0.11, pj));
    const el = pivot(0, -0.16, 0);
    el.add(limb(0.032, 0.1, pj));
    el.add(part(new THREE.SphereGeometry(0.036, 10, 8), skin, 0, -0.16, 0.005));
    sh.add(el); chest.add(sh);
    return { sh, el, s };
  });
  const legs = [-1, 1].map((s) => {
    const hp = pivot(s * 0.062, -0.02, 0);
    hp.add(limb(0.048, 0.12, pj));
    const kn = pivot(0, -0.19, 0);
    kn.add(limb(0.042, 0.1, pj));
    const foot = part(new THREE.SphereGeometry(0.045, 10, 8), sock, 0, -0.19, 0.035);
    foot.scale.set(0.85, 0.55, 1.4);
    kn.add(foot);
    hp.add(kn); hips.add(hp);
    return { hp, kn, s };
  });

  let phase = 0, yaw = 0, crawl = 0, crouch = 0, lean = 0, blow = 0, hold = 0, glance = 0, glanceT = 0;
  return {
    root,
    update(k, dt, t, M) {
      root.position.set(k.x, 0, k.z);
      yaw += wrap(Math.atan2(k.fx, k.fz) - yaw) * Math.min(1, dt * 14);
      body.rotation.y = yaw;
      crawl = damp(crawl, k.crawl ? 1 : 0, 10, dt);
      crouch = damp(crouch, !k.crawl && !k.running && k.speed > 0.2 && k.speed < 1.8 ? 1 : 0, 8, dt);
      blow = damp(blow, k.blowing >= 0 ? 1 : 0, 9, dt);
      hold = damp(hold, k.held >= 0 ? 1 : 0, 8, dt);
      const sp = k.speed, run = k.running ? 1 : 0;
      phase += dt * sp * (k.crawl ? 6 : 3.9);
      const sw = Math.sin(phase), amp = Math.min(1, sp / 2.2);
      lean = damp(lean, run * 0.22 + crouch * 0.3 + blow * 0.35, 8, dt);

      // posture: upright run, crouched creep, flat crawl
      hips.position.y = 0.42 - crouch * 0.07 - crawl * 0.24 + Math.abs(Math.cos(phase)) * 0.025 * amp * (1 - crawl);
      hips.rotation.x = crawl * 1.2;
      chest.rotation.x = lean * (1 - crawl) + crawl * 0.2;
      for (const L of legs) {
        const p = sw * L.s;
        L.hp.rotation.x = (1 - crawl) * (p * 0.75 * amp - crouch * 0.5) + crawl * (-1.5 + p * 0.35);
        L.kn.rotation.x = (1 - crawl) * (Math.max(0, -p) * 1.1 * amp + crouch * 0.8) + crawl * 1.4;
      }
      for (const A of arms) {
        const p = -sw * A.s;
        let shx = (1 - crawl) * (p * 0.8 * amp * (0.5 + run * 0.6) - crouch * 0.6) + crawl * (-1.4 + p * 0.4);
        let elx = (1 - crawl) * (-0.35 - run * 0.6 - crouch * 0.6) + crawl * -0.2;
        if (A.s > 0 && hold > 0.01) { shx = shx * (1 - hold) - 0.7 * hold; elx = elx * (1 - hold) - 0.9 * hold; } // carrying a toy
        A.sh.rotation.x = shx; A.el.rotation.x = elx;
        A.sh.rotation.z = A.s * (0.12 + crouch * 0.1);
      }
      // head: glances over the shoulder at the monster when it is near
      glanceT -= dt;
      const fear = k.fear || 0;
      if (glanceT < 0) { glanceT = 1.2 + Math.random() * 2.5 * (1.2 - fear); glance = fear > 0.25 && M ? 1 : 0; }
      let hy = 0;
      if (glance && M) hy = Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(M.x - k.x, M.z - k.z) - yaw)));
      head.rotation.y = damp(head.rotation.y, hy, 6, dt);
      head.rotation.x = -crawl * 1.0 + blow * 0.15;
      head.rotation.z = Math.sin(t * 40) * 0.025 * fear;
      // blowing: rounded mouth, puffed cheeks
      mouth.scale.set(1.3 - blow * 0.6, 0.5 + blow * 0.7, 0.5 + blow * 0.4);
      const puff = blow * (0.55 + 0.45 * Math.sin(t * 9));
      cheeks.forEach((c) => c.scale.setScalar(1 + puff * 0.35));
      // breathing; shivering with fear
      torso.scale.set(1 + Math.sin(t * (2 + fear * 6)) * 0.02, 1, 0.82);
      body.position.x = Math.sin(t * 37) * 0.004 * fear;
    },
  };
}

// ------------------------------------------------------------------ the monster
export function createMonster() {
  const hide = mat({ color: 0.06 }), furM = mat({ color: 0.085, vcol: true, sway: 0.05, side: THREE.DoubleSide });
  const claw = mat({ color: 0.5 }), tooth = mat({ color: 0.7 }), mouthM = mat({ color: 0.0 });
  const eyeMat = mat({ color: 0.0, emis: 1.0 }), pupilMat = mat({ color: 0.0 }), stalkM = mat({ color: 0.1 });
  const materials = [hide, furM, claw, tooth, mouthM, eyeMat, pupilMat, stalkM];
  const root = new THREE.Group(), body = new THREE.Group();
  const blob = shadowBlob(0.55);
  root.add(blob, body);

  // spine: three segments curling forward from the pelvis
  const NS = 3, SL = 0.34, RX = [0.36, 0.38, 0.32], RZ = [0.3, 0.32, 0.28];
  const segs = [];
  for (let i = 0; i < NS; i++) {
    const g = new THREE.Group();
    const b = part(new THREE.SphereGeometry(1, 16, 12), hide);
    b.scale.set(RX[i], SL * 0.9, RZ[i]);
    g.add(b, fur(170, RX[i], SL * 0.9, RZ[i], 0.24, 0.035, furM, { seed: i + 3 }));
    body.add(g); segs.push(g);
  }
  const head = new THREE.Group();
  const skull = part(new THREE.SphereGeometry(1, 16, 12), hide);
  skull.scale.set(0.26, 0.22, 0.25);
  head.add(skull, fur(110, 0.26, 0.22, 0.25, 0.18, 0.03, furM, { seed: 9, front: 0.5, droop: 0.5 }));
  const mouth = part(new THREE.SphereGeometry(1, 12, 6), mouthM, 0, -0.07, 0.22);
  mouth.scale.set(0.16, 0.02, 0.06);
  const jawLow = pivot(0, -0.085, 0.22);
  const jawTop = pivot(0, -0.06, 0.23);
  for (let i = 0; i < 7; i++) {
    const x = -0.13 + i * 0.043, l = 0.035 + (i % 3) * 0.01;
    const a = part(new THREE.ConeGeometry(0.01, l, 4), tooth, x, -l / 2, 0); a.rotation.x = Math.PI; jawTop.add(a);
    jawLow.add(part(new THREE.ConeGeometry(0.009, l * 0.8, 4), tooth, x + 0.02, l * 0.4, 0));
  }
  head.add(mouth, jawTop, jawLow);
  body.add(head);
  // eye stalk
  const stalk = Array.from({ length: 5 }, (_, i) => { const b = bone(0.03 - i * 0.003, 0.027 - i * 0.003, stalkM); body.add(b); return b; });
  const eye = new THREE.Group();
  const ball = part(new THREE.SphereGeometry(0.1, 16, 12), eyeMat);
  const pupil = part(new THREE.SphereGeometry(0.045, 10, 8), pupilMat, 0, 0, 0.075);
  pupil.scale.set(1, 1.6, 0.6);
  const lid = part(new THREE.SphereGeometry(0.106, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hide);
  eye.add(ball, pupil, lid);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.7);
  eye.add(halo);
  body.add(eye);
  // limbs
  const arms = [-1, 1].map((s) => {
    const up = bone(0.075, 0.06, hide), lo = bone(0.06, 0.045, hide);
    const hand = part(new THREE.SphereGeometry(0.06, 10, 8), hide);
    const claws = [0, 1, 2].map(() => { const c = part(new THREE.ConeGeometry(0.014, 0.13, 5), claw); body.add(c); return c; });
    body.add(up, lo, hand);
    return { s, up, lo, hand, claws, el: new THREE.Vector3(), w: new THREE.Vector3() };
  });
  const legs = [-1, 1].map((s) => {
    const th = bone(0.1, 0.08, hide), sh = bone(0.075, 0.06, hide);
    const foot = part(new THREE.SphereGeometry(1, 10, 8), hide);
    foot.scale.set(0.08, 0.05, 0.14);
    body.add(th, sh, foot);
    return { s, th, sh, foot, kn: new THREE.Vector3(), f: new THREE.Vector3() };
  });

  const nodes = Array.from({ length: NS + 1 }, () => new THREE.Vector3()), dirs = Array.from({ length: NS }, () => new THREE.Vector3());
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), look = new THREE.Vector3(), sa = new THREE.Vector3(), sbb = new THREE.Vector3();
  let phase = 0, yaw = 0, crouch = 0, reach = 0, jaw = 0, run = 0, scan = 0;

  return {
    root, eye,
    materials,
    update(M, kid, dt, t) {
      root.position.set(M.x, 0, M.z);
      yaw += wrap(Math.atan2(M.hx, M.hz) - yaw) * Math.min(1, dt * 10);
      body.rotation.y = yaw;
      const mode = M.mode, sp = M.speed;
      run = damp(run, Math.min(1, sp / 3.4), 6, dt);
      crouch = damp(crouch, mode === 'windup' ? 1 : mode === 'sleep' ? 0.8 : mode === 'recover' ? 0.5 : 0, 14, dt);
      reach = damp(reach, mode === 'lunge' ? 1 : mode === 'check' || M.doorT > 0 ? 0.6 : 0, 12, dt);
      // rage (a candle just went out): it rears up and roars, jaw wide, fur on end
      const rage = M.rage > 0 ? Math.min(1, M.rage) : 0;
      jaw = damp(jaw, mode === 'windup' || mode === 'lunge' || rage > 0.5 ? 1 : mode === 'chase' ? 0.5 : mode === 'sleep' ? 0 : 0.1, 10, dt);
      phase += dt * (1.2 + sp * 2.6);
      const sw = Math.sin(phase);

      // spine: hunched; lower and further forward the faster it goes; crouched back before a lunge
      const pelvisY = 0.72 - crouch * 0.22 - run * 0.08 + Math.abs(Math.cos(phase)) * 0.05 * run;
      const curl = 1.0 + run * 0.35 - crouch * 0.3 + reach * 0.4 + (mode === 'sleep' ? 0.5 : 0) - rage * 0.45 * (0.8 + 0.2 * Math.sin(t * 25));
      nodes[0].set(0, pelvisY, -0.08 - reach * 0.1);
      for (let i = 0; i < NS; i++) {
        const a = (curl * (i + 0.5)) / NS;
        dirs[i].set(Math.sin(t * 0.9 + i) * 0.03, Math.cos(a), Math.sin(a)).normalize();
        nodes[i + 1].copy(nodes[i]).addScaledVector(dirs[i], SL * (1 + reach * 0.25));
        segs[i].position.copy(nodes[i]).lerp(nodes[i + 1], 0.5);
        segs[i].quaternion.setFromUnitVectors(UP, dirs[i]);
        segs[i].scale.setScalar(1 + Math.sin(t * (2 + run * 4)) * 0.03);
      }
      // head forward at the top; looks at you when it knows where you are, scans when it searches
      const top = nodes[NS];
      head.position.copy(top).addScaledVector(dirs[NS - 1], 0.2).add(v1.set(0, -0.05, 0.08));
      scan = mode === 'search' || mode === 'patrol' ? Math.sin(t * 0.9) * 0.7 : 0;
      head.rotation.set(0.35 * run - 0.2 * crouch + (mode === 'sleep' ? 0.6 : 0), scan, Math.sin(t * 1.3) * 0.08);
      jawLow.rotation.x = jaw * 0.6; jawLow.position.y = -0.085 - jaw * 0.04;
      mouth.scale.y = 0.02 + jaw * 0.05;

      // eye: on a stalk from the top of the head, swaying; it stares at you, or ahead
      const sb = v1.set(0, 0.2, 0.05).applyEuler(head.rotation).add(head.position);
      const tip = v2.set(Math.sin(t * 1.1) * 0.08 + scan * 0.25, 0.62 + Math.sin(t * 0.8) * 0.05 + run * 0.05 - crouch * 0.15, 0.25 + run * 0.15).add(head.position);
      const mid = v3.copy(sb).lerp(tip, 0.5).add(look.set(0, 0.12, -0.1));
      for (let i = 0; i < stalk.length; i++) {
        const u0 = i / stalk.length, u1 = (i + 1) / stalk.length;
        const a = sa.copy(sb).multiplyScalar((1 - u0) ** 2).addScaledVector(mid, 2 * u0 * (1 - u0)).addScaledVector(tip, u0 * u0);
        const b = sbb.copy(sb).multiplyScalar((1 - u1) ** 2).addScaledVector(mid, 2 * u1 * (1 - u1)).addScaledVector(tip, u1 * u1);
        place(stalk[i], a, b);
      }
      eye.position.copy(tip);
      body.updateMatrixWorld(true);
      if (M.sees || mode === 'windup' || mode === 'lunge' || mode === 'chase') look.set(kid.x, 0.5, kid.z);
      else look.set(M.x + M.hx * 3 + Math.sin(t * 0.7) * 1.5, 0.3, M.z + M.hz * 3);
      eye.lookAt(look);
      eye.scale.setScalar(mode === 'windup' ? 1.35 : 1);
      lid.rotation.x = mode === 'sleep' ? 1.5 : -0.35 - jaw * 0.5;

      // arms: shoulders off the upper spine; hands drag near the floor, swing when it runs, reach when it lunges
      for (const A of arms) {
        const sh = v1.copy(nodes[2]).add(v3.set(A.s * 0.33, -0.05, 0.05));
        const swing = Math.sin(phase + (A.s > 0 ? 0 : Math.PI)) * 0.25 * run;
        const hang = v2.set(A.s * 0.42, 0.1 + Math.abs(swing) * 0.2, 0.25 + swing);
        const out = v3.set(A.s * 0.25, 0.75, 1.05);
        A.w.lerpVectors(hang, out, reach);
        if (crouch > 0.5 && mode === 'windup') A.w.set(A.s * 0.45, 0.85, 0.2);
        ik(sh, A.w, 0.5, 0.48, look.copy(sh).add(v2.set(A.s * 0.6, 0.2, -0.6)), A.el);
        place(A.up, sh, A.el); place(A.lo, A.el, A.w);
        A.hand.position.copy(A.w);
        A.claws.forEach((c, i) => {
          c.position.copy(A.w).add(v2.set((i - 1) * 0.035, -0.04, 0.05));
          c.quaternion.setFromUnitVectors(UP, v3.set((i - 1) * 0.2, -0.6 + reach * 0.6, 1).normalize());
        });
      }
      // legs: feet planted in a walking cycle under the hips
      for (const Lg of legs) {
        const hp = v1.set(Lg.s * 0.17, pelvisY - 0.05, -0.1);
        const p = Math.sin(phase + (Lg.s > 0 ? 0 : Math.PI));
        const stride = 0.12 + run * 0.28;
        Lg.f.set(Lg.s * 0.2, 0.05 + Math.max(0, Math.cos(phase + (Lg.s > 0 ? 0 : Math.PI))) * 0.12 * Math.min(1, sp), p * stride * Math.min(1, sp + 0.1));
        ik(hp, Lg.f, 0.4, 0.4, look.copy(hp).add(v2.set(0, 0, 1)), Lg.kn);
        place(Lg.th, hp, Lg.kn); place(Lg.sh, Lg.kn, Lg.f);
        Lg.foot.position.copy(Lg.f).add(v2.set(0, -0.01, 0.06));
      }
      furM.uniforms.uSway.value = 0.05 + run * 0.06 + jaw * 0.05 + rage * 0.12;
    },
    // seen: the whole body; hidden behind walls: only what pokes above them (the eye on its stalk)
    setSeen(seen, clipY) { for (const m of materials) m.uniforms.uClipY.value = seen ? -100 : clipY; blob.visible = seen; },
  };
}

let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
