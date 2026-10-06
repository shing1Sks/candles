// The forest: generated in chunks around the player, deterministic per chunk.
// Each chunk is a grove (dense), a clearing (open, with a little scene in it) or ordinary forest.
// Trees (pinned canopies swaying), bushes, grass, props, bunnies, falling leaves, birds overhead,
// a paper-diorama horizon and clouds on threads that travel with you, and a painted ground.
import * as THREE from 'three';
import { makeRng } from '../../concepts/paint.js';
import { buildRig, paperMat } from './art.js';
import { viewAngle } from './state.js';

const CH = 26;   // chunk size (m)
const R = 2;     // chunks kept around the player

function hash(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export class World {
  constructor(scene, sprites, A) {
    this.scene = scene; this.sprites = sprites; this.A = A;
    this.chunks = new Map();
    this.trees = [];      // active trees: { root, nodes, x, z, r, phase, scale }
    this.bunnies = [];
    this.swings = [];
    this.solids = [];     // everything you bump into: { x, z, r }
    this.cell = null;
    // one shared shaft of light for every clearing
    this.shaftGeo = new THREE.PlaneGeometry(4, 14);
    this.shaftMat = new THREE.MeshBasicMaterial({ map: A.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.22, fog: true });

    const gt = A.groundTex; gt.repeat.set(220, 220);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ map: gt, fog: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.renderOrder = -100;
    scene.add(ground);
    this.ground = ground;

    // the paper diorama horizon: two rings of cut-paper hills that travel with you
    this.rings = A.hills.map((t, i) => {
      t.repeat.set(3, 1);
      const r = 150 - i * 30, h = 26 - i * 4;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72, 1, true),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.y = h / 2 - 3;
      m.renderOrder = -90 + i;
      scene.add(m);
      return m;
    });
    // paper clouds hung on threads
    {
      const t = A.clouds; t.repeat.set(2, 1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(125, 125, 70, 72, 1, true),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.y = 30;
      m.renderOrder = -95;
      scene.add(m);
      this.rings.push(m);
    }

    // falling paper leaves
    this.leaves = [];
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(A.leafGeo, paperMat(A.leafTex, { side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      const o = sprites.add({ root: m, meshes: [m], billboard: false });
      this.leaves.push({ m, o, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() });
    }

    // birds circling far off
    this.birds = [];
    for (let f = 0; f < 3; f++) {
      const centre = new THREE.Vector2((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
      for (let b = 0; b < 5; b++) {
        const rig = buildRig(A.bird);
        rig.root.scale.setScalar(1.6);
        scene.add(rig.root);
        sprites.add({ root: rig.root, meshes: rig.meshes });
        this.birds.push({ rig, centre, rad: 30 + Math.random() * 25, ang: Math.random() * 6.28, h: 13 + Math.random() * 8, speed: (0.1 + Math.random() * 0.05) * (f % 2 ? 1 : -1), off: b, flap: Math.random() * 6 });
      }
    }
  }

  // ---- chunk generation ----
  genChunk(i, j) {
    const r = makeRng(hash(i, j));
    const rr = (a, b) => a + (b - a) * r();
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const ch = { objects: [], trees: [], bunnies: [], swings: [], solids: [] };
    const spots = [];
    const free = (x, z, d) => spots.every(([u, v, w]) => (u - x) ** 2 + (v - z) ** 2 > (d + w) ** 2);
    const at = () => [(i + r()) * CH, (j + r()) * CH];
    const nearSpawn = (x, z, d) => Math.hypot(x, z) < d;
    const card = (g, x, z, s, extra = {}) => {
      const m = new THREE.Mesh(g.geo, g.mat);
      m.position.set(x, 0, z);
      m.scale.setScalar(s);
      this.scene.add(m);
      ch.objects.push(this.sprites.add({ root: m, meshes: [m], cull: true, ...extra }));
      return m;
    };

    const roll = r();
    const biome = roll < 0.18 ? 'clearing' : roll < 0.5 ? 'grove' : 'forest';
    ch.biome = biome;

    // a clearing holds one small scene in its middle, with a shaft of light
    if (biome === 'clearing') {
      const cx = (i + 0.5) * CH + rr(-3, 3), cz = (j + 0.5) * CH + rr(-3, 3);
      const scene = pick(['pond', 'bench', 'swing', 'signpost', 'pond', 'swing']);
      if (!nearSpawn(cx, cz, 8)) {
        if (scene === 'swing') {
          const rig = buildRig(this.A.swing);
          rig.root.position.set(cx, 0, cz);
          this.scene.add(rig.root);
          const o = this.sprites.add({ root: rig.root, meshes: rig.meshes });
          ch.objects.push(o);
          ch.swings.push({ ...rig, phase: r() * 6 });
          ch.solids.push({ x: cx, z: cz, r: 1.2 });
        } else if (scene === 'pond') {
          const g = this.A.props.pond;
          const m = new THREE.Mesh(g.geo, g.mat);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = r() * 6.28;
          m.position.set(cx, 0.02, cz);
          m.scale.setScalar(rr(0.9, 1.4));
          this.scene.add(m);
          ch.objects.push(this.sprites.add({ root: m, meshes: [m], billboard: false, bias: 1e6 }));
        } else {
          const g = this.A.props[scene];
          card(g, cx, cz, 1);
          if (g.solid) ch.solids.push({ x: cx, z: cz, r: g.solid });
        }
        spots.push([cx, cz, 4]);
        const shaft = new THREE.Mesh(this.shaftGeo, this.shaftMat);
        shaft.position.set(cx, 6, cz);
        this.scene.add(shaft);
        ch.objects.push(this.sprites.add({ root: shaft, meshes: [shaft], bias: -50 }));
      }
    }

    const nTrees = biome === 'grove' ? 10 + Math.floor(r() * 5) : biome === 'clearing' ? 2 + Math.floor(r() * 3) : 6 + Math.floor(r() * 5);
    for (let k = 0; k < nTrees * 3 && ch.trees.length < nTrees; k++) {
      const [x, z] = at();
      if (nearSpawn(x, z, 6) || !free(x, z, biome === 'grove' ? 2.4 : 3.4)) continue;
      spots.push([x, z, 0]);
      const rig = buildRig(pick(this.A.trees));
      const s = rr(0.8, 1.35);
      rig.root.position.set(x, 0, z);
      rig.root.scale.setScalar(s);
      this.scene.add(rig.root);
      const o = this.sprites.add({ root: rig.root, meshes: rig.meshes, cull: true });
      const t = { ...rig, x, z, r: 0.42 * s, phase: r() * 6.28, scale: s, o };
      ch.trees.push(t); ch.objects.push(o);
      ch.solids.push({ x, z, r: t.r });
    }

    // things in between: stumps, logs, rocks, mushrooms
    const props = [['stump', 1.2], ['log', 0.7], ['rock', 1.3], ['mushrooms', 2.4]];
    for (const [name, mean] of props) {
      const n = Math.floor(mean * rr(0.3, 1.7));
      for (let k = 0; k < n; k++) {
        const [x, z] = at();
        if (nearSpawn(x, z, 4) || !free(x, z, 1.5)) continue;
        const g = this.A.props[name];
        const s = rr(0.75, 1.3);
        card(g, x, z, s);
        spots.push([x, z, 0.5]);
        if (g.solid) ch.solids.push({ x, z, r: g.solid * s });
      }
    }

    for (let k = 0; k < (biome === 'clearing' ? 3 : 7); k++) {
      const [x, z] = at();
      if (nearSpawn(x, z, 5) || !free(x, z, 1.5)) continue;
      card(pick(this.A.bushes), x, z, rr(0.6, 1.25));
    }
    for (let k = 0; k < (biome === 'clearing' ? 80 : 55); k++) {
      const [x, z] = at();
      card(pick(this.A.grass), x, z, rr(0.6, 1.3));
    }
    if (r() < (biome === 'clearing' ? 0.9 : 0.4)) {
      const rig = buildRig(this.A.bunny);
      const [x, z] = at();
      rig.root.position.set(x, 0, z);
      this.scene.add(rig.root);
      const o = this.sprites.add({ root: rig.root, meshes: rig.meshes });
      const b = { ...rig, o, home: new THREE.Vector2(x, z), target: new THREE.Vector2(x, z), hop: 0, rest: r() * 3, flee: 0, face: 1 };
      ch.bunnies.push(b); ch.objects.push(o);
    }
    return ch;
  }

  update(px, pz) {
    const ci = Math.floor(px / CH), cj = Math.floor(pz / CH);
    const cell = ci + ',' + cj;
    for (const r of this.rings) { r.position.x = px; r.position.z = pz; }
    if (cell === this.cell) return;
    this.cell = cell;
    for (let i = ci - R; i <= ci + R; i++) {
      for (let j = cj - R; j <= cj + R; j++) {
        const key = i + ',' + j;
        if (!this.chunks.has(key)) this.chunks.set(key, this.genChunk(i, j));
      }
    }
    for (const [key, ch] of this.chunks) {
      const [i, j] = key.split(',').map(Number);
      if (Math.abs(i - ci) > R + 1 || Math.abs(j - cj) > R + 1) {
        for (const o of ch.objects) { this.scene.remove(o.root); this.sprites.remove(o); }
        this.chunks.delete(key);
      }
    }
    this.trees = []; this.bunnies = []; this.swings = []; this.solids = [];
    for (const ch of this.chunks.values()) {
      this.trees.push(...ch.trees); this.bunnies.push(...ch.bunnies);
      this.swings.push(...ch.swings); this.solids.push(...ch.solids);
    }
  }

  // Stop-motion step (12 fps): canopies sway on their pins, bunnies hop, swings swing, leaves fall, birds flap.
  step(t, dt, S) {
    const player = S.player, wind = S.wind;
    const gust = Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.13 + 1) * 0.5;
    for (const tr of this.trees) {
      const d2 = (tr.x - player.x) ** 2 + (tr.z - player.z) ** 2;
      if (d2 > 50 * 50) continue;
      for (let k = 0; k < 3; k++) {
        const n = tr.nodes['canopy' + k];
        n.g.rotation.z = Math.sin(t * (0.9 + k * 0.23) + tr.phase + k * 1.7) * (0.012 + 0.008 * k) + gust * wind * 0.03 * (1 + k * 0.4);
      }
    }
    // the swing moves with no one on it, a little more when the entity is near
    for (const sw of this.swings) sw.nodes.seat.g.rotation.z = Math.sin(t * 1.4 + sw.phase) * (0.18 + S.dread * 0.25);

    for (const b of this.bunnies) {
      const pos = b.root.position;
      const dp = Math.hypot(pos.x - player.x, pos.z - player.z);
      if ((dp < 6 || S.dread > 0.5) && b.flee <= 0) {
        b.flee = 2.5;
        const ax = pos.x - player.x, az = pos.z - player.z, L = Math.hypot(ax, az) || 1;
        b.target.set(pos.x + (ax / L) * 9, pos.z + (az / L) * 9);
      }
      b.flee -= dt;
      const tx = b.target.x - pos.x, tz = b.target.y - pos.z, td = Math.hypot(tx, tz);
      if (td < 0.2) {
        b.rest -= dt;
        b.body.position.y = 0;
        b.nodes.head.g.rotation.z = Math.sin(t * 7) * 0.04;
        b.nodes.earF.g.rotation.z = Math.sin(t * 3 + 1) * 0.08;
        if (b.rest <= 0) {
          b.rest = 1 + Math.random() * 4;
          b.target.set(b.home.x + (Math.random() - 0.5) * 12, b.home.y + (Math.random() - 0.5) * 12);
        }
      } else {
        const sp = b.flee > 0 ? 4.2 : 1.6;
        const st = Math.min(td, sp * dt);
        pos.x += (tx / td) * st; pos.z += (tz / td) * st;
        b.hop += dt * (b.flee > 0 ? 9 : 6);
        const h = Math.abs(Math.sin(b.hop));
        b.body.position.y = h * 0.16;
        b.body.rotation.z = (h - 0.5) * 0.25 * b.face;
        b.nodes.leg.g.rotation.z = -h * 0.6;
        b.nodes.haunch.g.rotation.z = h * 0.4;
        b.nodes.earF.g.rotation.z = -h * 0.35;
        b.nodes.earB.g.rotation.z = -h * 0.3;
        const sx = (tx / td) * Math.cos(player.yaw) - (tz / td) * Math.sin(player.yaw); // camera-right component
        b.face = sx >= 0 ? 1 : -1;
      }
      b.body.scale.x = b.face;
    }

    // leaves: spawn under nearby canopies, tumble down
    for (const L of this.leaves) {
      if (L.life <= 0) {
        if (Math.random() < 0.08 && this.trees.length) {
          const tr = this.trees[Math.floor(Math.random() * this.trees.length)];
          if ((tr.x - player.x) ** 2 + (tr.z - player.z) ** 2 < 22 * 22) {
            L.m.position.set(tr.x + (Math.random() - 0.5) * 3 * tr.scale, (4 + Math.random() * 2.5) * tr.scale, tr.z + (Math.random() - 0.5) * 3 * tr.scale);
            L.v.set((Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.3, (Math.random() - 0.5) * 0.4);
            L.spin.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            L.life = 1; L.m.visible = true;
          }
        }
        continue;
      }
      L.m.position.addScaledVector(L.v, dt);
      L.m.position.x += Math.sin(t * 2 + L.spin.x) * 0.5 * dt + Math.cos(S.windAng) * wind * 0.6 * dt;
      L.m.position.z += Math.sin(S.windAng) * wind * 0.6 * dt;
      L.m.rotation.x += L.spin.x * dt; L.m.rotation.y += L.spin.y * dt; L.m.rotation.z += L.spin.z * dt;
      if (L.m.position.y < 0.02) { L.m.position.y = 0.02; L.life -= dt * 0.15; L.v.set(0, 0, 0); L.spin.set(0, 0, 0); L.m.rotation.set(-Math.PI / 2, 0, L.m.rotation.z); }
      if (L.life <= 0) L.m.visible = false;
    }

    for (const b of this.birds) {
      b.ang += b.speed * dt;
      const a = b.ang + b.off * 0.12;
      b.rig.root.position.set(b.centre.x + player.x * 0.6 + Math.cos(a) * (b.rad + b.off * 1.5), b.h + Math.sin(t * 0.7 + b.off) * 0.6, b.centre.y + player.z * 0.6 + Math.sin(a) * (b.rad + b.off * 1.5));
      b.flap += dt * 9;
      const f = Math.sin(b.flap + b.off);
      b.rig.nodes.wingF.g.rotation.z = -f * 0.7;
      b.rig.nodes.wingB.g.rotation.z = f * 0.6;
    }
  }

  collide(pos, radius = 0.35) {
    for (const s of this.solids) {
      const dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz), m = s.r + radius;
      if (d < m && d > 1e-4) { pos.x = s.x + (dx / d) * m; pos.z = s.z + (dz / d) * m; }
    }
  }

  // Trees in front of the player within a distance band (for the entity to hide behind).
  treesInView(player, dmin, dmax, cone) {
    const out = [];
    for (const tr of this.trees) {
      const d = Math.hypot(tr.x - player.x, tr.z - player.z);
      if (d < dmin || d > dmax) continue;
      const da = viewAngle(player, tr.x, tr.z);
      if (Math.abs(da) < cone) out.push({ tr, d, da });
    }
    return out;
  }

  // Is this spot open ground (no tree or prop on it)?
  open(x, z, clearance = 1.4) {
    return this.solids.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + clearance);
  }
}
