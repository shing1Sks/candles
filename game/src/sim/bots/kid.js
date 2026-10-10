// Kid bots: they stand in for a player while we make data. They know what a player knows: where the monster is
// (its eye shows over the walls, seen a moment late), the candles, doors, toys, the giant's light and hand.
// Styles weight the same goals differently:
//   sneaker    creeps whenever the monster is anywhere near, loves crawl spaces
//   sprinter   always runs, flees late
//   hider      ducks into wardrobes when it comes close
//   trickster  throws toys to lure it away, shuts doors behind itself
//   greedy     keeps blowing a candle with the monster closing in
//   chaos      a random stick and random buttons (so the data shows what does NOT happen)
//   probe      the old balance probe;  idle  stands still (tests)
// Skill (0..1) sets how late it sees the monster, how often it re-plans, how much its stick wobbles and how often
// it presses a wrong button. After a long time without a candle it gets bolder, as players do.
import { KID } from '../rules.js';
import { distField, findPath, clearLine } from '../grid.js';

const tf = Math.floor;
export const KID_STYLES = ['sneaker', 'sprinter', 'hider', 'trickster', 'greedy'];

export function observeKid(G) {
  const M = G.monster;
  return {
    t: G.t, kid: G.kid,
    monster: { x: M.x, z: M.z, awake: M.awake },
    candles: G.candles, doors: G.doors, items: G.items, wardrobes: G.wardrobes,
    beam: G.beam, reach: G.reach,
  };
}

const IDLE = Object.freeze({ mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false });

// flee when it is this close (m), creep when it is within this, crawl spaces' worth when fleeing, how long it will
// sit in cover with the monster right there before slipping out (s)
const STYLE = {
  sneaker: { flee: 7, creep: 14, crawl: 3, hide: 0, lure: 0, shut: 0.5, greed: 0, sit: 10 },
  sprinter: { flee: 5, creep: 0, crawl: 1, hide: 0, lure: 0, shut: 0, greed: 0.2, sit: 4 },
  hider: { flee: 8, creep: 9, crawl: 2, hide: 1, lure: 0, shut: 0.4, greed: 0, sit: 8 },
  trickster: { flee: 7, creep: 9, crawl: 2, hide: 0.2, lure: 1, shut: 1, greed: 0.1, sit: 6 },
  greedy: { flee: 4.5, creep: 6, crawl: 2, hide: 0, lure: 0, shut: 0, greed: 1, sit: 5 },
  probe: { flee: 7, creep: 10, crawl: 2, hide: 0, lure: 0, shut: 0, greed: 0, sit: 8 },
};

function gauss(rand) { return Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand()); }

export function createKidBot(G, { style = 'probe', skill = 0.6 } = {}, rand = Math.random) {
  if (style === 'idle') return () => IDLE;
  if (style === 'chaos') return chaos(rand);
  if (!STYLE[style]) throw new Error(`unknown kid style ${style}`);
  return player(G, STYLE[style], style === 'probe' ? 1 : skill, rand, style === 'probe');
}

// random sticks held for a while, random buttons
// A player on a keyboard, around any kid bot: 8 directions at full tilt, a key kept down a moment after the bot lets
// go, and now and then one direction held for a while whatever is in the way (players walk into walls; the bots
// rarely do, so the model had little to learn walls from).
export function keyboard(bot, rand) {
  let key = null, holdT = 0, pushT = 0, push = null;
  return (obs, dt) => {
    const inp = bot(obs, dt);
    holdT -= dt; pushT -= dt;
    if (pushT <= 0 && rand() < dt / 12) { push = Math.floor(rand() * 8); pushT = 0.4 + rand() * 1.6; } // ~10% of the time
    let dir = null;
    if (pushT > 0) dir = push;
    else if (Math.hypot(inp.mx, inp.mz) > 0.3) dir = ((Math.round(Math.atan2(inp.mz, inp.mx) / (Math.PI / 4)) % 8) + 8) % 8;
    if (dir !== null) { key = dir; holdT = 0.05 + rand() * 0.2; } else if (holdT <= 0) key = null;
    const a = key * Math.PI / 4;
    // keys have no half-press: where the bot eases off to go quietly, the player holds shift
    const creep = inp.creep || (pushT <= 0 && dir !== null && Math.hypot(inp.mx, inp.mz) < 0.7);
    return { ...inp, creep, mx: key === null ? 0 : Math.round(Math.cos(a) * 1e6) / 1e6, mz: key === null ? 0 : Math.round(Math.sin(a) * 1e6) / 1e6 };
  };
}

function chaos(rand) {
  let inp = { ...IDLE }, left = 0;
  return (obs, dt) => {
    left -= dt;
    if (left <= 0) {
      const a = rand() * Math.PI * 2, m = rand() < 0.2 ? 0 : rand() * 0.6 + 0.4;
      inp = { mx: Math.cos(a) * m, mz: Math.sin(a) * m, creep: rand() < 0.3, blow: rand() < 0.15, use: false, throw: false };
      left = 0.3 + rand() * 1.2;
    }
    return { ...inp, use: rand() < 0.05, throw: rand() < 0.05, blow: inp.blow || rand() < 0.05 };
  };
}

