# Candles: every mechanic, as cases

Every rule in the game, written as "when this happens, that follows". The code in `game/src/sim` is the source of
truth, and the numbers live in `game/src/sim/rules.js`; this file must change whenever they do.

Each case has an id. The scenario suite tests every case, and the dataset's coverage report counts how often each one
occurs (see `docs/superpowers/specs/2026-10-10-gamenet-training-design.md`). "Nothing happens" cases are listed on
purpose: the world model has to learn what does *not* happen too.

Units: 1 tile = 1 m, times in seconds. The rules run at 60 ticks a second. Positions are tile centres +0.5.

## 0. The board and the tick

- **G0 Map.** 37 × 23 tiles: 6 rooms in a ring corridor. Every tile has one type, and the type decides who can pass
  and who can see through it:

  | Tile | Kid passes | Monster passes | Blocks sight | Kid crawls |
  |---|---|---|---|---|
  | floor | yes | yes | no | no |
  | wall | no | no | yes | — |
  | vent duct | yes | no | yes | yes |
  | crack in a wall | yes | no | yes | yes |
  | table | yes | no | no | yes |
  | bed or crib | yes | no | no | yes |
  | low furniture | no | no | no | — |
  | tall furniture, wardrobe | no | no | yes | — |
  | door, shut | no | no | yes | — |
  | door, open | yes | yes | no | no |

- **G1 Kid-only passages.** Connected crawl tiles form 10 passages; each has the floor tiles you leave it by
  (its exits).
- **G2 Things on the board.** 6 candles (pushed into their tile's corner), 11 doors (pairs of tiles form a double
  door), 3 wardrobes (with a front tile), 7 toys to throw, 5 squeaky toys, 12 creaky boards.
- **G3 Tick order.** Each tick: the kid, then thrown toys, then the searchlight, then the hand, then the monster,
  then the catch check. Once the game is won or lost, nothing else happens in that tick or after.
- **G4 Start.** The kid starts in the playroom and the monster in the top-right corner, asleep. All candles lit.
  Searchlight first at 45 s; the hand is not active yet.
- **G5 Win.** The last candle goes out → won.
- **G6 Lose.** Any catch (X1, X2, H3) → caught.

## 1. Moving

- **K1 Run.** Stick → up to 3.2 m/s, accelerating at 28 m/s². Running is speed > 2 m/s without creep, not crawling.
  Running makes noise heard at 10 m (6 m through walls).
- **K2 Creep (held).** Up to 1.4 m/s. Silent. Creeping also stops creaks (N2) and squeaks (N3).
- **K3 Crawl.** On a crawl tile the kid crawls at 1.7 m/s (1.0 creeping). Crawling in a vent duct without creep
  rattles: noise 3 m.
- **K4 Collision.** The kid is a circle of radius 0.24 and slides along anything it can't pass (G0). The monster is
  a circle of 0.42 and is blocked by everything except floor and open doors.
- **K5 Facing.** The kid faces where it moves (above 0.1 m/s), or the candle it blows.
- **K6 Nothing happens:** pushing into a wall moves you along it at most; the monster can never enter a crawl tile.

## 2. Candles

- **C1 Blowing.** Hold blow with a lit candle within 1.05 m and in line of sight → the kid stops, faces it and blows.
  The nearest such candle is the one blown.
- **C2 Progress.** Progress grows by 1/1.5 per second; letting go keeps it. At 1 the candle goes out.
- **C3 Noise.** Blowing makes noise heard at 6 m.
- **C4 A candle goes out:**
  - the monster is told exactly where (an alert);
  - the monster is enraged for 5 s (+0.25 m/s);
  - the giant slams the table;
  - that corner of the house goes dark, so the monster's sight there drops from 13 m to 8 m (S1).
- **C5 More candles out → harder.** The monster's sense of you comes faster (S2), the searchlight comes more often
  (L1), and from 2 candles out the hand starts (H1).
