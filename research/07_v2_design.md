# 07 — v2: making it scary (design decisions and build log)

Status: **in progress, 2026-10-08.** This follows the user's playtest of slice v1:
- The controls felt wonky.
- It wasn't smooth.
- The sound was off.
- Not every task was playable.
- The story didn't seep in.
- Everything was uniform, visibility was too high, and there was no tension, no scares, no mystery.

The user asked me to research how horror games and horror audio work, to keep going until it's good end to end, and to play every checkpoint myself. The research is in `05_horror_design_research.md` (design: 19 principles, 42 recommendations, numbered R1–R42) and `06_horror_audio_research.md` (sound, when it lands). This doc records what I adopted, what I changed, and how each phase went in play.

## The diagnosis (from 05)
v1 has **rules without a conductor**. Every rule fires on its own timer, at full brightness, in identical spaces, so there's no baseline to deviate from and no quiet to break. Horror is contrast over time:
- normal, then wrong
- quiet, then loud
- a dark gap, then a pool of light
- safe, then not

## Already fixed (before the redesign)

**Controls:**
- The camera now blends between engine steps; that jitter was the "wonky" feel.
- Mouse look applies immediately.
- The up/down range is wider (±40°).
- `[` `]` change the mouse speed, and the setting is saved.
- A controls panel sits in the lower left and fades after 25 s.
- A context prompt at the bottom says what E does right now, and what the current lesson asks.

**Playability:**
- Holding E sweeps up every paper within 1.35 m; there's no aiming at each child.
- Sitting down in Eyes looks down for you and gives 1.5 s of grace.
- Velocity is now actual motion. Pushing against a desk is standing still; before, being stuck against a desk counted as "moving" when the teacher turned.
- `engine/test/playable.test.js` plays every lesson with the scripted agent across 12 seeds, and a lesson that a good player can't finish now fails the build.
- **Timing:** the agent's perfect play takes 6–20 s for Hand In Your Work, 9–19 s for Story Time and 60 s for Eyes. The hymn is now 20 s + 2 s per student, and the story is 10 lines × 5.5 s.

**Children:** a kid generator (`school/src/art/kids.js`). Each kid has:
- 7 boys' and 7 girls' hair styles
- 8 eye types, 8 mouth types, 5 noses
- a uniform: pinafore, tie or cardigan
- extras: freckles, plaster, bandage, scribble, torn ear, bow, soot
- a height
- a name tag drawn from the register's names

Front, back and snapped views all match.

## Adopted, in build order

| Phase | What | From 05 |
|---|---|---|
| 1 | **Tension Director**: a 0–100 tension score; phases CALM / UNEASE / DREAD / HUNT / PEAK / AFTERMATH; forced aftermath after peaks; a scare ledger with spacing rules; the Headmaster herded to your area but finding you only with his own senses; he gets new behaviours as the clock advances | R1–R5 |
| 1 | **Fair lessons**: a three-beat telegraph before every lose condition; strikes before doom; student counts by act; delivery counts near the desk; Eyes 40 s with a warning vignette and one lying whisper; Story Time with an honest hint, at most 4 spots, run skips 1; each rule taught once on the board | R20–R25 |
| 2 | **Darkness**: near-zero ambient; tubes every ~4 m with 30%→60% dead as the night goes on; black fog at 14–18 m; lighting states per chunk (full / patchy / dead / emergency / flicker); backlit silhouettes; the hands tremble and the FOV narrows with tension | R9, R10, R12, R36 |
| 3 | **Variety**: generated kids with an uncanny budget by act; wings (tint, floor, sound, landmark); dressing sets plus a damage layer that grows with the clock; a corridor anomaly deck (tiers 0–3, some warning about the next door); door rolls reweighted (empty, aftermath, lone child, store, vignette, wrong room); cross-run memory | R13–R19 |
| 4 | **Story seepage**: the register; the PA; concert posters; soot; the chained Hall wing; class photos as the evidence chain; Story Time slipping into the concert; detention lines changing with pages; the HALL key; pages changing the world | R26–R31 |
| 5 | **Transitions and opening**: the scripted first five minutes; doors take a beat; room sound leaks through doors; aftermath rooms; stairwells as decompression; the final bell as a scene; doom variants | R33–R35, R39–R41 |
| 6 | **Audio**: licensed music and adaptive stems by director phase; the Headmaster's distance bands; room tone cut out under 6 m; 2 s of silence before peaks; muffling through closed doors | R7, R32, plus 06 |
| 7 | **Instrumentation and tuning**: tension and scares in the twin; playtest reels; sameness grid | R42, §3 |

