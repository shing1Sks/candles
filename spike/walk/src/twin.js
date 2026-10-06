// THE DATA TWIN RECORDER. With ?record in the URL, every 12 fps world step is captured as one
// snapshot of every thing's state, plus every event, so each behaviour becomes its own data stream.
// Press F9 to download the session as JSONL (one line per tick). Schema: research/01_data_twin.md.

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;
const KIND = { ambient: 0, dropped: 1, rise: 2, fly: 3, collect: 4 };

function pose(rig) {
  const n = rig.nodes, z = (k) => r3(n[k].g.rotation.z);
  return {
    upperArm: z('upperArm'), forearm: z('forearm'), hand: z('hand'), head: z('head'), melt: z('melt'),
    thighL: z('thighL'), shinL: z('shinL'), thighR: z('thighR'), shinR: z('shinR'),
    lean: r3(rig.body.rotation.z), flip: r3(rig.body.scale.x),
  };
}

// one tick of the whole world, as data
export function snapshot(g, events) {
  const { S, entity: e, field: f, petals, world } = g;
  const P = S.player, R = 32;
  const near = (x, z) => (x - P.x) ** 2 + (z - P.z) ** 2 < R * R;
  return {
    t: r3(S.t),
    input: { reaching: P.reaching, sprint: P.sprint, moving: Math.hypot(P.vx, P.vz) > 0.2 },
    player: { x: r2(P.x), z: r2(P.z), yaw: r3(P.yaw), pitch: r3(P.pitch), vx: r2(P.vx), vz: r2(P.vz) },
    hand: [...S.held],
    world: { mist: r3(S.mist), dread: r3(S.dread), wind: r3(S.wind), windAng: r3(S.windAng), biome: world.chunks.get(world.cell)?.biome },
    field: { phase: f.phase, x: r2(f.centre.x), z: r2(f.centre.y), age: r2(f.age), cool: r2(f.cool), given: f.given, reachChance: r3(f.reachChance), hazard: r3(f.hazard(S.held.length)) },
    entity: {
      state: e.state, face: e.face, visible: e.visible, x: r2(e.x), z: r2(e.z),
      exposure: e.exposure, level: e.level, presence: r3(e.presence), timer: r2(e.timer ?? 0),
      pose: pose(e.rig),
    },
    petals: petals.items.filter((p) => p.life > 0 && near(p.m.position.x, p.m.position.z))
      .map((p) => [KIND[p.kind], r2(p.m.position.x), r2(p.m.position.y), r2(p.m.position.z), p.colour]),
    bunnies: world.bunnies.filter((b) => near(b.root.position.x, b.root.position.z))
      .map((b) => [r2(b.root.position.x), r2(b.root.position.z), b.flee > 0 ? 1 : 0]),
    events,
  };
}

export function startRecorder(g) {
  const snaps = [];
  g.onStep(() => snaps.push(snapshot(g, [])));
  // events are routed after the steps of a frame: file each under the tick it happened in
  g.onEvent((ev) => {
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].t <= ev.t + 1e-6) { snaps[i].events.push(ev); return; }
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    const blob = new Blob([snaps.map((x) => JSON.stringify(x)).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gamenet_twin_${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
    a.click();
  });
  g.twin = snaps;
  return snaps;
}
