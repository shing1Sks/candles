# Slice v1 "Home Time" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One playable night in a procedurally generated paper school (two floors, rolled classrooms with three lessons, the Headmaster, stars, detention, expulsion, the exit), driven by a headless, seeded rules engine that also records the data twin.

**Architecture:**
- `engine/` holds all state, rules and randomness. It's plain ES modules with no DOM, stepped at a fixed 60 Hz, deterministic per seed, and runs in Node.
- `school/` is a Vite + three.js app that only draws `S` and sends input. It reuses the concept-sheet painter for every texture and card.
- Modules share one shape (`init(S, ctx)`, `step(S, input, ctx)`), so each can later be swapped for a learned model.

**Tech Stack:** JavaScript (ES modules); Node 24 (`node --test`); Vite 8; three.js r0.186; Playwright (Python) for browser screenshots.

**Spec:** `research/03_slice_v1_spec.md` (design: `research/02_the_school.md`)

## Global Constraints

- **No commits without the user's explicit approval** (user's global rule). Every task ends at a *checkpoint*: tests green, a short note to the user. Commits are batched and proposed at milestones. Branch: `dev`.
- `engine/` must never use `Math.random`, `Date`, `performance`, `document` or `window`. A test enforces it.
- Every tunable number lives in `engine/rules.js`.
- The engine steps at a fixed `DT = 1/60` s; the twin records at 12 Hz; people's poses are quantised to 12 Hz in the renderer only.
- Floors: 0 (ground) and 1. Floor-to-floor height 3.6 m; corridor 3.4 m wide and 2.85 m tall; rooms 3.2 m tall.
- Chunks are 24 × 24 m. Coordinates: x east, z south (north = −z), y up. The camera looks along `(-sin yaw, -cos yaw)`.
- Performance: ≥ 30 fps at 1280×760 on the Intel Iris Xe laptop; ≤ 150 draw calls.
- Original art and sound only (procedural painter, synthesised audio).
- Scope is §3 of the spec; anything else goes to a v2 list, not into this build.

## Review Focus

1. **Spawning or waking inside a wall or closed door.** The player must always be placed in walkable space. Task 4 has a test that every spawn and detention exit point is walkable.
2. **A chunk forgotten while the player stands in it, or while the Headmaster's path runs through it.** Forgetting must skip the player's chunk and its neighbours. Task 3 tests that the player chunk and its neighbours are never re-rolled.
3. **Door states after forgetting.** A re-rolled chunk must drop stale door and room state, not keep a ghost lesson. Task 3 tests that room and door state under the old epoch is cleared.
4. **Input edge cases.** Pressing use with nothing in reach, drop with 0 stars, or show without a pass must do nothing and emit `useNothing` / `dropEmpty`, never throw. Task 4 tests use, drop and show with an empty inventory.
5. **A lesson's clock running out on the same tick as success.** Success wins if the stack lands on that tick. Task 7 tests the delivery-on-the-last-tick tie.

---

## File structure

```
engine/
  package.json            {"type":"module"}: lets Node run the ES modules
  rng.js                  hash32, makeRng, Streams (named seeded streams)
  rules.js                RULES: every number and every deck
  state.js                createState(seed, opts): the plain-JSON game state S
  events.js               makeEmitter(S): emit(type, data) → S.events (per tick)
  world.js                createWorld(opts), stepWorld(world, input): the one entry point; module order
  layout/
    ports.js              portOpen(seed, floor, edge): edge contracts
    chunk.js              genChunk(seed, floor, i, j, epoch): corridors, rooms, stairs, lights, lockers, doors
    space.js              Layout class: chunk cache, walkable(), segmentClear(), walls near a point, nav graph
    forget.js             forgetting: epochs, pins, which chunks may re-roll
  modules/
    player.js             movement, collision, stairs height and floor, noise, interact targeting
    doors.js              open, close, lock
    clock.js              the attention clock, the final bell
    stars.js              stars held, dropping, stamping; the exit hazard and the reach roll
    headmaster.js         the patrol state machine
    classroom.js          the room roll on first open; lesson dispatch; valuables; finished rooms
    lessons/handin.js     Hand In Your Work
    lessons/eyes.js       Eyes On Your Own Paper
    lessons/story.js      Story Time
    stairs.js             the 13th step
    detention.js          the detention scene; expelled; home time
  director.js             patrol scheduling, forgetting ticks, anti-monotony memory
  twin.js                 snapshot(S): one stream per module, 12 Hz
  sim.js                  CLI: headless night → JSONL
  agents/wander.js, agents/lesson.js
  test/*.test.js          node --test
school/
  package.json, vite.config.js, index.html
  src/main.js             boot, loop (fixed-step engine, smooth camera), input capture, event routing
  src/input.js            keys and mouse → input objects (look deltas accumulate per step)
  src/art/                paint.js, designs.js, school.js, rooms.js copied from spike/concepts (art only), cards.js (rigs)
  src/render/paperlit.js  the lit paper material (light array uniform, black fog)
  src/render/chunks.js    chunk meshes from layout geometry; tubes; doors
  src/render/rooms.js     classroom interiors (board, desks, windows, people)
  src/render/people.js    billboard rigs for students, teacher, Headmaster; 12 Hz pose quantisation
  src/render/hands.js     the forest hands (stars ring, papers, hall pass)
  src/fx.js, src/audio.js, src/ui.js
assets/audio/school/      generated sound set (Task 10)
```

---

### Task 1: Engine core (rng, rules, state, events, world loop)

**Files:**
- Create: `engine/package.json`, `engine/rng.js`, `engine/rules.js`, `engine/state.js`, `engine/events.js`, `engine/world.js`
- Test: `engine/test/core.test.js`

**Interfaces:**
- Produces:
  - `hash32(...parts) → uint32`
  - `makeRng(seed) → { next(), range(a, b), int(a, b), chance(p), pick(arr), weighted(obj) }` (`weighted({a: 0.6, b: 0.4}) → key`)
  - `new Streams(seed).get(name) → rng`
  - `RULES`
  - `createState(seed, { night = 1, pagesFound = [] }) → S`
  - `makeEmitter(S) → emit(type, data)`: pushes `{ tick, t, type, ...data }` onto `S.events`
  - `createWorld({ seed, night, pagesFound, modules }) → world { S, streams, layout, modules, emit }`
  - `stepWorld(world, input) → events[]`: clears `S.events`, runs each module's `step` in order, advances `S.tick` and `S.t`
  - Module shape: `{ id, init(S, ctx), step(S, input, ctx) }` where `ctx = { rng: streams.get(id), emit, layout, rules: RULES, world }`
  - `stateHash(S) → uint32` (hash of `JSON.stringify(S)`)
  - `const NO_INPUT`: an input with nothing pressed

