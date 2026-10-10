// Kid bots: they stand in for a player while we make data. They know what a player knows: where the monster is
// (its eye shows over the walls), the candles, doors and toys, and what they can hear.
// Styles: 'probe' (the balance probe's bot: go for the nearest candle, flee when it comes close), 'idle' (stands
// still; for tests). More styles come with the data work.
import { KID } from '../rules.js';
import { distField, findPath, clearLine } from '../grid.js';

const tf = Math.floor;

export function observeKid(G) {
  const M = G.monster;
  return {
    t: G.t, kid: G.kid,
    monster: { x: M.x, z: M.z, awake: M.awake, mode: M.mode },
    candles: G.candles, doors: G.doors, items: G.items, wardrobes: G.wardrobes,
    beam: G.beam, reach: G.reach,
  };
}

const IDLE = Object.freeze({ mx: 0, mz: 0, creep: false, blow: false, use: false, throw: false });

export function createKidBot(G, { style = 'probe', skill = 0.6 } = {}, rand = Math.random) {
  if (style === 'idle') return () => IDLE;
  if (style === 'probe') return probe(G);
  throw new Error(`unknown kid style ${style}`);
}

// The balance probe's bot: the nearest lit candle; when the monster is within 7 m, run for the spot furthest from
// it (crawl spaces count extra); duck the giant's hand; open shut doors on the way.
function probe(G) {
  const L = G.L, st = { plan: [], planT: 0, flee: false, cand: null, useT: 0 };
  return (obs, dt) => {
    const k = obs.kid, M = obs.monster;
    st.planT -= dt; st.useT -= dt;
    const d = Math.hypot(M.x - k.x, M.z - k.z), danger = M.awake && d < 7;
    const R = obs.reach;
    if (R.state === 'shadow' && !k.crawl && Math.hypot(k.x - R.x, k.z - R.z) < 2.2) {
      const dx = k.x - R.x, dz = k.z - R.z, n = Math.hypot(dx, dz) || 1;
      return { ...IDLE, mx: dx / n, mz: dz / n };
    }
    if (st.planT <= 0 || danger !== st.flee) {
      st.planT = 0.25; st.flee = danger;
      const kd = distField(L, tf(k.x), tf(k.z), G.kidBlocked);
      let goal = null;
      if (danger) {
        const md = distField(L, tf(M.x), tf(M.z), G.monBlocked);
        let best = -Infinity;
        for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
          const i = z * L.w + x, kk = kd[i];
          if (!(kk <= 8)) continue;
          const s = (isFinite(md[i]) ? md[i] : 40) - kk * 1.3 + (L.crawl(x, z) ? 2 : 0);
          if (s > best) { best = s; goal = [x, z]; }
        }
      } else {
        let bd = Infinity;
        for (const c of obs.candles) if (c.lit && kd[c.tz * L.w + c.tx] < bd) { bd = kd[c.tz * L.w + c.tx]; goal = [c.tx, c.tz]; st.cand = c; }
      }
      st.plan = goal ? findPath(L, tf(k.x), tf(k.z), goal[0], goal[1], G.kidBlocked) || [] : [];
    }
    const inp = { ...IDLE };
    if (!danger && st.cand && st.cand.lit && Math.hypot(st.cand.x - k.x, st.cand.z - k.z) < KID.blowReach * 0.9) { inp.blow = true; return inp; }
    const p = st.plan;
    while (p.length > 1 && clearLine(L, k.x, k.z, p[1].x, p[1].z, KID.radius, G.kidBlocked)) p.shift();
    if (p.length && Math.hypot(p[0].x - k.x, p[0].z - k.z) < 0.2) p.shift();
    const tgt = p[0] || (st.cand && !danger ? st.cand : null);
    // a shut door in the way: open it
    if (tgt && st.useT <= 0) for (const dr of obs.doors) {
      if (!dr.open && Math.hypot(dr.x - k.x, dr.z - k.z) < 1.2 && (dr.x - k.x) * (tgt.x - k.x) + (dr.z - k.z) * (tgt.z - k.z) > 0) { inp.use = true; st.useT = 1; break; }
    }
    if (tgt) { const dx = tgt.x - k.x, dz = tgt.z - k.z, n = Math.hypot(dx, dz) || 1; inp.mx = dx / n; inp.mz = dz / n; }
    inp.creep = !danger && d < 10;
    return inp;
  };
}