- **C6 Nothing happens:** blowing out of reach, without line of sight, at a candle already out, or from inside a
  wardrobe. A candle never relights.

## 3. Doors (one button, "use")

- **D1 Toggle.** Tap use within 1.35 m of a door → it opens or shuts. If a wardrobe front is nearer, use hides
  instead (W1). Within reach of a lit candle, use does nothing (the same button blows).
- **D2 Noise.** Opening or shutting: 6 m.
- **D3 It won't shut** on the kid, the monster, a toy or a squeaky toy in the doorway.
- **D4 A shut door** blocks movement for both, sight, candlelight and the kid's view.
- **D5 The monster at a shut door** (within 1.35 m, heading through it):
  - it stops and opens it in 0.6 s, noise 6 m;
  - chasing, it smashes through in 0.9 s, noise 12 m.

  It plans its routes as if doors were open.

## 4. Wardrobes

- **W1 Hide.** Tap use within 0.95 m of a wardrobe's front → the kid is inside:
  - it can't be seen or touched;
  - it stops blowing;
  - its toy stays in its hands.
- **W2 Come out.** Tap use, or push the stick. The stick only counts once it has been let go after hiding, and at
  least 0.4 s after getting in. Refused while the monster stands within 1.44 m of the front.
- **W3 Seen getting in.** The monster saw you in the last 1.5 s, you got in within the last 0.2 s, and the wardrobe
  is within 3 m of where it saw you → it walks to that wardrobe and opens it.
- **W4 Looking inside.** Opening takes 0.7 s.
  - You are inside → caught (X2).
  - Otherwise it is empty, and that wardrobe is skipped for 15 s.
- **W5 Searching nearby.** While searching, a wardrobe within 3.5 m of the search spot (not checked in the last
  15 s) is checked 40% of the time. After losing a chase, a wardrobe within 2.5 m of where it last saw you is always
  checked.

## 5. Noise and the things on the floor

- **N1 Hearing.** A noise of range r is heard within r in line of sight, 0.65 r through walls (the kid's own running
  and blowing: 0.6 r).
  - The kid's own noises reach the monster about 0.5 m off.
  - Doors, creaks, squeaks and landings reach it exact.
  - A heard noise sends the monster to look (B8), unless it is busy (chasing, winding up, lunging, recovering,
    taking a breather) or looking in a wardrobe.
- **N2 Creaky boards (12).** Stepping onto one at over 0.9 m/s without creep → creak, 7 m.
- **N3 Squeaky toys (5).** Passing within 0.42 m at over 0.6 m/s without creep:
  - squeak, 9 m;
  - the toy skids 0.6 m the way you move (not into a wall);
  - then it is quiet for 1.5 s.
- **N4 Toys (7).**
  - Pick up: walk within 0.6 m with empty hands → it is in your hands, automatically.
  - Throw: tap throw → it flies the way you face at 10 m/s, up to 7.5 m, and stops at anything solid.
  - It lands with a clatter, 13 m. One toy at a time.
- **N5 No throw:** into a wall right in front of you, while crawling, or from a vent.

## 6. What the monster senses

The world works these out at the end of every tick (`senses.js`). They pile up until the giant's mind next looks
(`observe`), so a mind that decides every few ticks misses nothing. The mind knows nothing else about the kid.

- **S1 Sight.** It sees you when all of these hold:
  - you are not in a wardrobe, vent or crack;
  - under a table or bed, you are within 1.4 m of it;
  - you are within 13 m if you stand in light (candlelight above 0.22 or the searchlight), else 8 m;
  - you are in its 180° view ahead, or within 2.2 m in any direction;
  - there is a clear line of sight (shut doors block it).
- **S2 Its sense of you (the ping).** With no other lead that tick, it learns roughly where you are:
  - every 7 s with all candles lit, down to every 3.5 s with one left (±20%);
  - up to 3 m off.
