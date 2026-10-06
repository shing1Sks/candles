// The entity: a double-sided paper puppet. Front = the friendly side (smiling, waving).
// Back = the other side (sad, frowning, melting), shown mirrored when the card flips.
//
//   wait     -> it is elsewhere (comes back sooner in mist and as it escalates)
//   peek     -> half behind a trunk, leaning out. Each time you notice it, it leans out further.
//   duck     -> caught looking: it slides back behind the trunk
//   emerge   -> after enough peeks it may stop hiding: it steps out...
//   flip     -> ...and the card turns over to its other side
//   hunt     -> stop-motion lunges toward you, mostly when you are not looking, limbs jerking on pins
//   toPetal  -> you dropped a petal: it goes to it instead
//   remember -> it stands over the petal, turns back to its smiling side, tilts its head. confused.
//   wave / behind -> the old ladder: it waves from the open, or it is standing behind you
//   vanish   -> stop-motion flicker, then gone
import * as THREE from 'three';
import { buildRig } from './art.js';
import { RULES, rand, chance } from './rules.js';
import { emit, viewAngle } from './state.js';

const E = RULES.entity;
const REST = { upperArm: -1.2, forearm: 2.75, hand: 0.35 };
const DECALS = 40;

export class Entity {
  constructor(scene, sprites, A, world) {
    this.world = world;
    this.front = buildRig(A.entity);
    this.back = buildRig(A.entityBack);
    this.back.body.scale.x = -1;
    for (const r of [this.front, this.back]) {
      r.root.visible = false;
      scene.add(r.root);
      sprites.add({ root: r.root, meshes: r.meshes });
    }
    this.rig = this.front; this.face = 'front';
    this.meltMats = [this.front, this.back].map((r) => r.nodes.melt.g.children[0].material);
    this.x = 0; this.z = 0;
    this.state = 'wait';
    this.timer = E.firstWait;
    this.level = 0;
    this.exposure = 0;
    this.presence = 0;
    this.side = 1;
    this.visible = false;

    // the ink it leaves where it has been
    this.decals = [];
    for (let i = 0; i < DECALS; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: A.inkTex[i % A.inkTex.length], transparent: true, depthWrite: false, fog: true }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      sprites.add({ root: m, meshes: [m], billboard: false, bias: 9e5 });
      this.decals.push({ m, life: 0 });
    }
    this.decalI = 0;
  }

  // ---- helpers ----
  place(x, z) {
    this.x = x; this.z = z;
    this.front.root.position.set(x, 0, z);
    this.back.root.position.set(x, 0, z);
  }

  show(v) {
    this.visible = v;
    this.front.root.visible = v && this.face === 'front';
    this.back.root.visible = v && this.face === 'back';
  }

  setFace(face) {
    this.face = face;
    this.rig = face === 'front' ? this.front : this.back;
    this.show(this.visible);
  }

  view(p) { return { d: Math.hypot(this.x - p.x, this.z - p.z), da: viewAngle(p, this.x, this.z) }; }

  pose({ upperArm, forearm, hand }, lean = 0, tilt = 0, jitter = 0.04) {
    for (const r of [this.front, this.back]) {
      const n = r.nodes;
      n.upperArm.g.rotation.z = upperArm;
      n.forearm.g.rotation.z = forearm;
      n.hand.g.rotation.z = hand;
      r.body.rotation.z = lean;
      // stop-motion: the head never holds perfectly still
      n.head.g.rotation.z = tilt + (Math.random() - 0.5) * jitter;
    }
  }

  ink(x, z) {
    const D = this.decals[this.decalI++ % DECALS];
    D.m.position.set(x + (Math.random() - 0.5) * 0.3, 0.012 + (this.decalI % DECALS) * 0.0004, z + (Math.random() - 0.5) * 0.3);
    D.m.rotation.z = Math.random() * 6.28;
    D.m.scale.setScalar(0.9 + Math.random() * 0.7);
    D.m.material.opacity = 0.9;
    D.m.visible = true;
    D.life = 70;
  }

  go(state) { this.state = state; this.t = 0; this.lookT = 0; this.seen = false; }

  appear(x, z, state, face = 'front') {
    this.place(x, z);
    this.setFace(face);
    this.front.body.scale.x = 1; this.back.body.scale.x = -1;
    this.show(true);
    this.go(state);
  }

  vanish(S, why) {
    this.go('vanish');
    this.flick = 5;
    emit(S, 'entityVanish', { why });
  }

  rest(S, extra = 0) {
    this.level++;
    this.show(false);
    this.go('wait');
    this.timer = Math.max(8, rand(E.wait) - this.level * 1.5) + extra;
  }

  // after it catches you
  reset() {
    this.show(false);
    this.go('wait');
    this.timer = RULES.caught.entityRest;
    this.exposure = 0;
    this.presence = 0;
    this.setFace('front');
  }

  // ---- starting an appearance ----
  start(S) {
    const p = S.player;
    const w = { ...E.kinds };
    if (this.exposure >= E.exposureToTurn) w.peek *= 1.6; // once it has been seen enough, it keeps coming back to peek
    const total = w.peek + w.wave + w.behind;
    let roll = Math.random() * total;
    const kind = (roll -= w.peek) < 0 ? 'peek' : (roll -= w.wave) < 0 ? 'wave' : 'behind';

    if (kind === 'peek') {
      const near = Math.max(E.peekDist[0], E.peekDist[1] - this.level);
      const opts = this.world.treesInView(p, near, near + 7, 0.5).filter((o) => Math.abs(o.da) > 0.15);
      if (!opts.length) { this.timer = 3; return; }
      const { tr } = opts[Math.floor(Math.random() * opts.length)];
      const ax = tr.x - p.x, az = tr.z - p.z, L = Math.hypot(ax, az);
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      this.side = chance(0.5) ? -1 : 1;
      this.tree = tr;
      const out = 0.42 + 0.14 * Math.min(this.exposure, 4); // it leans out further each time
      this.hideAt = [tr.x + (ax / L) * 0.7, tr.z + (az / L) * 0.7];
      this.peekAt = [this.hideAt[0] + rx * this.side * out * tr.scale, this.hideAt[1] + rz * this.side * out * tr.scale];
      this.outAt = [this.hideAt[0] + rx * this.side * 2.2 * tr.scale, this.hideAt[1] + rz * this.side * 2.2 * tr.scale];
      this.appear(this.peekAt[0], this.peekAt[1], 'peek');
      emit(S, 'peek', { exposure: this.exposure, d: +L.toFixed(1) });
    } else if (kind === 'wave') {
      const dist = Math.max(E.waveDist[0], E.waveDist[1] - this.level) + Math.random() * 3;
      for (let k = 0; k < 20; k++) {
        const a = p.yaw + (Math.random() - 0.5) * 0.9;
        const x = p.x - Math.sin(a) * dist, z = p.z - Math.cos(a) * dist;
        if (this.world.open(x, z, 1.2)) { this.appear(x, z, 'wave'); emit(S, 'wave', { d: +dist.toFixed(1) }); return; }
      }
      this.timer = 3;
    } else {
      this.placeBehind(p);
      this.appear(this.x, this.z, 'behind');
      emit(S, 'behind');
    }
  }

  placeBehind(p) {
    const dist = Math.max(E.behindDist[0], E.behindDist[1] - this.level * 0.5);
    this.place(p.x + Math.sin(p.yaw) * dist, p.z + Math.cos(p.yaw) * dist);
  }

  // A stop-motion lunge: a jump toward `tx,tz`, limbs thrown into a new random pose.
  lunge(S, tx, tz, dist, wild = true) {
    const ox = this.x, oz = this.z;
    let ax = tx - ox, az = tz - oz;
    const L = Math.hypot(ax, az) || 1;
    ax /= L; az /= L;
    const j = (Math.random() - 0.5) * (wild ? 1.0 : 0.3);
    const dx = ax * Math.cos(j) - az * Math.sin(j), dz = ax * Math.sin(j) + az * Math.cos(j);
    const step = Math.min(dist, Math.max(0, L - 0.4));
    this.place(ox + dx * step, oz + dz * step);
    this.ink(ox, oz);
    if (wild) {
      this.pose({ upperArm: rand([-2.4, 0.9]), forearm: rand([-2.6, 2.9]), hand: rand([-0.9, 0.9]) }, rand([-0.32, 0.32]), rand([-0.8, 0.8]), 0.1);
      for (const r of [this.front, this.back]) r.nodes.melt.g.rotation.z = rand([-0.25, 0.25]);
    }
    emit(S, 'lunge', { d: +Math.hypot(tx - this.x, tz - this.z).toFixed(2) });
  }

  // ---- the stop-motion step (12 fps) ----
  step(t, dt, S) {
    const p = S.player;
    for (const D of this.decals) {
      if (D.life <= 0) continue;
      D.life -= dt;
      D.m.material.opacity = Math.min(0.9, D.life / 10);
      if (D.life <= 0) D.m.visible = false;
    }
    S.shake = 0;

    if (this.state === 'wait') {
      this.presence = Math.max(0, this.presence - dt * 0.3);
      this.timer -= dt * (1 + S.mist * RULES.mist.entityHaste);
      if (this.timer <= 0) this.start(S);
      return;
    }
    if (this.state === 'vanish') {
      this.flick--;
      this.show(this.flick > 0 && this.flick % 2 === 1);
      if (this.flick <= 0) { this.rest(S, this.restExtra || 0); this.restExtra = 0; }
      return;
    }
    if (this.state === 'caught') return; // main is playing the crumple; it waits for reset()

    this.t += dt;
    const { d, da } = this.view(p);
    const watched = Math.abs(da) < 0.5 && d < 40;
    const inView = Math.abs(da) < 0.6 && d < 45;
    const hunting = this.state === 'hunt' || this.state === 'flip' || this.state === 'emerge';
    const target = hunting ? Math.min(1, 1.2 - d / 26) : this.state === 'remember' ? 0.35 : inView ? Math.max(0, 1 - d / 34) : 0;
    this.presence += (Math.max(target, this.presence * 0.97) - this.presence) * Math.min(1, dt * 3);
    for (const r of [this.front, this.back]) if (this.state !== 'hunt') r.nodes.melt.g.rotation.z = Math.sin(t * 0.9) * 0.035;

    switch (this.state) {
      case 'peek': {
        const lean = 0.2 + 0.07 * Math.min(this.exposure, 4);
        this.pose(REST, -this.side * lean, -this.side * (0.42 + 0.05 * this.exposure));
        if (Math.abs(da) < 0.18 && d < 40) this.lookT += dt;
        if (this.lookT > E.lookToNotice) {
          this.exposure++;
          emit(S, 'peekSeen', { exposure: this.exposure });
          // a petal let go from here on counts for this hunt
          if (this.exposure >= E.exposureToTurn && chance(E.turnChance)) { this.go('emerge'); this.huntFrom = S.t; emit(S, 'emerge'); }
          else { this.go('duck'); }
        } else if (d < 7) this.vanish(S, 'tooClose');
        else if (this.t > 26) this.vanish(S, 'unseen');
        break;
      }
      case 'duck': {
        const k = Math.min(1, this.t / 0.4);
        this.place(this.peekAt[0] + (this.hideAt[0] - this.peekAt[0]) * k, this.peekAt[1] + (this.hideAt[1] - this.peekAt[1]) * k);
        this.pose(REST, -this.side * 0.2 * (1 - k), -this.side * 0.42);
        if (k >= 1) this.rest(S);
        break;
      }
      case 'emerge': {
        // two stop-motion steps out from behind the trunk, then it stands there
        if (this.t > 0.35 && !this.e1) { this.e1 = true; this.place((this.peekAt[0] + this.outAt[0]) / 2, (this.peekAt[1] + this.outAt[1]) / 2); }
        if (this.t > 0.8 && !this.e2) { this.e2 = true; this.place(this.outAt[0], this.outAt[1]); }
        this.pose(REST, 0, Math.sin(this.t * 2) * 0.2 + 0.35, 0.02);
        if (this.t > 2.0) { this.e1 = this.e2 = false; this.flipTo('back', 'hunt'); emit(S, 'turned'); }
        break;
      }
      case 'flip': {
        // the card turns over in stop-motion: squash, swap sides, unsquash (the back is mirrored)
        const k = Math.floor(this.t / (1 / 12));
        const squash = [1, 0.6, 0.15, 0.15, 0.6, 1];
        if (k < 3) this.rig.body.scale.x = (this.face === 'front' ? 1 : -1) * squash[k];
        else {
          if (this.face !== this.flipFace) this.setFace(this.flipFace);
          if (k < 6) this.rig.body.scale.x = (this.face === 'front' ? 1 : -1) * squash[k];
          else {
            this.rig.body.scale.x = this.face === 'front' ? 1 : -1;
            this.go(this.flipThen);
            this.lungeT = rand(E.lungeEvery);
            this.huntT = 0;
          }
        }
        break;
      }
      case 'hunt': {
        this.huntT += dt;
        S.shake = d < 10 ? (1 - d / 10) * 0.7 : 0;
        // a petal you let go of while it hunts: it goes for that instead
        if (S.dropped && S.dropped.t >= this.huntFrom && !S.dropped.taken) {
          S.dropped.taken = true;
          this.petal = S.dropped;
          this.go('toPetal');
          this.lungeT = 0.2;
          emit(S, 'distracted', { colour: this.petal.colour });
          break;
        }
        if (d < E.catchDist) { this.go('caught'); emit(S, 'caught'); break; }
        if (d > E.giveUpDist || this.huntT > E.huntMax) { this.exposure = 1; this.restExtra = 15; this.vanish(S, 'gaveUp'); break; }
        this.lungeT -= dt;
        if (this.lungeT <= 0) {
          if (!watched || chance(E.lungeWhileWatched)) {
            // mostly straight at you; sometimes it darts to a tree to come at you from cover
            if (chance(0.15)) {
              const cover = this.world.treesInView(p, 4, d, 1.2)[0];
              if (cover) this.lunge(S, cover.tr.x + 0.6, cover.tr.z + 0.6, rand(E.lungeDist) * 1.5);
              else this.lunge(S, p.x, p.z, rand(E.lungeDist) * (1 + E.lungeGrowth * this.huntT));
            } else this.lunge(S, p.x, p.z, rand(E.lungeDist) * (1 + E.lungeGrowth * this.huntT));
          }
          this.lungeT = rand(watched ? E.lungeEveryWatched : E.lungeEvery);
        } else if (chance(0.25)) {
          // twitch: just the head, just a little
          for (const r of [this.front, this.back]) r.nodes.head.g.rotation.z += (Math.random() - 0.5) * 0.25;
        }
        break;
      }
      case 'toPetal': {
        const pd = Math.hypot(this.petal.x - this.x, this.petal.z - this.z);
        this.lungeT -= dt;
        if (pd < 1.0) {
          this.flipTo('front', 'remember');
          this.rememberFor = rand(E.distractTime);
          emit(S, 'remember', { colour: this.petal.colour });
        } else if (this.lungeT <= 0) {
          this.lunge(S, this.petal.x, this.petal.z, Math.min(pd - 0.6, 2.6), false);
          this.lungeT = 0.35;
        }
        break;
      }
      case 'remember': {
        // it looks down at the petal and tries to remember. head tilting one way, then the other
        const k = Math.sin(this.t * 1.1);
        this.pose({ upperArm: -0.7, forearm: 1.5 + Math.sin(this.t * 0.8) * 0.2, hand: 0.3 }, 0.12, k * 0.55, 0.02);
        const pulse = 1 + 0.9 * (0.5 + 0.5 * Math.sin(this.t * 3));
        for (const m of this.meltMats) m.userData.uSat.value = pulse; // the colour in it flares
        if (this.t > this.rememberFor) {
          for (const m of this.meltMats) m.userData.uSat.value = 1;
          this.exposure = 1;
          this.restExtra = 20;
          this.vanish(S, 'remembered');
        }
        break;
      }
      case 'wave': {
        const w = Math.sin(t * 5.5);
        this.pose({ upperArm: 0.08 + w * 0.08, forearm: w * 0.32, hand: Math.sin(t * 5.5 + 1.2) * 0.35 }, Math.sin(t * 0.7) * 0.03, 0.3 + Math.sin(t * 0.5) * 0.08);
        if (Math.abs(da) < 0.4 && !this.seen) { this.seen = true; emit(S, 'waveSeen'); }
        if (d < 8.5) this.vanish(S, 'tooClose');
        else if (this.seen && Math.abs(da) > 1.0) this.vanish(S, 'lookedAway');
        else if (this.t > 35) this.vanish(S, 'unseen');
        break;
      }
      case 'behind': {
        this.pose(REST, 0, 0.55);
        if (!this.seen && d > 14) this.placeBehind(p); // it keeps up with you until you turn round
        if (Math.abs(da) < 0.55) {
          if (!this.seen) { this.seen = true; emit(S, 'behindSeen'); }
          this.lookT += dt;
        }
        if (this.seen && (this.lookT > 1.5 || d < 4)) this.vanish(S, 'seen');
        else if (this.t > 30) this.vanish(S, 'unseen');
        break;
      }
    }
  }

  flipTo(face, then) {
    this.flipFace = face;
    this.flipThen = then;
    this.go('flip');
  }
}
