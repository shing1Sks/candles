# 05 — Horror design research: making *Home Time* scary

Status: **research for the redesign, 2026-10-08.** Input: the designer's playtest of slice v1 (`03_slice_v1_spec.md`): *not scary yet; uniform corridors/rooms/kids; visibility too high; no scares land; tension doesn't build; abrupt transitions; some tasks infeasible; story doesn't seep in; no mystery unravelling.* This doc says what the genre has learned and turns it into concrete changes. Sources are linked inline.

The short diagnosis: v1 is a set of **rules without a conductor**. Every rule fires on its own timer (Headmaster every 70–140 s, edge events every 4–9 s), at full brightness, in identical spaces, with no baseline to deviate from and no quiet to break. Horror is built from *contrast over time*: normal then wrong, quiet then loud, dark then a pool of light, safe then not. The fixes below are mostly about adding that contrast and a director that controls it.

---

## 1. Principles

**P1. Terror (anticipation) beats horror (the reveal) beats revulsion.** King ranks the suspense *before* the monster above the moment you see it, and the gross-out last ([Horror and terror, Wikipedia](https://en.wikipedia.org/wiki/Horror_and_terror)). Mechanic: spend most of the run in anticipation; make reveals rare and short. Ref: *Amnesia*, *P.T.*

**P2. Creepiness is ambiguity about whether there is a threat.** McAndrew and Koehnke's survey of 1,341 people found "creeped out" is the anxiety of not knowing *whether* something is wrong or *what kind* of wrong ([McAndrew & Koehnke 2016, PDF](https://scottbarrykaufman.com/wp-content/uploads/2016/04/McAndrew-Koehnke-2016.pdf)). Mechanic: things that are *slightly* off (a child facing the wall, one coat too many) creep people out more than an obvious monster. Ref: *The Exit 8*.

**P3. Tension needs release, on a cycle.** Left 4 Dead's director tracks a per-player "intensity" (raised by damage and nearby kills, decaying over time) and runs **Build Up → Sustain Peak → Peak Fade → Relax**, holding the relax phase for roughly 30–45 s before building again ([Booth, *The AI Systems of Left 4 Dead*, PDF](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf); [Game Developer](https://www.gamedeveloper.com/design/the-discomfort-zone-the-hidden-potential-of-valve-s-ai-director)). Mechanic: a director that measures stress and *forces* quiet after peaks.

**P4. Two brains: a director that knows, a monster that doesn't cheat.** Alien: Isolation's director keeps a **menace gauge** (rises with proximity, line of sight, and "close on the tracker and could reach you fast"), periodically nudges the alien toward the player's area, and **pulls it away** once menace peaks. The alien itself must find you with its own senses. Behaviours **unlock over time** so it seems to learn, never as a reward for killing you ([Game Developer: The Perfect Organism](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation)).

**P5. Sound first, sight last.** Frictional keeps monsters off-screen and leans on audio; its opaque sanity effects frightened players more than a visible meter would have ([Game Developer: Amnesia's Sanity Meter](https://www.gamedeveloper.com/design/game-design-deep-dive-i-amnesia-i-s-sanity-meter-)). Lethal Company plays random ambient footsteps and growls that mean nothing, and gives monsters similar-*style* cues, so you don't know *what* is near until you see it ([Wikipedia](https://en.wikipedia.org/wiki/Lethal_Company)). FNAF has almost no music; you track threats by sound and a few camera frames ([Wikipedia](https://en.wikipedia.org/wiki/Five_Nights_at_Freddy%27s_(video_game))).

**P6. Jump scares are seasoning, and they have to be earned.** Alien: Isolation's lead writer calls them "spice"; Frictional and Red Barrels say the build-up matters more than the hit, and that once players expect them, the *expectation* does the work. Fake-outs tell the player they can relax ([Game Developer: The time and place for jump scares](https://www.gamedeveloper.com/design/the-time-and-place-for-jump-scares-according-to-horror-devs)). Build-up then release must happen in that order. Too much build-up bores; too much release numbs ([Game Wisdom](https://game-wisdom.com/critical/jumpscare-horror-game-design)).

**P7. A good scare teaches a rule.** RE1's dogs through the window work because afterwards *every window* is a threat ([Game Wisdom](https://game-wisdom.com/critical/jumpscare-horror-game-design)). Mechanic: each stinger should leave a lasting suspicion behind it.

**P8. The space changes when you aren't looking.** Layers of Fear rearranges rooms behind your back and lights them so the change only reads when you turn ([Fandom](https://www.fandom.com/articles/why-layers-of-fear-is-absolutely-terrifying)). P.T. loops one corridor and changes it each lap: the radio, the light, the fridge, the crying sink ([Wikipedia](https://en.wikipedia.org/wiki/P.T._(video_game))).

**P9. The familiar is the canvas; the deviation is the scare.** The Exit 8 is a single corridor you learn by heart. Anomalies run from a wrong sign or a poster to a man with odd proportions, a blackout or a flood. If you see one, turn back; if not, go on. One mistake resets you ([Wikipedia](https://en.wikipedia.org/wiki/The_Exit_8)). It was built in nine months from one looping space ([AUTOMATON](https://automaton-media.com/en/news/20240214-27192)). The lesson: **a baseline must exist before variation can scare.**

**P10. Randomised haunts, with memory.** The Mortuary Assistant's Haunt System rolls the demon, the events and the scares each shift, escalates over the night, and **remembers what you have already seen** so it doesn't repeat ([Wikipedia](https://en.wikipedia.org/wiki/The_Mortuary_Assistant); [Bloody Disgusting](https://bloody-disgusting.com/video-games/3726393/the-mortuary-assistant-review-narratively-involving-mechanically-inventive-and-technically-flawed/)). Phasmophobia's ghosts roll behaviours, and its ghost events kill the lights, which doubles as an honest tell ([Phasmophobia wiki](https://phasmophobia.fandom.com/wiki/Ghost)).

**P11. Rule monsters need tells, plus escalation tied to progress.** Baldi slaps a ruler on his hand as he moves, hears doors, and gets faster with every notebook and wrong answer. The game is a cheerful maths program until the first impossible question flips it ([Wikipedia](https://en.wikipedia.org/wiki/Baldi%27s_Basics_in_Education_and_Learning)). SCP-173 moves only when unseen; the blink meter was added because the statue was too easy to walk past ([Wikipedia](https://en.wikipedia.org/wiki/SCP_%E2%80%93_Containment_Breach)). FNAF's animatronics get more aggressive each night ([Wikipedia](https://en.wikipedia.org/wiki/Five_Nights_at_Freddy%27s_(video_game))).

**P12. Make it *feel* dark, not *be* dark.** Keep near-black shadows and strong contrast; use pools of light, rim light on silhouettes and directional fill. Save true pitch-black for moments where light is the mechanic ([The Level Design Book: Darkness](https://book.leveldesignbook.com/process/lighting/darkness)). Silent Hill's fog turned a draw-distance limit into the series' signature: the danger is known but not seen ([Wikipedia](https://en.wikipedia.org/wiki/Silent_Hill_(video_game))). Visage makes light a resource: darkness drains sanity, bulbs can be fixed, ghosts can't touch candles ([Wikipedia](https://en.wikipedia.org/wiki/Visage_(video_game))). Outlast's night vision eats batteries ([Shacknews](https://shacknews.com/article/99782/outlast-2-how-to-find-batteries-for-your-camcorder)).

**P13. Information scarcity.** Iron Lung has a sealed porthole, a grainy still camera and an incomplete map ([Wikipedia](https://en.wikipedia.org/wiki/Iron_Lung_(video_game))). FNAF gives you a few camera frames. Fear grows in the gaps between what you can confirm.

**P14. Spend a long stretch on the mundane first.** Most of a Fears to Fathom episode is ordinary, which is exactly why the turn lands ([Dread Central](https://www.dreadcentral.com/editorials/483398/ultra-indie-spotlight-sunday-fears-to-fathom-shows-how-terrifying-the-ordinary-can-be-2/)). Puppet Combo's lo-fi look makes you doubt what you see, and its sketchy characters are red herrings ([Bloody Disgusting interview](https://bloody-disgusting.com/interviews/3639670/interview-love-slashers-vhs-survival-horror-fuels-work-developer-puppet-combo/)).

**P15. "What happened here?" The story lives between the panels.** Smith and Worch's GDC talk on environmental storytelling borrows McCloud's gutter: placed props imply events and the player infers the rest ([GDC Vault](https://gdcvault.com/play/1012647/What-Happened-Here-Environmental)). Gone Home tells its plot through shipping forms, post-its and notes, as a puzzle you reassemble ([Game Developer](https://www.gamedeveloper.com/design/how-i-gone-home-i-s-design-constraints-lead-to-a-powerful-story)). In Edith Finch, each room *is* its occupant ([Hardcore Gaming 101](https://www.hardcoregaming101.net/what-remains-of-edith-finch/)). Little Nightmares refuses to explain, has no dialogue, and builds a big off-screen world so that every visible choice is coherent ([PCGamesN](https://www.pcgamesn.com/little-nightmares-interview)).

**P16. Proximity-driven audio layers ("fear emitters").** Dead Space attaches fear emitters to objects and enemies. Up to four music layers swell as you approach, so the score works whatever route you take ([Game Informer](https://www.gameinformer.com/b/features/archive/2009/12/11/feature-noises-in-the-dark-exploring-the-sounds-of-dead-space.aspx)). Alien: Isolation's mix eases off at unpredictable moments, because constant tension numbs, and the player never knows how long the calm will last ([The Sound Architect](https://www.thesoundarchitect.co.uk/alienisolation/)).

**P17. Safe rooms that aren't quite safe.** Signalis marks save rooms with an unmistakable red glow and soothing music, then breaks the calm with a harsh save sound and tight resources ([Dread Central](https://www.dreadcentral.com/editorials/493266/signalis-sows-terror-through-clever-save-point-design/)). Darkwood alternates day exploration with nights barricaded in a hideout, on a map re-rolled per save ([Wikipedia](https://en.wikipedia.org/wiki/Darkwood)).

**P18. Non-linear fragments plus a recontextualising frame.** Mouthwashing cuts between before and after the crash, so every new fragment rereads the old ones ([Wikipedia](https://en.wikipedia.org/wiki/Mouthwashing_(video_game))). Inscryption's game master narrates and frames your play, and the rules themselves turn out to be the story ([Game Wisdom](https://game-wisdom.com/analysis/inscryption)).

**P19. A child's scale, gore withheld.** Little Nightmares builds horror from a child's view: adults huge, doors a struggle, no gore and few jump scares ([PCGamesN](https://www.pcgamesn.com/little-nightmares-interview)).

---

## 2. A taxonomy of scares, and a scare budget

| # | Scare type | What it is | Use when | Cost (how fast it wears out) | Reference |
|---|---|---|---|---|---|
| S1 | **Texture** | Room tone, hum, painted grime, distant life | Always; it's the floor | ~0 | Lethal Company ambience |
| S2 | **Wrongness / anomaly** | Something slightly off in a known space | Once a baseline exists; 1 per 1–2 chunks | Low, if the deck is large | Exit 8, P.T. |
| S3 | **Presence tell** | Off-screen sound or light change that implies a threat | Build-up phase | Low, if it's honest | Alien: Isolation, Baldi's ruler |
| S4 | **Peripheral glimpse** | A figure gone when you look | Build-up; ≤ 1 per 2 min | Medium | Layers of Fear, P.T. |
| S5 | **False scare** | A loud harmless thing | Right after a long build-up, to release | Medium; caps at 1 per 4 min | Alien: Isolation fake-outs |
| S6 | **Stinger** | A real, sudden threat with a hit | Peak, after ≥ 30 s of build | High; ≤ 1 per 5 min | RE1 dogs, RE7 |
| S7 | **Reveal** | Seeing the threat clearly | 1–2 per run | Very high | Amnesia (rarely shown) |
| S8 | **Chase** | Pursuit with an escape route | Peak; ≥ 3 min apart | High | Little Nightmares, Outlast |
| S9 | **Rule pressure** | A timer or a rule you can break | Inside lessons | Medium; sustains well | FNAF, Baldi, SCP-173 |
| S10 | **Doom** | The fail-state scare | Only when actually failing | Very high | P.T.'s Lisa |
| S11 | **Realisation** | A story beat that rereads earlier events | Between peaks, in relax | Doesn't wear out; it compounds | Mouthwashing, P.T. radio |
| S12 | **Personal** | The game knows you: your name, your path | 1–2 per run | High | Inscryption, Story Time |

**Scare budget for a 20–40 min run (tuned for 30).** Four acts. The director (Rec. 1) enforces the budget; the numbers are starting points for `rules.js`.

| Act (clock) | Real time | Goal | S2 anomalies | S3 tells | S4 glimpses | S5 false | S6 stingers | S7 reveals | S8 chases |
|---|---|---|---|---|---|---|---|---|---|
| **I. Normal** (1:00–1:30) | 0–5 min | Baseline; teach; slight unease | 1–2 (tier 0) | 2 | 1 | 0 | 0 | 0 | 0 |
| **II. Wrong** (1:30–2:15) | 5–13 min | Creep; first threat by sound | 4–6 (tier 0–1) | 6 | 2 | 1 | 1 | 0 | 0–1 |
| **III. Hunted** (2:15–3:00) | 13–22 min | Cycles of build/peak/relax | 6–8 (tier 1–2) | 10 | 3 | 2 | 2 | 1 (Headmaster) | 1–2 |
| **IV. Unravel** (3:00–3:30+) | 22–30 min | The school burns through; final bell | 4+ (tier 2–3) | constant | 2 | 0 | 1–2 | 1 (the fire) | 1 (bell) |

**Hard spacing rules:**
- No two S6/S8 within 180 s.
- Every S6 needs ≥ 30 s of S3 build in the same chunk or room before it.
- Every peak is followed by **45–60 s of Relax**: no S3–S8, the hum returns, lights come back.
- At most 1 S5 per 4 min. After an S5, the next 20 s are clean (that's the release).
- S7 never happens in full light, and never lasts more than 1.5 s unless it's a catch.
- Edge events (*Eyes On Your Own Paper*) and Headmaster tells never overlap. One channel of dread at a time.

---

## 3. How procedural horror avoids sameness — checklist

- [ ] **Set the baseline before varying it.** The first corridors of every run come from a small, consistent canonical set, so anomalies have something to break (Exit 8; P9).
- [ ] **Multiply variety in layers, not assets.** chunk = *kit* × *dressing set* × *lighting state* × *decal/damage layer* × *anomaly (0–1)* × *audio bed*. Six small decks give thousands of combinations.
- [ ] **Each region needs a character**: palette, floor, sound and a landmark per wing, so the player can tell where they are, and notice when that's wrong.
- [ ] **Tier the anomalies**: tier 0 is barely noticed, tier 1 noticed, tier 2 overt, tier 3 dangerous. The tier unlocks with the clock and the director's phase.
- [ ] **No repeats, within a run or across runs**: a seen-history in localStorage, like the Mortuary Assistant. Show every set piece once before any repeats.
- [ ] **Empty is content.** Many doors open onto nothing happening. The director decides density; a quiet room makes the next one land.
- [ ] **Insert hand-authored vignettes** (Smith/Worch-style dioramas) as rare deck cards, with 1–3 per run.
- [ ] **Rare events (1 in 10–20 runs)** give players stories to tell and a reason to replay.
- [ ] **Mutate the rules mid-run** (Alien's unlocks): a rule you learned in Act I bends in Act III.
- [ ] **Lighting state is the cheapest variety.** The same corridor in full, patchy, dead, emergency-green and moonlit light reads as five places.
- [ ] **Persist change across runs**: the school remembers what you found (P.T.'s changing loop).
- [ ] **Test sameness**: render a 6×6 grid of random chunks per seed. If two look alike at thumbnail size, the decks are too thin.

---

## 4. Story seepage — checklist

- [ ] **Never say it.** No text states "there was a fire". Every fact is implied, at least twice, in different media (P15).
- [ ] **Use 4–6 recurring motifs**: smoke/soot, the concert programme, the hymn, locked or chained doors, *the register* (the names), keys.
- [ ] **Only diegetic media**: the noticeboard, class photos, the register, children's drawings, lost property, PA announcements, the board, the Story Time book, the Headmaster's keys.
- [ ] **Put story in the mechanics**: the hymn *is* the concert song, detention *is* why he survived, and the final bell *is* the fire alarm. When the player realises it, the systems themselves reread (P18).
- [ ] **Change the environment as knowledge grows**: the school changes with pages found (P.T.).
- [ ] **Fragments arrive out of order**: each page or photo is a different moment (before, during, after) and can be found in any order (Mouthwashing).
- [ ] **Pose questions before answering them**: a chained door, an empty desk with flowers, a name scratched off. Mystery is a question held open.
- [ ] **Reward curiosity, never gate on it**: story sits on optional paths and in valuables, never as a required reading stop.
- [ ] **Leave the gutter empty**: the last piece is inferred, not shown (McCloud via Smith/Worch).
- [ ] **A board that sums up what you know**: the title-screen noticeboard pins what you've found, with string between items once they connect.

---

## 5. Recommendations for *Home Time*

Each is tagged with the principle(s) it rests on. They're grouped so they can become plan tasks.

### A. The Tension Director (the conductor v1 lacks)

**R1. Replace timers with a Tension Director** *(P3, P4)*. `director.js` keeps `tension` (0–100) from weighted inputs:
- Headmaster menace: in view +4/s; within 14 m and audible +2/s; lights dying toward you +1.5/s
- lesson pressure: +0.5/s, +8 on a strike
- darkness exposure: +0.3/s
- recent scares: S6 +15, S5 +6
- decay: −1.5/s

Phases: **CALM → UNEASE → DREAD → HUNT → PEAK → AFTERMATH**, entered at thresholds 0/20/40/60/80, with AFTERMATH forced after any peak. The phase gates which decks may fire. The Headmaster's arrivals, ambient events and anomaly tiers ask the director instead of rolling on their own timers.

**R2. Forced AFTERMATH after every peak** *(P3, P4)*. After a chase escape, a catch-free lesson finish, or menace held ≥ 80 for 20 s: 45–60 s of relief. The Headmaster leaves, lights come back **one by one moving away from you** (the reverse of his tell), the hum returns, and no stingers fire. Players learn that surviving buys quiet, which makes the next build-up readable.

**R3. The director herds; the Headmaster hunts** *(P4)*. The director only gives him a *target chunk* (your chunk ± 1, chosen to put him ahead of you or across your path). He finds you only with his own hearing and sight. Never send him to your exact position. That's what keeps catches fair.

**R4. The Headmaster "learns" by clock, never by catches** *(P4, P11)*:
- 2:00 he pauses at lockers he passes and opens 15% of them.
- 2:30 he doubles back after losing you.
- 3:00 he opens classroom doors mid-lesson (he becomes the *Visitor*).
- After the bell he stops jangling his keys. Losing the tell *is* the escalation.

**R5. A scare ledger with the spacing rules from §2** *(P6)*. The director logs every S-type with its tick (it goes into the twin), and refuses requests that break spacing. This is also the data you need to tune the budget from playtests.

### B. The Headmaster

**R6. A staged reveal ladder across the run** *(P1, P5, P13)*. Never show him lit and whole before Act III.
1. Act I: only sound. Keys far off, a door closing down the hall.
2. Act II: a silhouette at the end of a corridor, **backlit** in the last live light pool. That light dies and he's gone.
3. Act II/III: through a door window, his coat passes, a cane tip.
4. Act III: full figure at 15–20 m, in shadow with rim light.
5. His face only at a catch, in detention, or with the hall pass (he stoops into your face).

**R7. Tells in distance bands, as a fear emitter** *(P16, P11)*:
- \> 35 m: faint keys, echoing cane taps.
- 25 m: lights start dying toward you, a clunk each.
- 12 m: his footsteps and a slow breath. A low drone layer comes in.
- < 6 m: **all room tone cuts out.** The silence is the closest tell.

Four stem layers crossfade by distance. Keep the keys unique and honest, the one sound that always means *him*.

**R8. Add ambiguity to the cheaper tells** *(P2, P5)*. About 25% of light-deaths in Acts II–III are just failing tubes (the buzz, then the clunk, with no keys after). Players learn to wait for the keys, and the waiting is dread.

### C. Darkness and visibility

**R9. Light pools with dark gaps, and black fog** *(P12)*. Ambient is near zero. Corridor tubes every ~4 m, with 30% dead at the start of the night rising to 60% at 3:00. Black distance fog at 14–18 m, so the corridor's end is never visible; it's what's *in* the dark that matters. Gaps between pools are walkable but unreadable. Rooms are lit by the board lamp and window moonlight only. This also cuts per-pixel light cost on Iris Xe: fewer live tubes.

**R10. Silhouette rules for cards** *(P12)*. Billboards are flat, which is an asset: put light *behind* figures, never in front, for reveals and glimpses, so they read as black cut-outs with a paper-edge rim. Kids in corridors stand at the edge of a pool, half in it. Faces are lit only in lessons and dooms.

**R11. Matches: light as a resource, on theme** *(P12, Visage, Outlast)*. The boy finds a matchbox (lost property, the caretaker's cupboard). Each match gives ~12 s of warm light in a 3 m radius, makes noise 0.2 on strike, and is visible to the Headmaster at 20 m. 3–6 per night. A child carrying matches in a school that burned is a story beat the player holds in their hand. Drop the match and it goes out; never let it start a fire until the story allows.

**R12. Lighting states per chunk** *(§3)*: `full` (rare; Act I), `patchy`, `dead` (moonlight only), `emergency` (green EXIT signs only; Acts III–IV), and `flicker` (the final bell). Roll them by phase. The same kit in five lights reads as five places.

### D. Variation: corridors, wings, rooms, kids

**R13. A corridor anomaly deck** *(P2, P9, P10)*. Each chunk rolls 0–1 anomaly by tier and phase, with no repeats per run. A starter set of 24:
- *Tier 0 (barely noticed):*
  - a class photo with one face scribbled out
  - one coat too many on the pegs
  - a wall clock a minute off from the others
  - a poster hung upside down
  - a door numbered 12 → 14
  - a chair down from its desk in a "closed" room seen through the window
  - a lunchbox in the middle of the floor
  - a skipping rope tied to a door handle
- *Tier 1 (noticed):*
  - every drawing in a display is of the same child
  - a fire-extinguisher bracket stands empty
  - small wet footprints lead to a locker
  - a radiator ticks in rhythm with the hymn
  - an EXIT sign reads NO EXIT
  - a child's shoes are placed neatly side by side
  - the noticeboard has one notice repeated twenty times
- *Tier 2 (overt):*
  - a child card standing facing the wall
  - soot blooms above the doors
  - ceiling tiles are scorched
  - children's shadows are painted on the wall with no children
  - the corridor runs twice as long as its chunk (Exit 8 / P.T.)
  - the hymn comes faintly through the wall
- *Tier 3 (dangerous; an Exit-8-style rule):*
  - every light in a corridor is on: walk through it and he's there at the far end
  - a child stands in the corridor who *gets closer every time you look away* (SCP-173 rule); walk backwards past, or take another route

**R14. Make noticing pay** *(P9)*. Some tier-1/2 anomalies are **warnings about the next door**:
- soot over a door means a Lights out twist
- a scribbled face in the corridor photo means One too many inside
- shoes outside a door mean Locked in

The board's *Wrong board* hints already do this; extend it to the corridor. The observant player gets a real edge, so looking hard is rewarded rather than just being atmosphere.

**R15. Per-wing art direction** *(§3)*. Divide each floor into 3–4 wings by seed region, each with its own tint (all within grey oil), floor, sound bed and landmark:

| Wing | Look | Sound | Landmark | Story role |
|---|---|---|---|---|
| **Infants** (ground) | Warm grey, crayon friezes, low pegs, paper chains | Clock tick, a music box far off | Giant painted alphabet | Story Time; innocence |
| **Juniors** | Neutral grey, lockers, times tables | Corridor hum, radiators | Trophy case with one cup missing | The default |
| **The Hall wing** | Cold sooty grey, stacked chairs, stage curtains, concert posters | Muffled piano, the hymn under everything | Double doors, chained | The fire, seen by its traces; appears from page 2 (R27) |
| **Admin** (1st) | Dark carpet, polished wood, framed headmasters | Ticking, the PA's hiss | The Headmaster's door, with light under it | Where the keys live |

**R16. Dressing sets plus a damage layer** *(§3)*. Roll per chunk:
- *after PE*: bags dropped, a lost plimsoll
- *concert rehearsal*: programmes on the floor, tinsel
- *harvest display*: tins, a paper sun
- *mopped*: a bucket, a wet sign, the floor shining in the light pools
- *lost property spill*
- *art drying*: wet paintings pegged on a line across the corridor, which you have to push through, blind for a second

On top of that, a decal layer of soot and water damage whose strength **rises with the clock**, so the school burns in slow motion as the night goes on.

**R17. A kid-variation generator** *(P2, P19)*. Build each student card from parts:
- height 0.85–1.3 m
- one of 10 hair silhouettes
- uniform piece: cardigan, blazer, pinafore or tie
- one accessory: glasses, a plaster, bunches or a cap
- a face drawn from 6 painted sets

*Uncanny budget:* Act I kids are normal. From Act II, at most 1 kid in 4 gets one wrong trait:
- eyes slightly too far apart
- a neck one segment too long
- a painted-on smile
- a face scribbled over in crayon
- a uniform from a different decade (the concert year)
- a name label from the concert register

Idle micro-motion at 12 Hz (a pencil tap, a head tilt); one "watcher" per class whose head tracks you. Never more than one wrongness per figure. One is creepy; three is a monster.

**R18. Not every door is a lesson** *(§3, P14)*. Re-weight door rolls:
- 40% lesson
- 20% empty room (chairs on desks, moonlight)
- 10% aftermath (the class asleep, a register on the desk)
- 10% one child alone, drawing; they don't look up
- 10% a store or valuables room
- 5% a vignette (a hand-built diorama: the concert costume rail, the staff room with eleven cold cups of tea)
- 5% a "wrong" room: the same room you just left; your chair is warm

Empty rooms are pacing, not filler.

**R19. Cross-run memory** *(P10)*. Store seen anomalies, vignettes and twists in localStorage. The director prefers unseen cards until the deck is exhausted. This is the Mortuary Assistant trick that keeps run 5 surprising.

### E. Making the lessons fair and tense

**R20. A three-beat telegraph on every lose condition** *(P11)*. Pre-tell (sound), then pose (picture), then the act, with ≥ 0.6 s from pre-tell to act.

*Hand In Your Work:*
- The chalk **slows and scrapes** for 0.6 s before it stops.
- She lifts her shoulder (the card's pin turns) for 0.4 s.
- Then she looks.

The current *squeak → silence* gives no warning, so it plays as a coin flip.

**R21. Make the numbers feasible, and prove it headless** *(P11)*. Hand In Your Work today asks for 10–16 papers in 70 s at 1.8 m/s, with ~30% of the time frozen. Change it to:
- 6–9 students in Act I, rising to 12–14 by Act III
- take a paper at 1.4 m, not 1.1
- delivery counts automatically at 1.5 m from her desk

**Feasibility gate:** every roll the director deals must be completed by the `lesson` agent ≥ 90% of the time with perfect play and ≥ 50% with one mistake (run in `sim.js` over 200 seeds). Rolls that fail are rerolled. It's cheap, and it ends the "impossible task" problem for good.

**R22. Strikes before doom** *(P6, P11, Baldi)*. Being seen moving is a *strike*:
- strike 1: a heads-lift, the hymn −10 s
- strike 2: she starts walking toward you, the hymn slows (the 15%-slow version)
- strike 3: DOOM

Baldi gets faster as you fail; he doesn't kill you on the first mistake. It also saves the doom scare for when it means something.

**R23. *Eyes On Your Own Paper*: shorter, with honest danger and a lying edge** *(P2, P5)*.
- Writing time 40 s, not 60.
- A pencil line visibly fills the page, so progress is felt.
- A soft vignette darkens as your pitch nears −35°, a warning at −40°.
- 0.6 s of grace on the first look-up of the night.

The edge events become a mix of *harmless* (most) and *one real test*: a whispered "you can look now, he's gone", in the Teacher's voice. Looking is doom. Teach it once, then let it be the thing players remember.

**R24. *Story Time*: the story hints honestly** *(P11, P18)*.
- At most 4 hiding spots per room.
- Line 3 always describes the page's hiding place in a child's terms ("the page was somewhere soft and dark" means the cushion or the carpet).
- Running skips ahead 1 line, not 2, and she pauses audibly first ("…*running*, were we?").

12 lines × 7 s is fine once the search is fair.

**R25. Teach each rule once, diegetically and safely** *(P11, P14)*. The first time each lesson appears in a run, the board shows the rule as a school rule ("WHEN THE CHALK STOPS, SO DO YOU."), and her first turn is slow and forgiving. Baldi does the same: the first notebook is real maths. A player who understands the rule fears breaking it. A player who doesn't just feels cheated.

### F. Story: the concert fire, in fragments

**R26. Six channels, never stated**:
1. **Environment:** soot climbing with the clock; concert posters ("END OF TERM CONCERT — FRIDAY 7 PM — ALL WELCOME"); a costume rail.
2. **The register:** teachers call it at lesson start. Names get "here" in a child's voice, but some get no answer. Late in a run, the boy's name is answered "*detention*" by a voice that isn't his.
3. **The PA:** clicks, breath, a few lines. "Would all children make their way to the hall." Later: "Would the caretaker bring his keys."
4. **The hymn:** the same tune as the concert's closing song. A page shows the programme with its title.
5. **The pages:** each a different moment (R28).
6. **The Headmaster's key ring:** visible when he stoops. One big key with a paper tag reading HALL.

**R27. The school changes as you learn** *(P8, P10, P15)*. Pages persist; let them change the world:

| Pages found | Change |
|---|---|
| 0 | Clean school. No soot. The hall wing never generates |
| 1 | Concert posters appear; the hymn gets a second verse |
| 2 | The Hall wing can generate; its doors are chained; soot above them |
| 3 | The register has gaps; flowers on some desks |
| 4 | The detention room shows a window that faces the hall, glowing orange |
| 5 | The final bell's ring becomes the fire-alarm bell; one route opens through the hall (the true ending, later) |

**R28. Out-of-order pages, recontextualised by the last one** *(P18)*. Paint the five pages as *before* (the children in a line, the concert notice), *during* (smoke, the locked door) and *after* (the boy alone, outside, looking back). Any order works; each makes the earlier ones read differently. The last page should reframe the Headmaster: did he lock them in, or lock the boy *out*? Decide privately and seed both readings. Mystery lives in the ambiguity (P2).

**R29. Story Time slowly narrates the concert, not you** *(P18, Inscryption)*. In Acts I–II she narrates the boy ("the boy crept to the toy box…"). From Act III, one line in four slips into the concert ("…and the children sang, and the big doors were shut…") before correcting itself. It's the most direct channel, and the player is busy, so it seeps in rather than being read.

**R30. Detention is the story, in mechanics** *(P18)*. Today the lines read *I will not leave*. After 3 pages they read *I did not leave*. After 5, the Headmaster's snoring stops for good, and he says, without looking up: "*You were always in here, weren't you.*" Same mechanic, new meaning. That's the Mouthwashing move.

**R31. Class photos as the evidence chain** *(P15)*. Every corridor has the same *year photo* in a different hall position. Across the night, its children fade one at a time, matching the names missing from the register. The boy is never in it: he was in detention. A player who notices this has solved half the mystery without a single line of text.

### G. Transitions

**R32. Crossfaded audio states with doors as portals** *(P16)*. A 4-stem bed (hum / unease pad / dread drone / pursuit pulse) is driven by director phase, with 3–6 s crossfades. Closed doors low-pass the room behind them. A **2 s pre-peak silence** comes before every S6/S8: the hum drops out first. Silence is the strongest transition.

**R33. Thresholds take a beat** *(P6)*. Opening a classroom door takes 1.2 s. The room's sound leaks out before you see in (the hymn's intake of breath, chalk), and the card class "settles" at 12 Hz as you enter. The lesson starts only when you're 1 m inside *and* the board has written its title. No snaps.

**R34. Aftermath rooms: safe, but not** *(P17)*. A finished room is a Signalis-style rest spot: the class asleep, a radiator ticking, a warm desk lamp, and the stamp sound with your star. The director guarantees 20 s with no Headmaster arrival while you're in it. But one sleeping child's head is turned toward you when you leave. Rest without trust.

**R35. Stairwells as decompression** *(P3)*. Stairwells are low-tension zones: moonlight through a tall window, a different reverb, no Headmaster pathing *into* a stairwell during AFTERMATH. The 13-step rule stays, but it is the only threat there, so it hits harder.

**R36. Body and camera tells for tension** *(P3)*. At DREAD and above: the paper hands tremble slightly, FOV narrows by 4–6°, and breathing becomes audible, rising with tension. At AFTERMATH: a long exhale and FOV restored. These are cheap, and they carry the transition even when nothing on screen changes.

### H. Ambient life (the school is "still in session")

**R37. An ambient event deck gated by phase** *(P5, Lethal Company)*. Positional, mostly unexplained, 1 per 20–40 s in CALM/UNEASE, none during PEAK:
- a desk lid slamming two rooms away
- a ball bouncing down a stairwell
- a tap running in the toilets
- the PA clicking on, breath, clicking off
- the office phone ringing three times
- a child's laugh in a vent
- one piano note from the hall
- the register being called faintly behind a door
- a chair scraping on the floor *above*
- a door closing ahead of you
- a coat sliding off a peg
- a whistle from the playground
- the dinner bell, at 2 a.m.

Some of them *move* in sequence, as if someone is walking the route ahead of you.

### I. False scares

**R38. A false-scare deck, used as release** *(P5, P6)*:
- a coat falling as you pass
- a paper skeleton (Halloween display) swinging into a light pool
- the class hamster cage rattling
- a radiator bang
- **the road-safety cut-out** (a life-size painted lollipop lady or child, the "Stop, Look, Listen" kind) standing in a dark doorway. It's a flat card in a game of flat cards, so it's the perfect fake.

Fire one only at the end of a ≥ 30 s build that the director *chose not to* pay off with a threat. Then 20 s clean. **Once per run, maybe**, a real threat follows a false scare 6–10 s later, while the player is laughing at themselves. Never twice.

### J. The first five minutes (scripted, then handed to the director)

**R39. A fixed opening that builds a baseline and teaches by suspicion** *(P9, P14, P1)*:

| Time | Beat |
|---|---|
| 0:00 | Black, rain on windows, a clock ticking. Fade up: you're face-down on your arms at a desk. Every chair in the room is up on its desk except yours. The board says HOME TIME 3:30 in tidy chalk. Wall clock 1:00. |
| 0:30 | The door is open. The corridor is the **canonical corridor**: full light, lockers, a class photo, a mop bucket. Distant children's voices practising the hymn, coming from far off. Nothing happens for 60 s. This is the baseline. |
| 1:30 | The second corridor is the same, but the class photo has one face scribbled out (the first tier-0 anomaly). No comment. |
| 2:00 | A door with a lesson behind it: the tutorial *Hand In Your Work*. 6 students, the board rule visible, her first turn slow. You earn a star and the stamp. Twenty seconds of aftermath. One kid's head is turned when you leave. |
| 3:30 | Back in the corridor. Far down, lights die one, two, three toward you… and stop. Keys, far off. They fade. The lights stay dead. (The first presence. No reveal.) |
| 4:15 | You round an L. A child stands at the end of the corridor facing the wall, half in a light pool. Look away and look back: gone. One small shoe on the floor where they stood. |
| 5:00 | The PA clicks on. Breath. A man's voice, slow: "*Would [the boy's name] come to the Headmaster's office.*" Click. The director takes over in Act II. |

### K. Smaller but cheap wins

**R40. The final bell is a scene, not a switch** *(P3, P18)*. At 3:25 every clock in the school starts ticking loud and in sync. At 3:29, silence across the whole school for 3 s. At 3:30 the bell rings, and once pages ≥ 3 it is plainly a fire-alarm bell. The hymn starts playing from the hall wing.

**R41. Doom scares vary within a lesson** *(P10)*. Keep 3–4 doom variants per lesson (the shriek in camera; the class standing; the lights going out and the face lit by a single match; the narrator's last line read from *right behind you*). Pick one unseen, from cross-run memory, so the doom stays a shock rather than a reset animation.

**R42. Instrument it** *(§3, R5)*. Log tension, phase and every scare to twin v2. The playtest question "where did it stop being scary?" becomes a chart: flat tension equals a pacing bug; spikes with no AFTERMATH equal fatigue.

---

## Where to start (suggested order)

1. **R1–R2, R5, R32** (director, aftermath, ledger, audio states). Everything else hangs off them.
2. **R9, R10, R12** (darkness). It's the biggest perceived change for the least work.
3. **R20–R22, R25** (lesson fairness). Removes the "infeasible" complaint.
4. **R13, R15–R18** (variation decks). Removes "uniform".
5. **R6–R8, R39** (the Headmaster ladder and the opening). Makes the first night land.
6. **R26–R31** (story channels). Makes the second night worth playing.
