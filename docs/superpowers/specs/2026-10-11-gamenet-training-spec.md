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

**Compute plan.** Runpod community prices read live on 2026-10-11:
- RTX 4090: $0.34/h;
- RTX 5090: $0.69/h;
- A100 80 GB: $1.19/h.

**How the hours are worked out:**
- Training costs about 6 × parameters × pieces operations per example, forward and backward.
- With one masked pass for both heads and about 75 pieces, that is: S 2.9, M 9.6, L 22.8, XL 38 billion operations
  per example.
- An RTX 4090 sustains an assumed 40 trillion a second on a model this small (about 25–40% of its bf16 peak).
- One epoch is the 5.8 M steps of v1.

| Stage | What | RTX 4090 hours |
|---|---|---|
| 0 | Write the training code and test it on a slice on the laptop | 0 (free) |
| 1 | Pod setup and data: regenerate v1 on the pod's CPUs (the generator is deterministic), so nothing is uploaded | 0.3 |
| 2 | Throughput check: 2 minutes per size, turning this table into measured numbers before the long runs | 0.2 |
| 3 | Size sweep, 1 epoch each (S 7 min, M 23 min, L 55 min, XL 90 min), plus a data check: S and M on 25% and 50% of the data | 3.5 |
| 4 | Full one-step training of the winner, about 8 epochs with early stopping (M: 3 h, L: 7.3 h) | 3–7.5 |
| 5 | Rollout training, about 2 epochs' worth (M: 0.8 h, L: 1.8 h) | 0.8–1.8 |
| 6 | The exam: scenarios, 200 five-minute games, calibration | 0.5 |
| | **Total** | **about 8.5 h (M) to 14 h (L)** |

**Cost:**
- About **$3 (M) to $5 (L)** on an RTX 4090.
- If it reaches only half the assumed throughput, about **$6–10**.
- Asked cap: **$10**.
- Stage 2 makes the estimate exact after about 10 cents.

**If no 4090 is free:** an RTX 5090 ($0.69/h) is about 1.5–2× faster, so it costs about the same per job.

**Nothing runs on the laptop's CPU.** At the spike's pace it would take weeks.

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

1. **A GPU budget and go-ahead to rent:** a $10 cap (expected $3–5 on an RTX 4090).
2. **Bloodlust:** shorten 15 s → 6 s so it actually happens, or leave it as a rare rule?
3. **Playing speed:** is 10 ticks a second (smoothed to 60 fps) acceptable as the fallback?

## 10. First results (night of 2026-10-11)

**What ran.** Data v2 (5,000 games, 7.3 M steps) on an RTX 5090. Each size trained for 1 epoch. The pod was lost at
76 minutes when the Runpod balance reached $0; the account needs funds before the next run. Spend was about $0.9.

**The size sweep, 1 epoch each** (exam split):

| Size | Parameters | Minutes | Check loss | Kid error | Monster error | Candle-out F1 | Events F1 | Giant stick |
|---|---|---|---|---|---|---|---|---|
| S | 8.5 M | 6 | 1.043 | 2.0 mm | 3.3 mm | 0.89 | 0.82 | 86.5% |
| M | 24.5 M | 13 | 1.013 | 1.6 mm | 2.7 mm | 0.93 | 0.83 | 87.2% |
| L | 54.8 M | 22 | 1.007 | 1.6 mm | 2.6 mm | 0.95 | 0.83 | 87.6% |

- In one step, no size put the kid inside a wall.
- Bigger is better, with returns shrinking after M at 1 epoch. Most of the loss is the number floor (~0.73): the
  real randomness of the world.
- The giant's light and reach F1 are 0 because they are pressed on under 0.1% of steps. The exam now reports how
  often each is pressed (predicted against real) instead.
- XL and the data-amount check did not finish before the pod was lost.

**Run on its own output** (`tools/dream_exam.mjs`: the same seeded games played by the rules and inside the model's
world). Model S, 10 games of 120 s, kid bots:

