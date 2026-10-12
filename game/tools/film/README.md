# The film

How `candles.mp4` was made (about a minute: the game, the games multiplying, the rules dissolving into a network,
GameNet, the end card). With the dev server running (`npm run dev`), from a working folder with `shots/`, `frames/`,
`probe/` and `parts/`:

1. `node moments.mjs`: simulates nightmare games headless and lists moments (catches, the hand, the searchlight...).
   The monster's choices use a seeded stream (`&seedpolicy=1` in the browser), so a game replays as simulated.
2. `python rec_watch.py shots.json`: records those moments in the browser frame by frame at 30 fps
   (`?watch=film:i&seedpolicy=1&manual=1&nointro=1`).
3. `python rec_film.py grid|rules|card`: renders the drawn parts of `film.html` (`tools/film/film.js`) frame by frame.
4. `python rec_model.py NAME BOT SECONDS`: records GameNet with a kid bot: one network step, then three frames of
   the glide to it.
5. `python edit.py SHOT START SECONDS`: cuts it all with ffmpeg and mixes the sound from `public/audio`.

Do not edit files under `game/` while recording: the dev server reloads the page and the recording dies.
