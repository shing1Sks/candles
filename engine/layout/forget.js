// THE SCHOOL FORGETS ITSELF. A chunk you have left behind may be re-rolled with a new epoch: same
// ports (so the map still connects), different rooms. Never the chunk you're in or its neighbours,
// never a chunk marked with chalk. Odds grow with the clock. Any state belonging to the old epoch
// (rooms, doors, interactables, an entrance) goes with it.

export function forgetChunk(S, key) {
  const old = S.layout.epochs[key] ?? 0;
  S.layout.epochs[key] = old + 1;
  const prefix = `${key}@${old}:`;
  for (const bag of [S.rooms, S.doors, S.interact]) for (const id of Object.keys(bag)) if (id.startsWith(prefix)) delete bag[id];
  delete S.layout.entrances[key];
  delete S.layout.deadEndsSeen[key];
}

// one check; called every rules.layout.forget.every seconds. Returns the keys it forgot.
export function forgetTick(S, layout, rng, rules) {
  const F = rules.layout.forget, C = rules.layout.chunk;
  const hours = Math.max(0, (S.clock.minutes - 60) / 60);
  const p = (F.base + F.perClock * hours) * F.every / 60;
  const pi = Math.floor(S.player.x / C), pj = Math.floor(S.player.z / C);
  const out = [];
  for (const key of layout.generated) {
    if (S.layout.pinned[key]) continue;
    const [, i, j] = key.split(':').map(Number);
    if (Math.max(Math.abs(i - pi), Math.abs(j - pj)) < 2) continue;
    if (!rng.chance(p)) continue;
    forgetChunk(S, key);
    out.push(key);
  }
  return out;
}
