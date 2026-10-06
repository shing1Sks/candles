# Walk prototype: a grey forest

A first-person 2.5D paper forest. Painted cards stand in 3D and turn to face you. The world moves in 12 fps stop-motion while the camera moves smoothly. Everything is painted procedurally at load, about 15 s on a laptop, using the concept-sheet brush engine in `../concepts/`.

```
npm install
npm run dev        # http://localhost:5181
```

**Controls:** WASD walk · Shift run · mouse look · hold click (or E) to reach · right-click (or Q) to let a petal go · Esc to stop.

**Test modes:** `?auto` walks hands-free; `?auto=still` stands still. `window.__gn` exposes the state, the systems and `RULES` for scripting. `tools/scenes.py` screenshots every mechanic and `tools/perf.py` profiles (both use Playwright with the real GPU).

## How it fits together

| File | What it owns |
|---|---|
| `src/rules.js` | **The rulebook.** Every probability, distance and timer. The models will learn these. |
| `src/state.js` | **The game state hub** (`S`) plus `emit()`. Systems read and write `S` and announce what happened as events. |
| `src/main.js` | The loop: input, movement, camera. Steps every system at 12 fps and routes events to voice, sound and effects. |
| `src/world.js` | Chunked forest generation (groves, clearings, ordinary forest), props, bunnies, the swing, leaves, birds, collisions. |
| `src/petals.js` | Stray petals: catching, pinning to your hand, dropping, flying back to the field. |
| `src/field.js` | The bloom hazard, the pop-up field, the reach roll, the dissolve. |
| `src/entity.js` | The double-sided entity: peek, duck, emerge, flip, hunt, petal, remember, wave, behind, vanish. |
| `src/mist.js` | Mist banks and mist events. |
| `src/hands.js` | First-person hands (rest, walk, sprint and reach poses; knuckle-pin springs; the petal flower). |
| `src/fx.js` | Torn screen edges (dread), the crumple when caught, the colour flood and ending card. |
| `src/audio.js` | Loads `assets/audio/*` (served at `/audio/`), crossfades the calm/dread beds, plays SFX; synthesised fallbacks. |
| `src/art.js` | Rigged paper puppets (one texture per part, a pivot at every split pin) and all props, painted at load. |
| `src/sprites.js` | Far-to-near draw order for the transparent paper pieces, billboarding, culling past the fog. |

**Performance:** roughly 25–50 fps on Intel Iris Xe at 1280×760. Keep full-screen CSS blend layers unmounted when they aren't in use; the colour flood alone dropped the game to 1 fps.
