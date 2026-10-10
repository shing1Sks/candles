# GameNet: training design for Candles

Status: draft for review (2026-10-10). Every mechanic referred to by id (C4, W3, …) is defined in `docs/mechanics.md`.

## 1. What we are building

### What you asked for

- One main model *is* the game. Your input as the kid goes in; everything else comes out of it: the house, every
  mechanic (blow, and the candle goes out) and the monster.
- The monster comes in several types. All of them want to catch the kid, but they range from a dumb pathfinder to a
  smart hunter.
- The monster has emotions (anger, frustration, fury) that cause its odd moments, like stopping to yell. A feedback
  signal for "how am I doing" drives them.
- Randomness is reasonable, never wild.
- The world model must learn every mechanic and how both sides react to it. The kid ducks into a vent; the monster
  gets frustrated and works out a way round.
- Write every mechanic and every case down in one place (`docs/mechanics.md`).
- Then build the data.
- A side point: show the top view only at the start of a game, so it can't be used to cheat.

### What I am assuming (correct me)

- **Level of the model.** The main model predicts the game *state*, and the existing renderer and sound draw it.
  Predicting frames comes later, if at all, from the same recorded games.
- **Rules stay.** Today's mechanics and numbers stay. The only new things are the giant's controller, yells and fury
  (section 4).
- **One house** for now. The map is still fed to the model as an input, so more houses can come later.
- **Kid bots** exist only to make data; in the real game the kid is always you.
- **RL training** of monster policies is a later, optional stage. The feedback signal is built now and drives emotions
  first.
- **Training** happens later on a rented GPU and gets its own spec. This spec ends at a validated dataset.

### What success looks like

- **A dataset** of bot-versus-bot games:
  - every case in `docs/mechanics.md` occurs often enough;
  - each monster type behaves visibly differently;
  - every emotional act has a logged cause.
- **Reproducible and watchable.** Any recorded game replays exactly from its settings, and can be watched in the
  browser.

## 2. The big picture

```
                 ┌──────────────────────────── main model ─────────────────────────────┐
 your stick ───► │ state(t) + map + monster type ─► state(t+1), events(t)               │ ─► renderer, sound
 and buttons     │                                   ▲                                  │
                 │   monster head: state(t) ─► giant's controller input(t) ─┘           │
                 └──────────────────────────────────────────────────────────────────────┘

 Data: the rules engine (game/src/sim) plays kid bots against monster bots and records
       (state, kid input, giant input, events) every 50 ms.
```

### The pieces

- **Rules engine** (`game/src/sim`): the ground truth. It is deterministic given a seed and the inputs, and it gets
  split into:
  - **world**: bodies, mechanics and senses. It takes *two* controllers: the kid's and the giant's.
  - **giant's mind**: perception → belief → emotions → tactic → controller input. Personas are settings on one shared
    mind.
- **Kid bots** play the kid's controller.
- **Recorder** writes the dataset; **replays** rebuild any game from its settings.
- **Main model**, trained later, replaces both the world and the giant's mind:
  - **Mind in the state.** The monster's mind (belief, emotions, current intention) is part of the game state. So
    the model is Markov: one state in, the next state out, with no hidden memory.
  - **Monster head.** Inside the model, a monster head predicts the giant's controller input from the state. A core
    applies it together with yours. That is the "big state model plus smaller behaviour models" in one network.

## 3. The game state

One schema, defined once in `game/src/sim/schema.js`, encodes the state to numbers and decodes it back.
- The recorder, the replays and (later) the model all use it.
- The renderer reads the decoded state, so it works unchanged on a predicted one.

### Fixed for the game (context)

- the map: 37 × 23 tile types;
- where everything is placed;
- the monster type, as its persona settings.

### Dynamic (predicted every tick), one token per entity

| Token | Fields |
|---|---|
| game (1) | time, playing / won / caught, candles out, searchlight cooldown, hand cooldown |
| kid (1) | position, velocity, facing, crawling, running, creeping, wardrobe hidden in, toy held, candle being blown, noise, stick-released flag |
| candle (6) | lit, blow progress |
| door (11) | open, time since it changed |
| wardrobe (3) | time since it was opened |
| toy (7) | position, held, flying, flight direction, distance flown |
| squeaky toy (5) | position, cooldown |
| passage (10) | times the kid used it in this chase |
| searchlight (1) | idle / warning / on, timer, position, heading, spotted |
| hand (1) | idle / shadow / down / hold / up, timer, position |
| monster body (1) | position, velocity, heading, action under way and its timer (opening, bashing, winding up, lunging, recovering, checking, yelling), bloodlust, rage |
| monster mind (1 + 4) | intention, intention target, last seen (where, how long ago), anger, frustration, confidence, fury / spent timers, menace; up to 4 belief hypotheses (where, spread, weight) |

