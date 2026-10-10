// How the monster feels, and why. Every step it asks "how am I doing?" (appraise: r > 0 going well, < 0 badly;
// sharp setbacks also count separately). That drives:
//   anger        sharp setbacks; cools fast          -> runs, smashes doors, lunges from further, yells
//   frustration  setbacks adding up; cools slowly    -> drops its plan for another, tries bolder options
//   confidence   things going its way                -> steadier, more predictable
//   fury         anger and frustration both high     -> a 4 s rampage, then 2.5 s spent (the kid's chance); then
//                at least 30 s before another, so it stays an event
// The same r can later be the reward for training a monster with RL.

// sharp setbacks (anger) and their cost; other things it feels, good or bad
const SHARP = { candleOut: 0.6, gapEscape: 0.4, doorInFace: 0.3, lungeMiss: 0.25 };
const SOFT = { spotted: 0.3, beamSpot: 0.3, lostSight: -0.3, ambushEmpty: -0.2, grabMiss: -0.2, checkEmpty: -0.15, leadEmpty: -0.1 };

export function appraise(m, obs, dt) {
  let r = 0, sharp = 0, why = '', top = 0;
  for (const f of [...obs.felt, ...(m.felt || [])]) {
    const s = SHARP[f.kind];
    if (s) { r -= s; sharp += s; if (s > top) { top = s; why = f.kind; } } else r += SOFT[f.kind] || 0;
  }
  m.felt = [];
  // closing in on a kid it can see
  if (obs.sees && obs.kid) {
    const d = Math.hypot(obs.kid.x - obs.self.x, obs.kid.z - obs.self.z);
    if (m.lastD != null) r += (m.lastD - d) * 0.15;
    m.lastD = d;
  } else m.lastD = null;
  if (obs.heard.length) r += 0.05; // a lead
  // nothing to go on for a long time
  const lead = obs.sees || obs.heard.length || obs.ping || (obs.alerts && obs.alerts.length);
  m.quietT = lead ? 0 : (m.quietT || 0) + dt;
  if (m.quietT > 10) r -= 0.02 * dt;
  return { r, sharp, why };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function updateEmotion(m, ap, dt, p, { canYell = true } = {}) {
  m.anger = clamp01((m.anger + ap.sharp * (0.5 + p.temper)) * 0.5 ** (dt / (4 + 6 * p.patience)));
  m.frustration = clamp01((m.frustration + Math.max(0, -ap.r) * 0.8 - Math.max(0, ap.r) * 0.5) * 0.5 ** (dt / (30 + 30 * p.patience)));
  m.confidence = clamp01((m.confidence + Math.max(0, ap.r)) * 0.5 ** (dt / 8));
  let furyStarted = false;
  m.furyRest = Math.max(0, (m.furyRest || 0) - dt);
  if (m.furyT > 0) { m.furyT -= dt; if (m.furyT <= 1e-9) { m.furyT = 0; m.spentT = 2.5; } }
  else if (m.spentT > 0) { m.spentT = Math.max(0, m.spentT - dt); if (m.spentT === 0) m.furyRest = 30; }
  else if (m.anger >= 0.85 && m.frustration >= 0.7 && m.furyRest === 0 && canYell) { m.furyT = 4; furyStarted = true; }
  return { furyStarted };
}

// how adventurous its choices are: bolder when frustrated, steadier when confident
export function temperature(m, p) {
  return Math.max(0.1, Math.min(3, p.temp * (1 + 1.5 * m.frustration - 0.5 * m.confidence)));
}
