// BISCUIT. A ten-week golden puppy, the one warm, soft thing in the whole night.
// Built from soft shapes, each covered in real fur: twelve shells per part, drawn as one instanced
// draw, every shell pushed out along the normal and thinned by a strand pattern, with the tips
// drooping under gravity and trailing when he moves. A warm rim and a touch of glow keep him
// visible in the dark (the game is about him; you must always be able to find him), and his collar
// has a little light that blinks.
// The pose comes from the sim every frame: gait phase and speed, head look, ears, tail, crouch,
// sit, sniff, pant, carried.
import * as THREE from 'three';
import { U } from './materials.js';

const SHELLS = 8;
const FUR_U = { uFurLen: { value: 0.022 }, uGrav: { value: new THREE.Vector3(0, -1, 0) }, uDrag: { value: new THREE.Vector3() } };

// the fur: a standard material (so the street lamps and the moon light it properly) with shells
function furMaterial(color, tip, len = 1) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, emissive: new THREE.Color(color).multiplyScalar(0.07) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, FUR_U, { uLen: { value: len }, uTip: { value: new THREE.Color(tip) }, uShellMul: { value: 1 } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFurLen, uLen, uShellMul; uniform vec3 uGrav, uDrag;
        varying float vShell; varying vec3 vObj; varying vec3 vNw;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float shell = float(gl_InstanceID) / ${SHELLS - 1}.0 * uShellMul;
        #else
          float shell = 0.0;
        #endif
        vShell = shell; vObj = position;
        // out along the normal; the tips droop (gravity, in object space) and trail behind motion
        transformed += normal * shell * uFurLen * uLen;
        vec3 g = (inverse(mat3(modelMatrix)) * (uGrav + uDrag)) ;
        transformed += g * shell * shell * uFurLen * uLen * 0.55;`)
      .replace('#include <project_vertex>', `
        #ifdef USE_INSTANCING
          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        #else
          #include <project_vertex>
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vShell; varying vec3 vObj; uniform vec3 uTip;
        float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // strands: a jittered cell pattern in object space; each strand has its own length
        vec3 cp = vObj * 380.0; vec3 ci = floor(cp); vec3 f = fract(cp) - 0.5;
        // tufts: a slow noise groups strands into soft clumps of different lengths
        vec3 cq = floor(vObj * 45.0); float tuft = 0.55 + 0.45 * fh(cq);
        float len = (0.3 + 0.7 * fh(ci)) * tuft;
        float r = length(f.xy + f.yz * 0.5);
        if (vShell > 0.001 && (vShell > len || r > 0.58 * (1.0 - vShell * 0.8))) discard;
        diffuseColor.rgb *= 0.92 + 0.16 * fh(ci + 7.0);
        // roots darker (self-shadow), tips lighter
        diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.7, vShell));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTip, smoothstep(0.55, 1.0, vShell) * 0.6);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // a soft warm rim so he reads against the dark
        vec3 rn = vNormal + vec3(1e-5); float rim = pow(clamp(1.0 - abs(dot(normalize(rn), normalize(vViewPosition))), 0.0, 1.0), 2.5);
        totalEmissiveRadiance += uTip * rim * 0.32 * (0.4 + vShell);`);
  };
  m.customProgramCacheKey = () => 'fur:' + color;
  return m;
}

function furred(geo, mat, shells = SHELLS) {
  const m = new THREE.InstancedMesh(geo, mat, shells);
  const id = new THREE.Matrix4(); for (let i = 0; i < shells; i++) m.setMatrixAt(i, id);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  return m;
}
const ell = (rx, ry, rz, ws = 20, hs = 14) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); return g; };

export class Puppy {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root);
    this.scale = 1.25;
    const cream = 0xf0d2a0, tip = 0xfff0d0, toffee = 0xc8884e;
    const F = furMaterial(cream, tip), Fe = furMaterial(toffee, 0xe8b880, 1.1), Ft = furMaterial(cream, tip, 1.7), Fs = furMaterial(0xf6e4c4, 0xfff4e0, 0.6);
    this.body = new THREE.Group(); this.body.position.y = 0.2; this.root.add(this.body);
    // the body: swept along the spine. Deep chest, tucked belly, round rump. Taller than wide.
    const prof = [[0.004, -0.2], [0.045, -0.195], [0.085, -0.17], [0.102, -0.12], [0.1, -0.05], [0.088, 0.02], [0.084, 0.07], [0.092, 0.12], [0.088, 0.165], [0.06, 0.2], [0.004, 0.215]].map(([r, z]) => new THREE.Vector2(r, z));
    const bg = new THREE.LatheGeometry(prof, 22); bg.rotateX(Math.PI / 2); bg.scale(0.9, 1.08, 1);
    // the belly tucks up toward the back legs
    const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), z = bp.getZ(i); if (y < 0) bp.setY(i, y * (1 - Math.max(0, z + 0.02) * 1.6)); }
    bg.computeVertexNormals();
    this.torso = furred(bg, F); this.body.add(this.torso);
    const chest = furred(ell(0.07, 0.075, 0.05), Fs, 4); chest.position.set(0, -0.02, -0.15); this.body.add(chest);
    // the neck, then the head
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.05, -0.16); this.body.add(this.neck);
    const ng = new THREE.CylinderGeometry(0.058, 0.07, 0.11, 14); ng.rotateX(-0.6); ng.translate(0, 0.04, -0.02); this.neck.add(furred(ng, F, 5));
    this.head = new THREE.Group(); this.head.position.set(0, 0.105, -0.06); this.neck.add(this.head);
    this.head.add(furred(ell(0.112, 0.102, 0.104, 24, 18), F));
    for (const s of [-1, 1]) { const ch = furred(ell(0.052, 0.045, 0.05), Fs, 4); ch.position.set(s * 0.055, -0.045, -0.06); this.head.add(ch); }
    const muz = furred(ell(0.048, 0.04, 0.062), Fs, 4); muz.position.set(0, -0.042, -0.098); this.head.add(muz);
    const nose = new THREE.Mesh(ell(0.022, 0.016, 0.016), new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x1a1214, roughness: 0.2 })); nose.position.set(0, -0.026, -0.158); this.head.add(nose);
    this.tongue = new THREE.Mesh(ell(0.017, 0.006, 0.028), new THREE.MeshStandardMaterial({ color: 0xd86a78, roughness: 0.35 })); this.tongue.position.set(0, -0.075, -0.125); this.head.add(this.tongue);
    // eyes: big, low on the face, dark brown with two highlights
    const eyeM = new THREE.MeshStandardMaterial({ envMap: U.env, color: 0x1a0e08, roughness: 0.04, envMapIntensity: 2.4 });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.023, 16, 12), eyeM); e.position.set(s * 0.046, 0.006, -0.088); e.scale.set(1, 1, 0.8); this.head.add(e); this.eyes.push(e);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.004 + 0.006, 0.009, -0.019); e.add(hl);
      const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl2.position.set(-0.006, -0.008, -0.02); e.add(hl2);
    }
    // ears: teardrop flaps hinged at the top of the head, hanging down the sides, a spring makes them flop
    this.ears = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group(); p.position.set(s * 0.082, 0.058, 0.0); p.rotation.y = s * -0.25; this.head.add(p);
      const eg = new THREE.SphereGeometry(1, 16, 12); eg.scale(0.022, 0.07, 0.045);
      const ep = eg.attributes.position; for (let i = 0; i < ep.count; i++) { const y = ep.getY(i); ep.setZ(i, ep.getZ(i) * (1.15 - y / 0.07 * 0.35)); }
      eg.computeVertexNormals(); eg.translate(s * 0.012, -0.062, 0.005);
      p.add(furred(eg, Fe, 5)); this.ears.push({ p, s, a: 0, v: 0 });
    }
    // collar, tag, and the little light
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.011, 8, 22), new THREE.MeshStandardMaterial({ color: 0xc02a24, roughness: 0.45 }));
    col.rotation.x = Math.PI / 2 - 0.55; col.position.set(0, 0.03, -0.01); this.neck.add(col);
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 14), new THREE.MeshStandardMaterial({ envMap: U.env, color: 0xe8c050, roughness: 0.35, metalness: 0.55, emissive: 0x2a1c04 }));
    tag.rotation.x = Math.PI / 2; tag.position.set(0, -0.05, -0.062); this.neck.add(tag); this.tag = tag;
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 })); this.led.position.set(0.052, 0.04, -0.04); this.neck.add(this.led);
    // a glow round the collar light, so in the dark you can find him by it
    { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      this.ledGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0x66ff88, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.ledGlow.scale.setScalar(0.08); this.led.add(this.ledGlow); }
    this.collarAnchor = new THREE.Object3D(); this.collarAnchor.position.set(0, 0.085, 0.01); this.neck.add(this.collarAnchor);
    // legs: furry all the way down, fluffy paws
    this.legs = [];
    for (const [x, z, front] of [[-0.052, -0.12, 1], [0.052, -0.12, 1], [-0.056, 0.125, 0], [0.056, 0.125, 0]]) {
      const hip = new THREE.Group(); hip.position.set(x, -0.04, z); this.body.add(hip);
      const up = furred(ell(0.036, front ? 0.055 : 0.065, front ? 0.036 : 0.048), F, 5); up.position.y = -0.035; hip.add(up);
      const knee = new THREE.Group(); knee.position.y = -0.08; hip.add(knee);
      const low = furred(new THREE.CapsuleGeometry(0.022, 0.05, 4, 10), F, 4); low.position.y = -0.035; knee.add(low);
      const paw = furred(ell(0.03, 0.022, 0.036), Fs, 4); paw.position.set(0, -0.078, -0.012); knee.add(paw);
      this.legs.push({ hip, knee, front, x });
    }
    // tail: five slim segments, a plume that curls up over the back
    this.tail = [];
    let parent = this.body, pos = [0, 0.06, 0.195];
    for (let k = 0; k < 5; k++) {
      const g = new THREE.Group(); g.position.set(...pos); parent.add(g);
      const r = 0.02 - k * 0.0025, seg = ell(r, 0.034, r); seg.translate(0, 0.028, 0);
      g.add(furred(seg, Ft, 6)); this.tail.push(g); parent = g; pos = [0, 0.05, 0];
    }
    this.t = 0; this.blink = 0;
    this.prevPos = new THREE.Vector3(); this.drag = new THREE.Vector3();
  }

  // P: { x, y, z, yaw, speed, phase, headYaw, headPitch, ears (0 down..1 up/back -1 flat), wag, tailUp, crouch, sit, sniff, pant, carried, scared }
  update(P, dt, camera) {
    this.t += dt;
    const R = this.root;
    if (!P.carried) { R.position.set(P.x, P.y, P.z); R.rotation.set(0, P.yaw, 0); R.scale.setScalar(this.scale); }
    const sp = Math.min(1, P.speed / 1.6), ph = P.phase;
    // body: bob with the trot, lower when crouched/scared, tilt back when sitting
    // sitting: the rump goes down and back, the chest stays up on straight front legs
    this.body.position.y = 0.2 - P.crouch * 0.07 - P.sit * 0.035 + Math.abs(Math.sin(ph * Math.PI * 2)) * 0.012 * sp;
    this.body.position.z = P.sit * 0.06;
    this.body.rotation.x = P.sit * 0.62 - P.sniff * 0.08 + P.crouch * -0.05;
    const breath = 1 + Math.sin(this.t * (P.pant > 0.3 ? 11 : 3.2)) * (P.pant > 0.3 ? 0.025 : 0.012);
    this.torso.scale.set(breath, breath, 1);
    // legs: a trot (diagonal pairs) at speed; tucked when crouched; folded when sitting
    for (const L of this.legs) {
      const off = (L.front ? 0 : 0.5) + (L.x > 0 ? 0.5 : 0);
      const a = Math.sin((ph + off) * Math.PI * 2) * 0.55 * sp;
      let hip = a, knee = Math.max(0, -Math.cos((ph + off) * Math.PI * 2)) * 0.7 * sp;
      if (!L.front && P.sit > 0) { hip = -1.35 * P.sit; knee = 2.3 * P.sit; }
      if (L.front && P.sit > 0) { hip = hip * (1 - P.sit) - 0.62 * P.sit; knee *= 1 - P.sit; }
      if (P.carried) { hip = L.front ? -0.4 : 0.5; knee = L.front ? 0.3 : 0.2; }
      hip += P.crouch * (L.front ? -0.25 : 0.35);
      L.hip.rotation.x += (hip - L.hip.rotation.x) * Math.min(1, dt * 18);
      L.knee.rotation.x += (knee - L.knee.rotation.x) * Math.min(1, dt * 18);
    }
    // head: look where the sim says, nose to the ground when sniffing, a twitch when he sniffs
    const hy = P.headYaw, hp = P.headPitch - P.sniff * 0.75 + Math.sin(ph * Math.PI * 4) * 0.03 * sp;
    this.neck.rotation.y += (hy * 0.4 - this.neck.rotation.y) * Math.min(1, dt * 8);
    this.head.rotation.y += (hy * 0.6 - this.head.rotation.y) * Math.min(1, dt * 8);
    this.neck.rotation.x += (hp * 0.5 - this.neck.rotation.x) * Math.min(1, dt * 6);
    this.head.rotation.x += (hp * 0.5 + (P.sniff > 0.5 ? Math.sin(this.t * 22) * 0.03 : 0) - this.head.rotation.x) * Math.min(1, dt * 10);
    this.head.rotation.z = (P.tilt || 0) * 0.4;
    this.tongue.visible = P.pant > 0.3; this.tongue.scale.z = 1 + Math.sin(this.t * 11) * 0.2;
    // ears: a spring toward their target, kicked by head motion (they flop)
    for (const E of this.ears) {
      const target = P.ears >= 0 ? E.s * (0.25 + P.ears * 0.9) : E.s * 0.15;
      const back = P.ears < 0 ? -P.ears * 0.9 : 0;
      E.v += ((target - E.a) * 60 - E.v * 7) * dt + (Math.sin(ph * Math.PI * 2) * 2.2 * sp) * dt * E.s;
      E.a += E.v * dt;
      E.p.rotation.z = E.a; E.p.rotation.x = back;
    }
    // tail: wag fast when happy, slow and low when unsure, tucked when scared
    const wag = Math.sin(this.t * (6 + P.wag * 10)) * (0.15 + P.wag * 0.6);
    const up = P.scared ? 2.3 : 0.25 - P.tailUp * 0.35;
    this.tail.forEach((g, k) => { g.rotation.x = k === 0 ? up : (P.scared ? 0.35 : -0.42 + P.tailUp * 0.2); g.rotation.z = wag * (k + 1) * 0.32; });
    // his moments
    const m = P.moment, mt = P.mt || 0;
    if (m === 'scratch') { // a back leg up to the ear, going like a sewing machine, head tipped into it
      const L = this.legs[3]; L.hip.rotation.x = -1.6; L.knee.rotation.x = 1.0 + Math.sin(mt * 38) * 0.35; L.hip.rotation.z = -0.5;
      this.head.rotation.z = 0.45; this.ears[1].p.rotation.z = 0.6 + Math.sin(mt * 38) * 0.2;
    } else this.legs[3].hip.rotation.z = 0;
    if (m === 'yawn') { const k = Math.sin(Math.min(1, mt / 1.8) * Math.PI); this.head.rotation.x -= k * 0.55; this.tongue.visible = k > 0.3; this.tongue.scale.set(1.2, 1, 1.3); this.jaw = k; }
    if (m === 'shake') { const k = Math.sin(Math.min(1, mt / 1.2) * Math.PI); this.body.rotation.z = Math.sin(mt * 32) * 0.55 * k; this.head.rotation.z = -Math.sin(mt * 32) * 0.7 * k; this.ears.forEach((E) => (E.v += Math.sin(mt * 32) * 30 * k * dt * 60)); }
    else this.body.rotation.z *= 0.8;
    if (m === 'sneeze') { const k = mt < 0.5 ? mt / 0.5 : Math.max(0, 1 - (mt - 0.5) * 4); this.head.rotation.x += mt < 0.5 ? k * 0.35 : -k * 0.6; }
    // blinking
    this.blink -= dt; const closed = this.blink < 0.12 && this.blink > 0;
    if (this.blink < 0) this.blink = 2 + Math.random() * 4;
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1;
    // the collar light blinks
    this.led.visible = Math.floor(this.t * 1.2) % 2 === 0 || P.scared;
    this.led.material.color.setHex(P.scared ? 0xff5040 : 0x66ff88);
    this.ledGlow.material.color.copy(this.led.material.color); this.ledGlow.scale.setScalar(P.lost ? 0.5 : 0.08); this.ledGlow.visible = this.led.visible;
    // fur trails motion (world velocity -> drag), gravity in world
    const wp = R.getWorldPosition(new THREE.Vector3());
    const v = wp.clone().sub(this.prevPos).divideScalar(Math.max(dt, 1e-3)); this.prevPos.copy(wp);
    this.drag.lerp(v.multiplyScalar(-0.35).clampLength(0, 0.8), Math.min(1, dt * 6));
    FUR_U.uDrag.value.copy(this.drag);
  }
  collarWorld(out = new THREE.Vector3()) { return this.collarAnchor.getWorldPosition(out); }
}
