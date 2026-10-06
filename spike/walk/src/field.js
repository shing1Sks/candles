// The field of paper flowers. The more petals pinned to your hand, the likelier it blooms (up to a
// cap). It pops up right in front of you like a pop-up book, and your petals fly back into it.
// Walk to it and it comes apart at your fingertips... except, rarely, it doesn't: you reach it.
// Phases: idle -> field -> (dissolving | held -> dissolving) -> cooldown -> idle
import * as THREE from 'three';
import { paperMat } from './art.js';
import { RULES, chance, fires } from './rules.js';
import { emit, forwardOf } from './state.js';

const B = RULES.bloom;

export class Field {
  constructor(scene, sprites, A, petals) {
    this.scene = scene; this.sprites = sprites; this.A = A; this.petals = petals;
    this.phase = 'idle';
    this.cool = 20;
    this.flowers = [];
    this.centre = new THREE.Vector2();
    this.age = 0;
    this.given = 0; this.reachChance = 0;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: A.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    this.glow.visible = false;
    scene.add(this.glow);
    sprites.add({ root: this.glow, meshes: [this.glow], bias: 400 });
  }

  hazard(n) { return n < B.minHeld ? 0 : Math.min(B.hazardCap, B.hazardBase + B.hazardPerPetal * n); }

  bloom(S) {
    const p = S.player, [fx, fz] = forwardOf(p);
    this.centre.set(p.x + fx * B.ahead, p.z + fz * B.ahead);
    this.flowers = [];
    for (let i = 0; i < B.flowers; i++) {
      const r = B.radius * Math.sqrt(Math.random()) * (0.45 + 0.55 * Math.random());
      const a = Math.random() * Math.PI * 2;
      const f = this.A.flowers[Math.floor(Math.random() * this.A.flowers.length)];
      const mat = paperMat(f.tex);
      const edge = Math.min(1, r / B.radius);
      mat.userData.uSat.value = 1 - edge * edge * 0.8; // colour drains toward the rim
      const m = new THREE.Mesh(f.geo, mat);
      m.position.set(this.centre.x + Math.cos(a) * r, 0, this.centre.y + Math.sin(a) * r);
      const s = (0.7 + Math.random() * 0.7) * (1.15 - edge * 0.4);
      m.scale.set(s, 0.001, s);
      this.scene.add(m);
      const o = this.sprites.add({ root: m, meshes: [m] });
      this.flowers.push({ m, o, s, sat: mat.userData.uSat.value, pop: 0.15 + edge * 1.3 + Math.random() * 0.25, gone: false, t: 0, petals: 0 });
    }
    this.glow.position.set(this.centre.x, 2.2, this.centre.y);
    this.glow.visible = true;
    this.age = 0;
    this.given = S.held.length;
    this.reachChance = Math.min(RULES.reach.chanceCap, RULES.reach.chancePerPetal * this.given);
    this.rolled = false;
    this.phase = 'field';
    this.petals.ambientOn = false;
    this.petals.release(S, this.centre);
    emit(S, 'bloom', { given: this.given, reachChance: +this.reachChance.toFixed(3), x: +this.centre.x.toFixed(2), z: +this.centre.y.toFixed(2) });
  }

  dissolve(S) {
    this.phase = 'dissolving';
    this.age = 0;
    const dist = (f) => Math.hypot(f.m.position.x - S.player.x, f.m.position.z - S.player.z);
    const dMin = Math.min(...this.flowers.map(dist));
    // nearest first: it comes apart at your fingertips (measured from the nearest flower, so a far field still goes promptly)
    for (const f of this.flowers) f.t = Math.min(3, (dist(f) - dMin) * 0.28) + Math.random() * 0.4;
    emit(S, 'dissolve');
  }

  // Called when the ending card is dismissed: the colour slowly lets go.
  letGo(S) { if (this.phase === 'held') this.dissolve(S); }

