// BISCUIT'S MIND. He is a puppy on a walk: he leads a little, stops to sniff lamp posts and bins,
// pees on things, chases a leaf, looks back to check you're still there. He is also the only
// instrument you have: he notices things before you do.
//   ears up, staring    something is there
//   a low growl         it's close
//   crouched, tail in, pulling back behind your legs, whimpering    it's very close
//   barking             he's lost his nerve, and a bark carries; strangers and worse can hear it
// Stroking him (F) or carrying him (E) calms him. The lead is 2.4 m: when he wants to go further
// he pulls you; tug it (right mouse) and he comes.
import { ROAD, toRoad, at, groundAt } from './road.js';

export const DOG = { lead: 2.4, trot: 1.6, run: 3.4, accel: 6, stride: 0.36, sniffMin: 2.5, sniffMax: 5.5, poiCooldown: 40 };

export function makeDog(player) {
  return {
    x: player.x + 0.6, z: player.z - 1.2, y: player.y, yaw: 0, vx: 0, vz: 0, speed: 0, phase: 0,
    state: 'follow', st: 0, carried: false, poi: null, sniffed: new Map(),
    headYaw: 0, headPitch: 0, ears: 0, wag: 0.5, tailUp: 0, crouch: 0, sit: 0, sniff: 0, pant: 0, scared: false, tilt: 0,
    fear: 0, calm: 0.5, tension: 0, lookBackAt: 6, barkCd: 0, growlCd: 0, whimperCd: 0, pullX: 0, pullZ: 0, lured: null,
  };
}

