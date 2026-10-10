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
- the mouse wheel moves the camera closer or further, and Z steps back to the table;
- R retries.

## Layout

- `game/src/sim/`: the rules, with no graphics (runs in Node). Every tunable number is in `rules.js`, and the maze is in `level.js`.
- `game/src/render/`: the three.js view.
- `game/src/audio.js`: synthesised sound.
- `game/tools/`: `check.mjs` (maze sanity), `sim.mjs` (headless balance probe), `shot.py` (screenshots).
- `docs/design.md`: the design and the reasoning behind each mechanic.

The earlier prototypes (forest, school, The Long Way Home) are kept under the git tag `archive/before-maze`.