  // Stop-motion step (12 fps).
  step(t, dt, S) {
    const p = S.player;
    if (this.phase === 'idle') {
      this.cool -= dt;
      this.petals.ambientOn = true;
      if (this.cool <= 0 && fires(this.hazard(S.held.length), dt)) this.bloom(S);
      return;
    }
    if (this.phase === 'cooldown') {
      this.cool -= dt;
      if (this.cool <= 0) { this.phase = 'idle'; this.cool = 0; }
      return;
    }

    this.age += dt;
    const d = Math.hypot(p.x - this.centre.x, p.z - this.centre.y);
    if (this.phase === 'field' || this.phase === 'held') {
      for (const f of this.flowers) {
        const k = Math.min(1, Math.max(0, (this.age - f.pop) / 0.35));
        // pop-up: overshoot then settle, in stop-motion steps
        const y = k < 1 ? k * 1.25 : 1 + Math.sin(t * 2 + f.pop * 9) * 0.03;
        f.m.scale.y = f.s * Math.max(0.001, y);
        if (this.phase === 'held') f.m.material.userData.uSat.value = Math.min(1.45, f.m.material.userData.uSat.value + dt * 0.4);
      }
      this.glow.material.opacity = Math.min(this.phase === 'held' ? 0.9 : 0.55, this.age * 0.25);
      if (Math.random() < (this.phase === 'held' ? 0.9 : 0.3)) {
        const f = this.flowers[Math.floor(Math.random() * this.flowers.length)];
        this.petals.spawn(new THREE.Vector3(f.m.position.x, 0.4, f.m.position.z), new THREE.Vector3(S.wind * 0.2, 0.25 + Math.random() * 0.3, 0), 'rise');
      }
    }

    if (this.phase === 'field') {
      const close = d < B.dissolveDist || (p.reaching && d < B.reachDist);
      if (this.age > 2 && close && !this.rolled) {
        this.rolled = true;
        if (chance(this.reachChance)) {
          this.phase = 'held';
          S.endings++;
          emit(S, 'reached', { given: this.given, chance: +this.reachChance.toFixed(3) });
        } else this.dissolve(S);
      } else if (d > B.walkAwayDist) this.dissolve(S); // walked away: it goes anyway
    } else if (this.phase === 'dissolving') {
      let alive = 0;
      for (const f of this.flowers) {
        if (f.gone) continue;
        alive++;
        const k = this.age - f.t;
        if (k < 0) continue;
        if (f.petals < 1 && Math.random() < 0.5) {
          f.petals++;
          this.petals.spawn(new THREE.Vector3(f.m.position.x + (Math.random() - 0.5) * 0.3, 0.35 * f.s, f.m.position.z + (Math.random() - 0.5) * 0.3),
            new THREE.Vector3(S.wind * 0.3 + (Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.45, (Math.random() - 0.5) * 0.3), 'rise');
        }
        f.m.material.userData.uSat.value = Math.max(0, f.m.material.userData.uSat.value - dt * 1.6);
        if (k > 0.6) f.m.scale.y = Math.max(0.001, f.m.scale.y - dt * f.s * 2.2); // folds back down
        if (k > 1.2) { f.gone = true; this.scene.remove(f.m); this.sprites.remove(f.o); f.m.material.dispose(); }
      }
      this.glow.material.opacity = Math.max(0, this.glow.material.opacity - dt * 0.25);
      if (!alive) {
        this.glow.visible = false;
        this.flowers = [];
        this.phase = 'cooldown';
        this.cool = B.cooldown;
        emit(S, 'fieldGone');
      }
    }
  }

  // How much colour is near you (0..1): drives the music and the hands.
  nearness(S) {
    if (this.phase !== 'field' && this.phase !== 'dissolving' && this.phase !== 'held') return 0;
    const d = Math.hypot(S.player.x - this.centre.x, S.player.z - this.centre.y);
    if (this.phase === 'held') return 1;
    return Math.max(0, 1 - d / 30) * (this.phase === 'field' ? 1 : Math.max(0, 1 - this.age / 5));
  }
}
