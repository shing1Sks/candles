// The giant across the table: the one playing the monster.
// A spine of six segments curls up out of the dark and over the table edge; it bends further when it hunts.
// Shoulders hang off the spine, and two-bone arms reach the controller with elbows splayed out and down.
// Fingers wrap the grips and the thumbs ride the sticks. A heavy head hangs at the top of the spine with a
// slit of a mouth full of teeth, and from it a stalk carries the one eye out over the board.
// Thousands of fur strands sway on every part. When a candle goes out it lets go of the controller with one
// hand and slams it on the table. When it catches you it lifts its head and looks at you, the player.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { outMat } from './outlit.js';
import { glowTexture } from './actors.js';

const UP = new THREE.Vector3(0, 1, 0);

// A strand: a thin 4-sided cone from (0,0,0) to (0,1,0), dark at the root and paler at the tip.
function strandGeometry() {
  const g = new THREE.ConeGeometry(0.5, 1, 4, 2, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.fill(0.55 + 0.9 * p.getY(i), i * 3, i * 3 + 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const STRAND = strandGeometry();

// Fur over an ellipsoid (radii rx, ry, rz) in its own local space; strands droop toward local -y by `droop`.
function fur(n, rx, ry, rz, len, thick, material, { droop = 0.35, front = -1, seed = 1 } = {}) {
  const m = new THREE.InstancedMesh(STRAND, material, n);
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3(), mtx = new THREE.Matrix4();
  let r = seed * 9301;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let i = 0;
  while (i < n) {
    // even points on a sphere, stretched to the ellipsoid
    const y = 1 - 2 * rnd(), a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
    const ux = Math.cos(a) * rr, uz = Math.sin(a) * rr;
    if (front > -1 && uz > front) continue; // leave a face bare
    pos.set(ux * rx, y * ry, uz * rz);
    nrm.set(ux / rx, y / ry, uz / rz).normalize();
    nrm.y -= droop; nrm.x += (rnd() - 0.5) * 0.5; nrm.z += (rnd() - 0.5) * 0.5; nrm.normalize();
    q.setFromUnitVectors(UP, nrm);
    const L = len * (0.55 + rnd() * 0.9), T = thick * (0.7 + rnd() * 0.6);
    s.set(T, L, T);
    mtx.compose(pos.multiplyScalar(0.96), q, s);
    m.setMatrixAt(i++, mtx);
  }
  m.frustumCulled = false;
  return m;
}

// two-bone IK: elbow position for shoulder a, wrist c, bone lengths l1, l2, bending toward `pole`
function ik(a, c, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(c, a);
  const dist = Math.min(Math.max(d.length(), 0.01), l1 + l2 - 0.01);
  d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = new THREE.Vector3().subVectors(pole, a);
  p.addScaledVector(d, -p.dot(d)).normalize();
  return out.copy(a).addScaledVector(d, x).addScaledVector(p, h);
}

// a tapered tube between two points (updated every frame)
function bone(r1, r2, material) {
  const g = new THREE.CylinderGeometry(r2, r1, 1, 12, 1);
  g.translate(0, 0.5, 0);
  return new THREE.Mesh(g, material);
}
function place(mesh, a, b) {
  mesh.position.copy(a);
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(L || 1));
  mesh.scale.set(1, L, 1);
}

// a gamepad: body, grips, sticks, buttons, d-pad. Returns { group, sticks: [l, r], buttons, grip(side) }
function gamepad(shell, dark) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.5, 6, 16), shell);
  body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 0.55);
  g.add(body);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.55, 6, 12), shell);
    grip.position.set(s * 0.82, -0.05, 0.38); grip.rotation.x = -1.1; grip.rotation.z = s * 0.25;
    g.add(grip);
  }
  const sticks = [-0.45, 0.45].map((x) => {
    const p = new THREE.Group();
    p.position.set(x, 0.2, 0.05);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 10), dark);
    stem.position.y = 0.1;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.07, 18), dark);
    cap.position.y = 0.22;
    p.add(stem, cap); g.add(p);
    return p;
  });
  const buttons = [[0.85, -0.18], [1.03, 0], [0.85, 0.18], [0.67, 0]].map(([x, z]) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), dark);
    b.position.set(-x, 0.2, z); g.add(b);
    return b;
  });
  const dpad = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(0.34, 0.06, 0.11), new THREE.BoxGeometry(0.11, 0.06, 0.34)]), dark);
  dpad.position.set(0.85, 0.2, 0); g.add(dpad);
  return { group: g, sticks, buttons };
}

