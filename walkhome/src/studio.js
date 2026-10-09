// A STUDIO for looking closely at one thing (?studio=puppy|tall): a plain dark floor, a key light,
// a rim light, a turntable of camera angles. For art passes, not for the game.
import * as THREE from 'three';
import { Puppy } from './render/puppy.js';
import { TallManView } from './render/tallman.js';
import { U } from './render/materials.js';
import { Post } from './render/post.js';
import { bakeEnv } from './render/sky.js';

export function studio(kind) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; document.body.prepend(renderer.domElement);
  U.env = bakeEnv(renderer);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x14121a);
  const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 50); scene.add(cam);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshStandardMaterial({ color: 0x3a3640, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  scene.add(new THREE.HemisphereLight(0x8a9ac8, 0x1a1418, 0.5));
  const key = new THREE.SpotLight(0xffc890, 40, 12, 0.6, 0.6, 2); key.position.set(1.5, 3, 1.5); key.castShadow = true; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9ab0ff, 0.8); rim.position.set(-2, 2, -3); scene.add(rim);
  const post = new Post(renderer); post.scale = 1; post.setSize(innerWidth, innerHeight);
  let subject, P;
  if (kind === 'tall') { subject = new TallManView(scene); P = { active: true, x: 0, y: 0, z: 0, yaw: 0, speed: 0, phase: 0.3, seen: false, mode: 'stalk' }; key.target.position.set(0, 2, 0); }
  else { subject = new Puppy(scene); P = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, phase: 0, headYaw: 0, headPitch: 0, ears: 0, wag: 0.6, tailUp: 0, crouch: 0, sit: 0, sniff: 0, pant: 0, carried: false, scared: false, tilt: 0 }; }
  const views = kind === 'tall' ? [[0, 2.0, 5.5, 1.7], [2.5, 1.2, 4.0, 2.0], [-1.6, 3.0, 2.2, 2.6], [0, 2.9, 1.0, 2.9]] : [[0, 0.35, 1.3, 0.25], [1.2, 0.35, 0.3, 0.22], [0.9, 0.55, 0.9, 0.25], [-0.6, 0.9, 0.5, 0.2], [0, 0.25, -1.2, 0.25], [0.5, 0.25, 0.8, 0.3]];
  window.__studio = { P, subject, setView(i) { const [x, y, z, ty] = views[i % views.length]; cam.position.set(x, y, z); cam.lookAt(0, ty, 0); }, shot: () => renderer.domElement.toDataURL('image/png'), views: views.length };
  __studio.setView(0);
  let last = performance.now();
  function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; U.uTime.value += dt; if (kind === 'tall') subject.update(P, dt, cam); else subject.update(P, dt, cam); post.U.uTime.value = U.uTime.value; post.render(scene, cam, dt); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  document.getElementById('title').style.display = 'none'; document.getElementById('hints').style.display = 'none';
}
