# 01 — The data twin

Status: **v1, written 2026-10-07 from the built prototype** (`spike/walk/`). It's the bridge between the hand-written game and the models. The next steps (the engine that combines game state with per-entity behaviours, the datasets, the models) are to be designed together with the user. This doc only pins down *what exists and how it flows*.

## 1. What "data twin" means here

Every thing in the world is a small machine. On each world tick (12 per second) it **reads** some state, makes **random draws** governed by the rulebook, **writes** its new state and **announces** events. The twin is that description written out as data: one stream per thing, recorded tick by tick from real play. Later, each stream becomes the training data for that thing's model, and the game state stream becomes the hub model's data. That's the napkin sketch with numbers.

```
input (keys, mouse) ─► PLAYER ─┐
                               ▼
         ┌──────────── GAME STATE  S ────────────┐   (state.js: player, hand, wind, mist, dread, dropped, …)
         │   ▲     ▲      ▲      ▲      ▲        │
         ▼   │     │      │      │      │        ▼
      PETALS FIELD ENTITY MIST  WORLD (trees, bunnies, swing, leaves, birds)
         │     │      │      │      │
         └─────┴──────┴──────┴──────┴──► EVENTS ─► voice · sound · screen effects · twin recorder
                                     └─► RENDER (pins → angles → painted paper)
```

The rulebook is `spike/walk/src/rules.js`, and every probability below is named there. Ticks are fixed at `dt = 1/12 s`. Distances are in metres, angles in radians. The camera looks along `(-sin yaw, -cos yaw)`, and `viewAngle = 0` means dead ahead.

## 2. The things, one card each

### Player (the boy)
- **State:** `x, z, yaw, pitch, vx, vz, bob, walk, sprint, reaching`.
- **Reads:** input (WASD, Shift, mouse, reach, drop) and solids (trees and props; collision pushes him out).
- **Writes:** position and velocity (eased toward the input, at `walk` 2.4 or `sprint` 4.4 m/s).
- **Random draws:** none. The player is the one deterministic thing; their *choices* are the input stream.
- **Render:** camera, plus hands (rest/walk/sprint/reach blend; 5 finger angles per hand on spring pins).

### Hand (petals pinned to the back of the left hand)
- **State:** `held = [colour…]`, max 12.
- **Writes:** grows on `petalCaught`, shrinks on `petalDropped`, empties on `petalsReleased` (bloom) and on `woke` (after being caught).

### Petals (stray colour)
- **State per petal:** `kind ∈ {ambient, dropped, rise, fly, collect}`, `x, y, z`, `colour ∈ 0..4`, `life`, `age`, velocity and spin.
- **Reads:** player position, yaw and reaching; wind; `held.length`.
- **Random draws:**
  - Spawn timer `petals.spawnEvery`.
  - Spawn angle within `±spawnCone` of yaw, distance `spawnDist`, height `spawnHeight`, colour, life `petals.life`, spin.
- **Rules:**
  - At most `maxAmbient` strays.
  - Caught if within `catchRadius` of the eye, or within `reachRadius` and `reachCone` while reaching.
  - A dropped petal can't be re-caught for `dropCatchDelay`.
- **Events:** `petalCaught{colour, held, reached}`, `petalDropped{colour, held}`, `dropEmpty`, `petalsReleased{n}`.

### Field (the colour)
- **State:** `phase ∈ {idle, field, held, dissolving, cooldown}`, centre `x, z`, `age`, `cool`, `given`, `reachChance`.
- **Reads:** `held.length`; player position and reaching.
- **Random draws:**
  - Bloom is a Poisson hazard `h(n) = min(hazardCap, hazardBase + hazardPerPetal·n)` once `n ≥ minHeld` and the cooldown is over.
  - Flower layout: positions, kinds, colours, sizes, pop order.
  - **The reach roll:** one draw against `reachChance = min(chanceCap, chancePerPetal·given)`, made when the player first comes within `dissolveDist`, or within `reachDist` while reaching.
- **Events:** `bloom{given, reachChance, x, z}`, `reached{given, chance}`, `dissolve`, `fieldGone`.

### Entity (the double-sided paper card)
- **State:** `state`, `face ∈ {front, back}`, `visible`, `x, z`, `exposure`, `level`, `presence`, `timer`.
- **Pose (its pins):** `upperArm, forearm, hand, head, melt, thighL, shinL, thighR, shinR`, plus `lean` and `flip` (body scale: 1 = front, −1 = back, in between = mid-flip).
- **Reads:** player position and yaw (distance `d`, view angle `da`); trees in view (for hiding); open ground; mist (its wait timer runs `1 + mist` times faster); `S.dropped`.
- **State machine:**