- [ ] **Step 1: Write the failing test** (`engine/test/core.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hash32, makeRng, Streams } from '../rng.js';
import { createWorld, stepWorld, stateHash, NO_INPUT } from '../world.js';

test('hash32 is stable and order-sensitive', () => {
  assert.equal(hash32('a', 1, 2), hash32('a', 1, 2));
  assert.notEqual(hash32('a', 1, 2), hash32('a', 2, 1));
});

test('makeRng: same seed, same sequence; values in range', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) { const x = a.next(); assert.equal(x, b.next()); assert.ok(x >= 0 && x < 1); }
  const r = makeRng(1);
  for (let i = 0; i < 100; i++) { const n = r.int(3, 7); assert.ok(n >= 3 && n <= 7 && Number.isInteger(n)); }
  assert.equal(makeRng(5).weighted({ only: 1 }), 'only');
});

test('named streams are independent of each other', () => {
  const s1 = new Streams(9), s2 = new Streams(9);
  s1.get('a').next(); s1.get('a').next();
  assert.equal(s1.get('b').next(), s2.get('b').next());
});

test('same seed + same inputs = same state', () => {
  const run = () => { const w = createWorld({ seed: 3, modules: [] }); for (let i = 0; i < 120; i++) stepWorld(w, NO_INPUT); return stateHash(w.S); };
  assert.equal(run(), run());
});

test('the world advances fixed 1/60 s ticks', () => {
  const w = createWorld({ seed: 1, modules: [] });
  for (let i = 0; i < 60; i++) stepWorld(w, NO_INPUT);
  assert.equal(w.S.tick, 60);
  assert.ok(Math.abs(w.S.t - 1) < 1e-9);
});

test('engine never touches Math.random, Date or the DOM', () => {
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'test' && f !== 'node_modules') walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(root);
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of ['Math.random', 'Date.', 'new Date', 'performance.', 'document.', 'window.']) assert.ok(!src.includes(bad), `${f} uses ${bad}`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail.** Run: `node --test engine/` → FAIL (modules missing).

- [ ] **Step 3: Implement.**
  - `rng.js`:
    - `hash32` = FNV-1a over `parts.join('|')`, then a murmur finaliser.
    - `makeRng` = mulberry32 seeded by `hash32(seed)`.
    - `Streams` memoises `makeRng(hash32(seed, name))` per name.
  - `rules.js`: `export const RULES = { DT: 1/60, ... }` with sections `player`, `layout`, `clock`, `stars`, `exit`, `headmaster`, `classroom`, `lessons.handin`, `lessons.eyes`, `lessons.story`, `twists`, `stairs`, `detention`, `pages`. Fill each with the spec §6 numbers when its task lands. Task 1 needs only `DT`.
  - `state.js`: `createState` returns:

```js
{ seed, night, tick: 0, t: 0, phase: 'play',
  player: { x: 0, y: 0, z: 0, floor: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, crouch: false, run: false, noise: 0,
            carrying: 0, seated: null, hidden: null, inStair: null },
  held: { stars: 0, pass: 0, chalk: 0, pages: [...pagesFound] },
  clock: { minutes: 60, bell: false },
  layout: { epochs: {}, pinned: {}, entrances: {}, deadEndsSeen: {} },
  doors: {}, rooms: {}, lights: {}, headmaster: {}, director: {}, stairs: {}, detention: {},
  events: [] }
```

  - `events.js`: `makeEmitter(S)` returns `(type, data = {}) => S.events.push({ tick: S.tick, t: +S.t.toFixed(4), type, ...data })`.
  - `world.js`:
    - `createWorld` builds `S`, `streams`, `layout = null` (Task 2 fills it), `emit`, and runs each module's `init`.
    - `stepWorld` clears `S.events`, runs `step` for each module, then `S.tick++` and `S.t = S.tick * RULES.DT`. It returns a copy of `S.events`.
    - `NO_INPUT = { move: { x: 0, z: 0 }, look: { yaw: 0, pitch: 0 }, run: false, crouch: false, use: false, useHeld: false, drop: false, show: false }`.
    - `stateHash = (S) => hash32(JSON.stringify(S))`.

- [ ] **Step 4: Run.** `node --test engine/` → PASS (6 tests).
- [ ] **Step 5: Checkpoint** (no commit).

---

### Task 2: Layout: ports, chunk corridors, rooms, stairs, lights

**Files:**
- Create: `engine/layout/ports.js`, `engine/layout/chunk.js`
- Modify: `engine/rules.js` (add `layout`)
- Test: `engine/test/layout.test.js`

**Interfaces:**
- Produces:
  - `edgeKey(floor, i, j, side)`, where side ∈ `'N','S','E','W'`. It normalises to the shared edge, so the S edge of (i,j) equals the N edge of (i,j+1).
  - `portOpen(seed, floor, i, j, side) → bool`
  - `genChunk(seed, floor, i, j, epoch) → Chunk`

```js
Chunk = { key: `${floor}:${i}:${j}`, floor, i, j, epoch, x0, z0,            // world origin of the chunk
  ports: { N, S, E, W },                                                    // bools
  corridors: [ { x0, z0, x1, z1 } ],                                        // walkable rects (centre square + arms)
  rooms: [ { id, kind: 'classroom'|'cupboard'|'stair', kit: 'standard'|'small'|'infants'|null,
             x0, z0, x1, z1, door: { id, x, z, side, w: 1.2 }, quadrant } ],
  deadEnd: null | { side, x, z },                                           // the end wall point of a 1-port chunk
  lights: [ { id, x, z, y } ],                                              // ceiling tubes every 2.4 m along each arm
  lockers: [ { x0, z0, x1, z1, side } ],                                     // along one wall of each arm
  stair: null | { roomId, quadrant, steps: 12|13, dir: 'N'|'S'|'E'|'W' } }
```

**Rules:**
- **Rows and columns:** with `j` even, E/W ports are always open (main corridors). With `i % 3 == 0`, N/S ports are always open (cross corridors).
- **Hanging rows:** a chunk in an odd row (`j` odd, `i % 3 != 0`) always opens N, so every chunk connects.
- **Random ports:** all other ports open with `layout.portP = 0.45`, from `hash32(seed, 'port', floor, edgeKey)`.
- **Corridor shape:** the centre square is 3.4 m; each open port adds an arm from the square to the edge midpoint.
- **Quadrants:** each of the 4 quadrants (10.3 m square) next to at least one open arm gets a room from the chunk rng (`hash32(seed, 'chunk', floor, i, j, epoch)`):
  - classroom 70%: kit `standard` (8×9), `small` (6×7), or `infants` (8×9, floor 0 only)
  - cupboard 30%: 2×2 m
  - The door goes in the middle of the wall facing the chosen adjacent arm.
- **Stairs:** a stair chunk is one where `i % 3 == 0 && j % 2 == 0 && hash32(seed, 'stair', i, j) % 3 == 0`. Its stair quadrant is `hash32(seed, 'stairq', i, j) % 4` on both floors; it's a cross on every floor, so it's always adjacent to an arm. `steps = 13` when `hash32(seed, 'steps', i, j) % 8 == 0`, else 12.
- **Dead end:** a chunk with exactly one port. `deadEnd` = the closed end of the centre square opposite the port.

- [ ] **Step 1: Write the failing tests** (`engine/test/layout.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portOpen } from '../layout/ports.js';
import { genChunk } from '../layout/chunk.js';

const SEED = 11, R = 4; // a 9x9 region, i,j in [-4, 4]
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

test('neighbours agree on shared ports', () => {
  for (const f of [0, 1]) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    assert.equal(portOpen(SEED, f, i, j, 'E'), portOpen(SEED, f, i + 1, j, 'W'));
    assert.equal(portOpen(SEED, f, i, j, 'S'), portOpen(SEED, f, i, j + 1, 'N'));
  }
});