const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// world: { pois: [{x,z,kind,id}], threats: [{x,z,d,seen,kind}], hand: {x,z} } ; emit(name, data)
export function stepDog(D, P, input, dt, world, emit, rng) {
  D.st += dt; D.barkCd -= dt; D.growlCd -= dt; D.whimperCd -= dt;
  // ---- lost: he's run off and is cowering somewhere, whimpering. Get to him and he comes back.
  if (D.lost) {
    const L = D.lost; D.x = L.x; D.z = L.z; D.y = groundAt(L.x, L.z); D.speed = 0; D.vx = D.vz = 0;
    D.state = 'hide'; D.crouch = 1; D.scared = true; D.ears = -1; D.wag = 0; D.sit = 0; D.sniff = 0; D.tailUp = 0;
    D.headYaw = ease(D.headYaw, Math.sin(D.st * 0.7) * 0.6, 2, dt); D.headPitch = -0.1; P.pull = null; D.tension = 0; D.carried = false; P.carrying = false;
    // call him (R) and he answers: a yip, from wherever he's hiding (but you've shouted, at night)
    if (input.call) { D.whimperCd = Math.min(D.whimperCd, 0.5); D.answer = 0.6; }
    if (D.answer > 0 && (D.answer -= dt) <= 0) emit('bark', { x: D.x, z: D.z, loud: 0.6, lost: true });
    if (D.whimperCd < 0) { emit('whimper', { lost: true }); D.whimperCd = 2.0 + rng.range(0, 1.6); }
    // walk on past him and he bolts again, further up the road (he's following you, in his way);
    // the third time, he comes running to you on his own: the night can't go on without him
    if (P.s > L.s + 12) {
      L.runs = (L.runs || 0) + 1;
      if (L.runs >= 3) { D.lost = null; D.state = 'come'; D.st = 0; D.fear = 0.5; emit('found', { himself: true }); return D; }
      const s = P.s + 22 + rng.range(0, 10), side = -Math.sign(D.l || 1) || 1, q = at(s, side * 4.45);
      Object.assign(L, { x: q.x, z: q.z, s }); D.l = side * 4.45; emit('whimper', { lost: true });
    }
    if (Math.hypot(P.x - D.x, P.z - D.z) < 1.9) { D.lost = null; D.state = 'come'; D.st = 0; D.fear = 0.35; D.calm = 0.6; emit('found', {}); }
    return D;
  }
  // ---- pick up / put down
  if (input.carry) {
    const d = Math.hypot(D.x - P.x, D.z - P.z);
    if (D.carried) { D.carried = false; P.carrying = false; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); D.x = P.x + fx * 0.6; D.z = P.z + fz * 0.6; D.vx = D.vz = 0; D.state = 'follow'; emit('putDown', {}); }
    else if (d < 1.4) { D.carried = true; P.carrying = true; D.state = 'carried'; emit('pickUp', {}); }
  }
  // ---- fear: the nearest threat, how close, whether he can see it
  let th = null;
  for (const t of world.threats) if (!th || t.d < th.d) th = t;
  const tDist = th ? th.d : 99;
  const danger = th ? Math.max(0, Math.min(1, (26 - tDist) / 20)) * (th.seen ? 1 : 0.55) : 0;
  const petting = input.pet && (D.carried || Math.hypot(D.x - P.x, D.z - P.z) < 1.15);
  // you kneel and hold out your hand: he comes to it
  if (input.pet && !D.carried && !petting && D.state !== 'hide' && D.state !== 'come') { D.state = 'come'; D.st = 0; }
  D.calm = Math.max(0, Math.min(1, D.calm + (petting ? 0.6 : D.carried ? 0.15 : -0.02) * dt));
  D.fear = Math.max(0, Math.min(1, D.fear + (danger * 0.9 - 0.18 - D.calm * 0.3) * dt));
  D.petting = petting;
  if (petting && D.st > 0.3 && rng.chance(dt * 0.5)) emit('happyHuff', {});
  // ---- the voice: growl, whimper, bark (the bark is noise others can hear). But when it's right
  // there, within a few steps, he goes completely silent: no growl, no panting, just shaking
  D.hush = !!(th && th.kind === 'tall' && tDist < 5.5);
  if (!D.hush) {
    if (danger > 0.25 && D.growlCd < 0 && D.fear > 0.2) { emit('growl', { level: danger }); D.growlCd = 3 + rng.range(0, 2); }
    if (D.fear > 0.6 && D.whimperCd < 0) { emit('whimper', {}); D.whimperCd = 2.5 + rng.range(0, 2); }
    if (D.fear > 0.75 && danger > 0.5 && D.barkCd < 0 && rng.chance(dt * (1.4 - D.calm * 1.2))) { emit('bark', { x: D.x, z: D.z, loud: 1 }); D.barkCd = 1.2 + rng.range(0, 1.5); }
  }
  // stroked for a while, he licks your mitten
  D.lickT = Math.max(0, (D.lickT || 0) - dt);
  if (petting && D.st > 1.5 && D.lickT <= 0 && rng.chance(dt * 0.45)) { D.lickT = 0.7; emit('lick', {}); }

  // ---- carried: in your arms. Looks around; trembles when scared
  if (D.carried) {
    D.state = 'carried'; D.speed = 0;
    D.x = P.x; D.z = P.z; D.y = P.y;
    D.headYaw = th && danger > 0.1 ? 0 : Math.sin(D.st * 0.5) * 0.4; D.headPitch = 0.2;
    D.ears = D.fear > 0.5 ? -1 : 0.2; D.wag = petting ? 1 : 0.3 * (1 - D.fear); D.scared = D.fear > 0.55; D.crouch = 0; D.sit = 0; D.sniff = 0; D.pant = 0;
    D.tension = 0; P.pull = null;
    return D;
  }

  // ---- where does he want to be?
  // he walks with you, not with your eyes: his idea of "ahead" is the way you're going (looking
  // back over your shoulder doesn't send him round behind you). Standing still, it's the last way
  const moving = P.speed > 0.4;
  if (D.hd === undefined) D.hd = P.yaw;
  if (P.speed > 0.35) { const want = Math.atan2(-P.vx, -P.vz); D.hd = turnTo(D.hd, want, dt * 3); }
  const hand = world.hand, fx = -Math.sin(D.hd), fz = -Math.cos(D.hd), rx = Math.cos(D.hd), rz = -Math.sin(D.hd);
  const vfx = -Math.sin(P.yaw), vfz = -Math.cos(P.yaw), vrx = Math.cos(P.yaw), vrz = -Math.sin(P.yaw);
  D.still = moving ? 0 : (D.still || 0) + dt;
  let tx, tz, want = DOG.trot, look = null;
  // states
  if (input.tug) { D.state = 'come'; D.st = 0; emit('tug', {}); D.lured = null; }
  if (input.call) { D.state = 'come'; D.st = 0; emit('call', {}); }
  if (D.lured && D.state !== 'come' && D.state !== 'hide') D.state = 'lured';
  else if (!D.lured && D.state === 'lured') { D.state = 'follow'; D.st = 0; }
  if (D.fear > 0.55 && D.state !== 'come') { if (D.state !== 'hide') { D.state = 'hide'; D.st = 0; } }
  else if (D.state === 'hide' && D.fear < 0.4) { D.state = 'follow'; D.st = 0; }
  else if (danger > 0.15 && D.state !== 'come' && D.state !== 'alert' && D.state !== 'hide') { D.state = 'alert'; D.st = 0; emit('alert', { x: th.x, z: th.z }); }
  else if (D.state === 'alert' && danger < 0.08 && D.st > 2) { D.state = 'follow'; D.st = 0; }

  switch (D.state) {
    case 'follow': {
      // you're kneeling with your hand out: he stays right there at your hand
      if (input.pet) { tx = P.x + vfx * 0.68 + vrx * 0.05; tz = P.z + vfz * 0.68 + vrz * 0.05; want = DOG.trot * 0.6; look = { x: P.x, z: P.z }; break; }
      // a little ahead and to the right of you; idles beside you when you stop
      tx = P.x + fx * (moving ? 2.15 : 1.6) + rx * 0.5; tz = P.z + fz * (moving ? 2.15 : 1.6) + rz * 0.5;
      // something to sniff nearby?
      if (D.st > 1.5) for (const p of D.poiExtra ? [...world.pois, D.poiExtra] : world.pois) {
        const last = D.sniffed.get(p.id) ?? -999;
        if (world.time - last < DOG.poiCooldown) continue;
        const d = Math.hypot(p.x - D.x, p.z - D.z);
        if (d < 2.2 && Math.hypot(p.x - hand.x, p.z - hand.z) < DOG.lead + 0.4 && rng.chance(dt * 1.5)) { D.state = 'sniff'; D.st = 0; D.poi = p; D.sniffed.set(p.id, world.time); D.sniffFor = rng.range(DOG.sniffMin, DOG.sniffMax) * (p.kind === 'lamp' ? 1.3 : 1); D.pee = (p.kind === 'lamp' || p.kind === 'bin' || p.kind === 'gate') && rng.chance(0.3); emit('sniffStart', { kind: p.kind }); break; }
      }
      // little moments of his own, when it's quiet: scratch an ear, a big yawn, a shake (when wet), a sneeze
      if (D.st > 3 && world.calm && rng.chance(dt * (moving ? 0.03 : 0.12))) {
        const m = world.wet > 0.3 && rng.chance(0.5) ? 'shake' : rng.pick(['scratch', 'yawn', 'sneeze', moving ? 'sneeze' : 'scratch']);
        D.state = m; D.st = 0; emit('moment', { kind: m }); break;
      }
      // every so often, look back at you (he checks you're there)
      if (world.time > D.lookBackAt) { D.lookBackUntil = world.time + 1.1; D.lookBackAt = world.time + rng.range(7, 16); }
      // you look at him, he looks back at you (and his tail goes)
      if (world.watched && world.calm && D.fear < 0.3 && world.time > (D.lookBackUntil || 0) && world.time > (D.eyeCd || 0)) { D.lookBackUntil = world.time + 1.6; D.eyeCd = world.time + 4; }
      if (world.time < (D.lookBackUntil || 0)) look = { x: P.x, z: P.z };
      break;
    }
    case 'sniff': {
      const p = D.poi; tx = p.x + (D.x - p.x) * 0.3; tz = p.z + (D.z - p.z) * 0.3; want = DOG.trot * 0.8; look = { x: p.x, z: p.z, down: true };
      if (D.st > D.sniffFor) { D.state = 'follow'; D.st = 0; if (D.pee) { D.state = 'pee'; D.st = 0; emit('pee', {}); } }
      break;
    }
    case 'scratch': tx = D.x; tz = D.z; if (D.st > 2.6) { D.state = 'follow'; D.st = 0; } break;
    case 'yawn': tx = D.x; tz = D.z; if (D.st > 2.0) { D.state = 'follow'; D.st = 0; } break;
    case 'shake': tx = D.x; tz = D.z; if (D.st > 1.3) { D.state = 'follow'; D.st = 0; } break;
    case 'sneeze': tx = D.x; tz = D.z; if (D.st > 0.9) { D.state = 'follow'; D.st = 0; } break;
    case 'intro': tx = D.x; tz = D.z; look = { x: P.x, z: P.z }; if (D.st > 4.5 || P.speed > 0.6) { D.state = 'follow'; D.st = 0; } break;
    case 'pee': tx = D.x; tz = D.z; if (D.st > 2.4) { D.state = 'follow'; D.st = 0; } break;
    case 'come': tx = P.x + vfx * (input.pet ? 0.68 : 0.7) + vrx * (input.pet ? 0.05 : 0.35); tz = P.z + vfz * (input.pet ? 0.68 : 0.7) + vrz * (input.pet ? 0.05 : 0.35); want = DOG.run * 0.8; look = { x: P.x, z: P.z }; if (D.st > 1.6 && Math.hypot(tx - D.x, tz - D.z) < 0.5) { D.state = 'follow'; D.st = 0; } break;
    case 'alert': tx = D.x; tz = D.z; look = th ? { x: th.x, z: th.z } : null; if (D.st > 0.6) { tx = P.x + rx * 0.45 + fx * 0.4; tz = P.z + rz * 0.45 + fz * 0.4; want = DOG.trot * 0.7; } break;
    case 'hide': {
      // behind your legs, away from it
      const ax = th ? th.x - P.x : fx, az = th ? th.z - P.z : fz, al = Math.hypot(ax, az) || 1;
      tx = P.x - ax / al * 0.55; tz = P.z - az / al * 0.55; want = DOG.run; look = th ? { x: th.x, z: th.z } : null;
      break;
    }
    case 'lured': { const L = D.lured; tx = L.x; tz = L.z; want = DOG.trot; look = { x: L.x, z: L.z }; break; }
    default: tx = D.x; tz = D.z;
  }

  // ---- the target is the other side of a garden wall: go round by the gate
  if (world.blocked && world.gateAt && D.l !== undefined) {
    const tr = toRoad(tx, tz), EDGE = 4.82, inD = Math.abs(D.l) > EDGE, inT = Math.abs(tr.l) > EDGE;
    if (inD !== inT) {
      const side = inD ? Math.sign(D.l) : Math.sign(tr.l), g = world.gateAt(inD ? D.s : tr.s, side);
      if (g !== null && world.blocked(D.s, side)) { const q = at(g, side * (inD ? EDGE + 0.4 : EDGE - 0.4)); tx = q.x; tz = q.z; }
    }
  }
  // ---- move toward the target
  let dx = tx - D.x, dz = tz - D.z; const dist = Math.hypot(dx, dz);
  const sp = dist > 0.15 ? Math.min(want * (dist > 2.5 ? 1.6 : 1), dist * 3.2) : 0;
  const k = 1 - Math.exp(-DOG.accel * dt);
  D.vx += ((dist > 0.01 ? dx / dist : 0) * sp - D.vx) * k; D.vz += ((dist > 0.01 ? dz / dist : 0) * sp - D.vz) * k;
  let nx = D.x + D.vx * dt, nz = D.z + D.vz * dt;
  // ---- the lead: never more than DOG.lead from your hand. If he's pulling, you feel it
  const lx = nx - hand.x, lz = nz - hand.z, ll = Math.hypot(lx, lz);
  D.tension = Math.max(0, Math.min(1, (ll - DOG.lead * 0.8) / (DOG.lead * 0.2)));
  P.pull = null;
  if (ll > DOG.lead) {
    const ux = lx / ll, uz = lz / ll;
    // he wants to go on: he pulls you (harder when lured or frightened), and is held back
    const strength = D.state === 'lured' ? 2.6 : D.state === 'sniff' || D.state === 'pee' ? 0.9 : 0.6;
    P.pull = { x: ux * strength, z: uz * strength };
    nx = hand.x + ux * DOG.lead; nz = hand.z + uz * DOG.lead;
    if (D.state === 'sniff' && D.st > 1.2 && rng.chance(dt * 0.8)) { D.state = 'follow'; D.st = 0; }
  }
  // stay out of the houses
  const rc = toRoad(nx, nz), lim = ROAD.front - 0.3;
  if (Math.abs(rc.l) > lim) { const c = at(rc.s, Math.sign(rc.l) * lim); nx = c.x; nz = c.z; rc.l = Math.sign(rc.l) * lim; }
  // garden walls and fences are solid for him too: in and out only by the gate
  if (world.blocked) {
    const was = D.l ?? 0, EDGE = 4.82, side = Math.sign(rc.l) || Math.sign(was);
    const crossing = (Math.abs(was) <= EDGE) !== (Math.abs(rc.l) <= EDGE);
    if (crossing && world.blocked(rc.s, side)) { const c = at(rc.s, side * (Math.abs(was) <= EDGE ? EDGE - 0.16 : EDGE + 0.16)); nx = c.x; nz = c.z; rc.l = side * (Math.abs(was) <= EDGE ? EDGE - 0.16 : EDGE + 0.16); }
  }
  // round things (lamp posts, bins, parked cars): he goes round them
  if (world.obstacles) for (const o of world.obstacles) {
    const ox = nx - o.x, oz = nz - o.z, r = o.r + 0.16, d2 = ox * ox + oz * oz;
    if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); nx = o.x + ox / d * r; nz = o.z + oz / d * r; }
  }
  D.l = toRoad(nx, nz).l; D.s = rc.s;
  const moved = Math.hypot(nx - D.x, nz - D.z);
  D.speed = moved / Math.max(dt, 1e-4); D.x = nx; D.z = nz; D.y = groundAt(nx, nz);
  D.phase += moved / (DOG.stride * (D.speed > 2.6 ? 1.9 : D.speed > 1.15 ? 1.2 : 1));
  // he turns along his path (a body has to swing round, not spin on the spot)
  if (D.speed > 0.15) D.yaw = turnTo(D.yaw, Math.atan2(-D.vx, -D.vz), dt * (D.speed > 1 ? 6 : 3.5));
  else if (look) D.yaw = turnTo(D.yaw, Math.atan2(-(look.x - D.x), -(look.z - D.z)), dt * 2);

  // ---- face and body
  let hy = 0, hp = 0;
  if (look) { hy = wrap(Math.atan2(-(look.x - D.x), -(look.z - D.z)) - D.yaw); hy = Math.max(-1.6, Math.min(1.6, hy)); hp = look.down ? -0.2 : 0.1; }
  D.headYaw = ease(D.headYaw, hy, 6, dt); D.headPitch = ease(D.headPitch, hp, 6, dt);
  D.sniff = ease(D.sniff, D.state === 'sniff' ? 1 : 0, 5, dt);
  D.sit = ease(D.sit, (D.state === 'follow' && !moving && D.speed < 0.1 && D.st > 3) || D.state === 'intro' || D.state === 'scratch' || D.state === 'yawn' ? 1 : D.state === 'pee' ? 0.6 : 0, 3, dt);
  // stood still a long while, nothing about: he lies down, chin on his paws (and gets straight up when you go)
  const settle = ((D.state === 'follow' || D.state === 'yawn') && D.still > 10) || (petting && D.state === 'follow' && D.st > 2.5); // (being stroked a while, he flops down too)
  D.lie = ease(D.lie || 0, settle && world.calm && D.fear < 0.2 ? 1 : 0, settle ? 1.6 : 6, dt);
  // lying down and you kneel and stroke him: he rolls over for his belly
  D.belly = ease(D.belly || 0, petting && D.lie > 0.6 ? 1 : 0, petting ? 1.5 : 5, dt);
  if (D.belly > 0.5 && rng.chance(dt * 0.3)) emit('happyHuff', {});
  D.crouch = ease(D.crouch, D.state === 'hide' ? 1 : D.state === 'alert' ? 0.35 : 0, 5, dt);
  D.ears = ease(D.ears, D.state === 'hide' ? -1 : D.state === 'alert' ? 1 : D.state === 'come' ? 0.3 : 0, 6, dt);
  D.wag = ease(D.wag, petting || D.state === 'come' || D.state === 'intro' || (world.time < (D.lookBackUntil || 0)) ? 1 : D.state === 'alert' || D.state === 'hide' ? 0 : 0.45, 3, dt);
  D.tailUp = ease(D.tailUp, D.state === 'alert' ? 1 : 0, 4, dt);
  D.scared = D.state === 'hide';
  D.pant = ease(D.pant, D.hush ? 0 : D.speed > 2 || P.running ? 1 : 0, D.hush ? 8 : 1.5, dt);
  D.tilt = ease(D.tilt, petting || D.state === 'intro' || (world.time < (D.lookBackUntil || 0)) ? 0.6 : 0, 4, dt);
  D.moment = D.state === 'scratch' || D.state === 'yawn' || D.state === 'shake' || D.state === 'sneeze' ? D.state : null; D.mt = D.st;
  return D;
}

function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function turnTo(cur, target, k) { return cur + wrap(target - cur) * Math.min(1, k); }
