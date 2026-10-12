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

## 11. The day's runs (2026-10-11, Vast.ai)

**Data v3:** 10,000 games, 35% of kids played as on a keyboard. Every number below comes from the rollout exam: the
same 40 seeded games, 2 minutes each, played by the rules and inside each model.

| | Kid wins / caught / time-outs | Candles / min | Kid m/s | Pressure | Catches / min | Chasing |
|---|---|---|---|---|---|---|
| **The rules** | 6 / 27 / 7 | 2.89 | 1.12 | 47% | 0.57 | 10% |
| L, 3 epochs, rollouts from 70% | 21 / 10 / 9 | 3.66 | 1.10 | 49% | 0.22 | 7% |
| M, same recipe, mind drawn | 11 / 23 / 6 | 3.27 | 1.15 | 43% | 0.52 | 13% |
| **M round 3** (+2 epochs of rollouts), mind drawn | **7 / 27 / 6** | 3.36 | **1.12** | **46%** | 0.73 | 9% |
| M round 3, the play default (kid exact, coherent catches) | 13 / 19 / 8 | 3.05 | 1.08 | 48% | 0.38 | 12% |
| M + Fourier features, 4-step rollouts | 3 / 16 / 21 | 2.07 | 0.77 | 68% | 0.29 | 9% |
| M + Fourier, endgame weights | 0 / 12 / 28 | 1.95 | 0.79 | 59% | 0.18 | 8% |

**What worked:**
- **Rollout training is the lever.** The monster went from never chasing (0.3%) to chasing like the rules (9–13%).
  Two more epochs of it (round 3) brought outcomes, speed and pressure to the rules' numbers.
- **Weighting the monster's decision steps** (mode or action changes count double).
- **Decoding:**
  - top-p draws, so near-certain things stay certain;
  - snap: no change where the model is sure;
  - drawing only the monster's mind, which keeps it decisive and varied while the world stays steady;
  - constrained decoding: a catch, win or relit candle the model's own world contradicts is refused. About a third
    of the catches came with the monster more than 2 m away; those were the "sudden losses" in play.

**What did not:**
- **Fourier position features.** They give better one-step decisions, but run on its own output the monster hovers
  close and the kid creeps (stand-offs), with few catches.
- **Endgame weights.** More weight on the last 1.5 s before catches made the stand-offs worse.
- **L over M.** L had the better one-step scores but was the easier, more drifting world.

**Playing it (user, 18:55):** "random, slow, then suddenly lost". The answers:
- crisp decoding (above);
- coherent catches;
- a model at 10 steps a second (`--stride 2`): half the work per second of play, so real time on the laptop, and half
  the compounding.

**Infrastructure:**
- Vast.ai hosts vary a lot: two of seven rentals were unusable (overloaded, or broken ssh) and one never started.
  `vast_up.sh` destroys anything without ssh after 5 minutes.
- Rows stay in RAM (`--data_device cpu`).
- Exams run on the GPU machine in 8 parallel parts (`exam.sh`).

**The final settings (21:00).** Same 40 games; the play decode is: your kid exact, the monster's mind drawn, the rest
at 0.3, snap, peak, coherent catches, and walls refused.

| | Kid wins / caught / time-outs | Catches / min | Pressure | Kid m/s | In a wall |
|---|---|---|---|---|---|
| The rules | 6 / 27 / 7 | 0.57 | 47% | 1.12 | 0% |
| **Round 3, the play decode** (`?model=v3_M_r3`) | 12 / 24 / 4 | 0.53 | 51% | 1.08 | 0% |
| Stride 2 + 1 epoch of rollouts (`?model=v3_M_s2r3`) | 13 / 13 / 14 | 0.24 | 49% | 1.03 | 0% |

- **Peak** decodes the mean round the likeliest bin only. Near a wall the odds have two humps (blocked, or a full
  step), and their plain mean is a half step into the wall.
- **The wall check is a crutch.** With every kid on keys, the model alone put the kid in a wall 4–8% of the time.
- **Stride 2** runs in real time on the laptop (WebGPU) but catches half as often. It needs more rollout training,
  or the catch rule learned per 0.1 s.
