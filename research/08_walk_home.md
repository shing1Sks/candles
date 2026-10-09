# 08: *The Long Way Home*, design and build log

Status: **in progress, built autonomously overnight from 2026-10-09.** It follows the designer's brief, which was the last prompt before they went to sleep.

The style mockups that led here are in `assets/art/walkhome/`; the first-person picture-book frames are in `fp/`.

## The brief, as given

- **The game:** one night and one walk. A small boy walks his puppy home through a nightmare town. The threats are both real bad people and things that aren't people. The town is a never-ending, maze-like walk home.
- **The look:** the picture-book "nightmare" style in first person, with ink lines, but **really 3D**: depth in everything, *"a design concept that sits in reality."* There should be less light than the mockups had. The road should be very long and run into the horizon.
- **Nothing static, ever.** The tiniest details matter (*"look at one of those windows and think: I can do this, I can do that"*). Every stretch should have gradual phases, and nothing should repeat.
- **Use the horror research** (`05`, `06`), point by point, in depth.
- **Minimalist and simple, yet stunning.** "Visuals do 90% of the job, then the effects."
- **The puppy:** it should be good to look at and always visible. It's the essence of the thing.
- **Iterate by playing.** Finish a version, play it, learn, change it, and keep going. Don't stop.

## 1. The pitch

You are seven. It's late, too late. You're walking Biscuit home.

Your house is at the top of the hill at the end of the road. You can see its lit window from the moment you start. The road goes on, and on.

It's the town you know, the way you'll describe it tomorrow: houses too tall, leaning in; lamps bowed over like they're looking at you; a man in a tall hat who is always somewhere behind you when you turn round.

Biscuit is the only warm thing in it, and Biscuit knows before you do.

## 2. What makes it scary (from 05/06), and where each idea lives in this game

| Research principle | In *The Long Way Home* |
|---|---|
| **P1** terror beats horror | Most of the walk is anticipation. The Tall Man is seen whole perhaps three times. |
| **P2** creepy is ambiguity | Is that a man under the dead lamp, or a coat on a hook? Was the gnome facing the road before? |
| **P3** tension/release cycles | A **Walk Director** with phases CALM → UNEASE → DREAD → HUNT → PEAK → AFTERMATH. Lit lamps and "home-ish" stretches give the relief. |
| **P4** a director that knows, a monster that doesn't cheat | The director only places the Tall Man *behind* you, at a distance. He hunts with sight and hearing; Biscuit's barking is noise. |
| **P5** sound first | You hear his slow footsteps on the cobbles and a tuneless whistle before you see him. Biscuit's growl is the warning. |
| **P6** jump scares are seasoning | At most one real stinger every five minutes, always after a long build. False scares (a cat off a bin, a car alarm) come as release. |
| **P7** a scare teaches a rule | The first time a lamp dies behind you and he's standing under the next one, every dying lamp afterwards means him. |
| **P8, P9** baseline, then the space changes when you're not looking | The first street is the canonical one. Later you pass *the same signpost again*, but its arms point another way. The post box comes round again, and something is wrong with it (Exit 8 / P.T.). |
| **P10** randomised, with memory | An encounter deck rolls by seed, with no repeats in a run. |
| **P11** rule monsters need tells | **He only moves while you aren't looking at him.** (SCP-173 and Weeping Angels, reworked for a child: "if you look at him he has to stand still".) Biscuit pulls, you look forward, and he gains. Tells: his whistle, lamps dying between you, Biscuit's ears. |
| **P12** *feel* dark | Pools of sodium light with near-black between them, wet cobbles catching every lamp, ground mist, and a moon behind cloud. True black only where light is the mechanic. |
| **P13** information scarcity | No meters. Biscuit is the radar: wagging, then ears up, then a growl, then whimpering and pulling back. |
| **P14** mundane first | The first two minutes are a nice walk: sniffing, a cat, a neighbour's TV. |
| **P15** "what happened here?" | LOST posters on the lamp posts tell the story without a word (§6). |
| **P16** fear emitters | The audio layers swell with *his* distance, not with time. |
| **P17** safe, not quite | A lit lamp is safe: he won't step into its light. But lamps die. |
| **P19** child scale, no gore | Eye height 1.05 m. Adults' houses are enormous. Nothing gory, ever. |

## 3. The core loop (moment to moment)

- **Walk.** Biscuit is on a lead and wants to go places: sniffing lamp posts, peeing on bins, chasing leaves. You feel the lead pull your view and slow you. Tug (RMB) to bring Biscuit in.
- **Look back.** You can't watch behind you and walk forward at the same time. That is the whole game in one sentence.
- **Carry.** Press E to pick Biscuit up. You run slower and tire faster, but Biscuit is quiet and safe.
- **Pet.** Hold F (or hold Biscuit). A scared puppy barks, and barking is noise he can hear. Petting calms Biscuit. The loving act is also the survival act.
- **Hide.** Crouch (C) behind hedges, cars and bins. It only works if Biscuit is quiet.
- **Run.** Shift. It's loud and tiring. Run from light pool to light pool.
- **Lose the lead.** If he gets close and Biscuit panics, the lead can slip. Getting Biscuit back is worse than any chase.