### Per tick

- **The kid's input:** stick, creep, blow, use, throw.
- **The giant's input** (section 4).
- **Events:** about 40 kinds, with positions where they have one, each tagged with the case id it shows.
- **New "nothing happened" events**, so refusals are visible in the data:
  - `blowNothing` (C6);
  - `useNothing` (D1);
  - `shutRefused` (D3);
  - `unhideRefused` (W2);
  - `throwRefused` (N5).

## 4. The giant as a player

### Its controller

The giant's mind drives the monster through a controller, exactly like a player would. The world enforces every limit,
so no persona can cheat.

| Input | What the world does with it |
|---|---|
| left stick | move. Full tilt is hunt speed, 3.0 m/s |
| run (held) | allows chase speed, 3.55 m/s + bloodlust (B3) + rage (C4) |
| lunge (press) | wind-up 0.25 s, lunge 0.4 s along its heading, recover 1.5 s (B2); ignored while recovering |
| use (press) | at a shut door: open, 0.6 s (D5). At a wardrobe front: look inside, 0.7 s (W4) |
| bash (press) | at a shut door: smash through, 0.9 s, loud |
| yell (press) | **new:** stops for 0.8 s and roars, and the giant slams the table. The kid hears it. Costs time; that is the kid's opening. At most once every 6 s |
| light (press + aim) | the searchlight at the aimed spot (L2); the right stick steers its drift. Not before its cooldown (L1's interval × 0.8) |
| reach (press + aim) | the hand at the aimed spot (H2). Not before 2 candles are out or before its cooldown, and not while the light is up |

These move from rules to the giant's choices:
- the searchlight's and hand's timing and aim (today random near the true kid position);
- bashing, which today happens only in chases.

The world keeps the minimum gaps, the warnings and the fairness.

### What it knows

`observe(G, 'giant')`, computed by the world:
- its own body;
- candles, doors, wardrobes and toys;
- the kid's exact position **only** while it sees the kid (S1);
- noises it hears (N1);
- the ping (S2) and alerts (S3);
- the time.

### Its mind, every tick

1. **Belief.** Up to 4 hypotheses of where the kid is, each with a spread and a weight.
   - A sighting collapses them to one.
   - Noises and pings add or merge hypotheses (a ping with a 3 m spread).
   - Spreads grow with time at kid speed.
   - Looking at a spot and seeing nothing cuts its weight: negative evidence. Smart personas only.
   - Smart personas also move hypotheses along the kid's likely route: toward the nearest lit candle, or out of the
     passage it took.
2. **Appraisal: "how am I doing".** A signal r each tick. The same signal is the reward if we later train the monster
   with RL.

   | Happened | r |
   |---|---|
   | closing on a kid it can see | + per metre closed |
   | caught sight of the kid | +0.3 |
   | heard a lead | +0.05 |
   | lost sight | −0.3 |
   | kid escaped into a gap mid-chase | −0.4 |
   | door shut in its face (within 3 m ahead) | −0.3 |
   | lunge missed | −0.25 |
   | ambush paid nothing | −0.2 |
   | wardrobe empty | −0.15 |
   | arrived at a lead and found nothing | −0.1 |
   | a candle went out | −0.6 |
   | nothing to go on for over 10 s | −0.02 per second |
   | caught the kid | +1 |

3. **Emotions**, each between 0 and 1:

   | Emotion | Rises with | Falls | What it does |
   |---|---|---|---|
   | anger | sharp setbacks: a door in its face, a missed lunge, a candle out, a gap escape | fast (half-life 4–10 s by persona) | runs more, bashes instead of opening, lunges from further (up to 2.4 m); crossing 0.7 sets off a yell |
   | frustration | negative r adding up | slowly (30–60 s); a sighting or closing in cuts it | abandons the current plan for another (go round, cut off at a candle, guard, check wardrobes); more willing to try unusual options (temperature); the giant uses the hand and light sooner |
   | confidence | positive r | 8 s | fewer surprises, steadier chase |
   | fury | anger ≥ 0.75 and frustration ≥ 0.6 | a 4 s burst, then 2.5 s *spent* | always runs, bashes, ignores lures, yells; spent moves at patrol speed, the kid's window |

4. **Choosing what to do.** Tactics are scored (utility), and a choice is drawn by softmax with a temperature:
   - the temperature rises with frustration and falls with confidence;
   - choices are re-made every 0.5 s or on an event, with a bonus for keeping the current plan (no dithering).

   This is where the "reasonable randomness" lives. It picks among *good* options, more adventurously when
   frustrated, and never picks something pointless.

   The tactic library is shared by all personas:
   - chase, with a lead ahead;
   - lunge;
   - go to a lead;
   - search around a point;
   - check a wardrobe;
   - wait at a gap's exit;
   - cut off at a candle (smart only);
   - guard a candle;
   - breather (B7);
   - yell;
   - use the light;
   - use the hand.

5. **Controller.** The chosen tactic is turned into stick and buttons, with A* through doors. The world then applies
   them.

Every emotional act is logged with its cause, e.g. `yell {cause: 'gapEscape'}`. Its odd behaviour is always motivated
and never noise.

### Personas: five types, one goal

Each game draws a type, then jitters its settings (clipped Gaussian), so no two games play the same.

| Persona | Smart | Aggression | Patience | Trusts noise | Guards candles | Thorough (wardrobes) | Temper | Uses light and hand |
|---|---|---|---|---|---|---|---|---|
| Pathfinder | 0.1 | 0.5 | 0.5 | 0.5 | 0.3 | 0.3 | 0.4 | 0.3 |
| Brute | 0.3 | 0.9 | 0.2 | 0.4 | 0.1 | 0.2 | 0.9 | 0.5 |
| Stalker | 0.9 | 0.5 | 0.9 | 0.6 | 0.5 | 0.6 | 0.2 | 0.6 |
| Hound | 0.5 | 0.6 | 0.5 | 0.95 | 0.2 | 0.4 | 0.5 | 0.4 |
| Warden | 0.6 | 0.4 | 0.8 | 0.4 | 0.9 | 0.8 | 0.4 | 0.8 |

- **Pathfinder** is the dumb baseline: a single last-known point, A* to it, no prediction, no cut-offs.
- **Brute** chases straight, bashes, yells and lunges eagerly.
- **Stalker** predicts, cuts you off, waits at gap exits and is quiet.
- **Hound** lives by its ears: quick to every sound, easy to lure with a thrown toy.
- **Warden** holds the remaining candles, checks every wardrobe and works the searchlight.

Today's brain is ported first as a sixth type, **Classic**. It is the reference for the refactor.

**Balance.** Each persona is tuned so a mid-skill kid bot wins 5–25% of games ("ridiculously difficult but
beatable"). The probe (`tools/sim.mjs`) reports this per persona.

## 5. Kid bots (data only)

- **What a kid bot knows** is what a player knows:
  - the monster's eye over the walls (its position, always);
  - sounds, including yells;
  - candles, doors and toys.
- **How it chooses.** Utility over goals:
  - blow candle X;
  - flee through a gap;
  - hide in a wardrobe;
  - shut a door behind it;
  - throw a lure;
  - creep past;
  - wait.
- **Styles** weight those goals: Sneaker, Sprinter, Hider, Trickster (doors and throws), Greedy.
- **Skill** sets reaction delay (0.1–0.4 s), how far ahead it plans, mistakes and stick wobble.
- **Mess for coverage.** Every bot presses a random button now and then. About 5% of games use a **Chaos** kid
  (random walks, random buttons), so the data shows what does *not* happen.

## 6. Data

### Episodes

- **Settings.** Each episode is defined by:
  - a seed;
  - a persona and its settings;
  - a kid style and skill;
  - a start.

  It runs until won, caught or 300 s.
- **Starts.** 70% start fresh. 30% start mid-game from a random valid state:
  - 0–5 candles already out, others partly blown;
  - the kid and monster on reachable tiles at least 8 m apart;
  - some doors flipped and toys scattered (some held);
  - random emotions, light and hand phases;
  - the monster's belief seeded with one ping.

  This covers late-game mechanics (the hand needs 2 out) without playing every game to the end.

### Recording

- The rules keep running at 60 ticks a second.
- A record is written every 3rd tick (20 a second). Inputs are held for those 3 ticks, and events are gathered over
  them.

### Format

Shards of 256 episodes:
- `episodes.jsonl`: settings, outcome, length, case counts;
- `states.f16`: states, one row per record;
- `kid.f16`, `giant.f16`: the inputs;
- `events.bin`: the events;
- `index.json`: where each episode starts.

`schema.json` is generated from `schema.js`, and the Python side reads the shards with numpy memmaps.

### Replays

An episode's settings rebuild it exactly, because each game is one thread with its own seed. `?replay=<shard>:<ep>`
plays a recorded game in the browser, so personas can be watched and judged.

### Coverage report

Counts per case id from `docs/mechanics.md`, with a target of at least 1,000 each in v0, and a flag on anything under
target. The rare ones to watch:
- a win;
- found in a wardrobe;
- grabbed by the hand;
- fury;
- a door that won't shut.

### Scenario suite

One scripted micro-game per case: a start state, an input script and the expected outcome.
- It runs on the rules engine now, as tests.
- Later it runs on the model, as the per-mechanic exam.

### v0 size

- 2,000 episodes: about 80 h of play, 5.8 M records, about 3–4 GB.
- Worker threads should generate it in under 30 min on the laptop.

## 7. The main model (outline; its own spec later)

- **Input.** The map, as patches, plus one token per entity (section 3) and the persona token, about 110 tokens.
- **Output.** Each entity's next state:
  - positions and moves as bins, so a choice of outcomes can be represented;
  - flags as categories;
  - timers as numbers.

  Plus the events, and the monster head's controller distribution.
- **Training.**
  - The core learns from the true giant input; the head learns to copy it.
  - At play, the head is sampled at a set temperature.
  - After one-step training, multi-step rollouts (8–32 ticks fed with its own predictions) cut drift.
- **Size and where it runs.** A transformer of about 5–10 M parameters, small enough to run in the browser at
  20 ticks a second (onnxruntime-web). The renderer interpolates between ticks.

## 8. How we know it works

- **Rules engine:**
  - the scenario suite passes;
  - the probe's balance band holds per persona;
  - the coverage report is green;
  - replays are exact.
- **Model, later:**
  - per-case scenario pass rate against the rules engine;
  - 300 s self-play rollouts that stay valid (nobody inside a wall, candles never relight, a win only when all are out);
  - outcome, length and event rates matching the rules engine per persona;
  - and playing it.

## 9. The top view, only at the start (the side point)

- When a game starts, the camera shows the whole board and the giant across the table for about 3 s.
- Then it flies down behind the kid.
- The Z toggle is removed; the mouse wheel still moves the camera closer or further.

## 10. Build order

| Phase | What | Done when |
|---|---|---|
| 0 | Top view at start only (section 9) | plays in the browser |
| 1 | Split world and mind: the giant's controller, `observe`, today's brain ported as Classic, the new "nothing happened" events | probe numbers stay near today's (statistically; seeds won't match exactly) |
| 2 | `schema.js`, recorder, replays, browser replay viewer | a recorded game replays exactly |
| 3 | The new mind: belief, appraisal, emotions, tactics, yell, fury, light and hand as the giant's choices, five personas | each persona in its balance band; each looks different in replays |
| 4 | Kid bots: styles, skill, mess, Chaos; mid-game starts | bots finish games with no stalls |
| 5 | Scenario suite and coverage report | every case has a scenario; the report runs |
| 6 | Generate v0 (2,000 episodes) and its stats | coverage green, or gaps listed |

**This spec's implementation plan covers phases 0–6.** Training the model is the next spec.

## 11. Risks

- **Drift.** A learned world drifts over long play.
  - Rollout training and the validity checks (section 8) measure it.
  - If it stays bad, the fallback is a light rules "referee" (collisions only), but only if you agree.
- **Rare cases are scarce:** mid-game starts, Chaos kids and the coverage targets.
- **A smart monster is unbeatable:** balance bands per persona; the yell and the spent phase give openings.
- **Emotions read as random:** every emotional act has a logged cause, and replays let us judge it.
- **Data volume:** v0 is sized for the laptop. Bigger runs happen on a rented machine.

## 12. Considered and not chosen

- **A separate monster network** next to a world network. Two models to keep in step, and it breaks "one main model".
  The monster head inside the main model gives the same split without a second network.
- **Predicting frames first.** Far more data and compute, and you can't test mechanics one by one. Possible later from
  the same recordings.
- **Monster emotions as pure noise** (random pauses). Reads as a bug. Causes are required.
- **Training the monster with RL now.** The reward exists (appraisal), but scripted personas are controllable and
  explainable first. RL can follow.
