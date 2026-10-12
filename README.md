# Candles · GameNet

![Candles](game/public/og.jpg)

**A small horror game, and a neural network that learned to be it.** Play at **[candles.shing.in](https://candles.shing.in)**.

You are a small kid in a dark house. Blow out the candle in every room. Something lives here: it is faster than you,
it hears you run, and across the table a giant is playing it with a controller, a searchlight and, when it gets
impatient, its hand.

The game was written as ordinary code. Bots then played it about forty thousand times, and a transformer was trained
on those games until it could run the house by itself. The site offers both:

| Mode | What runs the house | Needs |
|---|---|---|
| **Classic** | The rules in `game/src/sim`: walls, doors, candles, the giant's tools | any computer with a keyboard |
| **GameNet** | A 25 M-weight transformer, every 0.1 s, from your keys. No game rules run: if it says the door is open, it is open | WebGPU (Chrome or Edge on a computer), a 99 MB download once |

In both, the monster is the **nightmare**: a small network trained by reinforcement learning to hunt. It catches 97.5%
of held-out bot kids. It reaches under beds and into cracks and squeezes into the vents after you, slower than you
crawl. Winning is rare. That is intended.

## How GameNet works

```
 your keys ───────────┐
                      ├──▶  the world model  ──▶  the next 0.1 s  ──▶  drawn (three.js)
 the nightmare's ─────┘     (the house)              │
 buttons (its brain                                  │
 reads the model's row) ◀────────────────────────────┘   10 times a second, in a Web Worker
```

1. **The game** (`game/src/sim`) runs headless in Node. Every 50 ms of a game is a row of 311 numbers (the kid, the
   monster and its mind, candles, doors, toys, the searchlight, the hand) plus the inputs of both players.
2. **Bots play it.** Kid bots of five styles with varied skill play the monster minds; 30,000 games plus 8,000
   crawl-space and giant's-tools drills make the latest dataset.
3. **The world model** (`game/train`): a transformer (384 wide, 12 layers) over the row cut into pieces and the house's
   tiles. It predicts the next row from this one and both players' inputs. It is trained teacher-forced, then on its
   own rollouts so it stays stable when it runs on its own output, at 0.1 s a step.
4. **The nightmare** (`game/src/sim/mind/nightmare.js`, `game/train/rl`): a 2 × 256 policy picking goals (the kid,
   cutting it off, its fading guesses, a noise, a candle to guard, a wardrobe, a search) every 0.25 s, trained with PPO
   against a league of kid bots.
5. **The split** (`game/src/model/brain.js`): in GameNet the nightmare reads what the monster sees, hears and feels from
   the model's own row and presses its buttons, which go into the model like your keys do. The model is only the world.
6. **In the browser** (`game/src/model`): ONNX Runtime Web on WebGPU in a worker, with constrained decoding (no catch,
   win or relit candle the model's own world contradicts; bodies kept out of walls).

**Where it stands** (bot exams inside the model; full write-up in
[the training spec](docs/superpowers/specs/2026-10-11-gamenet-training-spec.md), section 13):
- The mechanics exam: 384 generated moments (every candle, door, wardrobe, toy, crawl space, the searchlight and the
  hand), each checked 3 times. The play model, `v5_M_s2u`, passes 303 of them every time.
- Inside the model the nightmare catches 35 of 40 bot kids.
- On an Intel Iris Xe laptop it runs at about three-quarters of real time.
- Weak spots: the searchlight and the hand inside the model often miss what the rules would do, and now and then the
  house slips. All the training took about $17 of rented RTX 4090 time.

## Controls

| | |
|---|---|
| WASD / arrows / stick | run |
| Shift | creep, quietly |
| E or Space (hold) | blow out a candle |
| E or Space (tap) | open and shut doors, hide in and leave wardrobes |
| Q | throw the toy you carry (it makes a noise where it lands) |
| mouse wheel | camera closer / further |
| Esc | pause, and the menu |
| M / H | sound / hints |

## Run it

```
cd game
npm install
npm run dev        # http://localhost:5190
```

`npm run build` writes `game/dist` (about 134 MB): the game, the audio, the play model and the runtime's files.

## Deploy

`game/dist` is static. The host must send two headers so the runtime can use threads:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **Vercel:** import the repo with **Root Directory `game`**. `game/vercel.json` sets the build, the headers and the
  caching.
- **Other hosts:** set the same two headers.
- **File sizes:** the largest file is the runtime's WebAssembly (26.8 MB). Cloudflare Pages caps files at 25 MiB, so
  use Vercel or Netlify, or another host without that cap.
- **The model:** it ships as `game/public/models/v5_M_s2u/play.json` plus four 24 MB parts
  (`node tools/ship_model.mjs NAME` makes them from a trained `packed_brain.onnx`). The browser keeps the parts by
  their md5, so a return visit skips the download.
- **Models hosted elsewhere:** build with `VITE_MODEL_BASE=https://…/models/`. That host must allow CORS.

## Repository

```
game/
  index.html, src/main.js     the site: first screen, the two modes, the game loop
  src/sim/                    the rules, no graphics (runs in Node): rules.js has every number, level.js the house
    mind/                     the monster minds: five coded personas, the learned nightmare
    bots/                     kid bots and mid-game starts
  src/render/, src/audio.js   three.js view, sound
  src/model/                  GameNet in the browser: worker.js (the model), brain.js (the nightmare inside it),
                              decode.js / layout.js (the row in and out), dream.js (the game side)
  train/                      the world model (model.py, train.py, data.py, export.py), RL (rl/), pod scripts (pod/)
  tools/                      data (gen.mjs, coverage.mjs), exams (dream_exam.mjs, mechanics/), sim.mjs, check.mjs,
                              ship_model.mjs, clips/ (videos of games)
  test/                       519 tests: every rule's scenario, the minds, the schema, the generator
  dream.html, review.html     research pages for local use: the models' videos and exams, and clips of what the
                              model learns from (their videos and the research models are not committed)
docs/
  design.md                   the game's design and the reasoning behind each mechanic
  mechanics.md                every rule as a case, each with a scenario in game/test/scenarios.test.mjs
  superpowers/specs/          the training design and the full training log, run by run
```

The earlier prototypes (forest, school, The Long Way Home) are kept under the git tag `archive/before-maze`.

## Tests and tools

```
cd game
npm test                         # 519 tests, about 10 s
SLOW=1 npm test                  # also plays 20 games per kid style (about 3 minutes)
npm run check                    # the house: every candle reachable, starts far apart, gaps cost the monster a detour
node tools/sim.mjs 60 1          # balance probe; env PERSONA=nightmare KID=sneaker SKILL=0.6 START=fresh
```

Dev links (they skip the first screen):
- `?persona=stalker|brute|hound|warden|pathfinder|classic|nightmare` picks the monster in the rules game.
- `?model=NAME` plays any model in `public/models`, and `&debug` shows its numbers.
- `?watch=v5:12` replays game 12 of batch v5 exactly, as the generator played it, with no data needed (`[` `]` change
  the speed).

## Making data and training

```
cd game
node tools/gen.mjs v5 3600       # bots play; writes data/v5/ at the repo root (see below)
node tools/coverage.mjs v5       # how often each rule happened; outcomes by monster, kid and start
```

`data/<batch>/shard-NNN/` holds:
- `episodes.jsonl`: one line per game: config, outcome, rule counts, row offsets;
- `states.f32`: the rows, `rows + 1` per game;
- `ki.f32` and `gi.f32`: the kid's and the giant's inputs;
- `events.jsonl`: every event with who and why.

`schema.json` describes the row.

```python
import json, numpy as np
d = 'data/v5'
s = json.load(open(f'{d}/schema.json'))
X = np.fromfile(f'{d}/shard-000/states.f32', np.float32).reshape(-1, s['stateSize'])
eps = [json.loads(l) for l in open(f'{d}/shard-000/episodes.jsonl')]
```

The exams (`tools/dream_exam.mjs`, `tools/mechanics/exam.mjs`, `--brain`) read a whole `packed_brain.onnx`; a clone
has the play model only in parts: `cat game/public/models/v5_M_s2u/packed_brain.onnx.{0,1,2,3} > game/public/models/v5_M_s2u/packed_brain.onnx`.

Training ran on rented GPUs with the scripts in `game/train/pod/` (`v5_run.sh` makes data v5 and trains the world;
`rl_v5.sh` trains the nightmare; `v4_exams.sh` runs both exams). `train/export.py` writes the ONNX graphs the browser
runs. The spec has every run, its numbers and its cost.

## Credits

Made by [Shreyash](https://shing.in) ([@ShreyashAtX](https://x.com/ShreyashAtX)).

Music by Kevin MacLeod (incompetech.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):
"Ossuary 6 - Air", "Spider Eyes", "SCP-x4x (Mind Leech)". Sounds from BigSoundBank, OpenGameArt and an 1890 Edison
talking doll (CC0 and public domain); every file and its source is listed in
[game/public/audio/CREDITS.md](game/public/audio/CREDITS.md).