- **Spend:** $7.21 on Vast.ai (credit went from $24.18 to $16.97). All machines are destroyed.

**Next:**
1. More wall-pushing data, plus held-key data for the monster, so the wall check can go.
2. Stride 2 with the full round-3 recipe (2 epochs of rollouts).
3. A real-time playtest by you on the stride-2 model.
4. Fewer pieces per step (merge passages, squeaks, wardrobes, beliefs) for speed.

## 12. The nightmare and the whole house (night of 2026-10-12)

The user played `v3_M_r3`: "not bad", but the monster was the worst part, and doors and the ball did not work. They
asked for:
- a test of every mechanic;
- a monster that is smarter than the coded one and as hard as possible, "as if a real evil is playing";
- waking at 1–2 s;
- no fairness rule that cripples it, with a memory that fades;
- the model to see the whole house, not 5 × 5 patches.

**The mechanics exam** (`npm run mechanics -- MODEL_DIR`, `tools/mechanics/`):
- 383 cases generated from the level: every candle, door (from each side), wardrobe, toy (every free throw
  direction), squeaky toy, creaky board, passage and room (sight, chase, catch, hearing, searchlight, hand).
- Each case is a moment set up mid-game and warmed up by 0.3 s of the rules, so the monster's senses and mind are
  real. Then kid input is played and the result checked.
- Every case passes by the rules on seeds 1–10. Each check was also run with the kid's input removed, to show it fails
  without it.
- `v3_M_r3` passed 67% of runs. It never used doors, never picked up the ball, and its monster spotted a kid in plain
  view 1 time in 5. The 5 × 5 patches cannot see a line of sight.

**The nightmare** (`src/sim/mind/nightmare.js`, `train/rl/`):
- A mind whose decisions come from a small network (2 × 256). Every 0.25 s, or at once on big news, it picks:
  - one of 19 goals: the kid, cutting it off, its four fading guesses, the last noise, guarding a candle, the far end
    of a gap, a wardrobe, staying, or a search;
  - run or not;
  - the giant's searchlight or hand.
- Paths, doors, lunges, beliefs (a memory that fades, half-life 10 s) and moods are the shared parts of every mind.
- **Training:** PPO against the kid league: every bot style, varied numbers per game, a third on keyboards, 40%
  mid-game starts. Node workers play; Python learns. 56 workers on the Vast machine run about 120 k decisions every
  7–10 s.
- **Reward:**
  - +1 for a catch, −1 if the kid wins, −0.2 for each candle out, −0.002 for each decision;
  - −0.03 for each change of mind. At 0.003 it changed plan 114 times a minute: indecisive to watch, and a mind the
    main model cannot learn. At 0.03 it was 12 times a minute;
  - potential shaping by walking distance to the kid. That is used in the reward only and never seen.
- **Held-out duel** (60 kid games it never trained on):

  | Monster | Caught | Kid won | First catch | Candles out |
  |---|---|---|---|---|
  | Coded (hound, stalker, brute, warden, pathfinder) | 58–75% | 17–28% | 46–60 s | 3.8–4.0 |
  | The nightmare | 95% | 3.3% | 35 s | 2.6 |

- **The evader** (`src/sim/bots/evader.js`) was a learned kid for self-play. It never learned to win against the
  nightmare. Even with a timeout scored as a loss, it settled on hiding in a vent all game. It is not in the league or
  the data. That stalemate is open in the real game too: a kid in a crawl space is safe.

**The whole-house model** (`--whole_map`):
- Every tile of the house, with shut doors marked, passes through a 3-layer conv net into 60 map pieces in stage A.
- The 16 tiles on the line between the kid and the monster are added to both of their pieces.
- `layout.js viewIds` computes the same ids in the game: 676 game rows checked, 0 differ.
- The map pieces stay in stage A: 4,013 samples/s instead of 2,976.