function player(G, S, skill, rand, exact) {
  const L = G.L;
  const delay = exact ? 0 : 0.1 + (1 - skill) * 0.3, replan = exact ? 0.25 : 0.25 + (1 - skill) * 0.3;
  const wobble = exact ? 0 : 0.15 * (1 - skill), slip = exact ? 0 : 0.01 + 0.02 * (1 - skill);
  const seen = []; // where it saw the monster, a moment ago
  const st = { plan: [], planT: 0, flee: false, cand: null, useT: 0, hideW: null, hidT: 0, throwPhase: 0, throwDir: null, lastOut: 0, outs: -1, door: null, sat: 0, sitFor: S.sit, outT: 0, cover: -1 };
  return (obs, dt) => {
    const k = obs.kid, now = obs.t;
    st.planT -= dt; st.useT -= dt;
    seen.push({ t: now, x: obs.monster.x, z: obs.monster.z });
    while (seen.length > 1 && seen[1].t <= now - delay) seen.shift();
    const M = { ...seen[0], awake: obs.monster.awake };
    const d = Math.hypot(M.x - k.x, M.z - k.z);
    const outs = obs.candles.filter((c) => !c.lit).length;
    if (outs !== st.outs) { st.outs = outs; st.lastOut = now; }
    const bold = now - st.lastOut > 40 ? 0.7 : 1; // a long time without a candle: take more risks
    const danger = M.awake && d < S.flee * bold;
    const inp = { ...IDLE };

    // in a wardrobe: stay while it is near, then step out
    if (k.hidden >= 0) {
      st.hidT += dt;
      if (st.hidT > 3 && d > 10) { inp.use = true; st.hideW = null; }
      return inp;
    }
    st.hidT = 0;

    // the hand's shadow over you, or the searchlight swelling near you: get under something, or get away
    const R = obs.reach, B = obs.beam;
    const threat = R.state === 'shadow' && Math.hypot(k.x - R.x, k.z - R.z) < 2.6 ? R : (B.state === 'warn' || B.state === 'on') && Math.hypot(k.x - B.x, k.z - B.z) < 3.2 ? B : null;
    if (threat && !k.crawl) {
      const cover = nearestCover(L, G, k, 3);
      const tgt = cover || { x: k.x + (k.x - threat.x), z: k.z + (k.z - threat.z) };
      return steerTo(inp, k, tgt, wobble, rand);
    }

    // hide: a wardrobe close by when it comes near
    if (S.hide && danger && !st.hideW) {
      const w = obs.wardrobes.find((q) => Math.hypot(q.fx - k.x, q.fz - k.z) < 5 && Math.hypot(q.fx - M.x, q.fz - M.z) > 3);
      if (w && rand() < S.hide) st.hideW = w;
    }
    if (st.hideW) {
      if (!danger && d > 9) st.hideW = null;
      else {
        if (Math.hypot(st.hideW.fx - k.x, st.hideW.fz - k.z) < 0.8) { inp.use = true; return inp; }
        return follow(inp, G, st, k, { x: st.hideW.fx, z: st.hideW.fz }, wobble, rand, true);
      }
    }

    // a lure: holding a toy and it is coming, throw it off to one side (turn that way, then throw)
    if (S.lure && k.held >= 0 && M.awake && d < 11 && d > 3) {
      if (st.throwPhase === 0 && rand() < S.lure * 0.5) {
        const ax = k.x - M.x, az = k.z - M.z, n = Math.hypot(ax, az) || 1, side = rand() < 0.5 ? 1 : -1;
        st.throwDir = { x: (-az / n) * side, z: (ax / n) * side }; st.throwPhase = 1;
      }
      if (st.throwPhase === 1) { st.throwPhase = 2; inp.mx = st.throwDir.x; inp.mz = st.throwDir.z; return inp; }
      if (st.throwPhase === 2) { st.throwPhase = 0; inp.throw = true; return inp; }
    }

    // shut the door behind you while fleeing through it
    if (S.shut && danger && st.useT <= 0) {
      for (const dr of obs.doors) {
        if (!dr.open || Math.hypot(dr.x - k.x, dr.z - k.z) > 1.3 || Math.hypot(dr.x - k.x, dr.z - k.z) < 0.6) continue;
        // the door is between it and you
        if ((dr.x - k.x) * (M.x - k.x) + (dr.z - k.z) * (M.z - k.z) > 0 && rand() < S.shut) { inp.use = true; st.useT = 1.5; return inp; }
      }
    }

    // sitting in cover with it right there: after a while, slip out of this crawl space (away from it)
    if (k.crawl && danger && k.speed < 0.3) st.sat += dt; else st.sat = Math.max(0, st.sat - dt * 0.5);
    if (st.outT > 0) st.outT -= dt;
    else if (st.sat > st.sitFor) {
      st.outT = 4; st.sat = 0; st.sitFor = S.sit * (0.7 + rand() * 0.6); st.planT = 0;
      st.cover = L.passageAt(tf(k.x), tf(k.z));
    }
    const breaking = st.outT > 0;

    // plan: run for the spot furthest from it (crawl spaces count extra), or go for a candle
    if (st.planT <= 0 || danger !== st.flee) {
      st.planT = replan; st.flee = danger;
      const kd = distField(L, tf(k.x), tf(k.z), G.kidBlocked);
      let goal = null;
      if (danger) {
        const md = distField(L, tf(M.x), tf(M.z), G.monBlocked);
        let best = -Infinity;
        for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
          const i = z * L.w + x, kk = kd[i];
          if (!(kk <= 8)) continue;
          if (breaking && L.passageAt(x, z) === st.cover) continue; // not this hole again, for now
          const s = (isFinite(md[i]) ? md[i] : breaking ? 0 : 40) - kk * 1.3 + (L.crawl(x, z) && !breaking ? S.crawl : 0);
          if (s > best) { best = s; goal = [x, z]; }
        }
      } else {
        // the nearest candle; a careful kid weighs how close the monster is to it
        let bs = Infinity;
        for (const c of obs.candles) {
          if (!c.lit) continue;
          const kk = kd[c.tz * L.w + c.tx], md = M.awake ? Math.hypot(c.x - M.x, c.z - M.z) : 30;
          const s = kk + (S.greed < 0.5 && M.awake ? Math.max(0, 10 - md) * 1.5 : 0);
          if (s < bs) { bs = s; goal = [c.tx, c.tz]; st.cand = c; }
        }
      }
      st.plan = goal ? findPath(L, tf(k.x), tf(k.z), goal[0], goal[1], G.kidBlocked) || [] : [];
    }
    // blow: at a lit candle and it is not too close (greedy keeps at it longer)
    const c = st.cand;
    if (c && c.lit && Math.hypot(c.x - k.x, c.z - k.z) < KID.blowReach * 0.9 && (!danger || (S.greed > 0.5 && c.progress > 0.4 && d > 3))) { inp.blow = true; return inp; }

    const p = st.plan;
    while (p.length > 1 && clearLine(L, k.x, k.z, p[1].x, p[1].z, KID.radius, G.kidBlocked)) p.shift();
    if (p.length && Math.hypot(p[0].x - k.x, p[0].z - k.z) < 0.2) p.shift();
    const tgt = p[0] || (c && !danger ? c : null);
    if (tgt && st.useT <= 0) for (const dr of obs.doors) {
      if (!dr.open && Math.hypot(dr.x - k.x, dr.z - k.z) < 1.2 && (dr.x - k.x) * (tgt.x - k.x) + (dr.z - k.z) * (tgt.z - k.z) > 0) { inp.use = true; st.useT = 1; break; }
    }
    if (tgt) steerTo(inp, k, tgt, wobble, rand);
    inp.creep = !danger && M.awake && d < S.creep;
    // a slip: a button pressed for no reason
    if (slip && rand() < slip) { const b = Math.floor(rand() * 3); if (b === 0) inp.use = true; else if (b === 1) inp.throw = true; else inp.blow = true; }
    return inp;
  };
}