**Deferred (noted, not dropped):**
- matches as a light source (R11)
- 1-in-20 rare events
- the true ending through the hall (R27, page 5)

## Build log
(one entry per phase: what changed, what the playthrough showed, what I tuned)

### Phase 1: the director and fair lessons (done before this log started)
- `engine/director.js`, `engine/modules/tension.js`: tension 0–100, six phases, a scare ledger with spacing, glimpses before patrols, ambient life, apparitions and false scares.
- Lessons now telegraph in three beats, take strikes, teach the rule once on the board, and the story hints honestly. `engine/test/fair.test.js` and `playable.test.js` pin this down.

### Boot time
- The first launch paints everything in workers on CPU canvases, caches it in IndexedDB, and compiles and uploads the shaders and textures during loading: 109.5 s, then ~19 s, then ~1.5 s to a playable frame on later launches.
- The remaining ~3 s on the Iris Xe is the GPU finishing shader compiles. A 1×1 dummy texture upload takes the same 3 s, so it is not the textures. I left this alone, because Chrome's shader cache helps on a real profile.

### Phase 2: darkness
**Already in place:** near-zero ambient, black fog at 3–17 m, per-chunk light states (full, patchy, dead, emergency, flicker) and dying tubes as the night goes on.

**Added:**
- A vignette and moving film grain in the paper-lit shader. It's one pass with no extra cost.
- The hands are only as lit as where you stand (`lightAt` mirrors the shader), so in a dead stretch you barely see your own hands.

**Playthrough:** corridors now read as pools of light with black between them, and the hands darken in dead arms. The glimpse reads as a small backlit figure at 10–15 m. The apparition scene had a bug: it put the child behind the camera. I fixed the scene and the child shows.

### Phase 3: variety
**Wings (`engine/layout/wings.js`):** each 2×2 block of chunks is one wing.

| Wing | Look | Lockers |
|---|---|---|
| main | grey plaster | yes |
| infants | warm walls, lino floor | few |
| science | glazed tiles with a green stripe, cold tint, puddles, ceiling stains | some |
| old | dark varnished panelling, plank floor | few |

- The start block is always main, as the baseline.
- Lockers now vary by wing: a full bank, a short run, or none. Most corridors used to have one full wall of lockers, which was half of why they all looked the same.

**Dressing atlas (`school/src/art/dressing.js`):** 32 painted cells on one sheet, so each chunk's dressing is one draw call.
- Half of it is the ordinary school: radiator, QUIET sign, fire exit, clock, coat pegs, WELL DONE CLASS 3, concert poster, children's drawings.
- Half is wrong: rust-brown handprints and footprints, soot, a stopped clock, HAVE YOU SEEN, lines written on the plaster, tally marks, SORRY gouged into the wall, the tall man drawn by a child, white plimsolls, a doll, a red balloon, burnt scraps.
- `school/src/render/dress.js` places them from the wing's deck. Density rises with the act and the wrong items unlock by act. A chunk is re-dressed whenever it comes back into view, so the damage grows while you're away.

**Corridor anomalies (`engine/anomalies.js`):** 12 kinds in tiers 1–3, rolled per chunk as you come near, mostly tier 0–1 in Act I and 2–3 by Act IV, and never repeated within five.
- Examples: footprints that walk up the wall and across the ceiling; a wall papered with the same drawing; handprints on the ceiling; a row of plimsolls; coats with shoes under one; a soot-black arm with burnt paper.
- *Warnings:* red crayon arrows on the floor lead to a door marked THIS ONE. That room always has the page, and always one more twist.

