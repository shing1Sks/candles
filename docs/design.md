# Candles: design

A small grey 3D house on a board. You are a small kid. Blow out the candle in the corner of every room.
A monster hunts you. It is a little faster than you; your one advantage is that only you fit through the
small gaps. Across the table, a giant version of the monster is the one playing it.

## Decisions (agreed 2026-10-10)

- **The table (the user's sketch, clarified):**
  - The house is a small diorama board on a dark table in an endless dark universe.
  - Across the table sits the giant, hunched over the board with a controller. It is the one playing:
    - its thumbs move the sticks as its piece moves;
    - its eye follows the game and leans in when it hunts;
    - it looks up at *you* when it wins.
  - Everything outside the board is lit only by the board's glow. As the candles go out, the giant sinks into the dark until only its eye is left.
- **The camera puts you in the game (the user's second sketch):**
  - It sits low, just behind the kid and nearly level, and **always faces across the board toward the giant; it never turns**.
  - Walls block what is ahead, because seeing the whole room kills the thrill.
  - The board's far edge is the horizon, and the giant rises beyond it.
  - Walls and furniture between the camera and the kid dissolve, and so does a table or bed the kid crawls under.
  - The mouse wheel moves the camera closer or further. Z steps you back out to the table to see the whole board.
- **The house:** one hand-built level of six rooms (nursery, bathroom, kitchen, bedroom, playroom, cellar) inside a ring corridor.
- **The look:** only shades of grey. Candles are the only light; each one you blow out makes the house darker.
- **The monster:** a bot that plays like a person with a controller. There is no local multiplayer.
- **Winning and losing:** one touch loses; all six candles out wins. It should be very hard but fair.
- **Now: data for a learned game.**
  - Bots play each other: kid styles against five monster personas with moods, driven through the giant's
    controller.
  - Every game is recorded (`README.md`, "Making data").
  - The plan is in `docs/superpowers/specs/2026-10-10-gamenet-training-design.md`, and every rule is in
    `docs/mechanics.md`.
  - v1 is 3,600 games (80 h of play, 5.8 M steps, 7.2 GB, about 9 minutes to make).
  - Next: training the main model.

## Mechanics, and why each is there

Numbers live in `game/src/sim/rules.js`. Starting values came from research into games where this already works.

### The chase

| Mechanic | Value | Borrowed from |
|---|---|---|
| Monster faster than the kid | chase 3.55 m/s vs run 3.2 (111%) | Dead by Daylight: killers run at 110–115% of survivor speed and still lose chases to loops |
| Kid-only gaps (vents, cracks, under tables and beds) | the monster must go round: detours of 4–60 m | DbD windows and pallets: the runner's only tools against a faster hunter |
| Using the same gap 3 times in one chase | the monster stops following and waits at the other end | DbD blocks a window after 3 vaults in a chase (the anti-"infinite" rule) |
| Lunge | 0.25 s visible crouch and growl, then 5.4 m/s for 0.4 s; a miss costs 1.5 s at half speed | DbD's lunge and miss cooldown: a dodge you can see coming pays off |
| Chase speed-up | +0.15 / 0.30 / 0.45 m/s at 15 / 25 / 35 s of unbroken chase | DbD Bloodlust: long chases can't last forever |
| Heartbeat | starts 15 m away, faster and louder as it closes | DbD terror radius |
| It hears you | running 10 m (6 m through walls), vent rattle 3 m, blowing 6 m; creeping is silent | |
| A candle going out | it hears exactly where | DbD generator alert: finishing an objective starts a chase |
| Both of you almost know where the other is | you always see its eye on its stalk over the walls; it senses you every 7 s (3.5 s with one candle left), about 3 m off | the user's original rule. Alien: Isolation's director points the alien at your area but never your exact spot; Pac-Man speeds up near the end |
| Breather | after 25 s of close pressure it backs off to a far room for 9 s | Alien's menace gauge, Pac-Man's scatter phases |
| It never sees through walls | dark sight 8 m, candlelight 13 m; under a bed you are seen only within 1.4 m | Hello Neighbor and other "cheating AI" complaints |
| Blowing a candle | 1.5 s; progress is kept if you let go | the risk is getting there and away, not the button |

### Trouble in the house

These are tools and dangers beyond the chase. They give you decisions to make, and they make the house fight back.

| Mechanic | How it works | Why |
|---|---|---|
| Doors | Double doors you tap E to open or shut. A shut door blocks sight and candlelight. The monster has to open it (0.6 s) or, chasing, smash through it (0.9 s, loud). | Shutting a door in its face buys about a second and breaks its line of sight. Opening one makes a noise. |
| Wardrobes | Tap E to hide inside; you watch out through the slats. If it saw you get in, it comes straight to that wardrobe. While searching nearby, it looks inside 40% of the time. | The classic hiding place, but never fully safe (Granny, Outlast). |
| Creaky boards and squeaky toys | Twelve creaky boards and five squeaky toys give you away (7–9 m) unless you creep. The toys skid away when you step on them. | They reward creeping and punish running everywhere. |
| Toys to throw | Walk over a toy to pick it up, then Q to throw it about 7 m. It lands with a clatter heard 13 m away, and the monster goes to look. | A lure: lets you play with its hearing. |
| The giant's searchlight | Every 26–50 s its eye hangs a light over part of the house near you. It swells for 1.6 s, then drifts for 4.5 s. Caught in the open, the monster is told where you are. | Ties the giant to the board. A timed hide-or-move moment. |
| Rage | After a candle goes out, the monster is 0.25 m/s faster for 5 s and the giant slams the table. | Each candle is a spike of danger. |
| The giant's hand | Once two candles are out, every 40–75 s it lets go of the controller and reaches into the house near you. An open hand hangs over the walls while its shadow spreads (2.2 s), then it comes down. In the open, you are taken; under a table or bed, in a vent or a wardrobe, you are safe. | Escalation that stops you camping in one spot. Only this concept can do it. |

Rejected:
- the monster relighting candles (unwinnable);
- a stamina bar (UI and punishment for no gain);
- a candle with no escape route (the balance probe found the cellar candle was a death trap; it got a crack);
- the hand's grab making a noise (it led the monster straight to you every time, which was too much on top of the grab).

## Balance probe

`npm run sim` runs a rough kid bot against the monster. `OMNI=1` lets it always know where the monster is, matching the eye over the walls. The bot never uses doors to block, wardrobes or throwing, so a person should do better.

- **The eye over the walls** lifted the bot's wins from 8 to 33 of 60.
- **The monster's sense of you** was raised to match: every 4 s won 1 of 60, every 8 s won 18; we kept every 7 s.
- **With all the trouble added:** 7 of 60 won before the hand, 4 of 60 with it.
- **The rest:** most other games are stand-offs where the cautious bot hides and never commits.

That is "ridiculously difficult but beatable". Tune by playing.

## Look

### Lighting

- Lighting comes from top-down textures rather than three.js lights:
  - the kid's line of sight, with a faint glow around the kid;
  - each candle's light with wall and shut-door shadows, re-cast every frame from a flame that wanders a couple of centimetres, so the shadows breathe;
  - bounced light that spills softly round corners;
  - a baked soft contact shadow along walls and under furniture.
- Anything the kid can't see sinks into darkness. The monster is drawn in full only when the kid has line of sight; behind walls only its eye on the stalk shows above them.

### The house

- **Walls:** wallpaper by room (nursery stripes and dots, bedroom damask, playroom stripes, corridor diamonds), panelling under a chair rail, tiles in the bathroom and kitchen, brick in the cellar, and damp, drips and hairline cracks.
- **Furniture and clutter:** in every room, plus dust in the candlelight, cobwebs in corners, and drawings on the floor.

### Characters

- **The kid:** a child in pyjamas. They run, creep crouched, crawl, puff to blow out a candle, carry toys, and tremble and glance at the monster.
- **The monster piece:** a hunched furry spine with a toothed jaw and the eye on a stalk. Its arms drag their claws and its legs plant their feet. It crouches before it lunges.
- **The giant:** a six-segment spine curling over the table (further when it hunts) and IK arms with fingers on the controller. It has a head with a toothed mouth, the eye on a stalk, and about 2,400 fur strands. It slams the table, shines the searchlight from its eye and reaches into the house.

### Screen

- Walls and furniture in front of the kid dissolve in a dither, so the kid is never hidden.
- The film pass converts to grey and adds bloom on flames and eyes, gamma, vignette and grain. It squeezes and darkens the picture with fear, and adds slats when you hide.

## Performance

The game renders at about 1 megapixel at most and scales up to the window. It holds a locked 60 fps at 720p and 1080p on the target laptop (Intel Iris Xe). A profiling pass found the two big costs:
- re-uploading the light-map shapes every frame through static buffers, which stalled the CPU; they are now dynamic buffers;
- 4x MSAA, about 8 ms a frame; it was replaced by FXAA in the film pass.

## Sound

- **Sources:** recorded sounds (CC0 or public domain, plus three Kevin MacLeod tracks under CC BY 4.0, credited on the title screen) layered over live synthesis. See `game/public/audio/CREDITS.md`.
- **Ambience:** house wind and room tone, with music that rises when the monster hunts and hardens in a chase.
- **The kid:** a heartbeat that follows your fear, and footsteps that change with the floor.
- **The monster:** positional steps and breathing, muffled behind walls.
- **The giant:** breathing above, a table boom and roar when it slams, the searchlight hum, the groan when it reaches.
- **Haunts:** now and then a music box, the 1890 talking doll, whispers, a laugh or drips.