function steerTo(inp, k, tgt, wobble, rand) {
  let dx = tgt.x - k.x, dz = tgt.z - k.z;
  const n = Math.hypot(dx, dz) || 1;
  dx /= n; dz /= n;
  if (wobble) { dx += gauss(rand) * wobble; dz += gauss(rand) * wobble; const m = Math.hypot(dx, dz) || 1; dx /= m; dz /= m; }
  inp.mx = dx; inp.mz = dz;
  return inp;
}
function follow(inp, G, st, k, tgt, wobble, rand, fresh) {
  if (fresh || st.planT <= 0) { st.plan = findPath(G.L, tf(k.x), tf(k.z), tf(tgt.x), tf(tgt.z), G.kidBlocked) || []; st.planT = 0.25; }
  const p = st.plan;
  while (p.length > 1 && clearLine(G.L, k.x, k.z, p[1].x, p[1].z, KID.radius, G.kidBlocked)) p.shift();
  return steerTo(inp, k, p[0] || tgt, wobble, rand);
}
// the nearest crawl space (vent, crack, under a table or bed) within r tiles, by walking distance
function nearestCover(L, G, k, r) {
  let best = null, bd = Infinity;
  for (let z = tf(k.z) - r; z <= tf(k.z) + r; z++) for (let x = tf(k.x) - r; x <= tf(k.x) + r; x++) {
    if (!L.crawl(x, z) || G.kidBlocked(x, z)) continue;
    const d = Math.hypot(x + 0.5 - k.x, z + 0.5 - k.z);
    if (d < bd && clearLine(L, k.x, k.z, x + 0.5, z + 0.5, KID.radius, G.kidBlocked)) { bd = d; best = { x: x + 0.5, z: z + 0.5 }; }
  }
  return best;
}