**Doors (`rules.classroom.sceneP`):** not every door is a lesson now. Act I is about 60% lessons. The rest:
- an empty room: every light on, chairs up on the desks, more to take. It's the one calm room, a release.
- an aftermath: desks shoved and knocked over, papers everywhere, WHERE DID EVERYONE GO on the board.
- a lone child under a single light, who turns to look at you and says one line of the story. Which line depends on how many pages you hold, so the story seeps out one line at a time.
- from Act II, the class standing noses to the back wall beside the door, with FACE THE WALL. TOUCH NOTHING. on the board. Take anything and they all turn round. It's a scare, not a punishment.

The same scene never comes twice in a row.

**Bugs found in play:**
- *Decals were invisible:* walls are 0.1 m boxes, so the plaster sits 5 cm in front of the wall line and the decals were behind it.
- *Locker fronts were mirrored:* this was wrong since v1, and the numbers read backwards.
- *Dark marks vanished on dark surfaces:* handprints and footprints are now rust-brown.

**Playthrough:**
- The wings read as different places at a glance.
- The same-drawing wall and the coats are strong.
- A single-wall anomaly can be missed if it's in an arm you don't walk down. That's acceptable: not everything has to be seen.

### Phase 6: audio (`school/src/audio.js`, rewritten)
**Real recordings now carry the sound:**
- the 1917 "Holy, Holy, Holy" through a PA chain (band-pass, a light tanh drive, 50 Hz mains hum, the room). It's started so that it ends exactly when the lesson does, and slowed for Lights Out.
- real chalk and four layered pencil tracks. Every one stops dead the instant she turns.
- the Headmaster's footsteps and cane, sliced from recordings and positioned in HRTF space, with his keys jangling in his hand while he walks. When the keys stop, he's listening.
- the snore, the bell, and on Home Time one dry ring of the same bell with a playground far off.

**The score:**
- three Kevin MacLeod layers driven by the director's tension: a drone, distant strings from 50, and grating low strings from 80 or in a chase.
- low-passed when calm, ducked when he's within 10 m, during lessons and under the bell.
- a moment of silence before every big hit (seen, caught, doom, they turn).

**Other sound:**
- the infants' rooms have their own celesta.
- pages bring a memory: music box and choir with a fire under it.
- the director's ambient deck (a ball bouncing down stairs, a phone, a desk lid, the hymn far off) and the false scares all have sounds now.

**Engineering:**
- Long tracks are streamed from `<audio>` elements. Decoding them all up front was about half a gigabyte.
- The story recording is a different story from the captions, so it's muffled enough not to be legible.
- The Kevin MacLeod credit is on the title screen, as CC BY 4.0 requires.

### Phase 4: story seepage (`engine/story.js`)
All the story's words now live in one file. Two versions run side by side.

- **The official version:** the school's own voice keeps telling it. A concert in the Hall; the doors locked "so nobody gets lost"; everyone very good and very quiet.
- **The other version:** pages, children and walls tell it, and they say more the more pages you hold.

**What carries it:**
- **The PA:** speaks once a little into the night, then at the start of each act:
  - Act I: the end-of-term concert.
  - Act II: everyone to the Hall.
  - Act III: the Hall doors locked.
  - Act IV: "Would the child who is not in the Hall please come to the Hall." With three or more pages it adds "We are all waiting for you."
- **Detention:** what you're made to write changes with your pages, from "I will not leave." to "I did not smell smoke.", then "I was not there.", then "Nobody got out."
- **Story Time:** the first and last lines drift toward the concert. With four pages it ends "…and nobody got out. Except one."
- **The lone child:** says the next line of what happened, by how many pages you hold.
- **The Hall doors:** some dead ends turn out to be the Hall (mostly in the old wing). They are chained double doors with soot over the frame and small handprints low down. Using them gives one line, which changes with your pages:
  1. a bonfire smell
  2. singing
  3. "it was done from this side"
  4. hands on the inside
  5. "the chain is warm"
  6. the register stopping at your name

  The hymn plays far off behind them.
