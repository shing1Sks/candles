// Outside the maze: the board sits on a dark table in an endless dark. Across the table the giant hunches
// over the board with a controller in its claws - it is the one playing the monster. Its thumbs move the
// sticks as its piece moves, its eye follows the game, and it looks up at you when it wins.
// Everything out here is lit only by the glow coming off the board, so it fades as the candles go out.
import * as THREE from 'three';
import { spikes, glowTexture } from './actors.js';

const OU = { uGlow: { value: 1 }, uBoard: { value: new THREE.Vector4() }, uTime: { value: 0 } };

const outVert = /* glsl */ `
  varying vec3 vW; varying vec3 vN; varying vec3 vL;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vL = position;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const outFrag = /* glsl */ `
  uniform float uGlow, uTime, uWood; uniform vec4 uBoard; uniform vec3 uColor, uEmis;
  varying vec3 vW; varying vec3 vN; varying vec3 vL;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec3 n = normalize(vN);
    // light from the nearest point of the glowing board
    vec3 b = vec3(clamp(vW.x, uBoard.x, uBoard.z), 0.6, clamp(vW.z, uBoard.y, uBoard.w));
    vec3 d = b - vW; float dist = length(d);
    float glow = uGlow * (0.15 + 0.85 * max(0.0, dot(n, d / max(dist, 1e-3)))) / (1.0 + dist * dist * 0.004);
    float rim = 0.05 * pow(1.0 - max(0.0, dot(n, normalize(cameraPosition - vW))), 3.0); // a faint edge against the void
    vec3 base = uColor;
    if (uWood > 0.5) base *= 0.75 + 0.35 * vnoise(vec2(vW.x * 0.08, vW.z * 1.6)) + 0.1 * vnoise(vW.xz * 3.0);
    gl_FragColor = vec4(base * (0.006 + glow * 0.9 + rim) + uEmis, 1.0);
  }`;

function outMat(color, { emis = 0, wood = false, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...OU, uColor: { value: new THREE.Color(color, color, color) }, uEmis: { value: new THREE.Color(emis, emis, emis) }, uWood: { value: wood ? 1 : 0 } },
    vertexShader: outVert, fragmentShader: outFrag, side,
  });
}

function universe() {
  const g = new THREE.SphereGeometry(600, 48, 24);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: OU.uTime },
    vertexShader: 'varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vD;
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        vec3 d = normalize(vD);
        // slow grey dust drifting in the void
        float neb = n3(d * 3.0 + uTime * 0.01) * 0.6 + n3(d * 7.0 - uTime * 0.02) * 0.4;
        float c = pow(neb, 3.0) * 0.035;
        // stars: one per cell, a few of them bright, all faintly breathing
        vec3 p = d * 140.0, cell = floor(p);
        float h = h3(cell);
        if (h > 0.985) {
          vec3 sp = cell + 0.5 + 0.35 * (vec3(h3(cell + 7.1), h3(cell + 3.3), h3(cell + 1.9)) - 0.5);
          float s = smoothstep(0.22, 0.0, length(p - sp));
          c += s * (h > 0.997 ? 0.9 : 0.25) * (0.75 + 0.25 * sin(uTime * (1.0 + h * 3.0) + h * 40.0));
        }
        gl_FragColor = vec4(vec3(c), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const s = new THREE.Mesh(g, m);
  s.renderOrder = -1;
  return s;
}

// a capsule from a to b
function limb(a, b, r, material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 12), material);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// a gamepad: body, two grips, two sticks, four buttons. Returns { group, sticks: [l, r], buttons }
function gamepad(scale, shell, dark) {
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
    b.position.set(x, 0.2, z); g.add(b);
    return b;
  });
  g.scale.setScalar(scale);
  return { group: g, sticks, buttons };
}

export function createTable(scene, camera, L) {
  OU.uBoard.value.set(0, 0, L.w, L.h);
  const cx = L.w / 2;
  scene.add(universe());

  // the table, and the box the maze is built in
  const table = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 95), outMat(0.2, { wood: true }));
  table.position.set(cx, -1.9, 4);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(L.w + 1.4, 0.88, L.h + 1.4), outMat(0.12, { wood: true }));
  plinth.position.set(cx, -0.46, L.h / 2);
  scene.add(table, plinth);

  // the giant, across the table
  const fur = outMat(0.07), hide = outMat(0.05), claw = outMat(0.35), padShell = outMat(0.32), padDark = outMat(0.08);
  const BZ = -15;
  const giant = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.set(cx, 6, BZ);
  const egg = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), hide);
  egg.scale.set(13, 12, 9.5);
  const coat = new THREE.Mesh(spikes(700, 12.5, 11.5, 9, 4.2, 0.55), fur);
  torso.add(egg, coat);
  torso.rotation.x = 0.42;
  giant.add(torso);

  // arms reach over the table edge to the controller
  const pad = gamepad(2.6, padShell, padDark);
  pad.group.position.set(cx, 1.2, -4.2);
  pad.group.rotation.x = 0.55; // tilted up toward its face
  giant.add(pad.group);
  const armParts = [];
  const handAt = (s) => new THREE.Vector3(cx + s * 3.7, 1.3, -3.4);
  for (const s of [-1, 1]) {
    const sh = new THREE.Vector3(cx + s * 11.5, 12, BZ + 4), el = new THREE.Vector3(cx + s * 13, 3.5, BZ + 9.5), h = handAt(s);
    const upper = limb(sh, el, 2.0, hide), fore = limb(el, h, 1.5, hide);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), hide);
    hand.scale.set(2.0, 1.3, 2.2); hand.position.copy(h);
    const claws = new THREE.Group();
    claws.position.copy(h);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 6), claw);
      c.position.set(-s * (0.6 + i * 0.35), 0.6 + (i === 0 ? 0.6 : 0), 1.2 + i * 0.25);
      c.rotation.set(1.3, 0, s * (0.6 + i * 0.15));
      claws.add(c);
    }
    giant.add(upper, fore, hand, claws);
    armParts.push({ hand, claws, base: h.clone() });
  }

  // the stalk: a bent tube of segments from its back to the eye that hangs over the board
  const stalkMat = outMat(0.09);
  const segs = [];
  for (let i = 0; i < 12; i++) {
    const r = 0.75 - i * 0.04;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 1, 10), stalkMat);
    giant.add(m); segs.push(m);
  }
  const eye = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 20), outMat(0.3, { emis: 0.62 }));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), outMat(0));
  pupil.scale.set(0.8, 1.5, 0.5); pupil.position.z = 1.18;
  const lid = new THREE.Mesh(new THREE.SphereGeometry(1.58, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hide);
  eye.add(ball, pupil, lid);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(9);
  eye.add(halo);
  giant.add(eye);
  scene.add(giant);

  // your own controller, held low in front of you
  const mine = gamepad(0.24, outMat(0.42), outMat(0.1));
  mine.group.position.set(0, -0.58, -1.25);
  mine.group.rotation.x = 0.95;
  camera.add(mine.group);
  scene.add(camera);

  const base = new THREE.Vector3(cx, 17, BZ + 3), ctrl = new THREE.Vector3(cx, 24, BZ + 11);
  const eyePos = new THREE.Vector3(cx, 10, -2), want = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let lean = 0, blink = 0, nextBlink = 3, close = 0, lookUp = 0;
  const bez = (t, out) => {
    const a = 1 - t;
    return out.set(a * a * base.x + 2 * a * t * ctrl.x + t * t * eyePos.x, a * a * base.y + 2 * a * t * ctrl.y + t * t * eyePos.y, a * a * base.z + 2 * a * t * ctrl.z + t * t * eyePos.z);
  };

  return {
    update(G, dt, t, input, glow, zoom = 0) {
      OU.uTime.value = t;
      OU.uGlow.value += (glow - OU.uGlow.value) * Math.min(1, dt * 2);
      const M = G.monster, k = G.kid;
      const hunting = M.mode === 'chase' || M.mode === 'windup' || M.mode === 'lunge';
      const over = G.state !== 'play';
      lean += ((hunting ? 1 : M.mode === 'sleep' ? -0.6 : 0) - lean) * Math.min(1, dt * 2.5);
      lookUp += ((G.state === 'caught' ? 1 : 0) - lookUp) * Math.min(1, dt * 1.5);
      close += ((G.state === 'won' ? 1 : 0) - close) * Math.min(1, dt * 0.8);

      // body: breathing, leaning in when it hunts
      const breathe = Math.sin(t * 0.9) * 0.025;
      torso.scale.set(1 + breathe, 1 + breathe * 1.4, 1 + breathe);
      torso.rotation.x = 0.42 + lean * 0.12 - close * 0.25;
      torso.position.z = BZ + lean * 1.2;
      coat.rotation.y = Math.sin(t * 7) * 0.006 * (1 + lean * 3);

      // the eye hangs over the board above its piece, and drops lower when it is close to you
      want.set(cx + (M.x - cx) * 0.35, 7.5 - lean * 2 + Math.sin(t * 0.7) * 0.5, -2.2 + M.z * 0.1 + lean * 1.2);
      if (lookUp > 0.01) want.lerp(tmp.set(cx, 15, -2), lookUp);
      want.y -= close * 6;
      eyePos.lerp(want, Math.min(1, dt * 1.6));
      for (let i = 0; i < segs.length; i++) {
        const a = bez(i / segs.length, new THREE.Vector3()), b = bez((i + 1) / segs.length, new THREE.Vector3());
        b.x += Math.sin(t * 1.3 + i * 0.6) * 0.15 * i / segs.length;
        segs[i].position.copy(a).lerp(b, 0.5);
        segs[i].scale.y = a.distanceTo(b) + 0.15;
        segs[i].quaternion.setFromUnitVectors(up, tmp.copy(b).sub(a).normalize());
      }
      eye.position.copy(eyePos);
      // where it looks: at you (the kid) when it sees you, at its own piece otherwise, at YOU when it wins
      if (M.sees || hunting) look.set(k.x, 0.5, k.z);
      else look.set(M.x + M.hx * 2 + Math.sin(t * 0.5) * 2, 0.5, M.z + M.hz * 2);
      if (lookUp > 0.01) look.lerp(camera.position, lookUp);
      eye.lookAt(look);
      nextBlink -= dt;
      if (nextBlink < 0) { blink = 1; nextBlink = 3 + Math.random() * 5; }
      blink = Math.max(0, blink - dt * 7);
      const shut = Math.max(close, Math.sin(blink * Math.PI));
      // a heavy lid over the top of the eye: wider when it hunts, rolling down to blink or sleep
      lid.rotation.x = -0.4 - lean * 0.5 + shut * (Math.PI / 2 + 0.4);
      ball.scale.setScalar(M.mode === 'windup' ? 1.12 : 1);
      halo.material.opacity = 0.22 * (1 - close);

      // its thumbs on the sticks: the left stick is how its piece moves, the right one twitches
      const sp = Math.max(0.01, Math.hypot(M.vx, M.vz)), mag = Math.min(1, sp / 3);
      // it faces you, so its left/right and forward/back are mirrored from your view
      pad.sticks[0].rotation.set(-(M.vz / sp) * mag * 0.45, 0, -(M.vx / sp) * mag * 0.45);
      pad.sticks[1].rotation.set(Math.sin(t * 3.1) * 0.12 * (1 + lean), 0, Math.sin(t * 2.3) * 0.12);
      pad.buttons.forEach((b, i) => { b.position.y = 0.2 - ((M.mode === 'lunge' && i === 0) || (M.mode === 'windup' && i === 1) ? 0.07 : 0); });
      pad.group.position.y = 1.2 + lean * 0.4 + (M.mode === 'lunge' ? 0.5 : 0);
      for (const [i, a] of armParts.entries()) {
        const s = i ? 1 : -1;
        tmp.copy(a.base); tmp.y += lean * 0.4 + (M.mode === 'lunge' ? 0.5 : 0);
        a.hand.position.copy(tmp); a.claws.position.copy(tmp);
        a.claws.rotation.y = s * (i === 0 ? mag : 0) * 0.08;
      }

      // your controller mirrors your hands
      mine.sticks[0].rotation.set((input.mz || 0) * 0.45, 0, -(input.mx || 0) * 0.45);
      mine.buttons[0].position.y = 0.2 - (input.blow ? 0.07 : 0);
      // your controller sits low in your view; leaning in, it drops out of sight
      mine.group.position.y = -0.58 - zoom * 0.45;
      mine.group.visible = !over && zoom < 0.7;
    },
  };
}
