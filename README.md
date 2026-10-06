# GameNet (working name): an experience that a neural network dreams

A grey oil-paint forest made of pinned paper, where a boy collects the world's lost colour one petal at a time. A smiling paper entity lurks, and it has another side. The goal is to run the whole thing as small looped neural models instead of hand-coded mechanics. What the models get wrong becomes the dream-horror.

Start here: `research/00_DESIGN.md`. It holds the concept, what is decided, what is built and what is still open.

| Path | What |
|---|---|
| `research/00_DESIGN.md` | Living design doc: vision, story, look, mechanics, architecture, open decisions |
| `research/img/` | Sketches, concept sheets, prototype screenshots (`walk_v2/`) |
| `assets/art/` | Painted concept cards (entity, hands, tree, bunny, colour field) |
| `assets/audio/` | Original generated music, ambience and SFX (+ generator in `src/`) |
| `spike/concepts/` | Procedural brush engine and concept-sheet designs (`python spike/concepts/serve.py`) |
| `spike/walk/` | **The walkable prototype** (`npm run dev` there). Rulebook: `spike/walk/src/rules.js` |

Order of work: experience design → mechanics (rules and probabilities) → playable prototype ✔ → data twin → engine (game state plus per-entity behaviours) → gameplay datasets → models → training.