- **The world:** with three or more pages, the school dresses and rolls its anomalies one act further gone.

`engine/test/story.test.js` covers all of this.

### Phase 5: transitions
- **The opening:** the first moment of a night is black, then a card ("Friday — the last day of term. You came in late.") while the engine waits, then the corridor fades up over 2.6 s.
- **Doors you hear first:** a classroom is rolled when you come within 6 m of its door, so its interior is built before you open it (no pop). What's behind it leaks through the closed door, muffled:
  - pencils and chalk for a lesson
  - a voice reading for Story Time
  - a slow music box for a lone child
  - nothing at all for a class facing the wall
- **Not done yet:** a scripted first five minutes beyond the card, and doom variants.

### Phase 3, second pass: teachers and architecture
**Teachers (`TEACHERS` in `school/src/art/school.js`):** five specs, each with a dress colour, a shawl or none, a bun or long hair, eyes (monocle, milky glasses, or two holes punched through the paper) and a mouth (wide with teeth, stitched shut, or a thin red painted smile).
- Each spec paints her front and her back, and each room picks one.
- The first is painted at boot; the rest are painted while you play.
- The doom face is the room's own teacher.

**Architecture per wing (render only):**
- **Infants:** low 2.55 m ceilings, with bunting and paper chains strung across the corridor.
- **Science:** a 2.6 m ceiling, with pipes and a valve wheel along the top of every wall.
- **Old:** a tall 3.5 m ceiling, globe lamps hanging on rods, cobwebs high up, portraits of former headmasters (all of them him), and the HEAD BOYS honours board with 1960 scratched out.
- **Everywhere:** ceiling vents. Late in the night there's sometimes something behind one.
- **Where wings of different heights meet:** a strip of wall closes the gap.

**The sameness grid (`school/tools/sameness.py`):** drops the camera into 12 random corridors across wings and times and tiles them into one image.
- Before this pass, the wings differed in material, but every tile had the same corridor shape.
- After it, almost no two tiles could be swapped unnoticed.
- The old wing was too dark to read at all; the panelling is now brighter.

**Checks:** the 3-minute wander soak ran at 60 fps with up to ~200 draw calls and no errors. 105/105 engine tests pass.

### Playtest reels and the pacing fixes they forced
`school/tools/reel.py` lets a scripted agent play the real game and tiles a frame every ~20 s with the clock, the director's phase and tension, and the latest events. It's the closest I can get to sitting through a night.

**Reel 1 (wander, Act I, 5.4 min) showed:**
- **Tension sat at 0 ("calm") the entire time.** Small things decayed at 1.5/s before anything could build. The tension model was rebuilt:
  - slow decay while it's quiet (0.2/s), and the fast 1.5/s only above 40
  - dark corridors +0.5/s
  - small bumps for a sound somewhere (2.5), the PA (3), walking into a corridor that's gone wrong (4), a room that isn't a lesson (2), the lone child (6), the Hall doors (4), seeing him arrive (6)
  - **silence builds:** after 35 s with nothing happening, +0.35/s until something does
  - **a rising floor:** +0.25 per game minute past 1:00 (30 by 3:00)
- **The ambient deck repeated** (a ball bouncing down the stairs four times in 100 s). It now never repeats one of the last three.
- **Ten minutes of Act I without ever seeing him is too long.** There is now one glimpse of him in Act I, 150–240 s in (later if an apparition took the slot).
- **Hiding in a locker still showed the open corridor.** It's now black metal and the corridor through four slits.

**Reel 3 (after the fixes):**
- calm, building 4 → 19 over four minutes
- the glimpse at ~4:30 tips it into unease, 26–31, where it holds

**Reel 4 (lesson agent from 1:40):**
- Story Time, Hand In with locked doors, a strike to dread (54), an aftermath, the class facing the wall, then him killing the lights around 2:18 and a hide.
- It also exposed two agent bugs: the agent never left a locker after a glimpse, and it walked in and out of a room with no lesson forever. Both fixed.

