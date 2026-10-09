// HOME. When you reach the gate at the top of the hill: the porch light, the door opening by
// itself, warm light all down the path. Biscuit runs in. A woman's voice, from inside: "There you
// are." You walk in (the game walks you), the light takes everything, and then one last picture:
// the hall table, a framed photo of a boy and a puppy, and a MISSING poster, folded, put away.
// Then the credits. Nothing is explained.
import * as THREE from 'three';
import { at as roadAt, groundAt } from '../sim/road.js';
import { HOME } from '../sim/town.js';
import { homeSpec } from './regions.js';
import { houseFrame } from './house.js';
import { caption } from './encounters.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Ending {
  constructor(scene) { this.scene = scene; this.state = 'waiting'; this.t = 0; }

  // the gate: the end of the road, in front of the house
  gate() { const o = homeSpec(), F = houseFrame(o); return { F, o, gate: V3(o.d / 2 + 2.6, 0, 0).applyMatrix4(F.matrix), door: V3(o.d / 2 + 0.1, 0.55, 0).applyMatrix4(F.matrix), step: V3(o.d / 2 + 1.2, 0, 0).applyMatrix4(F.matrix) }; }

  // returns true once the ending owns the game
  update(dt, c) {
    if (this.state === 'waiting') {
      const G = this.gate(); if (c.P.s < HOME.s - 4.0 || Math.abs(c.P.l) > 5.5) return false;
      this.G = G; this.state = 'door'; this.t = 0;
      c.tall.active = false; c.director.phase = 'after';
      // the door, swinging open, and the light
      const { F, o } = G;
      this.hinge = new THREE.Group(); this.hinge.position.copy(V3(o.d / 2 + 0.07, 0.55, -0.5).applyMatrix4(F.matrix)); this.hinge.rotation.y = F.rotY; this.scene.add(this.hinge);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.12, 0.98), new THREE.MeshStandardMaterial({ color: o.door, roughness: 0.5 })); door.position.set(0, 1.06, 0.49); this.hinge.add(door);
      this.hall = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 2.1), new THREE.MeshBasicMaterial({ color: 0xffe6b0 })); this.hall.position.copy(V3(o.d / 2 + 0.06, 1.6, 0).applyMatrix4(F.matrix)); this.hall.rotation.y = F.rotY + Math.PI / 2; this.hall.visible = false; this.scene.add(this.hall);
      this.light = { pos: V3(o.d / 2 + 1.2, 1.7, 0).applyMatrix4(F.matrix), color: [1.0, 0.8, 0.55], power: 0, cone: 0, kind: 'home' }; c.extraLights.push(this.light);
      c.sound?.one('door_creak', { pos: G.door, gain: 0.7, rate: 0.9, slice: false, verb: 0.3 });
      return true;
    }
    this.t += dt; const G = this.G;
    // the game walks you in
    const auto = (target, speed) => { const dx = target.x - c.P.x, dz = target.z - c.P.z, d = Math.hypot(dx, dz); if (d > 0.05) { c.P.x += dx / d * Math.min(speed * dt, d); c.P.z += dz / d * Math.min(speed * dt, d); } c.P.y = groundAt(c.P.x, c.P.z); const yaw = Math.atan2(-(G.door.x - c.P.x), -(G.door.z - c.P.z)); c.P.yaw += (yaw - c.P.yaw) * Math.min(1, dt * 2); c.P.pitch += (0.05 - c.P.pitch) * Math.min(1, dt * 2); c.P.speed = speed; c.P.phase += speed * dt / 0.62; };
    if (this.state === 'door') {
      this.hinge.rotation.y = G.F.rotY - Math.min(1, this.t / 2.5) * 1.5; this.hall.visible = this.t > 0.2; this.light.power = Math.min(2.4, this.t * 1.2);
      auto(G.step, 0.0);
      if (this.t > 1.6 && !this.said) { this.said = true; caption('"There you are."', 4); }
      if (this.t > 2.0) { // Biscuit runs in
        c.D.carried = false; c.P.carrying = false;
        const dx = G.door.x - c.D.x, dz = G.door.z - c.D.z, d = Math.hypot(dx, dz); c.D.x += dx / Math.max(d, 1e-3) * Math.min(3.2 * dt, d); c.D.z += dz / Math.max(d, 1e-3) * Math.min(3.2 * dt, d); c.D.yaw = Math.atan2(-dx, -dz); c.D.speed = 3; c.D.phase += 3 * dt / 0.36; c.D.wag = 1; c.D.ears = 0.3; c.D.scared = false; c.D.crouch = 0; c.D.state = 'home';
        if (d < 0.4) c.D.hidden = true;
      }
      if (this.t > 5.5) { this.state = 'in'; this.t = 0; }
      return true;
    }
    if (this.state === 'in') { auto(G.door, 1.1); c.post.U.uFlash.value = Math.min(1, this.t / 4); if (this.t > 4.5) { this.state = 'still'; this.t = 0; this.still(c); } return true; }
    if (this.state === 'still') { c.post.U.uFlash.value = Math.max(0, 1 - this.t / 2); if (this.t > 11) { this.state = 'credits'; this.t = 0; this.credits(); } return true; }
    return true;
  }

  // the last picture, in its own little scene: a hall table, a lamp, a photo, a poster folded and put away
  still(c) {
    const S = this.stillScene = new THREE.Scene(); S.background = new THREE.Color(0x0a0705);
    const cam = this.stillCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 20);
    cam.position.set(0, 1.18, 1.95); cam.lookAt(0.0, 0.6, 0);
    const wallM = new THREE.MeshStandardMaterial({ color: 0x7a5a48, roughness: 0.9 });
    // wallpaper: an old faded damask, a sprig in a diamond, the paper a little stained
    const wc = document.createElement('canvas'); wc.width = 256; wc.height = 256; const w2 = wc.getContext('2d'); w2.fillStyle = '#9a7658'; w2.fillRect(0, 0, 256, 256);
    for (const [ox, oy] of [[0, 0], [128, 128], [128, -128], [-128, 128], [256, 0], [0, 256], [256, 256]]) {
      w2.save(); w2.translate(64 + ox, 64 + oy); w2.strokeStyle = 'rgba(200,170,120,0.22)'; w2.lineWidth = 3;
      w2.beginPath(); w2.moveTo(0, -46); w2.lineTo(40, 0); w2.lineTo(0, 46); w2.lineTo(-40, 0); w2.closePath(); w2.stroke();
      w2.fillStyle = 'rgba(70,46,34,0.35)'; for (let k = 0; k < 5; k++) { w2.beginPath(); w2.ellipse(Math.cos(k * 1.256) * 14, Math.sin(k * 1.256) * 14 - 4, 6, 11, k * 1.256, 0, 7); w2.fill(); }
      w2.fillRect(-1.5, 4, 3, 26); w2.restore();
    }
    for (let i = 0; i < 30; i++) { w2.fillStyle = `rgba(40,25,15,${Math.random() * 0.06})`; w2.beginPath(); w2.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 40, 0, 7); w2.fill(); }
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(4, 3); wt.colorSpace = THREE.SRGBColorSpace; wallM.map = wt;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), wallM); wall.position.set(0, 1.5, -0.35); S.add(wall);
    const skirting = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.5 })); skirting.position.set(0, 0.09, -0.33); S.add(skirting);
    // floorboards, worn pale down the middle where people walk
    const fcv = document.createElement('canvas'); fcv.width = 256; fcv.height = 256; const fg = fcv.getContext('2d');
    for (let i = 0; i < 8; i++) { fg.fillStyle = `hsl(25, 40%, ${16 + Math.random() * 6}%)`; fg.fillRect(i * 32, 0, 32, 256); fg.fillStyle = 'rgba(0,0,0,0.5)'; fg.fillRect(i * 32, 0, 1.5, 256); for (let k = 0; k < 14; k++) { fg.fillStyle = 'rgba(0,0,0,0.12)'; fg.fillRect(i * 32 + Math.random() * 30, Math.random() * 256, 1, 20 + Math.random() * 60); } fg.fillStyle = 'rgba(0,0,0,0.6)'; fg.fillRect(i * 32, (i * 97) % 256, 32, 1.5); }
    const ftx = new THREE.CanvasTexture(fcv); ftx.wrapS = ftx.wrapT = THREE.RepeatWrapping; ftx.repeat.set(3, 2); ftx.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ map: ftx, roughness: 0.5 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // a picture rail, and the hook by the door with his red bobble hat on it, still damp
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.5 })); rail.position.set(0, 1.82, -0.33); S.add(rail);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x9a7a38, metalness: 0.8, roughness: 0.3 })); hook.rotation.x = Math.PI / 2 - 0.4; hook.position.set(-0.66, 1.2, -0.3); S.add(hook);
    const knit = new THREE.MeshStandardMaterial({ color: 0xa82a24, roughness: 1 });
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), knit); hat.position.set(-0.66, 1.14, -0.27); hat.rotation.z = 0.25; hat.scale.set(1, 1.2, 0.8); hat.castShadow = true; S.add(hat);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), new THREE.MeshStandardMaterial({ color: 0xece4d8, roughness: 1 })); pom.position.set(-0.64, 1.235, -0.27); pom.castShadow = true; S.add(pom);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20), new THREE.MeshStandardMaterial({ color: 0xece4d8, roughness: 1 })); band.position.set(-0.675, 1.09, -0.27); band.rotation.set(Math.PI / 2, 0.25, 0); band.scale.set(1, 0.8, 1); S.add(band);
    // and on the floor by the table, his bowl, with his name on it. Empty
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64; const b2 = bc.getContext('2d'); b2.fillStyle = '#d8d0c0'; b2.fillRect(0, 0, 256, 64); b2.fillStyle = '#2a4a7a'; b2.font = 'bold 30px Georgia'; b2.textAlign = 'center'; b2.fillText('BISCUIT', 128, 44);
    const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.06, 28, 1, true), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.3, side: THREE.DoubleSide })); bowl.position.set(-0.2, 0.03, 0.12); bowl.rotation.y = -0.3; bowl.castShadow = true; S.add(bowl);
    const bb = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.3 })); bb.rotation.x = -Math.PI / 2; bb.position.set(-0.2, 0.005, 0.12); S.add(bb);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.45 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.4), wood); top.position.set(0, 0.82, -0.12); S.add(top);
    for (const x of [-0.5, 0.5]) for (const z of [-0.28, 0.04]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8, 0.035), wood); leg.position.set(x, 0.4, z); S.add(leg); }
    // the photo: a boy in a red bobble hat holding a cream puppy, in a brass frame
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 320; const g = pc.getContext('2d');
    g.fillStyle = '#c8b898'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#5a6a7a'; g.fillRect(16, 16, 224, 288);
    g.fillStyle = '#e8c0a0'; g.beginPath(); g.arc(128, 130, 40, 0, 7); g.fill(); g.fillStyle = '#b8302a'; g.beginPath(); g.arc(128, 118, 42, Math.PI, 0); g.fill(); g.fillRect(84, 112, 88, 12); g.beginPath(); g.arc(128, 72, 11, 0, 7); g.fillStyle = '#eee'; g.fill();
    g.fillStyle = '#1a1010'; for (const x of [114, 142]) { g.beginPath(); g.arc(x, 138, 4, 0, 7); g.fill(); } g.strokeStyle = '#1a1010'; g.lineWidth = 2.5; g.beginPath(); g.arc(128, 150, 14, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#26324e'; g.fillRect(74, 172, 108, 132); g.fillStyle = '#f0d8a8'; g.beginPath(); g.ellipse(128, 236, 40, 30, 0, 0, 7); g.fill(); g.beginPath(); g.arc(128, 204, 26, 0, 7); g.fill();
    g.fillStyle = '#b07a40'; for (const x of [104, 152]) { g.beginPath(); g.ellipse(x, 208, 8, 16, 0, 0, 7); g.fill(); }
    g.fillStyle = '#1a1010'; for (const [x, y] of [[119, 200], [137, 200], [128, 212]]) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
    g.fillStyle = '#c02a2a'; g.fillRect(108, 226, 40, 6);
    g.fillStyle = 'rgba(255,230,180,0.14)'; g.fillRect(16, 16, 224, 288);
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0x9a7a38, roughness: 0.25, metalness: 0.8 })); frame.position.set(-0.18, 0.98, -0.16); frame.rotation.x = -0.12; frame.rotation.y = 0.12; S.add(frame);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.235), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.35 })); photo.position.copy(frame.position); photo.rotation.copy(frame.rotation); photo.translateZ(0.011); S.add(photo);
    // the poster, folded in four
    const fc = document.createElement('canvas'); fc.width = 200; fc.height = 140; const f2 = fc.getContext('2d'); f2.fillStyle = '#d8ccb0'; f2.fillRect(0, 0, 200, 140); f2.fillStyle = '#2a1a16'; f2.font = 'bold 34px Georgia'; f2.fillText('MISSING', 22, 60); f2.font = '15px Georgia'; f2.fillText('last seen walking', 30, 96); f2.strokeStyle = 'rgba(0,0,0,0.3)'; f2.beginPath(); f2.moveTo(100, 0); f2.lineTo(100, 140); f2.moveTo(0, 70); f2.lineTo(200, 70); f2.stroke();
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    const fold = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95, color: 0x8a8070 })); fold.rotation.x = -Math.PI / 2; fold.rotation.z = 0.35; fold.position.set(0.02, 0.843, 0.02); S.add(fold);
    // a small lamp, and the lead, back on its hook
    // a little table lamp: a pleated fabric shade, the bulb glowing through it, a turned brass stem
    const pleat = document.createElement('canvas'); pleat.width = 128; pleat.height = 8; const p2 = pleat.getContext('2d'); for (let x = 0; x < 128; x++) { const v = 200 + Math.sin(x / 128 * Math.PI * 2 * 24) * 30; p2.fillStyle = `rgb(${v},${v * 0.86 | 0},${v * 0.64 | 0})`; p2.fillRect(x, 0, 1, 8); }
    const pt2 = new THREE.CanvasTexture(pleat); pt2.colorSpace = THREE.SRGBColorSpace;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.12, 0.15, 32, 1, true), new THREE.MeshStandardMaterial({ map: pt2, color: 0xf8e0b0, emissive: 0xc08840, emissiveIntensity: 0.9, emissiveMap: pt2, side: THREE.DoubleSide, roughness: 1 })); shade.position.set(0.38, 1.17, -0.2); S.add(shade);
    const stemM = new THREE.MeshStandardMaterial({ color: 0x9a7a38, metalness: 0.8, roughness: 0.28 });
    const stem = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0], [0.06, 0], [0.065, 0.015], [0.03, 0.03], [0.012, 0.06], [0.02, 0.13], [0.01, 0.2], [0.014, 0.27], [0.0, 0.29]].map(([r, y]) => new THREE.Vector2(r, y)), 20), stemM); stem.position.set(0.38, 0.84, -0.2); stem.castShadow = true; S.add(stem);
    // the lead, coiled on the table where someone put it down, the clasp catching the light
    const coil = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 5.2, r = 0.035 + i / 60 * 0.045; coil.push(V3(-0.38 + Math.cos(a) * r, 0.848 + (i % 12 < 6 ? 0.004 : 0), -0.02 + Math.sin(a) * r * 0.8)); }
    coil.push(V3(-0.3, 0.846, 0.05), V3(-0.22, 0.846, 0.09));
    const lead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.006, 5), new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.6 })); S.add(lead);
    const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc8b070, metalness: 0.9, roughness: 0.25 })); clasp.position.set(-0.21, 0.85, 0.095); clasp.rotation.x = Math.PI / 2; S.add(clasp);
    const L = new THREE.PointLight(0xffc888, 2.4, 6, 2); L.position.set(0.38, 1.13, -0.18); L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.bias = -0.002; S.add(L);
    frame.castShadow = true; top.castShadow = true; top.receiveShadow = true; wall.receiveShadow = true;
    S.add(new THREE.AmbientLight(0x3a2c22, 1.4));
    c.frozen = true;
  }

  credits() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;color:#e8dcc4;font-family:Georgia,serif;text-align:center;opacity:0;transition:opacity 3s;z-index:10';
    el.innerHTML = `<div style="font-size:40px;letter-spacing:.06em;margin-bottom:28px">The Long Way Home</div>
      <div style="color:#a89c88;font-size:15px;line-height:1.9">
      Music by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0<br>
      (creativecommons.org/licenses/by/4.0): "Deep Noise", "Spider Eyes", "SCP-x4x (Mind Leech)", "Gone Beyond". Excerpted and looped.<br>
      Additional sounds: Joseph SARDIN - BigSoundBank.com (CC0)<br>
      Biscuit, the town, and everything else: GameNet</div>
      <div style="margin-top:40px;color:#8a8070;font-style:italic">for everyone who was ever walked home in the dark</div>
      <div style="margin-top:46px;font-size:13px;letter-spacing:.2em;color:#a89c88;cursor:pointer" onclick="location.reload()">WALK HOME AGAIN</div>`;
    document.exitPointerLock?.();
    document.body.appendChild(el); requestAnimationFrame(() => (el.style.opacity = 1));
  }
}