| from | when | to | random draws |
|---|---|---|---|
| wait | timer ≤ 0 | peek / wave / behind | kind by weights `entity.kinds`; tree, side, distance |
| peek | looked at for `lookToNotice` | duck, or **emerge** if `exposure ≥ exposureToTurn` and roll `turnChance` | the roll |
| peek | player within 7 m / 26 s unseen | vanish | — |
| duck | 0.4 s | wait (`level+1`) | next timer `entity.wait` |
| emerge | 2 s | flip → hunt | — |
| hunt | lunge timer | hunt (lunge) | interval `lungeEvery` (or `lungeEveryWatched` while watched, then lunge only with `lungeWhileWatched`); distance `lungeDist·(1+lungeGrowth·t)`; heading jitter; 15% dart to cover; a new random pose on every pin |
| hunt | petal dropped during this hunt | toPetal → flip → **remember** | how long it remembers: `distractTime` |
| hunt | `d < catchDist` | caught | — |
| hunt | `d > giveUpDist` or `t > huntMax` | vanish | — |
| wave | close / looked away / 35 s | vanish | — |
| behind | seen 1.5 s / close / 30 s | vanish | — |

- **Events:** `peek{exposure, d}`, `peekSeen{exposure}`, `emerge`, `turned`, `lunge{d}`, `distracted{colour}`, `remember{colour}`, `caught`, `wave`, `waveSeen`, `behind`, `behindSeen`, `entityVanish{why}`.
- **Effects:**
  - `presence` → `S.dread`, which darkens and closes the fog, draws torn screen edges, raises the drone and the pin rattle, silences the birds, makes bunnies flee and the swing swing harder.
  - `shake` while hunting.
  - Ink decals at every lunge.

### Mist
- **State:** `on`, `timer`, `S.mist` (eased toward `mistTarget + slow base`).
- **Random draws:** time between events `mist.every`, duration `mist.lasts`, bank placement.
- **Events:** `mistIn`, `mistOut`.
- **Writes:** fog near/far (`farClear → farMist`) and the entity's haste.

### World (scenery)
- **Chunks** are deterministic per `(i, j)` from a seeded hash:
  - Biome: clearing 18%, grove 32%, forest 50%.
  - Tree count, positions and variants; props and their counts; bushes, grass; bunny chance.
  - A clearing gets one scene (pond, bench, swing or signpost) and a shaft of light.
- **Per tick:**
  - Canopies sway on their pins (sinusoid plus gusts × wind).
  - The swing swings `0.18 + 0.25·dread`.
  - Bunnies wander, and flee within 6 m or when `dread > 0.5`.
  - Leaves fall from nearby canopies.
  - Birds circle and flap.
- These are the cheapest models to learn and the first to try.

### Derived (not learned, just listeners)
- **Voice** (`dialogue.js`): a line pool per event.
- **Sound** (`audio.js`): calm/dread beds crossfaded by `dread`; mist ambience by `mist`; SFX per event.
- **Screen effects** (`fx.js`): edges by `dread`; crumple on `caught`; colour flood on `reached`.

## 3. The recording (what a dataset row looks like)

Run the prototype with `?record` (or with `?auto&record` hands-free) and press **F9** to download a `.jsonl` file: one line per tick. Each tick's events are filed under the tick they happened in.

```json
{"t": 83.25,
 "input":  {"reaching": true, "sprint": 0, "moving": true},
 "player": {"x": 4.12, "z": -96.3, "yaw": 0.412, "pitch": -0.02, "vx": -0.9, "vz": -2.2},
 "hand":   [0, 3, 1, 4, 2, 2],
 "world":  {"mist": 0.71, "dread": 0.12, "wind": 0.64, "windAng": 1.2, "biome": "grove"},
 "field":  {"phase": "idle", "x": 0, "z": 0, "age": 0, "cool": 0, "given": 0, "reachChance": 0, "hazard": 0.04},
 "entity": {"state": "peek", "face": "front", "visible": true, "x": 9.4, "z": -104.1, "exposure": 2, "level": 3,
            "presence": 0.42, "timer": 0,
            "pose": {"upperArm": -1.2, "forearm": 2.75, "hand": 0.35, "head": -0.53, "melt": 0.02,
                     "thighL": 0, "shinL": 0, "thighR": 0, "shinR": 0, "lean": -0.34, "flip": 1}},
 "petals":  [[0, 6.1, 2.3, -101.2, 3], [1, 4.4, 0.03, -95.1, 2]],
 "bunnies": [[12.3, -90.2, 0]],
 "events":  [{"t": 83.25, "type": "petalCaught", "colour": 2, "held": 6, "reached": true}]}
```

