# GameNet data: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Candles rules engine into a data factory. The monster is driven through a giant's controller by
personas with emotions; kid bots play the kid; every game is recorded to a reproducible dataset of about 2,000 games.

**Architecture:**
- `game/src/sim` splits into three parts:
  - a **world** (`stepWorld`) that takes two controllers, the kid's and the giant's, and enforces every limit;
  - **senses** (`observe`), which compute exactly what the giant may know;
  - **minds**, which turn observations into giant controller input: Classic (today's brain ported) and five personas
    with belief and emotions.
- **Episodes** are fully defined by a small config. Separate random streams for the world, the mind and the kid make
  them replay exactly.
- A **recorder** encodes the state every 3rd tick with one schema, and a worker pool writes shards.

**Tech stack:**
- Node 24 (ES modules, `node:test`, `worker_threads`, `Float16Array`);
- Vite and three.js for the browser viewer;
- Python with numpy and torch (CPU) for the feasibility spike only.

No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-gamenet-training-design.md`.
**Mechanics:** `docs/mechanics.md`. Case ids such as C4 and W3 refer to it.

## Feasibility findings (measured 2026-10-10, before planning)

**Machine:** 12 cores, 16 GB RAM, 94 GB free disk, no CUDA GPU, torch 2.14 (CPU).

**Simulation speed:** 20 games of about 160 s each took 39 s on one thread, including the old kid bot's distance
fields. That is about 4,900 rules ticks a second per core.
- 12 workers make about 60,000 ticks a second, about 1,000 s of play every second.
- v0 (about 80 h of play) therefore takes about 5 minutes of rules time. The bots add overhead, but under 30 minutes
  is safe.

**Model inference budget** (random weights, PyTorch eager on the CPU, one forward pass):

| Shape | Pieces | Params | ms per pass, 1 thread |
|---|---|---|---|
| width 256, 8 layers | 115 | 6.4 M | 114 |
| width 256, 6 layers | 55 | 4.8 M | 52 |
| width 128, 6 layers | 55 | 1.2 M | 11.6 |
| width 128, 6 layers | 70 | 1.2 M | 16.0 |

**What changes:**
- **The model is smaller than the spec said:** width 128, 6 layers, about 1.2 M parameters. Two passes take about
  23 ms against the 50 ms tick budget, on the CPU alone.
- **The map no longer enters as 60 patches.** Instead:
  - each moving piece (kid, monster, a flying toy) carries the 5 × 5 tiles around it;
  - about 12 coarse map pieces (rooms and corridor stretches) give the layout.

  That puts the model at about 70 pieces.
- **Task 1 updates the spec and the pitch page with these numbers.**
- **Learnability is still unproven.** Can a model learn crisp collisions and blow-out timing from data? Task 1 runs a
  small spike before we invest in the rest.

## Global constraints

- The rules tick stays at **60 Hz**. A record is written **every 3rd tick (20 Hz)**, and inputs are held for those
  3 ticks.
- **The world enforces every limit** (speeds, cooldowns, windups, warnings). Minds act only through the controller,
  and know only what `observe` gives them.
- **Today's mechanics and numbers stay.** The new mechanics are only:
  - the giant's controller;
  - the **yell**: 0.8 s stop, at most once every 6 s;
  - **fury** and **spent**, which are mind states.
- **Six monster types:** Classic (the reference), Pathfinder, Brute, Stalker, Hound, Warden.
- **Balance band:** with each persona, the mid-skill kid bot wins **5–25%** of games.
- **Data:**
  - games end won, caught or at **300 s**;
  - **30%** start mid-game;
  - **5%** use the Chaos kid;
  - the coverage target is **≥ 1,000** occurrences per case id;
  - v0 is **2,000 episodes**.
- **Replays:** a config alone rebuilds an episode, bit for bit, in Node and in the browser on this machine.
- **Repository rules:**
  - commit on `dev` only, and never push;
  - end each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - no new npm or pip dependencies;
  - datasets live in `data/` at the repo root, which is gitignored.
- **Style:** match the existing code. Small modules, comments that say why, and numbers in `rules.js`.

## Review focus

1. **Replay drift.** The same config must give the same game twice in Node and once in the browser. Task 5 tests
   this with a state hash, and Task 6 compares the browser's hash.
2. **A stuck monster.** No mind may leave the monster pushing against geometry for long. Task 8's probe reports the
   share of time stuck; it must be under 2%.
3. **Stalling kid bots.** Too many timeouts means bad data. Task 9's probe reports the timeout rate; it must be
   under 30%.
4. **Invalid mid-game starts.** Nobody may start inside a wall, a toy may not be held twice, and a candle can't be
   out with progress below 1. Task 9 validates 1,000 generated starts.
5. **One crashing episode killing the batch.** The generator must log the config and carry on. Task 11 tests this
   with an injected failure.

---

## File structure

```
game/src/sim/
  rules.js         + GIANT (yell, cooldowns), EMO (emotion constants)
  rng.js           NEW  seeded streams: rng(seed), hash(...)
  game.js          world: createGame, stepWorld(G, kidIn, giantIn, dt), step(G, kidIn, dt) (uses G.mind)
  body.js          NEW  the monster's body: movement caps, acts (door, bash, check, windup, lunge, recover, yell)
  tools.js         NEW  the giant's searchlight and hand, triggered by its controller
  senses.js        NEW  canSee, hearing, pings, alerts → observe(G)
  mind/
    index.js       NEW  createMind(G, persona), think(G, mind, obs, dt) → giant input; MODES enum
    nav.js         NEW  steer / A* / snap / randomSpot / ambush helpers (moved out of monster.js)
    classic.js     NEW  today's brain, ported to observations + controller
    belief.js      NEW  up to 4 hypotheses of where the kid is
    emotion.js     NEW  appraisal → anger, frustration, confidence, fury, spent
    personas.js    NEW  the 5 archetypes + jitter
    tactics.js     NEW  utility scoring, softmax choice, tactic executors
  monster.js       DELETED once classic.js and body.js own its parts
  schema.js        NEW  state → numbers (encode, fields, sizes)
  episode.js       NEW  configFor(batch, i), createEpisode(config), runEpisode(config, {record})
  bots/kid.js      NEW  kid bot: styles, skill, chaos
  bots/start.js    NEW  random valid mid-game starts
  coverage.js      NEW  case-id counters from events and state
game/src/main.js   top view at start; ?watch=batch:i viewer
game/src/render/view.js  intro fly-down; no Z toggle
game/test/*.test.mjs     node:test suites (scenarios, determinism, schema, body, emotion, belief, starts)
game/tools/sim.mjs       probe: per persona, kid style; stuck and timeout rates
game/tools/gen.mjs       NEW  worker pool → data/<batch>/shard-NNN/*
game/tools/coverage.mjs  NEW  sums a batch's coverage, flags gaps
game/tools/feasibility/  NEW  learnability spike (export.mjs, spike.py)
```

---

### Task 1: Learnability spike, and correct the numbers in the docs

**Files:**
- Create: `game/tools/feasibility/export.mjs`, `game/tools/feasibility/spike.py`
- Modify: `docs/superpowers/specs/2026-10-10-gamenet-training-design.md` (§7), `game/pitch.html` (piece count,
  size)

**Interfaces:**
- Produces: `data/spike/*.f32` (gitignored) and a printed verdict. Nothing else depends on it.

- [ ] **Step 1: Export transitions from today's game.**
  - Run 300 games with the probe's kid bot (copy `kidBot` from `tools/sim.mjs` into `export.mjs`).
  - Every 3rd tick write one row to `data/spike/rows.f32`:
    - kid x, z, vx, vz;
    - the input (mx, mz, creep, blow);
    - kid flags (crawl, blowing);
    - the 5 × 5 tile types around the kid (as ints);
    - the nearest lit candle's dx, dz and progress, and whether it is in line of sight;
    - and the same fields 3 ticks later.
  - Write the field count into `data/spike/meta.json`.
- [ ] **Step 2: Train in `spike.py`.**
  - Model: an MLP with 3 layers of 256, inputs embedded (tile types one-hot).
  - Targets:
    - kid Δx and Δz as 64-bin classification over ±0.2 m;
    - next progress (regression);
    - candle-out (binary).
  - Train for at most 10 minutes on the CPU with an 80/20 split.
- [ ] **Step 3: Measure on the test split.**
  - median |Δpos error|;
  - the share of predicted positions inside a kid-blocked tile (wall clipping);
  - candle-out F1.

  **Pass:** median error < 0.02 m, clipping < 0.5%, F1 > 0.95. Print a PASS or FAIL line per metric.
- [ ] **Step 4: Act on the result.**
  - **FAIL:** stop and report to the user with the numbers before any further task.
  - **PASS:** update spec §7 and the pitch page:
    - width 128, 6 layers, about 1.2 M parameters;
    - about 70 pieces (local 5 × 5 tiles per moving piece plus about 12 coarse map pieces);
    - about 23 ms per tick for 2 passes on the CPU.

  Add `data/` to `.gitignore`.
- [ ] **Step 5: Commit**: `feasibility: learnability spike (<verdict>), model sized to the measured budget`.

### Task 2: Test harness, and the top view only at the start

**Files:**
- Modify: `game/package.json` (`"test": "node --test test/"`), `game/src/render/view.js`, `game/src/main.js`,
  `game/index.html` (drop the Z hint)
- Create: `game/test/smoke.test.mjs`

**Interfaces:**
- Produces: `npm test`; `view.intro()`, which starts the overview-then-fly-down.

- [ ] **Step 1: Write a failing smoke test.**
  ```js
  import { test } from 'node:test'; import assert from 'node:assert/strict';
  import { parseLevel } from '../src/sim/level.js'; import { createGame, step } from '../src/sim/game.js';
  test('a game runs 10 s of standing still without ending', () => {
    const G = createGame(parseLevel(), 1);
    for (let i = 0; i < 600; i++) step(G, { mx: 0, mz: 0 }, 1 / 60);
    assert.equal(G.state, 'play'); assert.ok(G.t > 9.9);
  });
  ```
- [ ] **Step 2: Wire up the runner.** Add the `test` script, then run `npm test` and confirm it passes (this test
  pins today's behaviour).
- [ ] **Step 3: View: intro mode.**
  - On `begin()`, set `mode = 'table'` and zoom 0.15 for 3 s.
  - Then fly to the `'in'` camera over 1.2 s: lerp `camera.position` and the look target, eased.
  - Remove `toggleMode` and the `KeyZ` listener in `main.js`, and the "Z: step back to the table" line in
    `index.html`.
  - Keep `setZoom` for `tools/shot.py`'s `zoom=`.
- [ ] **Step 4: Verify in the browser** with `python tools/shot.py <out> a=wait=1 b=wait=5`:
  - `a` shows the whole board;
  - `b` shows the kid view;
  - pressing Z does nothing.
- [ ] **Step 5: Commit**: `Candles: the top view shows only at the start, then the camera flies down to the kid`.

### Task 3: The world takes two controllers (body, tools, senses)

**Files:**
- Create: `game/src/sim/rng.js`, `body.js`, `tools.js`, `senses.js`
- Modify: `game/src/sim/game.js`, `rules.js`
- Test: `game/test/body.test.mjs`

**Interfaces:**
- Kid input `KI`: `{ mx, mz, creep, blow, use, throw }`, as today.
- Giant input `GI`:
  - `{ mx, mz, run, lunge, use, bash, yell, light, reach, ax, az, lx, lz, why }`;
  - the stick has length ≤ 1, and full tilt is `MON.hunt`;
  - the buttons are booleans, and only the edge matters for presses;
  - `ax, az` is the aim for light and reach, and `lx, lz` is the right stick that steers the searchlight's drift;
  - `why` is an optional string copied onto the yell event.
- `export const IDLE_GI` is all zero.
- `stepWorld(G, ki, gi, dt)` runs, in order:
  1. kid;
  2. items;
  3. `stepTools(G, gi, dt)`;
  4. `stepBody(G, gi, dt)`;
  5. catch.

  Senses run inside `stepBody` before acting.
- `step(G, ki, dt)` computes `gi = G.mind ? think(G, G.mind, observe(G), dt) : IDLE_GI`, then calls
  `stepWorld`. Callers of `step` keep working.
- `observe(G)` returns:
  - `t`, `self` (`x, z, hx, hz, act, actT, speed`);
  - `sees`, and `kid` (`{ x, z, vx, vz }` only when `sees`);
  - `heard` (`[{ x, z, kind }]`), `ping` (`{ x, z } | null`), `alerts` (`[{ x, z, kind }]`);
  - `hideSeen` (a wardrobe id, or -1);
  - `candles` (`[{ id, x, z, lit }]`), `doors` (`[{ id, x, z, open }]`);
  - `canLight`, `canReach`, `beam` (`{ state, x, z, spotted }`), `reach` (`{ state }`), `candlesOut`.
- The world computes pings, hearing jitter and the searchlight-spotted alert with `G.rand` (the world stream).
- Monster body fields on `G.monster`:
  - `x, z, vx, vz, hx, hz, speed`;
  - `act` (`'none'|'door'|'bash'|'check'|'windup'|'lunge'|'recover'|'yell'`), `actT`, `actId`;
  - `awake`, `sightT`, `lust`, `rage`, `cool`, `yellCool`, `stuckT`, `stride`.
- New events:
  - `blowNothing`, `useNothing`, `shutRefused`, `unhideRefused`, `throwRefused`;
  - `yell { why }`;
  - `caught { by: 'touch'|'found'|'grab' }`.

- [ ] **Step 1: Write the failing body tests** in `body.test.mjs`, using a helper `scene(opts)` that builds a game and
  places the kid and monster (`G.monster.awake = true`):
  - full-tilt stick without run → speed ≤ 3.0 + 1e-6;
  - with run → ≤ 3.55;
  - with `rage > 0` → ≤ 3.80;
  - lunge press → windup 0.25 s at ≤ 1.775 m/s, then 0.4 s at 5.4, then recover 1.5 s at ≤ half chase;
  - lunge pressed during recover → ignored;
  - use within 1.35 m facing a shut door → `door` act, opened after 0.6 s (± one tick);
  - bash → 0.9 s, and the event has `bash: true`;
  - use at a wardrobe front with the kid inside → `caught { by: 'found' }` after 0.7 s;
  - yell → stops for 0.8 s, emits `yell`; a second yell within 6 s is ignored;
  - light pressed before its cooldown → nothing;
  - after it → `beam` warn at the aim;
  - reach with fewer than 2 candles out → nothing.
- [ ] **Step 2: Run** `npm test` and confirm the body tests fail.
- [ ] **Step 3: Implement.**
  - **`rng.js`:** move `rng` from `game.js` and add
    `hash(...ints) → uint32` (`Math.imul` mixing) for stream seeds.
  - **`body.js`:** take today's `move`, `doors`, and the lunge, windup and recover logic from `monster.js`, but
    driven by `gi`:
    - speed cap: `run ? MON.chase + lust + (rage > 0 ? MON.rageBoost : 0) : MON.hunt × |stick|`;
    - bloodlust from `sightT`, which grows while `canSee` and resets after 1 s unseen or when the kid enters a
      passage;
    - asleep until `t > MON.wake` or an alert.
  - **`tools.js`:** today's `stepBeam` and `stepReach` state machines, started by `gi.light` and `gi.reach` (aim
    clamped as today):
    - availability windows: first at `BEAM.first`, and `REACH.first` after the 2nd candle out;
    - after each use, the cooldown is the old interval × 0.8;
    - the drift steers toward `(lx, lz)` instead of toward the kid.
  - **`senses.js`:** move `canSee`, the hearing loop, pings and alerts out of `monster.js`, returning the
    observation above.
  - **`rules.js`:** add `GIANT = { yell: 0.8, yellEvery: 6, cool: 0.8 }`.
  - **`game.js`:** `stepWorld` and `step` as above; emit the refusal events where the code already returns early
    (`use` with nothing near, the shut-refused branch, `leaveWardrobe`'s refusal, the throw guard, and blow with no
    candle near).
- [ ] **Step 4: Run** `npm test`. Body tests pass; the smoke test still passes with `G.mind` unset (the monster
  stays idle).
- [ ] **Step 5: Commit**: `sim: the world takes two controllers; the monster's body, the giant's tools and its senses
  are their own modules`.

### Task 4: Classic: today's brain on the controller

**Files:**
- Create: `game/src/sim/mind/index.js`, `mind/nav.js`, `mind/classic.js`
- Delete: `game/src/sim/monster.js`
- Modify: `game/src/main.js`, `game/tools/sim.mjs`, `game/tools/check.mjs` (if they import `monster.js`), and the
  render code that reads `M.mode` (`render/actors.js`, `render/giant.js`, `audio.js`)
- Test: `game/test/classic.test.mjs`

**Interfaces:**
- `createMind(G, persona = { type: 'classic' }, seed)` → mind state; the game sets `G.mind`.
- `think(G, mind, obs, dt)` → `GI`.
- `MODES = ['idle','patrol','guard','hunt','search','chase','ambush','intercept','check','breather','fury','spent']`.
- Every mind exposes the same fields for the schema:
  - `mode`, `modeT`, `target {x,z}`, `lastSeen {x,z,t}`;
  - `anger`, `frustration`, `confidence`, `furyT`, `spentT`, `menace`;
  - `beliefs` (up to 4 `{x,z,spread,w}`);
  - `rand`.
- Render compatibility: `G.monster.mode` becomes a getter-free plain field that `body.js` sets every tick: the
  body's `act` if it isn't `'none'`, else `mind.mode`. So `actors.js`, `giant.js` and `audio.js` keep reading
  `M.mode` (values `windup`, `lunge`, `recover` still occur).

- [ ] **Step 1: Write the failing tests.**
  - With Classic, a monster that sees a kid 6 m away in the open enters `chase` within 0.2 s and closes the distance.
  - A kid entering the same vent 3 times in one chase → mode `ambush` with a target at a passage exit (B5).
  - A candle out → `hunt` toward that candle (C4 alert).
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Port.**
  - Move `steer`, `aim`, `randomSpot`, `snap`, `ambushSpot`, `wardrobeNear` and `pickGuard` to `nav.js`. They take
    `(G, mind)` and write `mind.wantX`/`wantZ`.
  - In `classic.js`, re-express `stepMonster`'s switch over modes using `obs` (never `G.kid` directly). It outputs:
    - stick = want ÷ `MON.hunt`;
    - `run` in chase and ambush;
    - `lunge` when the old windup condition holds;
    - `use` or `bash` when `doorAhead(G, self, want)` finds a shut door (bash only in chase, as today);
    - `use` at a wardrobe front in `check`;
    - light and reach on the old schedule, aimed with the old random offsets from its last ping (it no longer sees the
      true kid position).
  - Emotions stay 0. `beliefs[0]` = `lastHint`.
- [ ] **Step 4: Run** `npm test` and `OMNI=1 npm run sim -- 60 1`. Wins and catches must stay within ±50% of today's
  probe numbers (7/60 wins). Record the numbers in the commit message.
- [ ] **Step 5: Play it in the browser** for 2 minutes; screenshot a chase with `tools/shot.py`.
- [ ] **Step 6: Commit**: `sim: Classic, today's monster brain, now plays through the giant's controller`.

### Task 5: Episodes and exact replays

**Files:**
- Create: `game/src/sim/episode.js`
- Test: `game/test/determinism.test.mjs`

**Interfaces:**
- `configFor(batch: string, i: number)` → `{ id, seed, persona: { type, ...params }, kid: { style, skill }, start: 'fresh'|'mid', maxT: 300 }`.
  - It is deterministic from `hash(batch, i)`.
  - Until Tasks 8 and 9 land, the persona is always `classic` and the kid style always `probe`.
- `createEpisode(config)` → `{ G, kidBot }`, with three streams:
  - the world: `rng(seed)`;
  - the mind: `rng(hash(seed, 1))`;
  - the kid: `rng(hash(seed, 2))`.
- `runEpisode(config, { record = false, onRecord })` → `{ config, outcome, t, counts, hash }`.
  - `hash` is a uint32 over the rounded state every 60 ticks.
  - `onRecord(rowIndex, G, ki, gi, eventsSinceLastRecord)` is called every 3rd tick.
- Moves the probe's kid bot into `bots/kid.js` as style `probe` (Task 9 adds the rest). Its interface:
  `createKidBot(G, { style, skill }, rand)` → `(obs) → KI`, where `obs` is `observeKid(G)`: monster position (the
  eye over the walls), noises, candles, doors and items.

- [ ] **Step 1: Write the failing tests.**
  - `runEpisode(configFor('t', 3)).hash` is equal across two calls.
  - Configs 3 and 4 differ.
  - Changing only the kid's stream seed changes the hash while the first 4 s, before the monster wakes, still match.
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Implement** `episode.js` and `bots/kid.js` (style `probe`, ported from `tools/sim.mjs`, all randomness
  from the kid stream). Update `tools/sim.mjs` to use `runEpisode`.
- [ ] **Step 4: Run** `npm test`; it passes.
- [ ] **Step 5: Commit**: `sim: episodes from a config, with separate random streams, replay exactly`.

### Task 6: Schema, recorder, and the browser viewer

**Files:**
- Create: `game/src/sim/schema.js`
- Modify: `game/src/sim/episode.js` (`record`), `game/src/main.js` (`?watch=`)
- Test: `game/test/schema.test.mjs`

**Interfaces:**
- `TOKENS` is an ordered list of `{ kind, count, fields: [{ name, type: 'num'|'flag'|'cat', n? , scale? }] }`.
  - Kinds, in order: `game`, `kid`, `monster`, `mind`, `belief×4`, `candle×6`, `door×11`, `wardrobe×3`, `toy×7`,
    `squeak×5`, `passage×10`, `beam`, `hand`.
  - Categorical fields are one-hot.
  - Positions are divided by the map size; timers are divided by their maximum.
- `STATE_SIZE` is a number.
- `encode(G, out: Float32Array, offset)` writes `STATE_SIZE` numbers.
- `KI_SIZE = 6`; `encodeKI(ki, out, o)`.
- `GI_SIZE = 14`; `encodeGI(gi, out, o)`.
- `EVENT_TYPES` is an ordered array of strings; `eventId(type)`.
- `schemaJSON()` → a plain object (tokens, sizes, event types, level hash) for `schema.json`.
- `local5x5` and the coarse map pieces are model inputs computed at training time from positions plus the static map,
  so they are **not** stored per row.
- `decode` (numbers back into a game state for the renderer) is left to the training plan. Nothing in this plan
  consumes it.

- [ ] **Step 1: Write the failing tests.**
  - `encode` writes exactly `STATE_SIZE` finite numbers for 200 random states taken from a running episode.
  - Every flag field is 0 or 1, and every one-hot group sums to 1.
  - The kid's x field decodes back within 1e-3 (×`L.w`).
  - `schemaJSON()` round-trips through `JSON.stringify`.
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Implement** `schema.js` and recording in `runEpisode`:
  - preallocate `Float32Array`s that grow ×2 when full;
  - return `{ states, ki, gi, events: [[row, typeId, x, z, id], …], rows }`.
- [ ] **Step 4: The viewer.** `/?watch=<batch>:<i>` builds `configFor`, creates the episode, and plays it in the
  normal renderer:
  - the kid bot drives the kid instead of the keyboard;
  - speed is 1×, and `]` / `[` change it;
  - the HUD shows the persona, the kid style, the mind's mode and moods, and the running hash.

  Check that the hash at the end equals Node's (`node -e` printing `runEpisode(configFor(b, i)).hash`).
- [ ] **Step 5: Run** `npm test`; it passes. Watch one episode with `tools/shot.py`.
- [ ] **Step 6: Commit**: `data: the state schema, the recorder, and ?watch= to replay any episode in the browser`.

### Task 7: Belief and emotions

**Files:**
- Create: `game/src/sim/mind/belief.js`, `mind/emotion.js`
- Modify: `game/src/sim/rules.js` (`EMO`)
- Test: `game/test/mind.test.mjs`

**Interfaces:**
- `updateBelief(mind, obs, dt, { smart, L })` mutates `mind.beliefs` (≤ 4, weights sum to 1 when any):
  - a sighting → one hypothesis, spread 0.3;
  - a ping → added with spread 3;
  - a noise → added with spread 0.5 (1.5 for the kid's own noises);
  - hypotheses within 2 m merge (weighted);
  - spread grows by `KID.run × 0.6 × dt`, up to 12;
  - `smart > 0.5` also:
    - drifts each hypothesis 0.6 m/s toward the nearest lit candle;
    - multiplies the weight of any hypothesis in clear line of sight within 6 m and unseen by 0.2 each second
      (negative evidence).
- `appraise(mind, obs, ev, prev)` → `r`: the spec §4 table. `ev` is this tick's world events seen by the giant: its
  own act results, `candleOut`, `door` shut by the kid within 3 m ahead, lunge end without catch, `checkEmpty`, and
  the kid entering a passage while seen.
- `updateEmotion(mind, r, sharp, dt, persona)`:
  - anger += `sharp × (0.5 + temper)`; half-life `4 + 6 × patience` s;
  - frustration += `max(0, -r) × 0.8`, −= `max(0, r) × 0.5`; half-life `30 + 30 × patience` s;
  - confidence += `max(0, r)`; half-life 8 s;
  - fury starts when anger ≥ 0.75 and frustration ≥ 0.6 and fury, spent and the yell cooldown all allow: `furyT = 4`,
    then `spentT = 2.5`;
  - everything is clamped to [0, 1].
- `temperature(mind, persona) = persona.temp × (1 + 1.5 × frustration − 0.5 × confidence)`, clamped to [0.1, 3].

- [ ] **Step 1: Write the failing tests.**
  - A sighting collapses beliefs to one hypothesis at the kid.
  - Two pings 1 m apart merge.
  - Spread grows to 12 and stops.
  - Negative evidence: weight drops below 0.3 after 2 s unseen in view.
  - Anger after a candle out with temper 0.9 > temper 0.1.
  - Anger halves in 4 + 6 × patience s.
  - Fury fires only with both high, lasts 4 s, then spent for 2.5 s.
  - Temperature rises with frustration.
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Implement** both modules exactly as above. Put constants in `rules.js` `EMO`.
- [ ] **Step 4: Run** `npm test`; it passes.
- [ ] **Step 5: Commit**: `mind: belief hypotheses and emotions driven by a "how am I doing" signal`.

### Task 8: Tactics and the five personas

**Files:**
- Create: `game/src/sim/mind/personas.js`, `mind/tactics.js`
- Modify: `mind/index.js`, `game/tools/sim.mjs` (`PERSONA=` and a per-persona table: win, caught, timeout, stuck %,
  yells per game, fury per game)
- Test: `game/test/tactics.test.mjs`

**Interfaces:**
- `PERSONAS` is `{ pathfinder, brute, stalker, hound, warden }`, each with
  `{ smart, aggression, patience, ears, guard, thorough, temper, tools, temp }`. The values are the spec table, and
  `temp` is 0.6.
- `samplePersona(type, rand)` → params, jittered by `N(0, 0.08)` and clipped to [0, 1].
- `TACTICS` is a list of `{ name, mode, score(ctx) → number | -Infinity, act(ctx) → partial GI }`:
  - `chase`, `hunt`, `search`, `intercept`, `ambushGap`, `guard`, `wander`, `check`, `breather`, `useLight`,
    `useHand`;
  - `ctx` is `{ G, mind, obs, persona, best }`, where `best` is the heaviest belief.
- `choose(ctx)`:
  - re-scores every 0.5 s or on an event;
  - the current tactic gets +0.5;
  - draws by softmax at `temperature`.
- **Yell** fires when anger crosses 0.7 upward and `yellCool` allows, with `why` = the last sharp cause.
- **Fury:**
  - forces `chase` toward the best belief with `run`;
  - forces `bash` at doors;
  - ignores `heard.kind === 'land'` (lures).
- **Spent** caps the stick at 0.73 (patrol speed) with no run.
- Mind events are emitted as world events: `mood { anger, frustration }` when either crosses 0.25, 0.5 or 0.75, and
  `tactic { name, why }` on every switch.

- [ ] **Step 1: Write the failing tests.**
  - `choose` never returns a tactic whose score is `-Infinity`.
  - At temperature 0.1, the best tactic wins ≥ 95% of 1,000 draws.
  - At temperature 3, the second-best wins ≥ 20%.
  - Fury ignores a toy landing 3 m away.
  - Stalker's `intercept` scores above Pathfinder's in the same situation.
  - A Hound is lured by a landing 10 m away (hunts it); a Warden with a lit candle nearby is not (keeps guarding)
    at the same seed.
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Implement** the tactics, reusing `nav.js` (`steer`, `ambushSpot`, `wardrobeNear`, `pickGuard`).
  - Scores follow the spec §4 notes:
    - `intercept` = `smart × (0.5 + frustration)` when a lit candle is nearer the best belief than 6 m;
    - `useLight` = `tools × min(1, spread / 6) × (0.5 + frustration)` when `canLight`.
  - Personas only change weights and thresholds:
    - lunge range `1.6 + 0.8 × aggression`;
    - run when the best belief is younger than `2 + 4 × aggression` s;
    - wardrobe check chance `0.2 + 0.5 × thorough`;
    - menace limit `15 + 20 × patience`;
    - noise trust from `ears`.
- [ ] **Step 4: Balance.** Run `npm run sim -- 60 1` per persona with the mid-skill bot (style `probe` until Task 9).
  Tune only persona thresholds until every persona lands in 5–25% wins and stuck < 2%. Paste the table into the
  commit.
- [ ] **Step 5: Watch** one game per persona with `?watch=` and confirm they look different. Screenshot each.
- [ ] **Step 6: Commit**: `mind: five monster personas choosing tactics by mood, with yells and fury`.

### Task 9: Kid bots and mid-game starts

**Files:**
- Modify: `game/src/sim/bots/kid.js`
- Create: `game/src/sim/bots/start.js`
- Test: `game/test/kid.test.mjs`, `game/test/start.test.mjs`

**Interfaces:**
- `createKidBot(G, { style, skill }, rand)`, where `style` is one of `sneaker`, `sprinter`, `hider`, `trickster`,
  `greedy`, `chaos`, `probe`.
- **Goals:** `blow(c)`, `flee`, `hide(w)`, `shutBehind(d)`, `lure`, `creepPast`, `wait`.
  - Scores use the style's weights.
  - The chosen goal is replanned every `0.25 + (1 − skill) × 0.3` s.
  - The monster's position is seen with a delay of `0.1 + (1 − skill) × 0.3` s.
- **Mistakes:**
  - stick wobble `N(0, 0.15 × (1 − skill))`;
  - a random button with probability `0.01 + 0.02 × (1 − skill)` per decision.
- **Chaos:** a random stick held 0.3–1.5 s, and random buttons with probability 0.05 per decision.
- `randomStart(G, rand)` mutates a fresh game into a valid mid-game state:
  - 0–5 candles out, with the rest at progress 0–0.8;
  - the kid on a kid-walkable tile, and the monster on a monster-walkable tile with path distance ≥ 8;
  - 30% of doors flipped (never shut on anyone);
  - toys moved to random floor tiles, with at most one held by the kid;
  - emotions uniform in [0, 0.6];
  - searchlight and hand idle with random cooldowns;
  - the mind's beliefs seeded with a ping;
  - `G.t` set to 60–200 s.
- `configFor` now draws:
  - the persona type uniformly from the five;
  - style chaos with 5% probability, else uniform over the five play styles;
  - skill ~ U(0.2, 1);
  - start `mid` with 30% probability.

- [ ] **Step 1: Write the failing tests.**
  - 1,000 `randomStart`s are all valid: nobody in a blocked tile, no toy held twice, an out candle has progress ≥ 1,
    `candlesOut` matches, and the monster's path distance ≥ 8.
  - Each style finishes 20 games (won or caught) with a timeout rate < 30%.
  - A Hider uses a wardrobe at least once in 20 games; a Trickster throws at least once.
- [ ] **Step 2: Run** and confirm the tests fail.
- [ ] **Step 3: Implement.** Port the probe's flee and candle logic as the base, then add hide, shut-behind, lure,
  creep-past and the beam/hand cover reactions.
- [ ] **Step 4: Run** `npm test` and the per-persona probe with style `sneaker`, skill 0.6 (the mid-skill bot).
  Re-check the balance band; re-tune persona thresholds if needed.
- [ ] **Step 5: Commit**: `bots: kid styles with skill and mistakes, chaos kids, and random mid-game starts`.

### Task 10: Rule scenarios and coverage counters

**Files:**
- Create: `game/src/sim/coverage.js`, `game/test/scenarios.test.mjs`
- Modify: `game/src/sim/episode.js` (counts), `docs/mechanics.md` (sections 6, 7, 9 and 10 for the controller,
  personas, yell, fury, and refusals)

**Interfaces:**
- `CASES` is a list of `{ id, detect(G, events, ki, gi) → count }`, covering every id in `docs/mechanics.md`.
  - Event-based ids map from event types: C4 ← `candleOut`, D5 ← `doorTry`, W4 ← `checkOpen`, N2 ← `creak`,
    X1 ← `caught{by:touch}`, and so on.
  - State-based ids count ticks: K1 running, K2 creeping, K3 crawling, and so on.
- `countCases(G, events, ki, gi, counts)` adds to `counts`; `runEpisode` returns `counts`.

- [ ] **Step 1: Write the scenarios** in `scenarios.test.mjs`, one `test('<id> …')` per case id. Each builds a
  small `scene`, feeds a short input script, and asserts the outcome named in `docs/mechanics.md`. Examples:
  - **C2:** blow 1.0 s, let go 1 s, blow 0.55 s → out.
  - **D3:** a toy in the doorway → `shutRefused`.
  - **W2:** the monster 1.2 m from the front → `unhideRefused`.
  - **X3:** the monster adjacent to the kid in a vent for 3 s → still playing.
  - **H3:** under a table when the hand lands → not caught.
- [ ] **Step 2: Run** `npm test`. Every scenario passes (the rules exist already). A failure means the doc or the
  code is wrong; fix whichever is wrong and note it in the commit.
- [ ] **Step 3: Implement** `coverage.js`, then add a test that a 60 s episode yields nonzero counts for K1 and C1.
- [ ] **Step 4: Update** the four mechanics sections to match the new world.
- [ ] **Step 5: Commit**: `tests: a scenario for every rule, and counters for every case id`.

### Task 11: The generator, and v0

**Files:**
- Create: `game/tools/gen.mjs`, `game/tools/coverage.mjs`
- Modify: `game/package.json` (`"gen"`, `"coverage"` scripts), `README.md` (how to make and read data),
  `docs/design.md` (next stage → current)
- Test: `game/test/gen.test.mjs`

**Interfaces:**
- `node tools/gen.mjs <batch> <count> [workers=11]` writes `data/<batch>/` (repo root):
  - `schema.json`;
  - `shard-NNN/` per 256 episodes:
    - `episodes.jsonl` (config, outcome, t, counts, hash, rows, row offset);
    - `states.f16` (rows × `STATE_SIZE`);
    - `ki.f16`, `gi.f16`;
    - `events.jsonl` (one line per episode).
  - A failed episode writes `errors.jsonl` (config, stack) and is skipped.
- `node tools/coverage.mjs <batch>` prints:
  - per case id: count, target 1,000, OK or LOW;
  - per persona: win, caught and timeout rates;
  - the yell and fury rates.

  It exits with code 1 if any case is LOW.

- [ ] **Step 1: Write the failing test.** `gen` with 6 episodes and 2 workers into a temp dir, with one config forced
  to throw (`process.env.GEN_FAIL=2`), produces:
  - 5 episodes and 1 error line;
  - row counts matching the file sizes (`states.f16` bytes = rows × `STATE_SIZE` × 2).
- [ ] **Step 2: Run** and confirm the test fails.
- [ ] **Step 3: Implement** the worker pool (a `worker_threads` worker runs `runEpisode` with recording and posts
  transferable buffers; the main thread writes the shards) and `coverage.mjs`.
- [ ] **Step 4: Run** `npm test`; it passes.
- [ ] **Step 5: Make v0.**
  - Run `node tools/gen.mjs v0 2000`, then `node tools/coverage.mjs v0`.
  - If any case is LOW, raise the mid-start or chaos share, or add a style weight, and regenerate. Note the change.
  - Spot-check 3 random episodes with `?watch=v0:<i>`: hashes match, and the behaviour looks right.
- [ ] **Step 6: Docs.** Add to the README a "Making data" section: commands, folder layout, how to load with numpy:

  ```python
  import json, numpy as np
  s = json.load(open('data/v0/schema.json'))
  X = np.fromfile('data/v0/shard-000/states.f16', np.float16).reshape(-1, s['stateSize'])
  ```

  Update `docs/design.md`'s stage note.
- [ ] **Step 7: Commit**: `data: the generator, coverage report and the first 2,000-game dataset (v0)`. The data
  itself is not committed.