## 4. The road (gradual phases: nothing stays the same)

One continuous road of about 1.6 km, uphill at the end. It passes through regions, each with its own art, sound and encounter deck:

| # | Region | Look | Sound | Feeling |
|---|---|---|---|---|
| 1 | **Our street** (0–250 m) | Picket fences, gardens, warm windows, a TV glow, cats | A TV through a window, wind chimes, a distant train | Safe, with one wrong thing (the HOME signpost) |
| 2 | **The long street** (250–600 m) | The same houses, taller and narrower, lamps dying, curtains closing as you pass | Wind, leaves, his whistle, once | The first followed feeling |
| 3 | **The high street** (600–950 m) | Closed shops: a butcher with hooks, a toy shop of dolls facing out, a launderette still spinning, an ice-cream van parked | Hum of the launderette; the van's tune, slowed | The real people: the van, a man in a doorway |
| 4 | **The park edge** (950–1250 m) | Railings, black trees, a playground with a swing going, a canal bridge | Water, owls, the swing's creak | Hunted; the darkest stretch |
| 5 | **The hill** (1250–1600 m) | The road climbs; fog; the houses lean right over; home's window ahead, getting bigger | Your breath, wind, Biscuit's panting | The run home |

Within each region, every 20–40 m the **encounter deck** deals something: a vignette, an anomaly, a tell or a quiet stretch. The director chooses by phase and keeps the spacing rules from 05 §2.

## 5. The Tall Man and the real people

- **The Tall Man.** He's 3 m tall, in a long coat and a stovepipe hat, with a pale face and a painted-on smile. His arms hang past his knees.
  - **He moves only when you aren't looking at him.** "Looking" means he's in your view cone *and* lit (or within 6 m).
  - He prefers the dark between lamps and won't stand in a lit pool. Lamps die as he passes (the tell).
  - He hears noise: running, barking, tugging the gate.
  - The director spawns him behind you, out of sight, and pulls him back after a PEAK.
  - If he reaches you: black, and you wake at the last lit lamp you passed. **Biscuit is still with you, but frightened**, so the price is fear, not loss.
- **The van** (high street). An ice-cream van, parked, playing its tune slowed down. Its window slides open as you pass, and a voice says "*Is that Biscuit? Come here, Biscuit.*" Biscuit wants to go and pulls hard: a tug of war. The voice knows the name. Then the headlights come on behind you and it crawls after you.
- **The neighbour.** A woman at her gate in a dressing gown, holding a biscuit out. Biscuit pulls. Up close her smile is too wide. Walk past without stopping.

## 6. The story, never stated (environmental)

**LOST posters** on lamp posts, discovered in order as you walk:
1. LOST DOG, "answers to Biscuit". It's a drawing of *your* puppy. (Are you lost, or is it?)
2. Another LOST DOG, older, faded, the same puppy.
3. **MISSING: have you seen this boy?** A drawing of a boy in a red bobble hat. *You.* Under it: "last seen walking his dog".
4. The same poster, older, curling, with a date decades back.
5. On the hill: dozens of them, layered on every post and fence, all of you.

**The house.** Its lit window gets closer. At the door, the porch light comes on. Biscuit runs in. The door is open; warm light; a woman's voice says your name. Last card: inside, on the hall table, a framed photo of a boy and a puppy, and a MISSING poster, taken down, folded. *Home.*

Never explain it. The gutter is left empty.

## 7. Visual direction: *"a design concept that sits in reality"*

Reference points:
- **Monster House** (2006): a CG suburb at a child's scale, with stylised shapes but real materials.
- **Coraline / Laika**: stop-motion. Everything handmade and tangible, with real textures, real light and real depth of field.
- **Little Nightmares**: child scale.
- **Among the Sleep**: first-person child.
- **The Exit 8**: a baseline you learn.

What that means in practice:
- **Shapes from the drawing, materials from life.** Leaning, witch-hatted houses, built from real brick (with normal relief), slate shingles, painted clapboard, glazed windows, and wet cobbles that mirror the lamps. Everything gets roughness variation; nothing is a flat colour.
- **The ink stays, but thin.** A depth-based ink line in post traces silhouettes and creases, so it reads as an illustration *lit like reality*.
- **Windows have rooms behind them** (an interior-mapping shader): wallpaper, a lamp, furniture silhouettes, curtains. Some rooms have someone standing in them. Curtains close as you pass.
- **Dark.** Sodium pools with black between, a moon behind moving cloud, ground mist, and a long line of lamps running into the fog toward the one lit window on the hill.
- **Nothing static.**
  - Wind in trees, hedges, washing and lamp cables.
  - Leaves skittering across the road; moths at lamps; dust in the beams.
  - Chimney smoke; flickers; TVs in windows; curtains twitching.
  - Crows shifting on the wires; clouds crossing the moon; mist drifting.
  - Biscuit is always moving: tail, ears, breathing, sniffing.
