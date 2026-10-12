# Changelog and decisions

The decisions behind the project, newest first. Each run's numbers are in
[the training spec](docs/superpowers/specs/2026-10-11-gamenet-training-spec.md).

## 2026-10-13: ready to ship (candles.shing.in)

- **The site has a first screen:** what the game is and why, a diagram of what runs the house, links to shing.in and X, and two modes:
  - **Classic:** the rules with the nightmare;
  - **GameNet:** the world model with the nightmare inside it.
  - Music credits moved into a hover pill in a corner, apart from a sound toggle.
- **Fixed: WASD did nothing for the first 15–20 s of GameNet.**
  - Cause: the game started before the model was built, and its first runs compiled the GPU's shaders.
  - Fix: the start screen now waits for download, build and warm-up, with progress.
  - The model is cached by md5, so a return visit is ready in about 6 s.
- **The build ships only what the site needs.**
  - The model goes as 24 MB parts that any static host serves.
  - onnxruntime's own files go at `/ort/`. Bundled into the worker, its threads started the worker and hung.
  - The research models and clips stay out (134 MB instead of 4.8 GB).

## 2026-10-12, day: the monster's brain becomes a second player

- **Split the monster from the world model.** The learned nightmare reads the model's row and presses the monster's buttons; the model is only the world. Chosen over training a bigger all-in-one model: no new architecture was needed, and the same model went from 0.77 to 2.4 catches a minute.
- **Crawl spaces are no longer safe.** The user asked for "horrifying" and for no truly safe place. Four rules were tried with bots:
  - **Chosen:** it reaches 1.1 m under beds and tables and into cracks, and squeezes into the vent duct at 1.35 m/s (you crawl at 1.7). You can out-crawl it, so you keep moving.
- **The nightmare was relearned under the new rules:** 97.5% of held-out bot kids caught, at 15 s on average.
- **Play model `v5_M_s2u`:** 303 of the 384 mechanics cases pass every run, at about ¾ of real time on the laptop. Kept despite a weaker hand than `v5_M_s2r3`, because it passes more of everything else.

## 2026-10-12, night: the nightmare and the whole house

- **A learned monster:** PPO against a league of varied kid bots, with a penalty for changing its mind (at a low penalty it changed plans 114 times a minute, which is unreadable to play against).
- **The model sees the whole house, not 5 × 5 patches**, so it can carry out line of sight.
- **The mechanics exam:** every candle, door, wardrobe, toy, crawl space and tool as a set-up moment, checked against the model.
- **The monster wakes at 1.5 s**, as asked.

## 2026-10-11: the first world models

- **Size:** M (384 × 12, about 25 M weights) chosen over S and L by the rollout exam: running on its own output, M drifts much less than S. L had better one-step scores but made an easier, more drifting world.
- **Training method:** rollout training (on the model's own output) is what makes it stable.
- **Speed:** a stride-2 model (0.1 s steps) is what makes it playable in a browser.
- **Constrained decoding:** a catch, a win or a relit candle that the model's own world contradicts is refused.

## 2026-10-10: Candles

- **Fresh start:** the forest, school and Long Way Home prototypes are kept under the tag `archive/before-maze`.
- **The game:**
  - a grey candle maze on a table;
  - a giant plays the monster with a controller, a searchlight and its hand;
  - chase numbers after Dead by Daylight, the "fuzzy director" after Alien: Isolation (`docs/design.md`).
- **The rules run headless:** two controllers (the kid's and the giant's), deterministic episodes and a data generator, all built so a model could learn the game from bot play.
