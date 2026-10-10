# GameNet: training the main model

Status: draft for review (2026-10-11).

Builds on:
- `docs/superpowers/specs/2026-10-10-gamenet-training-design.md`, the whole picture;
- `docs/mechanics.md`, every rule;
- dataset `data/v1`: 3,600 games, 80 h of play, 5.8 M steps.

## 1. The goal, agreed

- **One main model is the whole game.**
  - **What goes in:** the game as it is now, plus your controller (WASD, creep, blow, use, throw). The model never
    guesses what you press.
  - **What comes out:** everything else, including what your press *does*:
    - the kid moves, stops at a wall, crawls under a bed;
    - the candle goes out;
    - the monster's choices and moods, the doors, the giant's light and hand, catches, the win.
- **Quality first.** Pick the model size that learns the game best, train it on a rented GPU, and only then make it
  fast for the laptop (quantize, distil, the laptop's GPU). Never shrink the model to fit the laptop.

**Success:**
1. It passes the exam: the scenario suite, the same 64 rule scenarios the rules engine passes.
2. It plays 5-minute games that stay valid:
   - nobody inside a wall;
   - candles never relight;
   - a win only when all are out.
3. Its monsters play like the bots: the same outcome and event rates per monster type.
4. You play it and it feels like the game.

## 2. What the model sees and says, every 50 ms

**In:**

| Piece | How many | From |
|---|---|---|
| game, kid, monster body, pending senses, mind, 4 guesses | 9 | `schema.js` (state row) |
| candles, doors, wardrobes, toys, squeaky toys, gaps | 6 + 11 + 3 + 7 + 5 + 10 | `schema.js` |
| searchlight, hand | 2 | `schema.js` |
| the 5 × 5 tiles round each mover (kid, monster, a flying toy) | folded into those pieces | the map |
| map: rooms and corridor stretches | about 12 | the map, once per game |
| monster type: its 9 traits | 1 | `episodes.jsonl` `persona` |
| your input | 1 | `ki` |
| the giant's buttons | 1 | `gi` (pass 2 only) |

That is **about 75 pieces**. Each piece becomes one vector.
- Each kind of piece has its own small encoder.
- Each piece gets a learned "which one" tag (candle 3, door 7).

**Out:**
- **Pass 1, the monster decides.** The giant's buttons. The stick is in bins; the buttons are yes/no.
- **Pass 2, the world moves.** The next state of every piece:

  | Kind of field | Predicted as |
  |---|---|
  | moves (position change) | 128 bins per axis, plus a small correction inside the bin |
  | flags | yes/no chances |
  | one-of-n | softmax |
  | timers and levels | a value, or "unchanged / reset / ticking" as a choice plus a value |

  Plus the step's **events**: one yes/no per type, with the details as small classifiers (who, why).
- **Events follow from the state where they can.** The spike showed "candle out" is learned far better as "progress
  passes 1" than as a rare yes/no. So a candle is out when its predicted state says so, and the events head only
  carries what the state can't show (a yell's reason, a creak).

**Randomness:** every output is odds, and play draws from them at a set temperature. The monster's moods already
raise or lower its own temperature, so its choices stay reasonable rather than wild.

## 3. The model

- **Shape:** a transformer over the pieces: pre-norm, GELU, with attention across all of them.
- **One network, two passes per tick.** The giant's-buttons piece is masked in pass 1 and filled in pass 2.
- **Training:** pass 2 always gets the bot's real buttons (teacher forcing), and pass 1 learns to press what the bots
  pressed.

**Sizes to train and compare.** Quality decides. CPU times are measured on this laptop at 4 threads, int8, with 80
pieces.

| Size | Width × layers | Params | CPU, 2 passes | CPU ticks a second |
|---|---|---|---|---|
| S | 256 × 8 | 6 M | 170 ms | 6 |
| M | 384 × 12 | 21 M | 320 ms | 3 |
| L | 512 × 16 | 51 M | 620 ms | 1.6 |
| XL | 768 × 12 | 85 M | 880 ms | 1.1 |

**What that means:** the laptop's CPU can't run any of them at 20 ticks a second, so playing must use the laptop's
GPU (section 7). Training doesn't care: all sizes train on the rented GPU.

**My expectation:** M or L will be the sweet spot.
- The data has 5.8 M steps and about 75 pieces, and a model that size can learn the monster's habits, not just the
  physics.
- XL tests whether more helps at all.
- If XL wins clearly, we make more data before going bigger.

## 4. Training