| | Rules | Model's world |
|---|---|---|
| Kid wins | 1 of 10 | 8 of 10 |
| Candles out per minute | 2.7 | 5.2 |
| Kid speed | 1.02 m/s | 1.72 m/s |
| Monster chasing / in "check" | 8.1% / 0.9% | 0.3% / 26% |
| Lunges per minute | 1.32 | 0.53 |
| Kid in a wall (bots) | 0% | 0% |
| Monster in a wall | 0% | 3.6% |

- One step at a time the kid is predicted about 5% fast (1.33 against 1.26 m/s); run on its own output, that
  compounds.
- The monster falls into checking and stops committing to chases, so the game gets easy.
- One win came with 5 candles out: the "win only with all candles out" rule is not held.
- The decode setting is not the cause. With expected values only (mix 0), draws only (mix 1) or the default blend
  (0.3), the kid wins 7, 6 and 8 of 10.
  - Expected values only: the monster almost never lunges (0.07 a minute).
  - Draws only: the monster acts most like the rules (chases, fury), but is inside a wall 11% of the time.
- **The bigger model drifts much less.** M on the same 10 games: the kid wins 3 and is caught 3 (rules 1 and 6). It
  puts out 2.6 candles a minute (rules 2.7), moves at 1.28 m/s (rules 1.02), and stays 8.0 m from the monster (rules
  7.9). What M still gets wrong:
  - in one game the kid slid into a wall and stayed in it (45% of that game);
  - the monster still checks too much (34%) and never chases.
- **L, exported mid-epoch before its learning rate had wound down, drifts in another way.** The monster hangs back
  (14.4 m from the kid, 0.07 lunges a minute), the kid is fast (1.71 m/s), and 6 games put out every candle without
  the game ever ending in a win. Its one-step scores were the best of the three, so **one-step loss does not tell
  how well a model holds up as a game**. Models are chosen by the rollout exam from now on.
- This is the drift phase 2 (rollouts) exists for. `train.py --rollout_from 0.7` now trains the last 30% on two
  steps, where the second starts from the model's own drawn guess.

**Held keys walk through walls.** A person holding a key into a wall gets the kid inside it (7–14 of 46 samples),
though the bots never do. The bot data has 0.6% of steps pushing against something, and only 13% of inputs look like
keys. Data v3 adds kids played as on a keyboard (`gen.mjs --keys 0.35`): 8 directions at full tilt, shift to go
quietly, and now and then a key held into whatever is there. That gives 2.9% blocked pushes.

**Speed on this laptop (Iris Xe), in the game:**
- The model runs in its own thread (a worker), and the house draws at 30 fps in `?model=` mode. At 60 fps the
  renderer starves the model.
- S: 14–16 steps a second (WebGPU, or wasm with int8). M: about 10. Real time is 20.
- What it took:
  - no integer ops in the graph, since WebGPU runs them on the CPU;
  - the sampling moved out of the graph into JS, since hundreds of tiny GPU kernels cost 7×;
  - one packed input and one packed output, since ORT pays about 4 ms per tensor moved.
- What's left is real compute: about 57 pieces through 8–12 layers. The next real speedup is fewer pieces: merge the
  ten passages, five squeaky toys, three wardrobes and four beliefs into one piece each (about 54 → 33). That needs a
  retrain.
- int8 weights help 1.3–1.4× on the CPU, with small drift.

**The next run (once the account has funds, about $2 on a 4090):**
1. Data v3: 10,000 games with `--keys 0.35`, generated on the pod (about 2 min).
2. M and L, each for 3 epochs with `--rollout_from 0.7` (`next_run.sh M`, `next_run.sh L`: about 40 and 70 minutes
   on a 5090). Copy best.pt and summary.json off the pod after every run.
3. Export both and run the rollout exam against the rules. Pick by these targets:
   - outcome mix and candle rate within 25% of the rules;
   - kid speed within 10%;
   - no win short of 6 candles, and none missed at 6;
   - wall clipping under 0.1% with keyboard kids.
4. If L is too slow for the laptop, distil it into a merged-piece S.