test('every chunk in the region is reachable from (0,0) through ports', () => {
  for (const f of [0, 1]) {
    const seen = new Set(['0,0']), q = [[0, 0]];
    while (q.length) {
      const [i, j] = q.shift();
      for (const [s, di, dj] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
        const ni = i + di, nj = j + dj, k = `${ni},${nj}`;
        if (Math.abs(ni) > R + 2 || Math.abs(nj) > R + 2 || seen.has(k) || !portOpen(SEED, f, i, j, s)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) assert.ok(seen.has(`${i},${j}`), `floor ${f} chunk ${i},${j} unreachable`);
  }
});

test('rooms never overlap corridors or each other, and stay inside the chunk', () => {
  for (const f of [0, 1]) for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
    const c = genChunk(SEED, f, i, j, 0);
    for (const r of c.rooms) {
      assert.ok(r.x0 >= c.x0 && r.x1 <= c.x0 + 24 && r.z0 >= c.z0 && r.z1 <= c.z0 + 24);
      for (const k of c.corridors) assert.ok(!overlap(r, k), `room ${r.id} overlaps a corridor`);
      for (const o of c.rooms) if (o !== r) assert.ok(!overlap(r, o), `${r.id} overlaps ${o.id}`);
      // the door sits on the room's boundary and opens onto a corridor
      const d = r.door, onEdge = d.x === r.x0 || d.x === r.x1 || d.z === r.z0 || d.z === r.z1;
      assert.ok(onEdge, `${r.id} door not on its wall`);
    }
  }
});

test('stairs exist on both floors at the same quadrant', () => {
  let found = 0;
  for (let i = -R * 3; i <= R * 3; i++) for (let j = -R * 3; j <= R * 3; j++) {
    const a = genChunk(SEED, 0, i, j, 0), b = genChunk(SEED, 1, i, j, 0);
    assert.equal(!!a.stair, !!b.stair);
    if (a.stair) { found++; assert.equal(a.stair.quadrant, b.stair.quadrant); assert.equal(a.stair.steps, b.stair.steps); }
  }
  assert.ok(found > 3, 'expected some stairs in a 25x25 region');
});

test('genChunk is pure: same args, same chunk; a new epoch keeps the ports', () => {
  const a = genChunk(SEED, 0, 2, 3, 0), b = genChunk(SEED, 0, 2, 3, 0), c = genChunk(SEED, 0, 2, 3, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(a.ports, c.ports);
});

test('infants rooms only on the ground floor', () => {
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const r of genChunk(SEED, 1, i, j, 0).rooms) assert.notEqual(r.kit, 'infants');
});
```

- [ ] **Step 2: Run** `node --test engine/test/layout.test.js` → FAIL.
- [ ] **Step 3: Implement `ports.js` and `chunk.js`** to the rules above. Add to `RULES.layout`: `{ chunk: 24, corridorW: 3.4, corridorH: 2.85, roomH: 3.2, floorH: 3.6, portP: 0.45, lightEvery: 2.4, roomP: { classroom: 0.7, cupboard: 0.3 }, kits: { standard: [8, 9], small: [6, 7], infants: [8, 9] }, kitP: { standard: 0.55, small: 0.25, infants: 0.2 } }`.
  - Room placement within a quadrant: centre the footprint in the quadrant, inset 0.6 m from the corridor walls.
  - Door positions: on the room edge facing the arm, at the middle of the overlap between room and arm.
  - Infants rooms on floor 1 re-roll to `standard`.
  - Stair rooms use the whole quadrant (10.3 × 10.3 minus the inset).
- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint.**

---

### Task 3: Layout: space queries, collision, nav graph, forgetting

**Files:**
- Create: `engine/layout/space.js`, `engine/layout/forget.js`
- Modify: `engine/world.js` (`world.layout = new Layout(S.seed, S)`)
- Test: `engine/test/space.test.js`

**Interfaces:**
- Consumes: `genChunk`, `portOpen`
- Produces:
  - `class Layout(seed, S)`:
    - `chunkAt(floor, x, z) → Chunk`: generates with the epoch from `S.layout.epochs[key] ?? 0` and caches by `key@epoch`.
    - `walkable(floor, x, z) → bool`: inside a corridor rect, or inside a room whose door is open or which the player is already in (`S.player` room), or within a door gap if that door is open.
    - `segmentClear(floor, x0, z0, x1, z1) → bool`: samples every 0.2 m; all walkable; no closed door crossed.
    - `wallsNear(floor, x, z, r) → AABB[]`: the boundary walls of corridors and rooms as thin boxes, with door gaps where doors are open.
    - `roomAt(floor, x, z) → room | null`; `doorById(id) → { door, room, chunk }`.
    - `nav(floor) → { nodes: Map(id → {x, z}), adj: Map(id → [id]) }` over the chunks generated so far: chunk centres, edge midpoints, door points.
    - `path(floor, fromXZ, toXZ) → [{x, z}]` (A* on nav).
  - `forget.js`: `forgetTick(S, layout, rng, rules) → keys[]`. It may bump `S.layout.epochs[key]` for chunks that are generated, not pinned, and at Chebyshev distance ≥ 2 from the player's chunk; it deletes `S.rooms`/`S.doors` entries for those chunks.

- [ ] **Step 1: Write the failing tests** (`engine/test/space.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../state.js';
import { Layout } from '../layout/space.js';
import { forgetTick } from '../layout/forget.js';
import { makeRng } from '../rng.js';
import { RULES } from '../rules.js';

const S = createState(11), L = new Layout(11, S);

test('the centre of chunk (0,0) is walkable on both floors; a room interior is not, while its door is closed', () => {
  for (const f of [0, 1]) assert.ok(L.walkable(f, 12, 12));
  const c = L.chunkAt(0, 12, 12), r = c.rooms.find((x) => x.kind === 'classroom');
  if (r) assert.ok(!L.walkable(0, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
});

test('segmentClear runs along a corridor and is blocked by a wall', () => {
  const c = L.chunkAt(0, 12, 12);
  assert.ok(L.segmentClear(0, c.x0 + 11, c.z0 + 12, c.x0 + 13, c.z0 + 12));
  assert.ok(!L.segmentClear(0, c.x0 + 12, c.z0 + 12, c.x0 + 2, c.z0 + 2)); // into a quadrant corner
});

test('nav path connects two corridor points in neighbouring chunks', () => {
  L.chunkAt(0, 36, 12); // generate the neighbour
  const p = L.path(0, { x: 12, z: 12 }, { x: 36, z: 12 });
  assert.ok(p && p.length >= 2);
  for (let k = 1; k < p.length; k++) assert.ok(L.segmentClear(0, p[k - 1].x, p[k - 1].z, p[k].x, p[k].z));
});

test('forgetting never touches the player chunk or its neighbours, nor pinned chunks; it clears stale room state', () => {
  const S2 = createState(5), L2 = new Layout(5, S2);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) L2.chunkAt(0, i * 24 + 12, j * 24 + 12);
  S2.player.x = 12; S2.player.z = 12; S2.player.floor = 0;
  S2.layout.pinned['0:3:3'] = true;
  S2.rooms['0:-3:-3@0:q0'] = { stale: true };
  const rng = makeRng(1);
  const rules = { ...RULES, layout: { ...RULES.layout, forget: { base: 1, perClock: 0 } } }; // forget everything allowed
  const keys = forgetTick(S2, L2, rng, rules, 60);
  for (const k of keys) { const [, i, j] = k.split(':').map(Number); assert.ok(Math.max(Math.abs(i), Math.abs(j)) >= 2); }
  assert.ok(!keys.includes('0:3:3'));
  assert.ok(keys.includes('0:-3:-3'));
  assert.equal(S2.rooms['0:-3:-3@0:q0'], undefined);
  // ports survive a re-roll
  const before = L2.chunkAt(0, -3 * 24 + 12, -3 * 24 + 12);
  assert.equal(S2.layout.epochs['0:-3:-3'], 1);
  assert.deepEqual(before.ports, L2.chunkAt(0, -3 * 24 + 12, -3 * 24 + 12).ports);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - Room and door ids are `${chunk.key}@${epoch}:q${quadrant}`, so stale state is keyed by epoch and dropped on forget.
  - Add `RULES.layout.forget = { base: 0.01, perClock: 0.04, every: 5 }`: the chance per chunk per minute is `base + perClock × clockHours`, checked every `every` seconds, so the per-check chance = per-minute chance × every / 60.
  - `forgetTick(S, layout, rng, rules, dtSeconds)`.
- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint.**

---

### Task 4: Player, doors, interaction, hiding

**Files:**
- Create: `engine/modules/player.js`, `engine/modules/doors.js`
- Modify: `engine/rules.js` (`player`), `engine/world.js` (default module list `[player, doors]`; spawn)
- Test: `engine/test/player.test.js`

**Interfaces:**
- Consumes: `Layout.walkable`, `wallsNear`, `roomAt`, `doorById`
- Produces:
  - `player` module.
    - **Input:** `input.move` is local (x right, z back), unit length or less. `input.look.yaw/pitch` are deltas in radians.
  - `S.player.target = { kind, id } | null`: the interactable in reach, with kind one of `door, paper, desk, mydesk, drawer, pass, page, chalk, locker, cupboard, entrance, board, lap, book`. Lessons and valuables register interactables in `S.interact[id] = { kind, x, z, floor, r }`; doors register themselves.
  - **Events:** `use{kind, id}`, `useNothing`, `dropEmpty`, `showEmpty`, `doorOpen{id}`, `doorClose{id}`, `doorLocked{id}`, `hide{id}`, `unhide{id}`, `step{floor}` (footstep cadence), `floorChange{from, to}`.
  - `spawnPoint(layout, rng) → {x, z, floor}`: the centre of a corridor in the ground floor's (0,0) chunk.
  - The player's `y` follows the stair heightfield inside stair rooms (Task 9 adds the 13-step rule).
  - `noise` per §6.1.
  - **Stair rooms are open spaces with both doors always open:** the ground-floor door at the bottom of flight 1, and the first-floor door at the top of flight 2.

- [ ] **Step 1: Write the failing tests** (`engine/test/player.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';

const go = (w, input, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('spawns in walkable space; walking forward moves north at walk speed', () => {
  const w = createWorld({ seed: 11 });
  const P = w.S.player;
  assert.ok(w.layout.walkable(P.floor, P.x, P.z));
  const z0 = P.z;
  go(w, { move: { x: 0, z: -1 } }, 60);
  assert.ok(z0 - P.z > 1.6 && z0 - P.z < 2.3, `moved ${z0 - P.z}`);
});

test('walls stop you', () => {
  const w = createWorld({ seed: 11 });
  go(w, { move: { x: 1, z: 0 }, run: true }, 60 * 30);
  assert.ok(w.layout.walkable(w.S.player.floor, w.S.player.x, w.S.player.z));
});

test('running is loud, crouching is quiet', () => {
  const w = createWorld({ seed: 11 });
  go(w, { move: { x: 0, z: -1 }, run: true }, 30); const loud = w.S.player.noise;
  go(w, { move: { x: 0, z: -1 }, crouch: true }, 30); const quiet = w.S.player.noise;
  assert.ok(loud > 0.9 && quiet < 0.1);
});

test('empty-handed use, drop and show do nothing but say so', () => {
  const w = createWorld({ seed: 11 });
  w.S.player.yaw = Math.PI / 4; // face nothing in particular
  const ev = go(w, { use: true, drop: true, show: true }, 1).map((e) => e.type);
  assert.ok(ev.includes('dropEmpty') && ev.includes('showEmpty'));
  assert.ok(ev.includes('useNothing') || ev.includes('use'));
});

test('use on a door opens it, which makes the room walkable', () => {
  const w = createWorld({ seed: 11 });
  const c = w.layout.chunkAt(0, w.S.player.x, w.S.player.z);
  const r = c.rooms[0];
  const P = w.S.player;
  // stand 0.8 m outside the door, facing it
  const d = r.door, out = { N: [0, -0.8], S: [0, 0.8], E: [0.8, 0], W: [-0.8, 0] }[d.side];
  P.x = d.x + out[0]; P.z = d.z + out[1];
  P.yaw = Math.atan2(-(d.x - P.x), -(d.z - P.z));
  const ev = go(w, { use: true }, 1);
  assert.ok(ev.some((e) => e.type === 'doorOpen'));
  assert.ok(w.layout.walkable(0, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2));
});
```

Here `door.side` is the side of the *room* the door is on: an `N` door is on the room's north wall, and its corridor lies to the north.

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - **Movement** (same style as the forest's `main.js`):
    - Forward is `(-sin yaw, -cos yaw)`.
    - Ease velocity toward the target speed with `k = min(1, DT × 8)`.
    - Collide a circle of radius 0.3 against `wallsNear`.
    - Pitch clamp ±`rules.player.pitchMax` (0.42), widened by lessons via `S.player.pitchMin`.
  - **Targeting:** the nearest interactable within `r` (default 1.2 m) whose bearing is within 35° of the view.
  - **Lockers:** `use` toggles `hidden`. While hidden, movement is ignored and noise is 0.
  - Add `RULES.player = { walk: 2.2, run: 4.2, crouch: 1.1, carry: 1.8, radius: 0.3, eye: 1.45, eyeCrouch: 0.95, noise: { run: 1, walk: 0.35, crouch: 0.05 }, reach: 1.2, reachCone: 0.61, pitchMax: 0.42 }`.
- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint.**

---

### Task 5: The app shell: walk the school

**Files:**
- Create:
  - `school/package.json`, `school/vite.config.js`, `school/index.html`
  - `school/src/main.js`, `school/src/input.js`
  - `school/src/art/` (copied art + `textures.js`, which calls the texture painters once and caches the canvases)
  - `school/src/render/paperlit.js`, `school/src/render/chunks.js`
  - `school/tools/scenes.py`
- Test: `school/tools/scenes.py corridor stairs` → screenshots, no page errors

**Interfaces:**
- Consumes: `createWorld`, `stepWorld`, `S`, `world.layout.chunkAt`, `RULES`
- Produces:
  - `makePaperLit(map, { repeat }) → THREE.Material`, with shared uniforms `uLights` (vec4[12]), `uLightCount`, `uAmb`, `uFogFar`.
  - `ChunkView`: `sync(world, camera)` builds or disposes meshes for the player's chunk and its 4 neighbours on the current floor (plus the other floor inside a stair room), keyed by `key@epoch`.
  - `window.__gn = { world, S, RULES, camera, renderer, keys }` for scenario scripts.
- **Main loop:**
  - Accumulate real time; run `stepWorld` at 60 Hz with the input sampled that frame.
  - Look deltas are added to the first step only.
  - The camera is set from `S.player` (y = floor × 3.6 + stair y + eye) with head bob.
  - The 12 nearest tubes (from chunk lights × `S.lights[id] ?? 1`) are written into the uniforms each frame.
- **Paper-lit fragment light:** `L = amb + Σ I·(0.8·exp(-h/(2·1.5²))·(0.55 + 0.45·min(1, v/8)) + 0.28/(1 + (h + v)/3))`, where `h` = horizontal squared distance and `v` = vertical squared distance to the tube. Output `color = tex × min(1, L)`, then fog `mix(color, black, smoothstep(6, uFogFar, dist))`.

- [ ] **Step 1:** Scaffold `school/`:
  - `package.json` with `three@^0.186.1`, `vite@^8.3.3`, scripts `dev`/`build`.
  - `vite.config.js` with `server: { port: 5182, strictPort: true, fs: { allow: ['..'] } }` and `publicDir: '../assets'`.
  - Run `npm install`.
- [ ] **Step 2:** Copy `spike/concepts/{paint,designs,school,rooms}.js` into `school/src/art/`:
  - Remove their `DESIGNS` exports and scene functions (hallway, classroom, stairwell).
  - Keep the painters and textures; export the texture functions.
- [ ] **Step 3:** Write `paperlit.js` (a `MeshBasicMaterial` with `onBeforeCompile` adding `vWorld` and the light loop) and `chunks.js`:
  - floor and ceiling quads per corridor rect and room rect (UVs in metres / tile size)
  - wall quads along every corridor and room boundary, with door gaps
  - door meshes (hinged group; angle from `S.doors[id].open`)
  - lockers as a wall texture strip
  - tubes as emissive quads
  - noticeboards and photos as decals every few arms (chosen by the chunk rng)
- [ ] **Step 4:** Write `main.js` and `input.js`:
  - pointer lock with `unadjustedMovement`, and the spike guard against huge movement jumps
  - keys: WASD, Shift, Ctrl/C, E/click, Q/right-click, F, Esc
  - the loading bar while textures paint
- [ ] **Step 5: Verify.**
  - Run `npm run dev` in `school/` and `python school/tools/scenes.py shots corridor stairs`.
  - Look at the screenshots: a lit paper corridor; dead tubes; the ground floor and the first floor via a stair room.
  - Check fps ≥ 30 (`window.__fps`).
- [ ] **Step 6: Checkpoint.** Show the user the screenshots.

---

### Task 6: The Headmaster

**Files:**
- Create: `engine/modules/headmaster.js`, `engine/director.js` (patrol scheduling part), `school/src/render/people.js` (rig + 12 Hz poses; the Headmaster first)
- Modify: `engine/rules.js` (`headmaster`), `engine/world.js` (module order: player, doors, director, headmaster)
- Test: `engine/test/headmaster.test.js`

**Interfaces:**
- Heading convention for him is the player's: forward = `(-sin yaw, -cos yaw)`.
- `S.headmaster = { state: 'absent'|'approach'|'patrol'|'chase'|'stoop'|'pinStar'|'leave', x, z, floor, path: [], timer, seenAt, lastNoise: {x, z} | null, killLights: [] }`.
- **Events:**
  - arrival and patrol: `hmArrive`, `hmLightDie{lightId}`, `hmHear{x, z}`
  - chase: `hmSee`, `hmLose`
  - escapes: `hmStoop` (the hall pass), `hmPinStar`
  - endings: `hmCatch` (→ the detention module), `hmLeave`
- `director` sets `S.director.nextPatrol` (seconds) from `RULES.headmaster.every` × (0.6 after 2:30) and calls `headmaster.arrive(S, ctx)`.

- [ ] **Step 1: Write the failing tests** (`engine/test/headmaster.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { headmaster } from '../modules/headmaster.js';

function rig(seed = 11) {
  const w = createWorld({ seed });
  const P = w.S.player;
  // put him 10 m east of the player along the corridor, patrolling
  Object.assign(w.S.headmaster, { state: 'patrol', x: P.x + 10, z: P.z, floor: P.floor, path: [], timer: 60 });
  return w;
}
const run = (w, input, secs) => { const ev = []; for (let i = 0; i < secs * 60; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('he hears running within 14 m, even facing away', () => {
  const w = rig(); w.S.headmaster.yaw = -Math.PI / 2; // facing east, away from the player
  const ev = run(w, { move: { x: 0, z: -1 }, run: true }, 0.5);
  assert.ok(ev.some((e) => e.type === 'hmHear'));
});

test('he sees you in his cone with a clear line and gives chase', () => {
  const w = rig(); w.S.headmaster.yaw = Math.PI / 2; // facing west, toward the player
  const ev = run(w, {}, 0.5);
  assert.ok(ev.some((e) => e.type === 'hmSee'));
  assert.equal(w.S.headmaster.state, 'chase');
});

test('within 1 m he catches you', () => {
  const w = rig(); Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 0.8, yaw: Math.PI / 2 });
  assert.ok(run(w, {}, 0.2).some((e) => e.type === 'hmCatch'));
});

test('a hall pass sends him away', () => {
  const w = rig(); w.S.held.pass = 1; Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 2.5, yaw: Math.PI / 2 });
  const ev = run(w, { show: true }, 4);
  assert.ok(ev.some((e) => e.type === 'hmStoop'));
  assert.ok(!ev.some((e) => e.type === 'hmCatch'));
  assert.equal(w.S.held.pass, 0);
  assert.ok(['leave', 'absent'].includes(w.S.headmaster.state));
});

test('a dropped star stops him for 4 s', () => {
  const w = rig(); w.S.held.stars = 2; Object.assign(w.S.headmaster, { state: 'chase', x: w.S.player.x + 6, yaw: Math.PI / 2 });
  const ev = run(w, { drop: true }, 0.05);
  run(w, {}, 1);
  assert.equal(w.S.headmaster.state, 'pinStar');
  assert.equal(w.S.held.stars, 1);
  run(w, {}, 3.5);
  assert.notEqual(w.S.headmaster.state, 'pinStar');
});

test('out of sight for 6 s, he loses you', () => {
  const w = rig(); Object.assign(w.S.headmaster, { state: 'chase', seenAt: w.S.t, x: w.S.player.x + 30 });
  w.S.player.hidden = 'locker-x';
  const ev = run(w, {}, 6.5);
  assert.ok(ev.some((e) => e.type === 'hmLose'));
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec §6.3.
  - **Lights:** on `approach`, take the tubes along his path toward the player and kill one per 0.8 s (`S.lights[id] = 0`, emit `hmLightDie`). On `leave`, restore them one per 0.4 s.
  - **Sight:** within 18 m, within 30° of his heading, and `segmentClear`. Through a door window only within the door's 1.2 m view strip (a straight line through the door point along the door normal).
  - **Hidden** players aren't seen unless `S.player.hiddenSeen`, which is set when he saw you within 2 s before you hid.
  - **Speeds:** 1.3 / 3.6 / 4.6 after the bell.
  - Add `RULES.headmaster = { every: [70, 140], spawnDist: [30, 50], lightEvery: 0.8, patrol: 1.3, chase: 3.6, chaseBell: 4.6, hear: { noise: 0.3, dist: 14 }, sight: { dist: 18, half: 0.52 }, loseAfter: 6, patrolFor: [40, 70], catch: 1.0, passDist: 3, stoop: 2.5, pinStar: 4 }`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Render.**
  - `people.js`: a `Person` rig from the headmaster card (body + head + jaw + arms as parts with pins, same as the forest's `buildRig`). Poses are updated at 12 Hz from `S.headmaster`: walk cycle, stoop, pin star.
  - **Sound** hooks: keys and footsteps positional, light clunk.
  - **Effects:** the hall-pass stoop pushes his face card to fill the screen for 2.5 s; caught = crumple.
  - **Scenes:** `corridor_hm` (lights dying), `hm_stoop`.
- [ ] **Step 6: Checkpoint.**

---

### Task 7: Classrooms: the roll, the interior, Hand In Your Work, stars

**Files:**
- Create:
  - engine: `engine/modules/classroom.js`, `engine/modules/lessons/handin.js`, `engine/modules/stars.js`
  - app: `school/src/render/rooms.js`, `school/src/render/hands.js` (forest hands with the star ring, the paper stack)
- Modify: `engine/director.js` (`rollRoom`), `engine/rules.js` (`classroom`, `lessons.handin`, `stars`), the world module order
- Test: `engine/test/classroom.test.js`, `engine/test/helpers.js` (`enterClass`)

**Interfaces:**
- `rollRoom(S, room, rng, rules) → roll = { lesson: 'handin'|'eyes'|'story', teacher: 'teacher'|'none', twists: [...], valuables: {...} }`
  - It never returns the same `lesson + twists` as `S.director.lastRoll`.
  - `story` happens only when `room.kit === 'infants'` (and always there).
  - Twist count: 0/1/2 at 50/35/15%, +1 after 2:30.
- `S.rooms[id] = { id, kit, roll, desks: [...], students: [{ id, x, z, seat, finished, paper, tracking, faceBack }], teacher: { x, z, facing }, lesson: {...}, state: 'idle'|'running'|'done'|'abandoned'|'doom' }`
- `lessons.handin`: `start(room, S, ctx)`, `step(room, S, input, ctx) → 'running'|'success'|'doom'`
- `stars`:
  - `award(S, ctx, why)`: +1 star (max 12), clock +6, emits `starEarned`
  - `drop(S, ctx)`: −1 star, emits `starDropped{x, z}`; used by the Headmaster
- **Events:**
  - the roll and the lesson: `roomRoll{id, roll}`, `lessonStart{id, lesson}`, `lessonSuccess{id}`, `lessonDoom{id, lesson}`
  - Hand In Your Work: `chalkStart`, `chalkStop`, `teacherLooks`, `seenMoving`, `paperTaken{studentId, unfinished}`, `stackDelivered`, `hymnCut`
  - `starEarned`

- [ ] **Step 1: Write the failing tests** (`engine/test/classroom.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../rng.js';
import { RULES } from '../rules.js';
import { createState } from '../state.js';
import { rollRoom } from '../director.js';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';

test('roll odds are close to the rulebook over 10k rolls; story only in infants; no immediate repeat', () => {
  const S = createState(1), rng = makeRng(2);
  const n = { handin: 0, eyes: 0 }; let prev = null;
  for (let k = 0; k < 10000; k++) {
    const r = rollRoom(S, { id: 'r' + k, kit: 'standard' }, rng, RULES);
    n[r.lesson]++;
    const sig = r.lesson + '|' + r.twists.slice().sort().join(',');
    assert.notEqual(sig, prev); prev = sig;
  }
  assert.ok(Math.abs(n.handin / 10000 - 0.6) < 0.04, `handin share ${n.handin / 10000}`);
  for (let k = 0; k < 200; k++) assert.equal(rollRoom(S, { id: 'i' + k, kit: 'infants' }, rng, RULES).lesson, 'story');
});

// (lives in engine/test/helpers.js, shared by the lesson tests)
// a helper that opens the first classroom next to spawn and rolls it to a fixed lesson
export function enterClass(seed, lesson, twists = []) {
  const w = createWorld({ seed });
  const room = w.layout.chunkAt(0, w.S.player.x, w.S.player.z).rooms.find((r) => r.kind === 'classroom' && r.kit !== 'infants');
  w.S.director.forceRoll = { lesson, teacher: 'teacher', twists, valuables: {} };
  const d = room.door;
  w.S.doors[d.id] = { open: true };
  Object.assign(w.S.player, { x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2 }); // step inside
  stepWorld(w, NO_INPUT);
  return { w, room: w.S.rooms[room.id] };
}

test('Hand In Your Work: collecting every paper and delivering in time earns a star', () => {
  const { w, room } = enterClass(11, 'handin');
  assert.equal(room.state, 'running');
  const evs = [];
  for (const s of room.students) { Object.assign(w.S.player, { x: s.x, z: s.z - 0.6 }); w.S.player.target = { kind: 'paper', id: s.id }; evs.push(...stepWorld(w, { ...NO_INPUT, use: true })); }
  Object.assign(w.S.player, { x: room.teacher.deskX, z: room.teacher.deskZ + 0.8 }); w.S.player.target = { kind: 'desk', id: room.id };
  evs.push(...stepWorld(w, { ...NO_INPUT, use: true }));
  assert.ok(evs.some((e) => e.type === 'stackDelivered'));
  assert.ok(evs.some((e) => e.type === 'starEarned'));
  assert.equal(room.state, 'done');
});

test('Hand In Your Work: when the hymn ends, DOOM', () => {
  const { w, room } = enterClass(11, 'handin');
  room.lesson.hymn = 0.05;
  const ev = []; for (let i = 0; i < 10; i++) ev.push(...stepWorld(w, NO_INPUT));
  assert.ok(ev.some((e) => e.type === 'lessonDoom'));
  assert.equal(w.S.phase, 'expelled');
});

test('Hand In Your Work: moving while she looks costs 10 s of hymn', () => {
  const { w, room } = enterClass(11, 'handin');
  room.lesson.phase = 'look'; room.lesson.phaseT = 1.5;
  const h0 = room.lesson.hymn;
  const ev = []; for (let i = 0; i < 20; i++) ev.push(...stepWorld(w, { ...NO_INPUT, move: { x: 0, z: -1 } }));
  assert.ok(ev.some((e) => e.type === 'seenMoving'));
  assert.ok(room.lesson.hymn < h0 - 9.5);
});

test('delivering on the last tick of the hymn still wins', () => {
  const { w, room } = enterClass(11, 'handin');
  for (const s of room.students) s.paper = 'taken';
  w.S.player.carrying = room.students.length;
  room.lesson.hymn = 1 / 60;
  Object.assign(w.S.player, { x: room.teacher.deskX, z: room.teacher.deskZ + 0.8 }); w.S.player.target = { kind: 'desk', id: room.id };
  const ev = stepWorld(w, { ...NO_INPUT, use: true });
  assert.ok(ev.some((e) => e.type === 'lessonSuccess'));
  assert.ok(!ev.some((e) => e.type === 'lessonDoom'));
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - **The interior** (pure, from the room rng):
    - the desk grid fitted to the kit
    - the teacher desk at the front, the board on the far wall from the door
    - students on seats; one seat empty (yours)
  - **Interactables:** `S.interact` entries for papers, the teacher's desk, the drawer, your desk, the chalk.
  - **Hand In Your Work** per spec §6.4:
    - `lesson = { hymn: 70, phase: 'chalk'|'look', phaseT, carried: 0 }`
    - In the look phase, `|v| > 0.3` → `seenMoving` (once per look), hymn −10, heads up 3 s.
    - Under `teacher: 'none'`, `teacherLooks` → `studentsLook`.
  - **Order within a tick:** process `use` before the hymn countdown.
  - **Doom:** `S.phase = 'expelled'`; `lessonDoom` carries the doom type for the renderer.
  - **Leaving mid-lesson:** abandoned; the door locks; clock +3.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Render.**
  - `rooms.js` builds a classroom from `S.rooms[id]`:
    - windows (window texture, moonlight term in the shader via `uMoon` for rooms with windows)
    - the board (`blackboardTexture` redrawn for the lesson text)
    - the frieze, the clock (a canvas redrawn each clock minute)
    - the teacher desk with the apple and drawer
    - desks and chairs as panels
    - student rigs (back/front card bodies + head part on the neck pin): `tracking` turns the head; `heads up` raises it
    - the teacher rig (back/front)
  - **The doom finale:** stand → smile → snap (`student_snapped` pose) → the shriek rush.
  - Hands carry the paper stack.
  - **Scenes:** `class_handin`, `class_look`, `class_doom`.
- [ ] **Step 6: Checkpoint.** Show the user the screenshots.

---

### Task 8: Eyes On Your Own Paper, Story Time, twists, valuables

**Files:**
- Create:
  - engine: `engine/modules/lessons/eyes.js`, `engine/modules/lessons/story.js`
  - app: `school/src/ui.js` (subtitles; the story lines)
- Modify: `engine/modules/classroom.js` (twists, valuables), `engine/rules.js` (`lessons.eyes`, `lessons.story`, `twists`, `valuables`), `school/src/render/rooms.js`
- Test: `engine/test/lessons2.test.js`

**Interfaces:**
- `eyes` lesson state: `{ written: 0, need: 60, lookUpT: 0, nextEdge, invigilator: {x, z, target} }`
  - **Events:** `sat`, `writing`, `edgeThing{kind}`, `lookedUp`, `invigilatorComes`
  - It sets `S.player.pitchMin = -1.1` while sitting.
- `story` lesson state: `{ line: 0, lineT, page: { hiddenIn: 'toybox'|'carpet'|'cubby'|'child', found: false } }`
  - **Events:** `storyLine{n, text}` (text chosen from `STORY_LINES` by the player's situation), `pageFound`, `pageGiven`
- `valuables`: `drawer` (star; opens only while `teacherFacing === 'board'`), `pass`, `page` (one per night; `S.held.pages` and `pageFound{n}`), `chalk` (`S.held.chalk`; `use` on a door while holding chalk sets `S.layout.pinned[chunkKey]` and the door's `chalked`).
- **Twists:** `oneTooMany`, `turned`, `lockedIn`, `lightsOut`, `visitor`, `wrongBoard`. Each is an `apply(room, S, ctx)` at start, plus optional `step` hooks.

- [ ] **Step 1: Write the failing tests** (`engine/test/lessons2.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld, NO_INPUT } from '../world.js';
import { enterClass } from './helpers.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('Eyes: write 60 s with your eyes down → star', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  assert.ok(w.S.player.seated);
  w.S.player.pitch = -0.9;
  const ev = tick(w, { useHeld: true }, 60 * 61);
  assert.ok(ev.some((e) => e.type === 'lessonSuccess'));
});

test('Eyes: looking up for 0.4 s → DOOM', () => {
  const { w, room } = enterClass(11, 'eyes');
  w.S.player.target = { kind: 'mydesk', id: room.id }; tick(w, { use: true });
  w.S.player.pitch = 0;
  const ev = tick(w, { useHeld: true }, 30);
  assert.ok(ev.some((e) => e.type === 'lessonDoom'));
});

test('Story: the lines narrate you; giving the page in time wins; the last line is DOOM', () => {
  const { w, room } = enterClass(11, 'story');
  const ev = tick(w, {}, 60 * 8);
  const lines = ev.filter((e) => e.type === 'storyLine');
  assert.ok(lines.length >= 1 && lines.every((l) => typeof l.text === 'string' && l.text.length > 0));
  room.lesson.page.found = true; w.S.player.carrying = 1;
  w.S.player.target = { kind: 'lap', id: room.id };
  assert.ok(tick(w, { use: true }).some((e) => e.type === 'lessonSuccess'));

  const b = enterClass(12, 'story');
  b.room.lesson.line = 11; b.room.lesson.lineT = 0.01;
  const ev2 = tick(b.w, {}, 5);
  assert.ok(ev2.some((e) => e.type === 'storyLine' && /caught him/.test(e.text)));
  assert.ok(ev2.some((e) => e.type === 'lessonDoom'));
});

test('Story: running makes her skip two lines', () => {
  const { w, room } = enterClass(11, 'story');
  const l0 = room.lesson.line;
  tick(w, { move: { x: 0, z: -1 }, run: true }, 20);
  assert.ok(room.lesson.line >= l0 + 2);
});

test('twists: lockedIn locks the door; oneTooMany adds a student; lightsOut adds 15 s', () => {
  const a = enterClass(11, 'handin', ['lockedIn']);
  assert.ok(Object.values(a.w.S.doors).some((d) => d.locked));
  const base = enterClass(11, 'handin'), more = enterClass(11, 'handin', ['oneTooMany']);
  assert.equal(more.room.students.length, base.room.students.length + 1);
  const dark = enterClass(11, 'handin', ['lightsOut']);
  assert.ok(Math.abs(dark.room.lesson.hymn - (base.room.lesson.hymn + 15)) < 0.05);
});

test('chalk on a door pins the chunk', () => {
  const { w, room } = enterClass(11, 'handin');
  w.S.held.chalk = 1; w.S.player.target = { kind: 'door', id: Object.keys(w.S.doors)[0] };
  tick(w, { use: true });
  assert.ok(Object.keys(w.S.layout.pinned).length >= 1);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec §6.4.
  - **`STORY_LINES`:** keyed by situation `{ entering, still, creeping, running, nearToybox, nearCarpet, nearCubby, nearChild, hasPage, nearHer, end }`. Each has 2–3 hand-written lines in the past tense about "the boy". The end line is always *"…and then she caught him."*
  - **Eyes edge things** every `[4, 9]` s from `RULES.lessons.eyes.edge` weights: `footsteps, hand, breath, standUp, flicker, whisper`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Render.**
  - **Eyes:** seated camera; your paper on the desk with handwriting that grows; edge-things as cards at the view edge.
  - **Story:** the infants kit with the carpet, toy box, cubbies and reading chair; subtitles; the page hiding places.
  - **Twists:** turned cards, an extra student, board hints, the visitor (a Headmaster rig at the back).
- [ ] **Step 6: Checkpoint.**

---

### Task 9: Clock, final bell, exit, stairs, detention, expelled, pages, screens

**Files:**
- Create:
  - engine: `engine/modules/clock.js`, `engine/modules/stairs.js`, `engine/modules/detention.js`
  - app: `school/src/fx.js` (crumple and edges from the forest; the rush, the flood, the page view)
- Modify: `engine/modules/stars.js` (exit), `engine/rules.js`, `school/src/ui.js` (title with pages, end cards)
- Test: `engine/test/night.test.js`

**Interfaces:**
- `S.clock = { minutes, bell }`: 60 + t/20 + jumps; the bell at 210 (3:30). Events: `clockMinute{m}`, `bell`.
- `exit`:
  - `onDeadEnd(S, ctx, chunk)` is called by the layout when a ground-floor dead end is first generated. It rolls the hazard (stars ≥ 3) and sets `S.layout.entrances[chunk.key] = true` (max 1 before the bell, 2 after).
  - `use` on the entrance runs the reach roll. Success → `S.phase = 'home'`, `homeTime`. Fail → `exitFail`: stars to 0, clock +15, the chunk is forgotten.
- `stairs`: `S.stairs = { follower: false, roomId }`. Events: `thirteenth`, `followerAppears`, `followerCatch`.
- `detention`:
  - `hmCatch` → `S.phase = 'detention'` (or `'expelled'` after the bell).
  - `S.detention = { lines: 0, writeT: 0, snore: true, snoreT }`
  - **Events:** `detentionStart`, `lineWritten{n}`, `snoreStop`, `linesReset`, `runAlong`.
  - On `runAlong`: the phase returns to play, the player is placed at a fresh ground-floor chunk's corridor centre (walkable), stars → 0, clock +10.

- [ ] **Step 1: Write the failing tests** (`engine/test/night.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../rng.js';
import { RULES } from '../rules.js';
import { createWorld, stepWorld, NO_INPUT } from '../world.js';
import { exitHazard, reachChance } from '../modules/stars.js';

const tick = (w, input = {}, n = 1) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...stepWorld(w, { ...NO_INPUT, ...input })); return ev; };

test('the clock runs 1 min per 20 s and rings the bell at 3:30', () => {
  const w = createWorld({ seed: 1 });
  tick(w, {}, 60 * 20); assert.ok(Math.abs(w.S.clock.minutes - 61) < 0.05);
  w.S.clock.minutes = 209.99; const ev = tick(w, {}, 60);
  assert.ok(ev.some((e) => e.type === 'bell')); assert.ok(w.S.clock.bell);
});

test('exit formulas match the spec', () => {
  assert.equal(exitHazard(2), 0);
  assert.ok(Math.abs(exitHazard(4) - 0.28) < 1e-9);
  assert.equal(exitHazard(12), 0.6);
  assert.ok(Math.abs(reachChance(5) - 0.15) < 1e-9);
  assert.equal(reachChance(12), 0.35);
});

test('reach roll: success → home time; failure → stars 0, clock +15', () => {
  const ok = createWorld({ seed: 1 }); ok.S.held.stars = 12; ok.S.director.forceReach = true;
  ok.S.player.target = { kind: 'entrance', id: 'x' };
  assert.ok(tick(ok, { use: true }).some((e) => e.type === 'homeTime'));
  assert.equal(ok.S.phase, 'home');
  const no = createWorld({ seed: 1 }); no.S.held.stars = 5; no.S.director.forceReach = false;
  const m0 = no.S.clock.minutes; no.S.player.target = { kind: 'entrance', id: 'x' };
  assert.ok(tick(no, { use: true }).some((e) => e.type === 'exitFail'));
  assert.equal(no.S.held.stars, 0); assert.ok(no.S.clock.minutes >= m0 + 15);
});

test('caught → detention; writing 5 lines while he snores → run along, spawned in walkable space', () => {
  const w = createWorld({ seed: 2 }); w.S.held.stars = 4;
  w.S.headmaster.caughtNow = true; tick(w); // hmCatch sets this flag; detention consumes it next tick
  assert.equal(w.S.phase, 'detention');
  w.S.detention.snoreT = 999; // never stops in this test
  const ev = tick(w, { useHeld: true }, 60 * 21);
  assert.ok(ev.some((e) => e.type === 'runAlong'));
  assert.equal(w.S.phase, 'play'); assert.equal(w.S.held.stars, 0);
  assert.ok(w.layout.walkable(w.S.player.floor, w.S.player.x, w.S.player.z));
});

test('writing while the snoring stops resets the lines', () => {
  const w = createWorld({ seed: 2 }); w.S.headmaster.caughtNow = true; tick(w);
  w.S.detention.lines = 3; w.S.detention.snore = false; w.S.detention.snoreT = 1;
  const ev = tick(w, { useHeld: true }, 10);
  assert.ok(ev.some((e) => e.type === 'linesReset')); assert.equal(w.S.detention.lines, 0);
});

test('caught after the bell → expelled', () => {
  const w = createWorld({ seed: 2 }); w.S.clock.bell = true; w.S.headmaster.caughtNow = true; tick(w);
  assert.equal(w.S.phase, 'expelled');
});

test('13 steps: turning around on the flight summons the follower; turning again catches you', () => {
  const w = createWorld({ seed: 2 });
  w.S.stairs = { roomId: 'stair-x', steps: 13, climbYaw: 0, follower: false, onFlight: true };
  w.S.player.yaw = Math.PI; let ev = tick(w);
  assert.ok(ev.some((e) => e.type === 'followerAppears'));
  w.S.player.yaw = 0; tick(w); w.S.player.yaw = Math.PI; ev = tick(w);
  assert.ok(ev.some((e) => e.type === 'followerCatch'));
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** to spec §6.2, §6.5–§6.7.
  - `hmCatch` sets `S.headmaster.caughtNow = true`; `detention.step` consumes it on the next tick.
  - Add `exitHazard(n) = n < 3 ? 0 : min(0.6, 0.08 + 0.05·n)` and `reachChance(n) = min(0.35, 0.03·n)`.
  - `forceReach` is honoured only when present (for tests).
  - Pages persist in the app: `localStorage['homeTime.pages']`, passed to `createWorld({ pagesFound })`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Render.**
  - **Stairs:** the stair room geometry (two flights, landing, window, floor sign, the timer switch); the follower card one step behind.
  - **Detention:** the room (desk, board with lines being written, the Headmaster asleep at his desk with a snore cycle).
  - **Expelled:** the doom → black → EXPELLED → the title.
  - **Home time:** the doors open, a white-gold flood, HOME TIME.
  - **The page view:** full-screen crayon page for 3 s.
  - **The title:** pages found as small pinned cards.
  - **Every wall clock** shows `S.clock.minutes`. The bell: all tubes flicker, plus the bell bed.
  - **Scenes:** `stairs13`, `detention`, `expelled`, `home`.
- [ ] **Step 6: Checkpoint.**

---

### Task 10: The sound set (parallel, from Task 5 on)

**Files:**
- Create: `assets/audio/school/*.ogg`, `assets/audio/school/src/make_school_audio.py`, `assets/audio/school/README.md`, `CREDITS.md`
- Modify: `school/src/audio.js` (the forest `audio.js` pattern: load OGGs, synth fallbacks, positional sounds via a `PannerNode` for the Headmaster)

The list is spec §9:
- **Beds:** `hymn_70s`, `hymn_slow`, `corridor_hum`, `room_tone`, `bell_loop`
- **SFX:**
  - the classroom: `chalk_squeak_1..3`, `chalk_stop`, `pencils_loop`, `paper_pick_1..3`, `desk_lid`, `chair_scrape`
  - doors and hiding: `door_open`, `door_shut`, `door_lock`, `locker_open`, `locker_shut`
  - the Headmaster: `keys_loop`, `cane_tap_1..3`, `hm_step_1..4`, `light_clunk`, `light_buzz_loop`
  - doom and jump scares: `shriek`, `crack_chorus`
  - voices: `whisper_name`, `story_murmur_loop`
  - markers: `stamp`, `snore_loop`, `stinger_rush`

- [ ] **Step 1:** Dispatch a sound-design subagent with this list, the forest's `assets/audio/src/make_audio.py` as the house style (numpy synthesis → OGG, original only), and the mood brief (calm-creepy, paper, a children's choir *ooh* for the hymn, a four-line tune, 70 s).
- [ ] **Step 2:** Verify: every file loads (`python assets/audio/school/src/check_audio.py`); durations and loudness are within the brief.
- [ ] **Step 3:** Hook into `audio.js`; play each sound once in the browser scenario `sounds`; the user listens.
- [ ] **Step 4: Checkpoint.**

---

### Task 11: Data twin v2, headless sim, agents

**Files:**
- Create: `engine/twin.js`, `engine/sim.js`, `engine/agents/wander.js`, `engine/agents/lesson.js`, `school/src/record.js` (`?record` + F9)
- Test: `engine/test/twin.test.js`

**Interfaces:**
- `snapshot(S) → { t, input, player, held, clock, headmaster, rooms: { [id]: { kit, roll, state, lesson } } (only active or nearby), director, stairs, detention, phase, events }`. One line per 12 Hz tick (every 5th engine step).
- Agents: `agent.act(S, layout, rng) → input` (they use their own rng stream `agent`).
- `node engine/sim.js --seed N --agent wander|lesson --minutes M [--out file]`.

- [ ] **Step 1: Write the failing test** (`engine/test/twin.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const sim = (out, agent) => execFileSync(process.execPath, ['engine/sim.js', '--seed', '7', '--agent', agent, '--minutes', '2', '--out', out]);

for (const agent of ['wander', 'lesson']) test(`headless ${agent} night is byte-identical across runs`, () => {
  sim('tmp_a.jsonl', agent); sim('tmp_b.jsonl', agent);
  const a = readFileSync('tmp_a.jsonl', 'utf8'), b = readFileSync('tmp_b.jsonl', 'utf8');
  rmSync('tmp_a.jsonl'); rmSync('tmp_b.jsonl');
  assert.equal(a, b);
  const lines = a.trim().split('\n');
  assert.ok(lines.length >= 12 * 120 - 2);
  const first = JSON.parse(lines[0]);
  for (const k of ['t', 'player', 'clock', 'headmaster', 'phase']) assert.ok(k in first);
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
  - **`wander`:** follows corridors, opens doors at random, hides in a locker when `hmArrive` or keys are heard, and drops a star when chased with stars.
  - **`lesson`:** does Hand In Your Work (paper order by distance, freezes on `chalkStop`), Eyes (looks down, holds use) and Story (searches hiding spots in order). It makes deliberate mistakes with p = 0.1.
- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint.**

---

### Task 12: Performance, scenario sweep, tuning handoff

**Files:**
- Create: `school/tools/perf.py`; `research/img/slice_v1/*.jpg`
- Modify: `research/03_slice_v1_spec.md` (a status line), `README.md` (how to play and run the sim), `CHANGELOG.md` (only at good-to-go)

- [ ] **Step 1:** `python school/tools/perf.py` gives fps and draw calls in a corridor, a full classroom and a stairwell. **Pass:** ≥ 30 fps, ≤ 150 calls. If it fails, apply spec §12's mitigations.
- [ ] **Step 2:** `python school/tools/scenes.py research/img/slice_v1` captures every beat; check each screenshot against the spec. `node --test engine/` passes everything.
- [ ] **Step 3:** A full-night auto run (`?auto`, the `wander` agent driving the browser) for 5 minutes with no page errors.
- [ ] **Step 4:** Hand off to the user: how to play, what to look for, the tuning knobs (`engine/rules.js`). **Propose commits** for approval, grouped by milestone (engine, layout, app, Headmaster, classrooms, night, sound, twin).