**Also:**
- **Doom differs by lesson:**
  - *Hand In:* they stand and their heads snap down.
  - *Eyes:* every head turns to you in their seats, then every light dies.
  - *Story Time:* they stand while the lights stutter, then the snap.
- **Cross-night memory:** the anomalies you walked into last night are held back tonight.

### The true ending (was deferred)
With all five pages, the Hall doors are no longer chained. It goes black, then four cards: "The chain is gone." / "Every chair in the Hall is taken but one." / "The register is read to the end. Your name is the last." / "Everyone is here. Everyone can go home." Then the doors flood with daylight, over the hymn and one ring of the bell. HOME TIME: everyone went home. It is marked in localStorage (`homeTime.trueEnding`). The front-door escape is still the other way out: alone, with stars. Tested in `story.test.js`.
- Boot experiment: removing the light loop's dynamic break did not change the ~3 s first-upload wait, so it is the GPU/driver warm-up, not shader complexity. Reverted.

### Phase 8: the last bell, and rare nights (after the v2 commit)
**The opening (`engine/modules/opening.js`).** Wrongness needs a baseline, and the night used to start already dark. Now every night opens on an ordinary school:
- The card varies by night (`openingCard` in `engine/story.js`): "the last day of term. You came in late." on the first night, "Again." on the second, then other lines. With pages held it says "Everyone else is already in the Hall." or "Someone has kept your seat."; after the true ending, "You went home. You came back anyway." Nights you actually began are counted in localStorage.
- **Day (first 7 s):** every corridor is lit end to end, the fog is pushed back, and children are heard through the walls (the playground recording, low-passed; quieter on later nights).
- **The last bell:** the children stop dead under the bell. The lights go out bank by bank from the far end toward you (`dayLit` in `engine/lights.js`, 3.5 s), with a clunk for each bank.
- **Then black and silence.** The tubes over you die last and stutter back on about a second later, and only those. The PA speaks into that quiet.
- The corridor you start in is *canonical* until Act II: fully lit, with no anomalies. This was meant to exist already; the flag was read but never set.

**Rare nights (`engine/modules/rare.js`).** About one night in three (34%), once, 200–560 s in, at the first quiet moment: you're not in a room, on the stairs or hiding, he's absent, and the phase is calm to dread. The last three kinds you've had are held back (`homeTime.seenRare`).
- **Procession:** a crocodile of children, two by two, crosses the next junction ahead in silence, under a pool of light. If there's no junction, the lights blink and they're standing in your own corridor a few metres away, then walk off into the dark. The last child stops and looks at you. Walk toward them and they're gone. The only sound is small feet.
- **Fire drill:** 20 s of the fire bell and emergency lighting everywhere. Your noise is zero while it rings, so it's the one safe time to run. Five seconds in, a whole school's worth of small feet runs from behind you, through you, and on ahead. It ends with "Everyone went out. Nobody came back in."
- **The register:** the PA calls a class. The answers stop partway ("Michael Hart." … "Michael Hart."). It ends "Everybody is in the Hall." … "Everybody but one."
- **Sanctuary:** the next corridor ahead has every light on, a cleaner's bucket and mop, and a radio playing the music-box choir. Inside it, tension falls fast and no visit can start. Leave and its lights go out behind you, and the radio stops. If you never walk in, it's gone after 90 s.
- Tension bumps: rare 4, the procession's look 10, the rush 8, each register line 0.9.

**Checks:** 119/119 engine tests, with new `opening.test.js` and `rare.test.js`. Scenes `opening` and `rare` (`scenes.py rare rare=<kind>`) were looked at frame by frame. They forced two fixes:
- The day frame first read as identical to night (the ambient raised too little), and the start corridor stayed lit through the sweep, so the dark never reached you.
- The procession was first in single file straight away from you (only the nearest child visible), at 16 m (specks in the dark), turning only once it was in the dark.