- **The world reacts to fear.** The houses lean in with the director's tension, so the street literally closes over you when he's near. It's done with a vertex shader uniform, so it's cheap.

## 8. Tech plan

- `walkhome/`: a Vite and three.js app (port 5184). The sim (deterministic and seeded) is kept separate from the render, so tools can drive it.
- The road streams in 24 m segments: built ahead, freed behind. The town generator is seeded per segment and region.
- Lighting:
  - lamp light comes from a custom uniform array of the nearest lamps, injected into the standard materials, so they all get proper specular on the wet cobbles;
  - one moon shadow follows the player;
  - one real shadowed SpotLight sits on the nearest lit lamp.
- Post: ACES, a cheap bloom, depth ink lines, grain, vignette, and adaptive resolution for the Iris Xe.
- Tools: Playwright playthrough and screenshot scripts, an fps soak, and a reel.

## 9. Build log

(Each entry: what was built, what playing it showed, and what changed.)

### Pass 1: the walkable town (2026-10-09, overnight)

What was built (`walkhome/`, Vite on :5184):
- **The road and town:** seeded, deterministic, ~1.6 km. The road wanders, rolls, humps over the canal and climbs the hill (`sim/road.js`). The whole town (houses, lamps, props, trees, telegraph poles, park, posters) is laid out once from the seed (`sim/town.js`).
- **Streaming:** 24 m segments, built ahead and freed behind. Each segment is one merged mesh per material (`render/kit.js`).
- **Materials:** procedural PBR on canvas (albedo + height→normal + roughness) for every material (`render/textures.js`). Brick, clapboard, render, fish-scale slates, granite setts, slabs, grass, wood, painted iron, hedge, bark.
- **Shader injections** into three's standard material (`render/materials.js`):
  - *lean*: houses breathe and lean in with fear;
  - *lamps*: the nearest 10 lights go through the real BRDF, so wet setts catch every lamp;
  - *wind*: hedges, washing and trees sway.
- **Houses** (`render/house.js`): plinths, quoins or corner boards, string courses, recessed sashes with sills and lintels, shutters (some hanging), bay windows, panelled doors under fanlights, steps, porches, gutters and downpipes, crooked chimneys with pots, dormers, turrets, witch's-hat roofs with a flared skirt, steep gables. Everything is warped, twisted and leaned in the house's own frame.
- **Windows** (`render/windows.js`): interior mapping, so every pane has a room behind it (wallpaper, floorboards, rug, ceiling lamp, wardrobe or doorway, furniture, curtains). Some are TV rooms flickering blue. With fear, figures stand in rooms. "Watcher" windows close their curtains as you pass.
- **Lamps:** swan-neck cast-iron posts with a hood like a bowed head; mist beams with drifting dust; far lamps as points all the way up the hill to home's window.
- **Post** (`render/post.js`):
  - depth-based ink lines (silhouettes and creases, thinning with distance);
  - bloom and ACES tonemapping;
  - violet-shadow / warm-highlight grade;
  - fear desaturation, vignette and chromatic fringe;
  - grain;
  - adaptive resolution.
- **Biscuit** (`render/puppy.js`, `sim/puppy.js`):
  - *Model:* 12-shell fur (strands droop and trail motion); spring ears, wagging tail, blinking glossy eyes; a collar with a tag and a blinking light.
  - *Behaviour:* leads; sniffs lamp posts, bins and gates; pees; looks back to check on you.
  - *His warnings:* ears up, then growl, then hide behind your legs, whimper, bark.
  - *Comfort:* stroking (F) and carrying (E) calm him.
  - *The lead:* pulls you (`P.pull`); tug it to bring him back.
- **The hands and lead** (`render/viewmodel.js`): a navy sleeve, knitted cuff and red mitten. The lead is a 26-point verlet rope that sags, snaps taut and drags on the ground.
- **The Tall Man** (`sim/tallman.js`, `render/tallman.js`):
  - *Look:* 3 m, wool frock coat, stovepipe hat, porcelain face with a painted smile.
  - *His rule:* he moves only when you're not looking. Peripheral vision doesn't count, so you can catch him moving at the edge of the screen. Looked at, he's frozen mid-stride.
  - *Pursuit:* far and unseen, he closes fast; near, he stalks or rushes.
  - *Light:* lamps near him flicker and die, and he waits at the edge of a lit pool until its lamp goes.
  - *Senses:* he hears barking and running; crouching behind cover with Biscuit quiet loses him.
