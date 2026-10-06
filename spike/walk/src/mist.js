// Mist: banks of paper fog drift through the trees all the time; every so often a mist event rolls
// in and visibility drops to a few trees. The entity comes back sooner in the mist.
import * as THREE from 'three';
import { RULES, rand } from './rules.js';
import { emit } from './state.js';

const M = RULES.mist;
const BANKS = 26;

export class Mist {
  constructor(scene, sprites, A) {
    // no depth test: a bank that dips below the ground would otherwise cut a hard line across it
    this.mat = new THREE.MeshBasicMaterial({ map: A.mistTex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.2 });
    this.banks = [];
    for (let i = 0; i < BANKS; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), this.mat);
      scene.add(m);
      sprites.add({ root: m, meshes: [m] });
      this.banks.push({ m, placed: false });
    }
    this.on = false;
    this.timer = rand(M.every);
  }

  place(B, S, near = false) {
    const p = S.player, a = Math.random() * Math.PI * 2, d = near ? rand([4, 30]) : rand([20, 32]);
    B.m.position.set(p.x + Math.cos(a) * d, rand([0.4, 2.6]), p.z + Math.sin(a) * d);
    B.m.scale.setScalar(rand([0.8, 1.9]));
    B.placed = true;
  }

  // Stop-motion step (12 fps).
  step(t, dt, S) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.on = !this.on;
      this.timer = rand(this.on ? M.lasts : M.every);
      S.mistTarget = this.on ? 1 : 0;
      emit(S, this.on ? 'mistIn' : 'mistOut');
    }
    const base = 0.12 * (0.5 + 0.5 * Math.sin(t * 0.05));
    S.mist += (S.mistTarget + base - S.mist) * Math.min(1, dt * 0.22);

    const p = S.player, wx = Math.cos(S.windAng) * S.wind * 0.5, wz = Math.sin(S.windAng) * S.wind * 0.5;
    for (const B of this.banks) {
      if (!B.placed) { this.place(B, S, true); continue; }
      B.m.position.x += wx * dt; B.m.position.z += wz * dt;
      const d = Math.hypot(B.m.position.x - p.x, B.m.position.z - p.z);
      if (d > 34) this.place(B, S);
    }
  }

  // every frame: banks take the fog's colour and thicken with the mist
  frame(S, fogColour) {
    this.mat.color.copy(fogColour);
    this.mat.opacity = 0.14 + S.mist * 0.5;
  }
}
