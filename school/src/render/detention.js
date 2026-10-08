// DETENTION: a small room of its own. You sit at a desk facing the board; the Headmaster sleeps at
// his desk beside it, his head nodding with each snore. Your lines appear on the board as you write
// them. When the snoring stops, he lifts his head.
import * as THREE from 'three';
import { makePaperLit } from './paperlit.js';

function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export class DetentionView {
  constructor(T, cards) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    const DS = THREE.DoubleSide, L = (t, o = {}) => makePaperLit(t, { side: DS, ...o });
    const W = 6, D = 6, H = 3.2;
    const plane = (w, h, mat, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); this.scene.add(m); return m; };
    T.planks.tex.repeat?.set?.(1, 1);
    plane(W, D, L(T.planks.tex), 0, 0, 0, 0, -Math.PI / 2);
    plane(W, D, L(T.ceiling.tex), 0, H, 0, 0, Math.PI / 2);
    for (const [x, z, ry] of [[0, -D / 2, 0], [0, D / 2, Math.PI], [-W / 2, 0, Math.PI / 2], [W / 2, 0, -Math.PI / 2]]) plane(W, H, L(T.wall2.tex), x, H / 2, z, ry);
    // the board, written on as you go
    this.boardC = document.createElement('canvas'); this.boardC.width = 1024; this.boardC.height = 320;
    this.boardTex = canvasTex(this.boardC);
    plane(3.6, 1.12, L(this.boardTex), 0, 1.6, -D / 2 + 0.05);
    // the Headmaster asleep at his desk, to the right of the board
    const hm = cards.headmaster, hH = 2.55;
    this.hmGeo = new THREE.PlaneGeometry(hH * hm.width / hm.height, hH).translate(0, hH / 2 - hH * (1 - 1118 / 1160), 0);
    this.hm = new THREE.Mesh(this.hmGeo, makePaperLit(canvasTex(hm), { transparent: true, side: DS }));
    this.hm.position.set(1.7, -0.55, -1.6); this.scene.add(this.hm);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.7), L(T.planks.tex, { color: 0xb8b0a2 }));
    desk.position.set(1.7, 0.39, -1.1); this.scene.add(desk);
    const mine = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.66, 0.48), L(T.planks.tex, { color: 0xc4bcae }));
    mine.position.set(0, 0.33, 0.9); this.scene.add(mine);
    this.lights = [{ x: 0, y: 3.1, z: -1.2, I: 0.85 }, { x: 0, y: 3.1, z: 1.2, I: 0.4 }];
    this.shown = -1; this.t = 0;
  }

  drawBoard(lines, writeT, lineSecs, text = 'I will not leave.') {
    const key = lines * 100 + Math.floor((writeT / lineSecs) * 18) + text.length * 1e4;
    if (key === this.shown) return;
    this.shown = key;
    const c = this.boardC.getContext('2d');
    c.fillStyle = '#1d1c1a'; c.fillRect(0, 0, 1024, 320);
    c.strokeStyle = '#4a4440'; c.lineWidth = 16; c.strokeRect(0, 0, 1024, 320);
    c.fillStyle = 'rgba(236,233,224,0.9)'; c.font = '38px "Segoe Print", "Comic Sans MS", cursive';
    for (let i = 0; i < lines; i++) c.fillText(text, 60, 66 + i * 52);
    if (lines < 5) c.fillText(text.slice(0, Math.floor((writeT / lineSecs) * text.length)), 60, 66 + lines * 52);
    this.boardTex.needsUpdate = true;
  }

  // camera: sat at your desk; you can look around a little
  update(S, camera, dt, rules) {
    this.t += dt;
    const T = S.detention;
    this.drawBoard(T.lines || 0, T.writeT || 0, rules.detention.lineSecs, T.text);
    // snoring: his head nods; quiet: he straightens and looks at you
    this.hm.rotation.x = T.snore ? 0.25 + Math.sin(this.t * 1.6) * 0.06 : 0;
    this.hm.position.y = T.snore ? -0.55 : -0.45;
    this.hm.rotation.y = Math.atan2(camera.position.x - 1.7, camera.position.z + 1.6);
    camera.position.set(0, 1.2, 1.5);
    camera.rotation.set(Math.max(-0.5, Math.min(0.3, S.player.pitch)), Math.max(-0.9, Math.min(0.9, S.player.yaw - (this.yaw0 ?? S.player.yaw))), 0);
    return this.lights;
  }
}