- **S3 Alerts.** A candle going out (C4) or the searchlight catching you (L3) tell it exactly where.
- **S4 Leads land on its floor.** Any lead inside a wall or furniture is moved to the nearest tile it can stand on.
- **It also feels** its setbacks and wins, which drive the personas' moods (section 12):
  - a door shut in its face (within 3 m, ahead);
  - a missed lunge;
  - you slipping into a gap it saw you reach;
  - a candle going out;
  - an empty wardrobe;
  - losing sight of you;
  - spotting you;
  - the searchlight finding you;
  - the hand missing.

## 7. How the monster behaves

Two kinds of mind play the giant's controller (section 12):
- **Classic** is the original brain. The rules below are Classic's, line for line.
- **The five personas** use the same behaviours as tactics, scored by their traits and mood.

Speeds: patrol 2.2, hunt 3.0, chase 3.55 m/s (111% of the kid's run), accelerating at 10 m/s². Running past hunt speed
needs the run button.

- **B0 Asleep** for the first 4 s, or until an alert. It can't catch you asleep.
- **B1 Chase.** It sees you and isn't busy → chase, aiming a little ahead of where you are going.
- **B2 Lunge.** Chasing, within 2 m, facing you, with a clear line:
  - it crouches and growls for 0.25 s at half speed;
  - it lunges at 5.4 m/s for 0.4 s;
  - it recovers for 1.5 s at half speed, then chases again.
- **B3 Bloodlust.** Seeing you for 6 / 10 / 15 s of one chase → +0.15 / 0.30 / 0.45 m/s. It resets when you take a
  gap or it loses you. Chases in this house are short; at the old 15 / 25 / 35 s it never happened.
- **B4 Lost you.** It runs to where it last saw you. On arriving (or after 2.5 s), it does the first of these that
  fits:
  - checks a wardrobe there (W5);
  - goes round to the far end of a gap you took (B5);
  - searches 3 spots around where you were heading.
- **B5 Gaps.** You take the same gap 3 times in one chase → it stops following and waits at the far exit (the near
  one 25% of the time) for up to 4.5 s.
- **B6 Under the table.** It can see you under a table or bed but can't reach you for 2 s → it goes round to wait
  at an exit.
- **B7 Breather.** 25 s within 8 m of you while seeing or chasing → it backs off to the lit candle furthest from you
  for 9 s.
- **B8 Hunt.** A lead → it goes there at hunt speed. On arriving (or after 12 s) it searches.
- **B9 Search.** It visits up to 3 spots within 3.5 m, lingering 1.2 s at each (W5 may interrupt), then patrols.
- **B10 Patrol.**
  - It guards a lit candle with chance 0.3 + 0.08 × lit candles (not the same one twice), otherwise wanders the
    house, leaning toward its last lead.
  - It lingers 2.2 s at each spot.
- **B11 Stuck.** Pushing for 0.6 s without moving → a random shove and a new path.
- **B12 Rage.** C4's +0.25 m/s applies in chase, hunt and wardrobe checks.

## 8. Getting caught

- **X1 Touch.** The monster is awake, and:
  - you are not in a wardrobe, vent or crack;
  - you are within 0.93 m of it (0.6 m under a table or bed);
  - it has a clear line of sight to you.
- **X2 Found** in a wardrobe (W4).
- **X3 Nothing happens:** it stands right next to your vent or crack, or touches the wardrobe you are in without
  opening it.

## 9. The giant's searchlight

- **L1 When.** The giant chooses.
  - It is not available before 45 s.
  - After each sweep it is not available again for 0.8 × the old gap: 50 s with all candles lit down to 26 s with one
    left.
  - Classic keeps the old schedule (±20%); personas use it when they have lost track of you, more when frustrated.
- **L2 Where and how.**
  - It shines where the giant aims. Classic aims 2–6 m from its last sense of you; personas aim within their best
    guess.
  - It warns for 1.6 s as the light swells.
  - It is on for 4.5 s, drifting at 0.8 m/s, turning the way the giant's right stick pushes.
  - It lights its area, so the monster sees 13 m there.
- **L3 Spotted.** You are within 2.5 m of its centre and not covered (wardrobe, vent, crack, under a table or bed) →
  once per sweep, the monster is told exactly where you are.

## 10. The giant's hand

- **H1 When.** From 2 candles out, the giant chooses:
  - it is not available until 35 s after the second candle;
  - after each reach, not again for 0.8 × the old gap (75 s with 2 out, down to 40 s with one left);
  - never while the searchlight is up.
- **H2 How.**
  - It aims where the giant aims: up to 2.5 m from its sense of you.
  - Its shadow spreads for 2.2 s.
  - It comes down in 0.35 s, holds 0.9 s, and goes back up in 1 s.
- **H3 Grabbed.** Within 1.35 m of where it lands and not covered → caught.

## 11. Randomness

Each game draws from three seeded streams, so a seed plus the config replays a game exactly, and changing one never
shifts the others.
- **The world:**
  - the searchlight's starting drift;
  - the ping's timing and error;
  - the jitter on the kid's own noises;
  - the stuck shove.
- **The giant's mind:**
  - the persona's jittered traits;
  - its tactic draws (softmax at a mood-set temperature);
  - patrol, search and guard spots;
  - near or far gap exit;
  - wardrobe checks;
  - when and where it uses the light and hand.
- **The kid bot:** its reaction, wobble, slips and choices.

## 12. The giant's controller, moods and personas

- **Z1 The controller.** The monster only moves through the giant's controller, and the world enforces every limit:
  - the stick goes up to hunt speed; run allows chase speed + bloodlust + rage;
  - the lunge has its crouch and recovery;
  - doors take 0.6 s to open or 0.9 s to smash;
  - a wardrobe takes 0.7 s to look inside;
  - the light and hand have their cooldowns.

  "Nothing happened" is an event too: `blowNothing`, `useNothing`, `shutRefused`, `unhideRefused`, `throwRefused`.
- **Z2 Yell.** It stops and roars for 0.8 s, at most once every 6 s. A persona yells when its anger crosses 0.7, or
  as a fury starts, and the event says why (`gapEscape`, `doorInFace`, `candleOut`, `lungeMiss`, `fury`).
- **Z3 Fury.** Anger ≥ 0.85 with frustration ≥ 0.7 → 4 s of fury:
  - it charges its best guess (never a thrown toy), running, smashing doors;
  - then it is spent for 2.5 s, at no more than patrol speed;
  - then at least 30 s before another fury, so it stays an event (about once a game).
- **Z4 Tactics.** A persona commits to its plan.
  - It re-decides at once on something big: it sees you, loses you, sees you hide, gets an alert, finishes its plan,
    flies into a fury, or gets a lead more than 4 m from where it is heading.
  - Small things (a noise, its fuzzy sense of you, a setback) and the 0.75 s timer count only once it has held the plan
    1-2 s (by patience).
  - It does not hunt a lead within 1.5 m; it searches round it.
  - Result: about 30 plans a minute (it was 62), and few changes within a second without a reason (11%; it was 58%).
  - The tactics: fury, chase, hunt, search, check, intercept (at a candle), ambush (at a gap's exit), guard, wander,
    breather.
  - The draw is softmax at its temperature: raised by frustration, lowered by confidence.
  - Every switch is logged with its reason.
- **The types** (each game jitters the traits by about ±0.08):

  | Type | Plays like |
  |---|---|
  | Pathfinder | the dumb baseline: goes to its best guess, no predicting, no cut-offs |
  | Brute | charges, smashes, yells, lunges from further |
  | Stalker | predicts where you are going, cuts you off at candles, waits at gap exits |
  | Hound | hunts by ear, easily lured by a thrown toy |
  | Warden | holds the lit candles, checks wardrobes, works the light |

  Moods (anger, frustration, confidence) come from its sense of how it is doing; see `game/src/sim/mind/emotion.js`.