export function createGiant(L, camera) {
  const cx = L.w / 2;
  const hide = outMat(0.05), furMat = outMat(0.075, { vcol: true, sway: 0.12, side: THREE.DoubleSide });
  const claw = outMat(0.42), tooth = outMat(0.55), mouthMat = outMat(0.0), padShell = outMat(0.3), padDark = outMat(0.07);
  const root = new THREE.Group();

  // ---- spine and torso
  const N = 6, SEG = 4.7, BASE = new THREE.Vector3(cx, -8, -20.5);
  const RX = [11.5, 12, 11.5, 10.5, 9, 7.5], RZ = [9, 9.5, 9.5, 8.5, 7.5, 6.5];
  const segs = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), hide);
    body.scale.set(RX[i], SEG * 0.85, RZ[i]);
    g.add(body, fur(i < 2 ? 260 : 360, RX[i], SEG * 0.85, RZ[i], 4.2 - i * 0.25, 0.42, furMat, { seed: i + 1 }));
    root.add(g);
    segs.push(g);
  }
  // ---- head: a heavy lump at the top of the spine, a mouth slit with teeth on its front
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), hide);
  skull.scale.set(6, 5, 5.6);
  head.add(skull, fur(420, 6, 5, 5.6, 3.4, 0.36, furMat, { seed: 11, front: 0.55, droop: 0.5 }));
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), mouthMat);
  mouth.scale.set(3.6, 0.35, 1.2); mouth.position.set(0, -1.6, 5.0);
  const jawTop = new THREE.Group(), jawLow = new THREE.Group();
  jawTop.position.set(0, -1.45, 5.2); jawLow.position.set(0, -1.75, 5.2);
  for (let i = 0; i < 11; i++) {
    const x = -3.1 + i * 0.62, len = 0.55 + ((i * 37) % 5) * 0.12;
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, len, 5), tooth);
    t1.position.set(x, -len / 2, 0.15 - Math.abs(x) * 0.12); t1.rotation.x = Math.PI;
    jawTop.add(t1);
    const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, len * 0.8, 5), tooth);
    t2.position.set(x + 0.3, len * 0.4, 0.1 - Math.abs(x) * 0.12);
    jawLow.add(t2);
  }
  head.add(mouth, jawTop, jawLow);
  root.add(head);

  // ---- the eye on its stalk
  const stalk = [];
  const stalkMat = outMat(0.11);
  for (let i = 0; i < 14; i++) { const b = bone(0.85 - i * 0.04, 0.8 - i * 0.04, stalkMat); root.add(b); stalk.push(b); }
  const eye = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), outMat(0.3, { emis: 0.62 }));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), outMat(0));
  pupil.scale.set(0.8, 1.5, 0.5); pupil.position.z = 1.18;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hide);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(9);
  eye.add(ball, pupil, lid, halo);
  root.add(eye);

  // ---- the controller, held over the table edge, tilted up toward its face
  const pad = gamepad(padShell, padDark);
  pad.group.scale.setScalar(2.8);
  root.add(pad.group);

  // ---- arms and hands
  const arms = [-1, 1].map((s) => {
    const upper = bone(2.2, 1.7, hide), fore = bone(1.7, 1.3, hide);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(1.75, 14, 10), hide);
    const upperFur = fur(140, 2.4, 0.5, 2.4, 2.2, 0.3, furMat, { seed: 20 + s, droop: 0.6 });
    upperFur.scale.set(1, 1, 1);
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), hide);
    palm.scale.set(1.9, 1.0, 2.1);
    hand.add(palm);
    // four fingers curled under the grip, each two bones with a claw
    const fingers = [];
    for (let f = 0; f < 4; f++) {
      const fg = new THREE.Group();
      fg.position.set(-s * (-0.9 + f * 0.6), -0.4, 1.4 - f * 0.1);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 8), hide);
      a.position.set(0, -0.6, 0.2); a.rotation.x = -0.4;
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.0, 4, 8), hide);
      b.position.set(0, -1.6, -0.5); b.rotation.x = 0.9;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.0, 6), claw);
      c.position.set(0, -1.85, -1.3); c.rotation.x = 2.2;
      fg.add(a, b, c); hand.add(fg); fingers.push(fg);
    }
    const thumbA = bone(0.5, 0.42, hide), thumbB = bone(0.42, 0.3, hide);
    const thumbClaw = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 6), claw);
    root.add(upper, fore, elbowBall, hand, thumbA, thumbB, thumbClaw, upperFur);
    return { s, upper, fore, elbowBall, upperFur, hand, fingers, thumbA, thumbB, thumbClaw, elbow: new THREE.Vector3(), wrist: new THREE.Vector3() };
  });

  // ---------------- animation
  const st = { lean: 0, hunt: 0, slam: -1, lookUp: 0, close: 0, roar: 0, beam: 0, blink: 0, nextBlink: 3 };
  const nodes = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  const dirs = Array.from({ length: N }, () => new THREE.Vector3());
  const eyePos = new THREE.Vector3(cx, 8, -2), want = new THREE.Vector3(), look = new THREE.Vector3();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  const headQ = new THREE.Quaternion();
  let onImpact = null;

  function spine(t) {
    // total forward curl: ~100 degrees, more when it hunts, less when it sits back
    const curl = 1.55 + st.lean * 0.38 - st.close * 0.5 - st.lookUp * 0.35 + st.roar * 0.15;
    const sway = Math.sin(t * 0.37) * 0.04;
    nodes[0].copy(BASE);
    for (let i = 0; i < N; i++) {
      const a = (curl * (i + 0.5)) / N;
      dirs[i].set(Math.sin(sway * i), Math.cos(a), Math.sin(a)).normalize();
      const breathe = 1 + Math.sin(t * (0.9 + st.hunt * 1.4)) * 0.025 * (i < 4 ? 1 : 0.4);
      nodes[i + 1].copy(nodes[i]).addScaledVector(dirs[i], SEG);
      const g = segs[i];
      g.position.copy(nodes[i]).lerp(nodes[i + 1], 0.5);
      g.quaternion.setFromUnitVectors(UP, dirs[i]);
      g.scale.setScalar(breathe);
    }
  }

  function arm(A, t, M, grip) {
    // shoulder hangs off the 4th spine node, out to the side and a little forward
    const sh = v1.copy(nodes[4]).add(v3.set(A.s * 10, -1.5, 0)).addScaledVector(dirs[3], -1).add(v2.set(0, 0, 1.5));
    const target = A.wrist;
    let holding = true;
    if (A.s < 0 && st.slam >= 0) {
      // the slam: up, then down hard beside the board, a moment pressed there, then back to the controller
      const s = st.slam, up = v2.set(cx - 9, 11, -4.5), down = v3.set(cx - 12.5, -0.4, -3);
      if (s < 0.45) target.lerpVectors(grip, up, Math.sin((s / 0.45) * Math.PI / 2));
      else if (s < 0.6) target.lerpVectors(up, down, ((s - 0.45) / 0.15) ** 2);
      else if (s < 0.95) target.copy(down);
      else target.lerpVectors(down, grip, Math.min(1, (s - 0.95) / 0.6) ** 0.7);
      holding = s > 1.5;
    } else target.copy(grip);
    const pole = v2.copy(sh).add(v3.set(A.s * 9, -2.5, -4));
    ik(sh, target, 8.2, 7.6, pole, A.elbow);
    place(A.upper, sh, A.elbow); place(A.fore, A.elbow, target);
    A.elbowBall.position.copy(A.elbow);
    A.upperFur.position.copy(sh).lerp(A.elbow, 0.5);
    A.upperFur.quaternion.setFromUnitVectors(UP, v3.subVectors(A.elbow, sh).normalize());
    A.upperFur.scale.set(1, sh.distanceTo(A.elbow) / 1.2, 1);
    // the hand sits on the grip, matching the controller's tilt; a fist when it lets go
    A.hand.position.copy(target);
    if (holding) A.hand.quaternion.copy(pad.group.quaternion);
    else A.hand.quaternion.setFromUnitVectors(UP, v3.subVectors(target, A.elbow).normalize().negate()).multiply(q1.setFromAxisAngle(UP, A.s * 0.5));
    A.fingers.forEach((f, i) => { f.rotation.x = holding ? 0 : -0.6 - i * 0.05; });
    // thumb: from the side of the hand to the top of its stick
    const base = v1.set(-A.s * 1.2, 0.6, 0.6).applyQuaternion(A.hand.quaternion).add(A.hand.position);
    const tip = holding ? pad.sticks[A.s > 0 ? 0 : 1].localToWorld(v2.set(0, 0.3, 0)) : v2.copy(base).add(v3.set(A.s * 0.4, 0.5, 1.2));
    const mid = v3.copy(base).lerp(tip, 0.5).add(new THREE.Vector3(0, 0.6, 0));
    place(A.thumbA, base, mid); place(A.thumbB, mid, tip);
    A.thumbClaw.position.copy(tip);
    A.thumbClaw.quaternion.setFromUnitVectors(UP, v1.subVectors(tip, mid).normalize());
  }

  return {
    root, eye,
    onImpact(fn) { onImpact = fn; },
    event(e) {
      if (e.type === 'slam') { st.slam = 0; st.roar = 1; }
      if (e.type === 'spotted' || e.type === 'beamSpot') st.roar = Math.max(st.roar, 0.6);
    },
    update(G, dt, t) {
      const M = G.monster, k = G.kid, B = G.beam;
      const hunting = M.mode === 'chase' || M.mode === 'windup' || M.mode === 'lunge';
      st.hunt += ((hunting ? 1 : 0) - st.hunt) * Math.min(1, dt * 2);
      st.lean += ((hunting ? 1 : M.mode === 'sleep' ? -0.7 : M.mode === 'hunt' || M.mode === 'check' ? 0.45 : 0) - st.lean) * Math.min(1, dt * 1.8);
      st.lookUp += ((G.state === 'caught' ? 1 : 0) - st.lookUp) * Math.min(1, dt * 1.5);
      st.close += ((G.state === 'won' ? 1 : 0) - st.close) * Math.min(1, dt * 0.7);
      st.roar = Math.max(0, st.roar - dt * 0.8);
      st.beam += ((B.state === 'on' ? 1 : B.state === 'warn' ? 0.5 : 0) - st.beam) * Math.min(1, dt * 4);
      if (st.slam >= 0) {
        const was = st.slam;
        st.slam += dt;
        if (was < 0.6 && st.slam >= 0.6) onImpact?.();
        if (st.slam > 1.7) st.slam = -1;
      }
      spine(t);

      // head at the top of the spine, facing down over the board; it tracks its piece, or you
      const top = nodes[N], dTop = dirs[N - 1];
      head.position.copy(top).addScaledVector(dTop, 3.5);
      look.set(M.x, 0, M.z);
      if (M.sees || hunting) look.set(k.x, 0, k.z);
      if (st.lookUp > 0.01) look.lerp(camera.position, st.lookUp);
      m4.lookAt(look, head.position, UP); // +z (its face) toward what it watches
      q1.setFromRotationMatrix(m4);
      headQ.slerp(q1, Math.min(1, dt * 2.5));
      head.quaternion.copy(headQ);
      head.rotateX(-0.25 + Math.sin(t * 0.6) * 0.04);
      const jaw = Math.max(st.roar, st.lookUp * 0.8, st.hunt * 0.2);
      jawLow.position.y = -1.75 - jaw * 1.6; jawLow.rotation.x = jaw * 0.5;
      mouth.scale.y = 0.35 + jaw * 1.6;

      // the eye hangs over the board near its piece, drops lower to stare when it hunts,
      // and swings out over the searchlight when it uses it
      want.set(cx + (M.x - cx) * 0.35, 7.5 - st.lean * 2 + Math.sin(t * 0.7) * 0.5, -2.2 + M.z * 0.1 + st.lean * 1.2);
      if (st.beam > 0.01) want.lerp(v1.set(B.x, 9, Math.min(B.z, L.h * 0.6) - 1), st.beam * 0.6);
      if (st.lookUp > 0.01) want.lerp(v1.set(cx, 15, -2), st.lookUp);
      want.y -= st.close * 6;
      eyePos.lerp(want, Math.min(1, dt * 1.6));
      const sBase = v1.set(0, 3.8, 2.5).applyQuaternion(head.quaternion).add(head.position);
      const sCtrl = v2.copy(sBase).add(v3.set(0, 7, 4));
      for (let i = 0; i < stalk.length; i++) {
        const p = (u, out) => { const a = 1 - u; return out.set(a * a * sBase.x + 2 * a * u * sCtrl.x + u * u * eyePos.x, a * a * sBase.y + 2 * a * u * sCtrl.y + u * u * eyePos.y, a * a * sBase.z + 2 * a * u * sCtrl.z + u * u * eyePos.z); };
        const a = p(i / stalk.length, new THREE.Vector3()), b = p((i + 1) / stalk.length, new THREE.Vector3());
        b.x += Math.sin(t * 1.3 + i * 0.6) * 0.12 * (i / stalk.length);
        place(stalk[i], a, b);
      }
      eye.position.copy(eyePos);
      if (st.beam > 0.3) look.set(B.x, 0, B.z);
      else if (M.sees || hunting) look.set(k.x, 0.5, k.z);
      else look.set(M.x + M.hx * 2 + Math.sin(t * 0.5) * 2, 0.5, M.z + M.hz * 2);
      if (st.lookUp > 0.01) look.lerp(camera.position, st.lookUp);
      eye.lookAt(look);
      st.nextBlink -= dt;
      if (st.nextBlink < 0) { st.blink = 1; st.nextBlink = 3 + Math.random() * 5; }
      st.blink = Math.max(0, st.blink - dt * 7);
      const shut = Math.max(st.close, Math.sin(st.blink * Math.PI));
      lid.rotation.x = -0.4 - st.lean * 0.5 - st.beam * 0.3 + shut * (Math.PI / 2 + 0.4);
      ball.scale.setScalar((M.mode === 'windup' ? 1.12 : 1) * (1 + st.beam * 0.08));
      ball.material.uniforms.uEmis.value.setScalar(0.62 + st.beam * 0.4);
      pupil.scale.set(0.8 - st.beam * 0.3, 1.5 - st.beam * 0.5, 0.5);
      halo.material.opacity = (0.22 + st.beam * 0.35) * (1 - st.close);
      halo.scale.setScalar(9 + st.beam * 6);

      // the controller: over the table edge, tilted up toward its face, jolting forward when it lunges
      pad.group.position.set(cx, 1.1 + st.lean * 0.4 + (M.mode === 'lunge' ? 0.6 : 0), -4.2 - st.lean * 0.3);
      pad.group.rotation.set(-0.5 - st.lean * 0.1, Math.PI, Math.sin(t * 0.8) * 0.03);
      const sp = Math.max(0.01, Math.hypot(M.vx, M.vz)), mag = Math.min(1, sp / 3);
      // its left stick is how its piece moves (it sits facing you, so the stick is turned round)
      pad.sticks[0].rotation.set((M.vz / sp) * mag * 0.45, 0, (M.vx / sp) * mag * 0.45);
      pad.sticks[1].rotation.set(Math.sin(t * 3.1) * 0.12 * (1 + st.hunt), 0, Math.sin(t * 2.3) * 0.12);
      pad.buttons.forEach((b, i) => { b.position.y = 0.2 - ((M.mode === 'lunge' && i === 0) || (M.mode === 'windup' && i === 1) || (M.doorT > 0 && i === 2) ? 0.07 : 0); });
      pad.group.updateMatrixWorld(true);
      for (const A of arms) {
        // the controller is turned round to face it, so its local -x is our +x
        const grip = pad.group.localToWorld(new THREE.Vector3(-A.s * 0.85, -0.1, 0.5));
        arm(A, t, M, grip);
      }
      // fur bristles when it hunts or roars
      furMat.uniforms.uSway.value = 0.12 + st.hunt * 0.12 + st.roar * 0.25;
    },
  };
}