**Data:**
- **Loading:** `data/v1` read as float32 memory maps.
- **Splits:** by episode, 90% train, 5% check, 5% exam.
- **Hold-out:** 200 games from a fresh batch stay unseen until the end.
- **Standoffs:** standoff rows (17%) are down-weighted to half.
- **Rare rules:**
  - rows with rare events (wardrobes, doors, the hand, endings) are up-weighted;
  - the counts from `coverage.mjs` set the weights.

**Phases:**
1. **One step.** Predict state r + 1 from state r and both inputs, plus the giant's buttons from state r.
   - Loss: cross-entropy for bins, flags and choices; Huber for the small corrections.
   - Each field kind is normalised so no field drowns the rest.
2. **Rollouts.** The model plays 8, then 16, then 32 steps on its own sampled predictions, with the bot's inputs as
   the kid.
   - It learns to recover from its own small errors, the main cause of drift in learned games.
   - Truncated backprop through the unrolled steps.
3. **Calibration.**
   - Tune the sampling temperatures on the check split so outcome and event rates match the bots per monster type.
   - Train with a small chance of a randomly wrong button, so it stays robust to odd inputs from a person.

**Compute** (a rough estimate; prices are checked before renting):

| | M | L |
|---|---|---|
| One-step training, one rented GPU (A100 / 4090 class) | about 2–3 h | about 6–8 h |
| Rollout phase | about the same again | about the same again |
| Rough cost | $10–$25 | $10–$25 |

The cost range covers the whole size sweep. Runpod is available here. Nothing is rented without your go-ahead on
the exact machine and hourly price.

## 5. The exam

1. **Per field, one step:** position error, flag and choice accuracy, timer error, per kind of piece.
2. **The scenario suite on the model.**
   - `schema.js` gains `decode`: the inverse of `encode`, turning a row back into a game state.
   - Each scenario in `scenarios.test.mjs` sets its moment in the rules engine, encodes it, lets the model run the
     steps, decodes, and checks the same outcome. Pass rate per rule id.
3. **Five-minute games**, the model playing against kid bots (every style).
   - The game stays valid:
     - wall clipping under 0.1% of steps;
     - no relit candle;
     - no toy held twice;
     - a win only with all candles out.
   - Counts are tracked against the bots: outcomes, events per game, the tactic mix per monster type.
4. **The rare rules,** reported separately: they are where a learned game breaks first.
5. **You play it** (section 7).

## 6. What comes after the first training

- **Weak rules.** If the exam shows a weak rule, make more of exactly that data. The rules engine and the aimed
  mid-game starts can produce any moment on demand, so the exam drives the next batch.
- **Gaps already known from v1:**
  - the wardrobe and door rules are under target;
  - bloodlust never happens in natural play (a rules question for you: shorten its 15 s, or leave it out?);
  - standoffs are 17% of rows.

## 7. Playing it on the laptop

**The route:**
- Export the trained model to ONNX.
- Run it in the browser with onnxruntime-web on **WebGPU, at float16**. This uses the laptop's Iris Xe GPU, not the
  CPU.

**Expected speed** (an estimate, to be measured once a trained model exists): M about 15 ms per tick and L about
30 ms per tick on the Iris Xe, so 20 ticks a second is plausible for M and borderline for L.

**The catch:** the renderer shares that GPU and already uses much of it at 60 fps.

**Fallbacks, in order:**
1. 10 ticks a second, with the renderer smoothing to 60 fps.
2. One pass instead of two (the giant's buttons predicted in the same pass).
3. A distilled smaller student trained to copy the big model.
4. Play on a stronger machine.

**The switch:** `?model=<name>` runs the game on the model in place of the rules. `decode` turns its output into the
game state the renderer and sound already read.

## 8. Build order

| Step | What | Done when |
|---|---|---|
| 1 | `decode` + the exam harness, run on the rules engine itself | 64/64 on the rules (it is the reference) |
| 2 | The training code (PyTorch): dataset, model, losses, one-step training | trains on the laptop on a small slice, loss falling |
| 3 | A size sweep on a rented GPU (S, M, L, XL), one-step | exam results per size |
| 4 | Rollout training on the best size or two | 5-minute games stay valid |
| 5 | Calibration, export to ONNX, the in-browser `?model=` switch | you play it |
| 6 | Targeted data for weak rules, retrain | the exam improves |

## 9. Needs your answer

1. **A GPU budget and go-ahead to rent:** e.g. up to $50 for the whole sweep.
2. **Bloodlust:** shorten 15 s → 6 s so it actually happens, or leave it as a rare rule?
3. **Playing speed:** is 10 ticks a second (smoothed to 60 fps) acceptable as the fallback?