`petals` rows are `[kind, x, y, z, colour]` with kind codes `0 ambient, 1 dropped, 2 rise, 3 fly, 4 collect`. Petals and bunnies are listed only within 32 m of the player.

**A real sample:** `research/data/twin_sample_90s.jsonl` holds 90 s of hands-free play (`?auto&record` with reach held): 1,079 ticks, about 1 MB. It covers 5 petals caught, one bloom and dissolve, the entity peeking and standing behind you. That's roughly **0.7 MB per minute** of play before compression.

**Per-thing streams fall straight out of this:**

| Stream | Columns |
|---|---|
| player | `input` + `player` |
| hand | `hand` + petal events |
| petals | the `petals` rows + catch events |
| field | `field` + bloom/reach events |
| entity | `entity` (+ pose) + entity events, with the player's relative position and view angle computed from `player` |
| mist | `world.mist` + mist events |
| the hub | the whole line |

## 4. Gaps to close before generating datasets (to discuss)
1. **Seeded randomness.** Chunks are seeded, but every other draw uses `Math.random()`. For reproducible datasets each system needs its own seeded RNG, so that one run can be replayed exactly.
2. **Headless simulation.** Rules are tangled with rendering: the entity's pose lives on its rig, petals on meshes. A data-generation engine should step the rules without drawing, then render from state. That is the "engine" we design next, and it is also what lets the models replace the rules one by one.
3. **Player agents.** Right now there's `?auto` (walk and drift) only. Datasets need scripted and random agents: wander, chase petals, flee the entity, drop petals, stand still, turn around.
4. **What the hub model sees.** Decide what's state (learned and carried) versus what's derived (recomputed): for example `dread` is derived from the entity, `viewAngle` from the player.
5. **Event versus state.** Some facts exist only as events, like the reach roll result. Decide which of them become state fields.


## 5. Twin v2: the school (2026-10-08)

The school engine (`engine/`) closes gaps 1-3 of §4:
- **Seeded randomness.** Every draw comes from a named stream (`engine/rng.js`), and a test forbids `Math.random`.
- **Headless stepping.** The rules run in Node with no renderer.
- **Player agents.** There are two scripted agents.

The twin is filled from the engine's own state `S` (`engine/twin.js`), never from meshes.

**Recording:**
- **Headless:** `node engine/sim.js --seed 7 --agent wander|lesson --minutes 10 --out night.jsonl`. The same seed and agent give a byte-identical file; `engine/test/twin.test.js` checks this. Two minutes of night simulate in about a second.
- **In the browser:** open `localhost:5182/?record` and press **F9** to download.
- **Rate:** one line every 5th engine step, so 12 lines per second.

**One line holds:**
- `t, tick, night, seed`
- `input`: move, look deltas, run, crouch, use, useHeld, drop, show
- `player`: position, floor, yaw/pitch, velocity, crouch/run, noise, carrying, seated, hidden, room, stairwell, target
- `held`: stars, pass, chalk, pages
- `clock`: minutes, bell
- `headmaster`: state, position, yaw, lights killed
- `rooms`: only the room you're in plus any running lesson. Each has kit, roll (lesson, teacher, twists, valuables), state, lesson state, students (position, paper, tracking, facing), teacher, visitor and board.
- `director`: next patrol, last roll, patrols
- `stairs`
- `detention`
- `layout`: entrances, chalk-pinned chunks
- `phase`
- `events`: everything since the last line

**Streams per module** (the training data for each model later):

| Module | Columns |
|---|---|
| player | `input` + `player` |
| Headmaster | `headmaster` + hm* events, with the player's relative position |
| each lesson | `rooms[id].lesson` + lesson events, per roll |
| director | `director` + roomRoll / hmArrive / forgot |
| clock | `clock` + clockMinute / bell |
| exit | `held.stars` + entranceAppears / homeTime / exitFail |

**Agents:**
- **`wander`** explores, peeks into rooms, and hides from the Headmaster.
- **`lesson`** finds unfinished classrooms and plays Hand In Your Work, Eyes On Your Own Paper and Story Time by their rules, slipping deliberately with p = 0.1.

In an 8-minute run, `lesson` completed 4 lessons of all three kinds, was caught by a visitor, served detention and walked on.
