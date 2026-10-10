# GameNet

**Candles**: a small grey horror house on a board. Across the table, a giant plays the monster.

You are a small kid. Blow out the candle in the corner of every room. A monster hunts you. It is a little
faster than you, but only you fit through the vents, the cracks in the walls and the gaps under the beds.

## Run it

```
cd game
npm install
npm run dev        # http://localhost:5190
```

Controls:
- WASD or a gamepad to run, Shift to creep quietly;
- hold E or Space at a candle to blow it out;
- tap E or Space to open or shut doors, or to hide in and leave wardrobes;
- walk over a toy to pick it up, Q to throw it;
- the mouse wheel moves the camera closer or further (the whole board shows only for a moment at the start);
- R retries.

## Layout

- `game/src/sim/`: the rules, with no graphics (runs in Node). Every tunable number is in `rules.js`, and the maze is in `level.js`.
  - The world takes two controllers, the kid's and the giant's (`game.js`, `body.js`, `tools.js`); `senses.js` is all
    the monster may know.
  - `mind/`: the giant's minds (Classic, and the five personas with belief and moods).
  - `bots/`: kid bots and mid-game starts.
  - `episode.js`, `schema.js`, `coverage.js`: episodes, the row layout, the rule counters.
- `game/src/render/`: the three.js view.
- `game/src/audio.js`: synthesised sound.
- `game/tools/`: `check.mjs` (maze sanity), `sim.mjs` (headless balance probe), `gen.mjs` and `coverage.mjs` (data), `shot.py` (screenshots).
- `docs/design.md`: the design and the reasoning behind each mechanic.
- `docs/mechanics.md`: every rule as a case (C4, W3, ...), each with a scenario in `game/test/scenarios.test.mjs`.

The earlier prototypes (forest, school, The Long Way Home) are kept under the git tag `archive/before-maze`.

## Tests

```
cd game
npm test               # every rule's scenario, the world, the minds, the schema, the generator
SLOW=1 npm test        # also plays 20 games per kid style (about 3 minutes)
```

## Making data

Kid bots play the monster's minds headless, and every game is recorded (`docs/superpowers/specs/2026-10-10-gamenet-training-design.md`).

```
cd game
node tools/gen.mjs v0 2000          # about 6 minutes on 11 cores; writes data/v0/ at the repo root
node tools/coverage.mjs v0          # how often each rule happened, and outcomes by monster, kid and start
node tools/sim.mjs 60 1             # balance probe; env PERSONA=stalker KID=sneaker SKILL=0.6 START=fresh
```

Any episode replays exactly in the browser: `http://localhost:5190/?watch=v0:780` (`[` `]` change the speed,
`&persona=warden` swaps the monster).

`data/<batch>/`:
- `schema.json`: the row layout (pieces, their fields, input fields, event types).
- `errors.jsonl`: episodes that crashed (skipped).
- `shard-NNN/`, 256 episodes each:
  - `episodes.jsonl`: one line per episode: config, outcome, seconds, rows, replay hash, rule counts, `stateRow`,
    `inputRow`.
  - `states.f16`: float16 states. Each episode has `rows + 1` (its start, then after each 50 ms step).
  - `ki.f16`, `gi.f16`: the kid's and the giant's inputs, one row per step. Step r takes state r to state r + 1.
  - `events.jsonl`: per episode, `[row, type, x, z, id]` for every event (types in `schema.json`).

```python
import json, numpy as np
d = 'data/v0'
s = json.load(open(f'{d}/schema.json'))
X = np.fromfile(f'{d}/shard-000/states.f16', np.float16).reshape(-1, s['stateSize'])
K = np.fromfile(f'{d}/shard-000/ki.f16', np.float16).reshape(-1, len(s['kiFields']))
eps = [json.loads(l) for l in open(f'{d}/shard-000/episodes.jsonl')]
e = eps[0]; states = X[e['stateRow']: e['stateRow'] + e['rows'] + 1]; kid = K[e['inputRow']: e['inputRow'] + e['rows']]
```