- **The director** (`sim/director.js`):
  - *Acts:* our street is the baseline, then one glimpse far ahead under a lamp; the long street brings stalk visits; the park and hill bring hunts.
  - *Phases:* CALM → UNEASE → DREAD → HUNT → PEAK → AFTER. AFTER relights his lamps one by one, nearest first.
  - *Getting caught:* black, then you wake under the last lamp you passed, Biscuit pressed against your legs.
- **Sound** (`audio.js`, `assets/audio/walk`):
  - *Sources:* 43 CC0 recordings from BigSoundBank, each page checked (`tools/fetch_audio.py`, credits in `CREDITS.md`, per-sound slices detected). Plus synthesis (`tools/make_synth.py`): his whistle ("London Bridge", slow, flat, echoing), the ice-cream van's warped Greensleeves, a lamp failing, a sub thud, ringing ears.
  - *What plays:* HRTF positional sound with air absorption; region beds; the town's own life (owls, a dog behind a door, cats, chimes, a train far off, a gate); Biscuit's panting, growls, whimpers and barks; his whistle, and footsteps that stop when you turn; lamp buzz and failure.
  - *Music and fear:* the score comes in with fear and drops out before the peak; heartbeat; the world muffles with fear.
- **Regions:**
  - *Our street:* picket fences and gardens.
  - *The long street:* tall terraces behind iron railings.
  - *The high street:* shopfronts with painted signs (some under brass lamps), real 3D displays (dolls in rows, one facing the wrong way; the butcher's hooks; a launderette drum still turning), and a newsagent's board: SEARCH FOR BOY GOES ON INTO NIGHT.
  - *The park:* railings and pillars, the gate, a playground (a swing moving on its own, the roundabout turning), benches, a pond with reeds.
  - *The canal bridge:* a balustrade a child can see through, the canal 4 m down, towpath walls, a moored narrowboat with a lit porthole.
  - *The hill:* the houses lean hardest.
  - *Home:* at the top, the only straight house.
- **The story on the lamp posts:** LOST DOG (Biscuit), fading; then MISSING (a boy in a red bobble hat, "last seen walking his dog"), the dates older as you climb (2019 … 1951); on the hill, every post and fence is covered.

What playing it showed, and what changed:
- The first frames were too bright and washed: halved the ambient and moon, and lowered exposure and lamp power.
- Window glass faced into the walls: flipped the winding. The setts looked like coins: rewritten as rounded blocks at a real scale.
- Biscuit was invisible: at a child's eye height a dog 1 m ahead is below the frame. He now leads at ~2.2 m, the default view tips down 0.12 rad, he's 25% bigger, and he has a warm rim.
- The sleeve hid him: the arm is now angled down out of frame, so only the mitten and lead show.
- A negative first-frame `dt` from requestAnimationFrame exploded the physics: dt is clamped at ≥ 0.
- Tall Man v1 never gained and gave up early. Now every glance back shows him nearer, and visits end on a peak timer.
- Shop signs and displays were hidden inside the leaning walls: shops get a real ground-floor opening, and their signs and glass lean with the house.
- A child can't see over a 1.2 m parapet: the bridge got a balustrade.
- Performance on the Iris Xe: about 36–55 fps at 0.85 render scale (adaptive). 170–770 draw calls depending on the region; the high street is the heaviest.

### Pass 2: the night as a whole (things on the way, the ending, playing it end to end)

- **Encounter deck** (`render/encounters.js`). The director deals one at a time, every 26–48 m, gated by region and phase, never repeating in a night, and preferring ones not met in earlier nights (localStorage):
  - *The gnome:* always first, in our street. It's nearer and turned toward you every time you look back. It teaches the Tall Man's rule safely before he exists.
  - *Texture:* a cat on a lamp-lit gate post (eyeshine; Biscuit is lured; it hisses and drops away); a ball rolling out of an alley; a phone box ringing (answer it with E: "…Is Biscuit with you? Don't let go of him. Whatever you do.").
  - *Wrongness:* curtains closing house by house down the street; lights going out window by window toward you; people standing in rooms; a front door open with light on the path that slams as you draw level.
  - *People:* the neighbour at her gate in a dressing gown, door open behind her ("Biscuit… come here, sweetheart", then her smile widens); the ice-cream van playing Greensleeves too slowly ("Is that Biscuit? Ooh. I've got a treat for Biscuit"), whose headlights then come on and it crawls after you for 26 s; a car slowing beside you.
  - *Startle:* a big dog lunging at a gate (a false scare, 05 P6).
  - People and startle encounters hold the Tall Man off. Ambient wrongness can build into a visit.
- **Staging:** everything is placed in light (a lamp's pool, a porch, an open door). A black cat on a dark wall is realistic and invisible.
- **The ending** (`render/ending.js`):
  - At home's gate (the only straight house, every window warm), the door opens by itself and light floods the path. Biscuit runs in. "There you are."
  - The game walks you in, then whiteout.
  - The last still: a hall table, a lamp, a framed photo of a boy in a red bobble hat holding a cream puppy, a MISSING poster folded beside it, and his lead coiled where someone put it down. Then the credits.
  - First pass hung the lead on a hook; it read as a noose and was changed.
- **The opening:** fade up on Biscuit sitting at your feet looking up at you and wagging, then the view lifts to the long street and home's window on the hill.
- **The catch:** you're turned round to face him, and he folds down at the hips until his porcelain face (black almond voids, stitched smile) fills the view, lit for 0.75 s, then black. You wake under the nearest lamp behind you, which comes back on.
- **Biscuit, rebuilt from studio turntables** (`?studio=puppy`):
  - a swept body (deep chest, tucked belly) and a neck;
  - teardrop ears;
  - bigger eyes, low on the face, with two highlights;
  - fur all the way down; a curled plume of a tail;
  - finer, tufted fur.
  - Studio shots caught three bugs: brows that made him look grumpy; a brass tag rendering black against the dark sky; NaN pixels from degenerate lathe normals.
- **The Tall Man, rebuilt** (`?studio=tall`):
  - an eggy glowing head became a porcelain mask on a long skull;
  - a high collar and scarf, lapels and buttons;
  - his face kept turning sideways because of an angle-wrap bug in the head turn.
- **Lamp light on everything** (`lampify`): Biscuit, the Tall Man, the hands and the encounter props were lit only by the moon. Now every standard material gets the lamp loop.
- **Stroking:** hold F to kneel; Biscuit comes to your hand, and the free mitten reaches his head and strokes it. Carrying holds him low, face peeking up.
- **Hiding:** a darker vignette while you're hidden.
- **Bot playtests** (`src/bot.js`, `tools/night.py`). It walks the whole night: glances back, runs at peaks, carries Biscuit when he's terrified, strokes him, tugs the lead. Timeline of one night at 3× speed:
  1. gnome
  2. glimpse at ~116 m
  3. car, ball
  4. first visit at ~270 m with lights going out; figures in windows
  5. a peak on the high street, then AFTER
  6. curtains
  7. the van and a visit
  8. phone, cat, two hunts in the park
  9. a catch on the hill
  10. home
- **What the bot found:**
  - Hunts plateaued at ~9 m for 90 s (flat tension). Now he escalates to a rush after 38 s.
  - The van and a visit overlapped. People encounters now hold the director.
  - A catch cost 100–135 m. Now you wake under the nearest lamp behind you (≤ 38 m).
  - Hunts were nearly unwinnable: hunt speed is now 2.5, a rush only within 7 m, and a lamp you stand under takes 4–6 s to kill.
  - The road tangent pointed backwards (the bot walked home in reverse; the posters faced away from you).
- **Performance:**
  - Far segments are silhouettes with lit-window specks (1–2 draws each), so the road reads to ~330 m.
  - The environment map is used only where reflection shows.
  - Fur shells are cut to 8 (fewer on small parts); smoke and mist are instanced cards; resting leaves cost nothing; the moon shadow updates every other frame.
  - Iris Xe: ~38 fps at a fixed 0.85 scale; adaptive resolution between 0.6 and 0.95.

### Pass 3: details, weather, life

- **Street details** (`render/details.js`):
  - parked cars by the kerb (leaves on the bonnet; they're solid) and pillar boxes;
  - double yellow lines on the busy streets, a worn centre line on the long street, drain gratings and manhole covers;
  - a bus shelter whose timetable says "no service";
  - the old SLOW / children-running sign, and chalk hopscotch on the pavement that ends in HOME;
  - house numbers by every door, milk bottles on doorsteps, fishbone TV aerials on chimneys;
  - each region's street-name plate (ALDER CLOSE, LONG LANE, HIGH STREET, PARK ROAD, HOME HILL).
- **The HOME signpost:** three arms, all HOME, none agreeing. It's at the start, and again on the hill, turned.
- **On the hill, our street again:** a run of houses half way up are the houses you started beside (same shape, paint, gardens), taller and leaning harder (05 P8/P9).
- **Weather that turns:** dry until the park, a drizzle in it, rain up the hill.
  - Rain streaks fall in a box around you (one draw, animated in the shader, tilted by gusts).
  - The setts and slabs get glossier as it rains.
  - Rain-on-concrete and rain-on-puddle beds fade in.
- **Windows:**
  - TV rooms throw a flickering blue onto the street.
  - Lit rooms sometimes have someone's shadow walk across.
  - The lights-out wave also kills the light the windows throw.
- **Biscuit's moments:** when it's quiet he scratches an ear (back leg going), yawns, shakes himself (when wet) or sneezes. Each has its pose and sound. A proper sit: rump down, front legs straight.
- **Baked ambient occlusion** on house walls (darker toward the ground and under the eaves): the houses sit in the world.
- **Garden boundaries are solid** except at their gates. The bot (and anyone) used to walk through walls and press its face into them.
- **Pause** (Esc → "Biscuit is waiting."); first-time hints (stroke and pick up, the tug, "Don't take your eyes off him."); "Walk home again" after the credits.
- **Run it:** `walkhome/README.md`.

### Pass 4: loss, glimpses, fixes from the bot

- **Losing Biscuit:** the first time the Tall Man catches you, Biscuit bolts.
  - You wake under the lamp with the lead hanging empty from your mitten; it's a free rope now, dragging.
  - Thirty-odd metres up the road he's pressed against a garden wall, whimpering. The whimper is positional and carries further than usual. His collar light blinks red with a glow.
  - There are no visits while he's lost. Reach him and he comes back to your hand.
  - It's the stake the design was built around: the price of being caught is the dog, not your life.
- **The glimpse at a door** (encounter `alley`): 12–19 m ahead, a front door lit behind someone very tall standing in his front garden. He doesn't move while you look; look away and he's gone.
  - Getting this to read took four tries: black on black; too far and hidden behind a parked car; the light behind him lost to the 6-light budget (encounter lights now get priority).
  - It's backlit (05 R10), the faint porcelain face catches the light, and it's placed with a clear line of sight.
- **The bot reached the gate but the ending never fired:** it measured the distance to the centre of the road. Now the trigger is reaching the top of the road anywhere on the pavement.
- **Busy rules:** while he's about, the deck only deals quiet wrongness, never people. The director's phases have hysteresis (no dread↔hunt flicker).

### Pass 5 (2026-10-09, day): the user's second playtest

What the user found: no thrill for 5–10 minutes; the Tall Man "just stuck"; Biscuit through walls; a car
through a parked car; hands and dog reactions weird. And: push the sky and surroundings toward realism.
Research in `09_terror_research.md`.

- **The Tall Man can't stall any more.** His rule is still "only when you're not looking", but with a
  child's holes in it:
  - you only see him in light, or as a silhouette within about 28 m;
  - a lamp you watch him under starts to die, and he moves in the dark frames of its flicker;
  - stare too long and your eyelids get heavy (shown on screen), then you blink, and he's up to 4.5 m nearer;
  - a Tall Man withdrawing while you watch vanishes on a blink;
  - the glimpse ahead ends in a lamp stutter, and so does the figure in the doorway.
  - Measured (`scenario stare`): from 40 m he reaches you in about 30 s of staring, in steps.
- **Hide and seek.** Crouched behind a car with Biscuit quiet:
  - he loses you and searches round where he last knew you were;
  - right on top of you, he finds you; a whimper or growl carries about 15 m;
  - lost for 10 s, he gives up (`scenario hide`).
  - Noise now falls off with distance: a bark carries about 60 m, the doorbell about 30.
- **The clock paces the night as well as the road.** The glimpse comes by 80 s and the first visit about 55 s after it, wherever you are. An encounter can't hold him off for more than 30 s.
- **Omens fill every gap between visits** (13–28 s apart):
  - footsteps behind that match yours and take one more step when you stop;
  - Biscuit staring back down the road and growling at nothing;
  - a lamp stuttering ahead, eyes shining in a garden, a gate creaking behind you;
  - a TV, a phone or knocking inside a house; breathing right behind you; his whistle far off;
  - a figure at the edge of your eye that's gone when you turn;
  - the first one on the long street is always the fox scream, and Biscuit barks at it.
  - Bot night: 32 omens, 8 visits and 11 encounters on the way home.
- **Doorbells:** walk up any garden path and press E at the door. Each house answers once:
  - nothing at all;
  - footsteps down the hall that stop on the other side of the door;
  - three knocks back from inside;
  - a big dog going mad behind the door;
  - "Go home." through the letterbox.
- **Biscuit:**
  - garden walls, gates, lamp posts and cars are solid for him; he goes round by the gate;
  - he walks the way you're walking, not the way you're looking;
  - he walks, trots or gallops depending on speed, and lies down chin on paws if you stand still;
  - he looks back and wags when you look at him, and half-closes his eyes when stroked;
  - frights frighten him; call him (R, a squeaky toy) when he's lost and he yips back;
  - his collar light stutters when the Tall Man is near.
- **Hands:**
  - knitted red mittens: a fist round the lead's loop, an open hand for stroking;
  - a duffel sleeve with a turned-back cuff;
  - arms are always aimed from the shoulder;
  - the lead pulls your arm toward him; your free hand pumps when you run.
- **His face:** crazed grey porcelain, uneven eye holes weeping black, a crack, a chip off the jaw, and a wet glint of real eyes deep in the holes that follow you. At the catch, the stitched smile tears open in the middle and the face is lit from below.
- **Sound:**
  - a music-box lullaby (original) that slows and detunes with fear and stops dead when he comes;
  - his coat rustles only while he moves unseen;
  - a cooling bulb ticks after each lamp dies; a sub thump on each blink;
  - knocking, a fox, a squeaky toy and a doorbell;
  - after a fright the world goes thin and your ears ring.
- **The night, made real:**
  - **Stars** with a real brightness spread; how many you see depends on lamp glare and the region.
  - **The moon:** a flat gibbous disc (Lommel-Seeliger shading) with seas and craters.
  - **Cloud:** two layers lit by the moon, with silver edges, a corona, the town's orange on the cloud base, and the 22° halo before the rain.
  - **The town beyond:** a distant skyline with lit windows, which from the hill becomes a town below.
  - **Lamp light in the mist:** analytic in-scattering, which dies with each lamp.
  - **Wet road:** long reflection streaks from the lamps.
  - **Eyes at night:** the dim world goes blue-grey (scotopic grade), the lamps stay warm.
  - **Rain-streaked walls.**
- **Fixed:**
  - the encounter car and the van drive down the middle (there are parked cars both sides);
  - dead lamps no longer glow in the distance;
  - the moon's shadows don't swim when you look round;
  - FOV narrows when he's near.
- **Perf:**
  - loose meshes in each segment are merged by material (−170 draw calls on the high street);
  - shaders compile once at build;
  - 4 full segments ahead instead of 5 (the fog hides the 5th);
  - the lead is a tube rewritten in place.
  - Bot night: 41 fps average, 28 minimum.

### Pass 6 (2026-10-09, afternoon): things to do, people, the last run, finish

- **The last run (finale).** From 125 m out from home:
  - every lamp behind you dies in a chain coming toward you;
  - he arrives 55 m back and never withdraws;
  - he's faster than you walk and slower than you run, and adrenaline lets you run longer (stamina drain ×0.55);
  - look back to hold him while you run, but don't stare (you'll blink);
  - caught: you're back before the stretch, and Biscuit stays with you this time.
  - Tuning: the first version was unwinnable (he ran 3.9 m/s against your 3.3). Now the bot makes it on its first try with him close behind.
- **He calls Biscuit by name.** Once a visit, from the dark, a whispered "Biscuit..." (formant synthesis plus a real CC0 whisper).
  - Biscuit goes to the voice whatever his fear and drags you toward the dark (about 0.5 m/s) until you haul him back (Q / right mouse).
- **The man from the bus stop** (encounter `stranger`; real people, not him):
  - he follows at your pace, about 10 m back, and runs if you run;
  - he looks at the pavement when you look at him, and says "Evening.";
  - stop, and he walks right up to you, says "Nice dog.", and goes on past and away.
- **Doorbells**, plus a panelled front door at home.
- **Window vignettes:** someone standing facing the far wall (all night, a few rooms); later, a family at a table with every face turned to the window.
- **Chalk on the pavement:** children's drawings of a tall man in a hat: "DONT LOOK AWAY", "HE WAITS", the last at your own gate. The hopscotch reads the right way up now.
- **Biscuit:**
  - lies down chin on paws if you stand still; stroke him and he flops down;
  - keep stroking and he rolls over for his belly;
  - he licks your mitten (the hand flinches);
  - within about 5 m of the Tall Man he goes completely silent and shakes.
- **Sound:**
  - a Shepard tone under the hunt;
  - a beating low drone that swells as he nears;
  - whispers in gardens; a lick; a doorbell; a whispered "Biscuit".
- **Things you see:**
  - proper 1970s cars and an ice-cream van, rounded and two-tone, with a glasshouse, chrome and plates;
  - window light spilling onto walls and gardens;
  - walls darken and gloss in the rain; softer splash rings;
  - the last picture redone: damask paper, floorboards, a pleated lamp, his bobble hat on the hook, Biscuit's empty bowl.
- **Settings on the pause screen:** volume, mouse speed, film grain and colour fringe.
- **Fixes from an independent code review:**
  - lamp streaks and mist were painted onto the ending picture;
  - Biscuit could pop through walls after being put down or after a respawn;
  - his return on his own was a teleport;
  - the withdrawal blink stopped working after an earlier blink;
  - Tall Man state leaked between visits;
  - the eyelids darkened the screen corners even when open;
  - a "flicker" omen could fire with no lamp to flicker;
  - R made no squeak while Biscuit was lost.
- **Later in Pass 6:**
  - **The towpath.** The canal was invisible from the bridge: the ground strips ran straight over it. They now stop at the canal, so you look down to the water.
    - Crossing, you see a man on the towpath below under the narrowboat's light, face turned up to you.
    - Look away and there's a splash, and he's gone.
    - The encounter always gets its slot on the bridge approach.
  - **Him in a front room:** an omen where he stands in a lit ground-floor room ahead (he's meant to be behind you), curtains open. It matches exactly one window.
  - **The toy-shop dolls** turn their heads to follow you once the night has turned, all but the one facing the wall.
  - **The catch holds his face on you** for about a second (it was 0.2 s, too quick to register) before the dark; then the mouth tears open.
  - **Feel and hints:** running feels like it (bob, sway, +4° view); the first blink is named ("You blinked.").
  - **Performance** (1080p is the hard case on the Iris Xe, about 28–33 fps):
    - lamp glow and reflections moved to a half-res pass;
    - cheaper beams;
    - render scale floor 0.5 on big screens;
    - a lighter moon shadow map.
  - **A second code review fixed:**
    - a lure that never ended if you were caught mid-lure;
    - him appearing in several windows (bay sides, upstairs);
    - a last-run retry with no lamps left to die;
    - the stranger cut off by the deck;
    - Biscuit carried upside down after a belly rub.
  - **Gameplay clips** (bot): `assets/art/walkhome/game2/clips/` (kept out of git).

### Pass 7 (2026-10-09, late afternoon): small true things

- **Street by street, the lamps change:**
  - tungsten in your street (warm);
  - low-pressure sodium on the long street (orange);
  - mercury on the high street (a cold blue-green that makes faces look dead);
  - sodium again after.
  - Beams, the light in the mist and the reflections all follow the lamp's colour.
- **The night gets late:** lit windows go out one by one as people go to bed. Home's stay lit.
- **Biscuit hears him first:** about 3 s before each visit he stops and stares back down the road, growling. Then the whistle.
- **Him, peering round a tree trunk ahead** (omen): a top hat and a pale face leaning out from behind the bark. Hold his eye and he slides back in.
- **Your body:**
  - your breath shows in the cold, more when you've run or you're frightened;
  - your hands tremble with fear.
- **Small sounds:** Biscuit's tag jingles as he trots (and goes quiet when he does); your footsteps splash in the rain.
- **His walk** lurches with a hitch every other step, head level and locked on you. You catch it at the edges of your eyes.
- **A rare shooting star** when it's calm and you look up.
- **The toy-shop dolls** turn their heads to follow you once the night has turned.
- **The credits say how your night went:** minutes, catches, whether Biscuit ran, how often you looked back and blinked.
- **The same road every time, never quite the same night:** the director's RNG is fresh each play (unless `?seed`).
- **Mix check:** I recorded the Web Audio output during a bot visit and measured it. Quiet stretches sit about −31 dB RMS, a peak about −17 dB, no clipping. The default volume is up a touch.
- **QA:**
  - a frame every 50 m along the whole road showed no broken geometry;
  - three seeds of full bot nights all reach home with no errors.
- **More of Pass 7:**
  - **The moonlight comes and goes** as cloud crosses the moon. The CPU samples the sky shader's own cloud noise at the moon's direction.
  - **Newspapers** tumble down the street in the gusts (SEARCH FOR BOY GOES ON).
  - **The lure is captioned**, because the synthesised whisper may not be intelligible.
  - **A third code review fixed:**
    - you could step off the bridge into the air over the canal;
    - lamp beams lost their street colour after a rebuild;
    - the towpath slot could be jumped by another encounter;
    - the towpath man stood over the water;
    - a peek or him-in-a-window could come before the first glimpse;
    - a stale warning skipped Biscuit's ears-up;
    - windows that had gone dark still lit the street;
    - looks back were over-counted;
    - a shooting-star NaN guard;
    - the stride tilt leaked into the catch pose.
- **And:**
  - **A child laughing** somewhere off in the gardens (a real CC0 recording, BigSoundBank #1660; at most twice a night).
  - **Lightning on the hill:** a white instant that lights him wherever he is (and freezes him), then thunder rolling in 1–4 s later.
  - **Lost, Biscuit's collar light blinks red** on the wall beside him: a beacon to find him by.
  - **The gnome** (Act I's teacher) is bigger and glossy-painted, because he was invisible in the dark. The cat's eyes catch the light.
  - **A favicon:** the only 404 left in the console was `favicon.ico`.
  - **The peek** is capped at three a night.
  - **A bench in the park:** E to sit a moment. Biscuit settles at your feet, the music box plays, your breath comes back and the fear eases. But you're sitting still in the open, and if he comes you're up at once.
  - **The park railings are solid** (they weren't: you and Biscuit could walk straight through them). In and out only by the two gates, one each side of the canal. Gardens are the same now, both ways. The canal stops you at the bank instead of snapping you onto the bridge.
