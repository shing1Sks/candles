# The Long Way Home

You are seven. It's late. You're walking Biscuit home.

One night, one road (about 1.6 km, roughly 12–20 minutes), first person, a child's eye height.
Design, research mapping and the build log: `../research/08_walk_home.md`.

## Play

```
cd walkhome
npm install      # once
npm run dev      # then open http://localhost:5184
```

| Key | |
|---|---|
| WASD, mouse | walk, look |
| Shift | run (you run out of breath) |
| C | crouch (behind a hedge or a car, with Biscuit quiet, he loses you) |
| E | pick Biscuit up, put him down; at a front door, ring the bell; answers a ringing phone; on a park bench, sit a moment |
| F (hold) | kneel and stroke Biscuit; it calms him |
| Right mouse / Q | tug the lead |
| R | squeak his toy (call him; if he's run off, he answers. It carries) |
| [ ] | mouse speed |
| Esc | pause |

The one rule nobody tells you: **he only moves when you're not looking at him.**
(Children's rules have holes: you can only see him in the light; lamps he's under flicker and die;
and you can't keep your eyes open for ever.)

## URL switches (for testing)

| | |
|---|---|
| `?go` | skip the title and intro |
| `?s=700&l=2.5` | start at 700 m along the road, 2.5 m right of centre |
| `?stats` | fps, draw calls, where you are |
| `?fear=0.8` | force the fear level |
| `?bot&ts=3` | let the playtest bot walk it, at 3× speed |
| `?studio=puppy` / `?studio=tall` | turntable studio for one model |
| `?fixres` `?noshadow` `?nolamps` `?nonormal` | performance probes |

## Tools (Python + Playwright, dev server running)

- `tools/shots.py <out> name:s:l:yaw:pitch[:fear] ...`: stills at places on the road.
- `tools/scenario.py <out> <name>`: scripted moments (`visit`, `stare`, `hide`, `ahead`, `bell`, `belly`, `hands`, `human`, `gnome`, `van`, `catch`, `ending`, `models`...).
- Long runs: start the no-reload server `npx vite --config vite.test.config.js` (:5185) and set `WH_PORT=5185`, so editing code doesn't reload a run.
- `tools/night.py [timescale] [minutes] [seed] [outdir] [start s]`: a whole night with the bot, with a timeline log and frames.
- `tools/walk.py`, `tools/perf.py`, `tools/studio.py`.
- `tools/fetch_audio.py`: the outdoor sound set (BigSoundBank, CC0; each page checked; credits written). `tools/make_synth.py`, `tools/make_synth2.py`: the synthesised sounds (whistle, van, music box, coat, knocks, fox, doorbell, Shepard tone...).

## Where things are

- `src/sim/`: road, town layout, the boy, Biscuit's mind, the Tall Man, the director (deterministic, seeded).
- `src/render/`:
  - houses, windows (interior mapping), street segments and far LOD;
  - lamps, sky, post (ink, bloom, grade);
  - Biscuit (shell fur), the Tall Man;
  - encounters, regions (shops, park, bridge), details, fx (leaves, mist, rain, moths, smoke), the ending.
- `src/audio.js`: positional sound, beds, the town's life, the score.