**Data v4:**
- 30,000 games against the nightmare: 35% keyboard kids, 50% curious kids (they go and fiddle with doors, toys,
  squeaky toys, boards and wardrobes, making doors 6× more common), and 50% of bots with varied numbers.
- 13.7 M rows, made in 67 s on 56 cores.
- Rows with a rare moment are drawn 6× more often (`--oversample 6`): 3.4% of rows, about 20% of batches.

**`v4_M`** (M, whole house, 2 epochs, rollouts from 70%, 233 min on a 4090):
- One-step: kid 1.79 mm, monster 2.13 mm, candle out F1 0.99, events F1 0.89, giant stick 89%.
- The giant's searchlight and hand are poorly learned (F1 0.13 and 0.19).

| | Yesterday's `v3_M_r3` (vs a hound) | `v4_M` (vs the nightmare) |
|---|---|---|
| Mechanics, runs passed | 67% | 78% |
| Cases passed every run | 226 | 269 |
| Doors | 55% | 71% |
| Toys | 39% | 69% |
| Wardrobes | 77% | 87% |
| Creaky boards | 71% | 77% |
| Squeaky toys | 55% | 76% |
| Searchlight | 27% | 42% |
| Hand | 30% | 36% |

| Whole games (40) | Kid won / caught / timeout | Catches / min |
|---|---|---|
| The nightmare, by the rules | 0 / 40 / 0 | 2.37 |
| Inside `v4_M` | 10 / 25 / 5 | 0.70 |
| (Yesterday: rules / `v3_M_r3`) | | (0.57 / 0.53) |

- The model's monster is deadlier than yesterday's real game, but about a third of the nightmare.
- The walls in decoding now check the body (0.22 m and 0.38 m), not only the centre: the kid no longer sinks into
  walls.
- One learned habit from the bots: walking into a shut door sometimes opens it without a press of use, because the
  bots always press use there.
- `v4_M` runs at 10.3 steps a second in the browser on the laptop (`v3_M_r3`: 17.8).

**Round 3 on top** (rollouts K = 2, lr 2e-4). With the rows in RAM, rollout steps ran at about 1,300 samples/s, so
70 minutes was about a third of an epoch:

| | `v4_M` | `v4_M_r3` (play this) | `v4_M_r4` (+60 min) |
|---|---|---|---|
| Mechanics, runs passed | 78% | 79% | 78% |
| Cases passed every run | 269 | 276 | 274 |
| Doors | 71% | 78% | 74% |
| Whole games: kid won / caught / timeout | 10 / 25 / 5 | 10 / 26 / 4 | 12 / 22 / 6 |
| Catches / min | 0.70 | 0.77 | 0.56 |
| Pressure | 28% | 34% | 39% |

The nightmare by the rules: 0–1 / 39–40 / 0, 2.1–2.4 catches a minute. 40 games swing by about ±0.15 a minute, and
drawing the game state at every step was no better (0.52).

**Where it stands:**
- The model's monster stays near you more than the old one did, and lunges more.
- It catches about a third as often as the real nightmare: lunges do not turn into catches.
- The giant's searchlight and hand are the weakest mechanics (about 40%). They are rare in the data, and the giant's
  light and reach buttons have F1 0.13 and 0.19.
- Doors are much better but not right (74–78%). The model sometimes opens a door the kid walked into without pressing
  use, a habit learned from the bots.

**Spend:** Vast $4.51 (one 4090 for 7.4 h: RL, data, three trainings, exams). Credit went from $16.92 to $12.41.

**Next:**
1. Catches inside the model: weight the steps where the rules catch (and where they do not, close by), and train
   longer with rollouts. Measure with 100 games, not 40.
2. The giant's tools: more data where the light and the hand are used (as the curious kids did for doors), and
   oversample their presses.
3. Doors: bot data in which kids walk into shut doors without pressing use.
4. Speed: `v4_M_r3` runs at 10 steps a second on the laptop. Try stride 2 on v4, or a smaller whole-house model.
5. The hiding stalemate: a kid in a vent is safe for good, so the game needs a rule (the giant's hand reaching into
   vents? a smoke-out?) — the user's call.
