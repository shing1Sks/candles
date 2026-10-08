// CORRIDOR ANOMALIES (research/05 R16-R18): the school changes in ways you notice, a little more as
// the night goes on. Each chunk gets at most one anomaly, rolled the first time you come near it, in
// tiers: 0 nothing, 1 odd, 2 wrong, 3 impossible. Act I is mostly tier 0-1, Act IV mostly 2-3. The
// same anomaly never comes twice in a row, and none comes back until five others have been seen.
// Some are warnings: chalk arrows to a door mean the page is behind it, and so is something else.
export const ANOMALIES = {
  shoesRow: { tier: 1 },     // pairs of small shoes along a wall, all facing it
  chairWall: { tier: 1 },    // a child's chair at the end of an arm, facing the wall
  doll: { tier: 1 },         // a rag doll sitting in the junction
  arrowDoor: { tier: 1, warns: true }, // red crayon arrows on the floor to one door: THIS ONE
  missingRow: { tier: 2 },   // HAVE YOU SEEN, the same child, over and over
  linesWall: { tier: 2 },    // I must not leave before the bell, written on the plaster
  coatFeet: { tier: 2 },     // a row of coats on pegs, and under one of them, shoes
  ceilingHands: { tier: 2 }, // small handprints all over the ceiling
  tallyWall: { tier: 2 },    // tally marks, a wall of them
  trailUpWall: { tier: 3 },  // small footprints down the corridor, up the wall, across the ceiling
  sameDrawing: { tier: 3 },  // one wall papered with the same drawing of him
  sootArm: { tier: 3 },      // the walls black with soot, burnt paper on the floor: the fire
};

// chance of each tier by act (I..IV): [none, 1, 2, 3]
const TIERS = [[0.6, 0.35, 0.05, 0], [0.4, 0.35, 0.2, 0.05], [0.3, 0.25, 0.3, 0.15], [0.2, 0.2, 0.35, 0.25]];

export function rollAnomaly(S, c, rng, act) {
  const A = S.layout.anomalies || (S.layout.anomalies = {}), id = `${c.key}@${c.epoch}`;
  if (id in A) return A[id];
  const recent = S.layout.recentAnomalies || (S.layout.recentAnomalies = []);
  let r = rng.next(), tier = 0;
  const p = TIERS[Math.min(4, act) - 1];
  while (tier < 3 && r >= p[tier]) { r -= p[tier]; tier++; }
  // the canonical opening corridors are ordinary: wrongness needs a baseline
  if (tier === 0 || S.director?.canonical?.[c.key] || c.stair && tier === 3) { A[id] = null; return null; }
  let pool = Object.keys(ANOMALIES).filter((k) => ANOMALIES[k].tier === tier && !recent.includes(k));
  if (!pool.length) pool = Object.keys(ANOMALIES).filter((k) => !recent.includes(k));
  const kind = pool[Math.floor(rng.next() * pool.length)];
  const a = { kind, tier, seed: Math.floor(rng.next() * 1e6) };
  if (kind === 'arrowDoor') {
    const rooms = c.rooms.filter((x) => x.kind === 'classroom');
    if (!rooms.length) { A[id] = null; return null; }
    a.room = rooms[Math.floor(rng.next() * rooms.length)].id;
  }
  A[id] = a;
  recent.push(kind); if (recent.length > 5) recent.shift();
  return a;
}

// roll the chunk you're in and its neighbours (so a corridor is decided before you can see down it)
export function rollAnomaliesNear(S, layout, rng, act, emit) {
  const C = 24, P = S.player, pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
  // walking into a chunk that has one is what counts (for tension), not the roll
  const here = layout.chunk(P.floor, pi, pj), hereId = `${here.key}@${here.epoch}`;
  if (S.layout.inChunk !== hereId) {
    S.layout.inChunk = hereId;
    const a = S.layout.anomalies?.[hereId];
    if (a) emit('anomalyNear', { key: here.key, kind: a.kind, tier: a.tier });
  }
  for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const c = layout.chunk(P.floor, pi + di, pj + dj), id = `${c.key}@${c.epoch}`;
    if (S.layout.anomalies && id in S.layout.anomalies) continue;
    const a = rollAnomaly(S, c, rng, act);
    if (a) emit('anomaly', { key: c.key, kind: a.kind, tier: a.tier });
  }
}
