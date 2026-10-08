# 03 — Spec: slice v1, "Home Time" (the first playable night)

Status: **written for review, 2026-10-08.** This is the gate to building (the user's flow: discuss → doc the conclusion → build). The design it implements is `02_the_school.md`. Once approved, an implementation plan follows (`04_slice_v1_plan.md`), then the build.

## 1. Goal and success

One full night in a procedurally generated paper school, playable from the first bell to either **home time** or **expelled**. It runs on a rules engine that works with or without a browser.

**Success means all of these are true:**
1. A night is playable start to finish on the user's laptop (Intel Iris Xe) at **≥ 30 fps** at 1280×760.
2. Each door you open rolls a different classroom from the deck. In a 20-minute night you don't see the same combination twice.
3. The Headmaster's patrol, the three lessons, stars, detention, expulsion and the exit all work as specified in §6. The user plays it and agrees it's scary.
4. The engine runs headless in Node: `node engine/sim.js --seed 7 --agent wander --minutes 10` writes a data-twin JSONL. **The same seed and agent give a byte-identical file.**
5. The engine tests pass (`node --test engine/`).

## 2. Decisions this spec rests on

| Decision | When, and source |
|---|---|
| School setting; brutal horror; a story to uncover | User, 2026-10-08 |
| EXPELLED ends the night; pages persist; CAUGHT → detention (option A) | User, 2026-10-08 |
| Every area is a deck: kit × activity × who × twists × valuables, plus ambient life | User approved ("all cool"), 2026-10-08 |
| First lessons: Hand In Your Work, Eyes On Your Own Paper, Story Time | User approved, 2026-10-08 |
| Story: the end-of-term concert fire; never stated outright | Accepted by default ("all cool"), 2026-10-08; revisit anytime |
| The forest becomes the outside / epilogue | Accepted by default; **not in v1** (v1 ends on a card) |
| Working title *Home Time*; gore implied, not shown | Accepted by default |
| The school forgets itself, more as the clock climbs | Accepted by default |
| Look: grey oil paint on pinned paper; first-person 2.5D; people are billboard cards | Forest design, §3a/§3e of `00_DESIGN.md` |

## 3. Scope

**In v1:**

| Area | What's included |
|---|---|
| Floors | Ground and 1st, joined by switchback stairwells |
| Hallway kits | straight, L, T, cross, dead end; lockers, doors, noticeboards, class photos, papers on the floor |
| Room kits | classroom (*standard*, *small*, *infants*); stairwell (*switchback*); store cupboard (a place to hide); the front entrance (the exit, only when rolled) |
| Lessons | Hand In Your Work; Eyes On Your Own Paper; Story Time (infants kit only) |
| Teachers | the Teacher; *No one* (the chalk writes by itself) |
| Twists | One too many, Turned, Locked in, Lights out, Visitor, Wrong board |
| Valuables | gold star (the teacher's drawer), hall pass, torn page, chalk |
| Roaming | the Headmaster |
| Global | the attention clock and **the final bell** |
| Verbs | walk, run, crouch, look, use/reach, drop a star, show the hall pass, hide (locker, cupboard), carry (the stack of papers) |
| Screens | title, detention scene, expelled, home time |
| Story | 5 torn pages and the noticeboard; pages persist across nights |
| Data | twin v2 (per-module streams), headless runner, two scripted agents |

**Out of v1 (designed in `02`, built later):**
- the bully, the Caretaker, the toy room, the choir room, the library, the nurse, the art room, the toilets
- the other six lessons and seven twists; the substitute and the Headmaster as teachers
- lights-out / fire-drill / roll-call events
- the other hall and stair kits
- lean, climb and crawl
- the forest epilogue
- any model, dataset or training

## 4. Architecture

```
engine/   plain JS modules, no DOM, no three.js. Runs in the browser and in Node.
  rng.js        named, seeded random streams: rng('layout'), rng('headmaster'), ...  (no Math.random anywhere)
  rules.js      the rulebook: every number, and every deck (kits, lessons, twists, valuables) as data
  state.js      the game state S: plain, JSON-serialisable
  events.js     emit() and the event log
  layout/       chunk generator, kits, rooms, stairs, the entrance; forgetting; collision; nav graph
  modules/      player, doors, headmaster, classroom (+ lessons/), stars, clock, detention, pages
  director.js   rolls what's behind each door; schedules the patrol; anti-monotony
  world.js      createWorld(seed) and step(world, input): the one entry point
  sim.js        headless runner (Node), agents/
  twin.js       per-tick snapshot, one stream per module
school/   the Vite app: reads S each frame and draws it; turns keys and mouse into input
  src/art/      the Painter and the cards (moved from spike/concepts), textures painted at boot
  src/render/   three.js: paper-lit shader, chunk meshes, billboards, hands, effects
  src/audio/    beds and SFX (forest system, new sounds)
  src/ui/       title, detention, expelled, home time, subtitles
```

**The one rule that makes the data twin and the models possible:** the engine owns all game state and all randomness. The app never decides anything; it only draws `S` and sends `input`. Every module has the same shape:

```js
export const headmaster = {
  id: 'headmaster',
  init(S, rng) { /* put its state under S.headmaster */ },
  step(S, input, rng, emit) { /* read S, draw from its own rng stream, write S.headmaster, emit events */ },
};
```

**Time:**
- The engine steps at a fixed **60 Hz** (movement and collision).
- Characters' visible poses are quantised to **12 Hz** for the stop-motion look; that's a render concern.
- The twin records at 12 Hz.

**Determinism:**
- No `Math.random` or `Date` in `engine/`; a test greps for them.
- Each module draws only from its own named stream, so adding a module doesn't shift anyone else's dice.

## 5. The procedural school

**Chunks.**
- Each floor is a grid of **24 × 24 m chunks**, generated lazily as you approach, like the forest.
- **Edge contracts:** each chunk edge has a *port* (a corridor crossing it) or none, decided by `hash(seed, floor, edge)`. Both neighbours read the same edge, so corridors always line up.
- A chunk's corridor shape follows from its open ports: 1 port is a dead end, 2 are a straight run or an L, 3 a T, 4 a cross. Corridors are 3.4 m wide and 2.85 m tall, as in the hallway frame.

**Rooms.**
- The space beside the corridors is packed with room footprints along the corridor walls: classrooms 8×9 m (*standard*, or *infants* on the ground floor) or 6×7 m (*small*), store cupboards 2×2 m.
- Each room has one door onto the corridor; v1 has no two-door rooms.
- **A footprint is fixed when the chunk is generated. What's inside is rolled when you first open the door** (§6.4).

**Stairs.**
- A stair column at `(i, j)` exists when `hash(seed, i, j) % 5 == 0`. It's a switchback stairwell in both the ground and first-floor chunks at that spot, so the floors always connect.
- The stair has 12 steps per flight. One flight in eight has 13 (§6.6).

**The entrance.** The front entrance can appear only in a ground-floor dead end (§6.5).

**Forgetting.**
- Each chunk has an `epoch`. A chunk that is off-screen and at least 2 chunks behind you may be re-rolled with `epoch+1`, keeping its edge contracts so the map stays connected.
- The chance per chunk per minute is `forget.base + forget.perClock × clockHours`.
- **A door marked with chalk pins its chunk's epoch:** that chunk is never forgotten.

**Collision** uses axis-aligned boxes: walls, door frames, desks, lockers. The player is a 0.3 m circle. The Headmaster walks a **nav graph** of corridor centrelines and door points.

## 6. The rules (v1 numbers; all live in `engine/rules.js`)

### 6.1 Player
| Rule | Value |
|---|---|
| Speed | walk 2.2 m/s, run 4.2, crouch 1.1, carrying 1.8 (can't run) |
| Noise | run 1.0, walk 0.35, crouch 0.05 |
| Eye height | 1.45 m (0.95 crouched) |

Noise is what the Headmaster hears (§6.3) and what *Story Time* and *Eyes On Your Own Paper* care about.

### 6.2 Stars, attention clock, final bell
- **Held stars:** max 12, shown on the back of the left hand (the forest's petal ring, gold).
- **The clock:** it starts at **1:00** and runs at 1 minute of clock time per 20 s of real time. It jumps **+6 min** per star earned, **+4** per time the Headmaster sees you, and **+10** per detention. Every wall clock shows it.
- **At 3:30, the final bell:**
  - The bell rings continuously.
  - All lights in the school flicker.
  - The Headmaster patrols at chase speed and never gives up.
  - Being caught after the bell means **EXPELLED**.
  - The exit hazard is at its cap.

### 6.3 The Headmaster
- **States:** `absent → approach → patrol → (sees you) chase → catch | lose → patrol … → leave → absent`.

| Rule | Value |
|---|---|
| Arrives | every `[70, 140]` s; more often as the clock climbs (×0.6 after 2:30) |
| Spawns | on the same floor, 30–50 m away along the nav graph, out of sight |
| Tell | ceiling lights on his path die one by one toward you, 1 per 0.8 s (clunk) |
| Sounds | keys, cane taps (positional) |
| Patrol speed | 1.3 m/s |
| Hearing | walks to any noise above 0.3 within 14 m |
| Sight | 60° cone, 18 m, line of sight in corridors; through a door's window only if you're inside its 1.2 m-wide view strip |
| Chase speed | 3.6 m/s (4.6 after the bell) |
| Loses you | after 6 s out of sight |
| Leaves | after `[40, 70]` s of patrol |
| Catch | within 1.0 m |

- **Hall pass:** show it (hold F) while he's within 3 m. He stoops into your face for 2.5 s and leaves. The pass is spent.
- **Drop a star:** he stops for 4 s to pin it to his coat, then resumes.
- **Hiding:** in a locker or cupboard you're invisible unless he saw you go in. If he did, he opens it: caught.
- **Caught** → crumple → detention, unless it's after the bell, which is **expelled**.

### 6.4 Classrooms
**The roll happens when you first open a classroom door.** Kit is fixed by the footprint (infants only on the ground floor).

| Roll | Odds |
|---|---|
| Lesson | Story Time only in infants rooms; otherwise Hand In Your Work 60% / Eyes On Your Own Paper 40% |
| Teacher | the Teacher 85%, No one 15% (Story Time always has the Teacher: someone has to read) |
| Number of twists | 0 (50%), 1 (35%), 2 (15%); +1 after 2:30 (max 3) |
| Valuables | the drawer star 40%; hall pass 25%; torn page 20% (if any are left this night); chalk on the ledge 50% |

- The director never repeats the previous room's lesson **and** twist set.
- **A lesson starts when you cross the threshold** (Locked in shuts the door then).
- **Success** gives a star, stamped on your hand. **DOOM** means expelled.
- A finished room stays finished: empty desks, or the class asleep at them. Leaving mid-lesson abandons it with no reward; the door locks and the clock jumps +3.

**Hand In Your Work**
| Rule | Value |
|---|---|
| Clock | the hymn, 70 s (Lights out: +15 s) |
| Papers | one per student, 10–16 students (kit dependent) |
| Taking a paper | stand within 1.1 m and use |
| Delivering | use at the teacher's desk to drop the stack |
| The rule | chalk squeaks for `[3, 7]` s, then silence for `[1.5, 2.5]` s while she turns and looks |
| Caught moving while she looks | speed > 0.3 = seen: she screams, the hymn jumps −10 s, all heads lift for 3 s |
| Under *No one* | the chalk writes by itself; when it stops, **the students** look up instead, with the same rule |
| Unfinished students | 25% of students; taking their paper makes that head track you for the rest of the lesson |
| DOOM | all stand (one frame), smile, heads snap down, she shrieks into the camera |

**Eyes On Your Own Paper**
| Rule | Value |
|---|---|
| Task | sit at your desk (use), then hold use to write for 60 s of writing time; progress pauses while you don't hold it |
| The rule | your view pitch must stay below −35° (looking at your desk). Pitch above that for more than 0.4 s = looking up = DOOM |
| Things at the edge of view | every `[4, 9]` s, one of: footsteps behind; a hand on the next desk; breath (sound + screen edge); a student standing up beside you; the lights flickering; your name whispered |
| Noise | above 0.3 makes the invigilator (the Teacher, or a figure under No one) walk to your desk |
| DOOM | the invigilator's face is right there when you look up; the class stands |

**Story Time** (infants kit)
| Rule | Value |
|---|---|
| Task | find the missing page (hidden: toy box, under the carpet, a cubby, in a child's hands) and put it in her lap |
| Clock | the story, 12 lines × ~7 s |
| The rule | lines are chosen to describe what you're doing ("the boy crept to the toy box…"), from your position, speed and target, so the story narrates you. Running makes her skip ahead 2 lines. |
| DOOM | the last line, read looking at you: *"…and then she caught him."* |

**Twists v1**
| Twist | Effect |
|---|---|
| One too many | +1 student not on the register |
| Turned | the class faces the back, toward you |
| Locked in | the door locks until the lesson ends |
| Lights out | only the board lit; the lesson clock +15 s |
| Visitor | the Headmaster sits at the back; noise > 0.3 near him = caught |
| Wrong board | the board shows a hint (*THE PAGE IS IN THE TOY BOX*, *SHE TURNS SOONER*), wrong 30% of the time |

### 6.5 The exit
- **Exit hazard:** with stars ≥ 3, each newly generated ground-floor dead end becomes the front entrance with chance `min(0.6, 0.08 + 0.05 × stars)`. Before 3:30 at most one entrance exists at a time; after the bell, up to two.
- **The reach roll** happens at the doors: `min(0.35, 0.03 × stars)`.
  - **Success:** the doors open, daylight floods the screen, a HOME TIME card. The night is won.
  - **Fail:** the doors open onto a corridor. Your stars peel off into the dark (held → 0), the clock jumps +15, and the entrance chunk is forgotten.

### 6.6 Stairs
- Climbing takes you between floors.
- **13 steps:** if you turn more than 120° from the climb direction while on the flight, a student is standing one step behind you. From then on, you must reach the landing door without turning again, or you're caught.

### 6.7 Detention, expelled, pages
- **Detention:**
  - You wake at a desk facing the board in a detention room. The Headmaster is at his desk, snoring.
  - Hold use at the board to write *I will not leave* 5 times. Each line takes 4 s of chalk.
  - Snoring stops for 2 s every `[6, 12]` s. If you're writing while it's quiet, the count resets.
  - After 5 lines: *"Run along."* The door opens to a fresh ground-floor chunk. Stars → 0, clock +10.
- **Expelled:** the doom finale, then black, then *EXPELLED*, then the title. Pages found are saved (localStorage); the next night is a new seed.
- **Pages:**
  - 5 torn crayon pages, painted procedurally from `drawing()`-style compositions: the children in a line; the concert notice; smoke; the locked door; the boy alone.
  - One appears per night at most, as a classroom valuable. Picking it up shows it full-screen for 3 s.
  - The title screen shows the pages found so far.

## 7. Rendering

**The paper-lit material.** One shader for walls, floors, ceilings, props and cards:
- the painted texture
- times light from a uniform array of up to **12 nearby ceiling tubes** (`x, y, z, intensity`): a pooled gaussian downlight plus a small all-round term, the same function as the concept frames
- times moonlight through windows
- darkness fogged to black

Tubes can **die, flicker and come back**, which is just a uniform change. That's how the Headmaster's tell works.

**Geometry:**
- Corridor and room walls are quads with tiled paper textures painted at boot by the Painter: the wall, locker, floor, ceiling, door, noticeboard, photo, window, blackboard, frieze, clock and display textures from `spike/concepts`, cached as canvases.
- Desks and chairs are flat paper panels.
- **People are billboard cards** from the concept art: the student (front, back and snapped), the teacher (front and back), the Headmaster. Each is a pinned rig for the poses v1 needs: head pin (track, snap), arm pins (write, reach), the jaw (open).

**Budget:**
- Draw the current chunk, its 4 neighbours, and both floors only inside a stairwell.
- ≤ 150 draw calls, ≤ 400 k triangles.
- Textures: 1 atlas per texture kind, ≤ 64 MB total.

**Screen effects** reuse the forest's crumple (caught) and torn edges (dread). New ones: the expelled finale, the home-time flood, the page view.

**Hands:** the forest's paper hands. Stars replace petals in the ring. The stack of papers is shown in the hands while carrying it, and the hall pass is held up when shown.

## 8. Controls

| Input | Action |
|---|---|
| WASD, mouse | move, look (the fixed look settings from today: pitch ±0.42 rad outside *Eyes On Your Own Paper*, which allows looking down to −1.1) |
| Shift / Ctrl | run / crouch |
| E or left click | use / reach: take a paper, open a door, sit, write, pick up, hide |
| Q or right click | drop a star |
| F (hold) | show the hall pass |
| Esc | pause |
| `?record`, F9 | record the twin, download it |

## 9. Sound (new, generated like the forest set; original, no samples)

**Beds:**
- the hymn: a children's choir *ooh* on a simple four-line tune, 70 s, with a version slowed 15%
- the corridor hum
- the classroom room tone
- the final bell (continuous)

**SFX:**
- the classroom: chalk squeak; chalk stop; pencils scratching; paper pick-up; desk lid; chair scrape
- doors and hiding: door open, door shut, door lock; locker open, locker shut
- the Headmaster: keys; cane tap; footsteps (his, slow); light clunk; light flicker buzz
- doom and jump scares: the shriek; the paper-crack chorus (heads snapping)
- voices: the whisper of your name; the story narration murmur (the words are subtitles)
- markers: the stamp (a star earned); the detention snore

## 10. Testing

**Engine (Node, `node --test`), written before the code (TDD):**
- **Determinism:** the same seed, inputs and steps give an identical state hash; and there's no `Math.random`/`Date` in `engine/`.
- **Layout:** neighbouring chunks agree on ports; every corridor in a 9×9-chunk region is connected; rooms never overlap corridors or each other; every stair column exists on both floors; forgetting keeps ports intact; chalk pins the epoch.
- **Rolls:** classroom roll odds over 10,000 rolls are within tolerance; there's no repeat of the previous lesson+twists combination; Story Time appears only in infants rooms.
- **Lessons:** each lesson's success path gives a star; the clock running out fires DOOM; being seen moving during the silence costs 10 s; looking up for 0.4 s fires DOOM.
- **Headmaster:** given a scripted player, he hears noise > 0.3 within 14 m; loses you after 6 s out of sight; catches within 1 m; a hall pass sends him away; a dropped star stops him for 4 s.
- **Exit:** hazard and reach-roll rates over many seeds match the formulas.

**Headless:** a 10-minute `wander` agent and a `lesson` agent run without errors, and the JSONL is byte-identical across two runs.

**Browser:** Playwright scenario screenshots, one per beat:
- a corridor with lights dying
- a classroom mid-lesson
- the turn
- the doom
- detention
- the exit

Also an fps check on the laptop, and the user plays it.

## 11. Data twin v2
- The same JSONL idea as v1, but filled from `S` by the engine, not from meshes.
- **One stream per module:**
  - player
  - headmaster
  - classroom (per room: kit, roll, lesson state)
  - director
  - clock
  - stars/exit
- Events are filed by tick.
- Recorded headless by `sim.js`, or in the browser with `?record`.
- Two agents in v1: `wander` (explores, opens doors, hides when it hears keys) and `lesson` (does lessons by their rules, with tunable mistakes).

## 12. Risks
| Risk | Mitigation |
|---|---|
| Painting every texture at boot is slow (the forest took seconds) | Paint once, cache in IndexedDB keyed by art version; a loading bar as now |
| A per-pixel light loop over 12 tubes is too slow on Iris Xe | Cap at 8 if needed; or bake lights per chunk into vertex colours, with a uniform only for the tubes that change |
| The 12 Hz stop-motion poses look like lag on the camera | Only people are quantised; the camera and world stay smooth (as the forest does) |
| Scope creep (the design has ~40 features) | §3's out-list is binding for v1; additions go to the v2 list |
| Lessons feel unfair | Every rule has a tell in sound *and* picture; numbers are in rules.js for tuning after the user plays |

## 13. Order of work (the plan will expand each step into tasks)
1. Engine core: rng, state, events, world, the module shape, determinism tests.
2. Layout: chunks, ports, corridors, rooms, stairs, collision, nav graph, with tests.
3. App shell: Vite app, the paper-lit shader, corridors drawn from layout, walk around both floors.
4. The Headmaster: module + render + sound.
5. Classrooms: roll + room interior + Hand In Your Work.
6. Eyes On Your Own Paper, Story Time, twists, valuables.
7. Stars, clock, final bell, exit, detention, expelled, pages, title.
8. Sound set (generated, in parallel from step 3).
9. Twin v2, headless sim, agents.
10. Tuning pass with the user.
