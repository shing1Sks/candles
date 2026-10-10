# Candles: design

A small grey 3D maze, seen tilted from above. You are a small kid. Blow out the candle in the corner of
every room. A monster hunts you. It is a little faster than you; your one advantage is that only you fit
through the small gaps.

## Decisions (agreed 2026-10-10)

- One hand-built level: six rooms (nursery, bathroom, kitchen, bedroom, playroom, cellar) inside a ring corridor.
- Only shades of grey. Candles are the only light; each one you blow out makes the house darker.
- The monster is a bot that plays like a person with a controller. There is no local multiplayer.
- One touch loses. All six candles out wins. It should be very hard but fair.
- Bots playing each other and dataset generation are the **next stage**, not this one. The rules already run
  without graphics (`game/src/sim`), so that stage can plug in without a rewrite.

## Mechanics, and why each is there

Numbers live in `game/src/sim/rules.js`. Starting values came from research into games where this already works.

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
| Fuzzy sense of you | every 10 s (every 5 s with one candle left), about 4 m off | Alien: Isolation's director points the alien at your area but never your spot; Pac-Man speeds up near the end |
| Breather | after 25 s of close pressure it backs off to a far room for 9 s | Alien's menace gauge, Pac-Man's scatter phases |
| It never sees through walls | dark sight 8 m, candlelight 13 m; under a bed you are seen only within 1.4 m | Hello Neighbor and other "cheating AI" complaints |
| Blowing a candle | 1.5 s; progress is kept if you let go | the risk is getting there and away, not the button |

Rejected: the monster relighting candles (unwinnable), a stamina bar (UI and punishment for no gain),
a candle with no escape route (the balance probe found the cellar candle was a death trap; it got a crack).

## Balance probe

`npm run sim` runs a rough kid bot (fair information: it knows where the monster is only by sight or within
6 m) against the monster. Latest: 60 games → 8 won, 17 caught, 35 stand-offs where the cautious bot hides
and never commits. That reads as "very hard" for a careful player. Tune by playing.

## Look

- Lighting comes from two top-down textures rather than three.js lights. One is the kid's line of sight (with a faint glow around the kid); the other is each candle's light with its wall shadows. Anything the kid can't see sinks into darkness. The monster is drawn only when the kid has line of sight; in the dark you see just its eye.
- Walls in front of the kid dissolve in a dither so the kid is never hidden.
- A film pass converts to grey and adds gamma, vignette, grain, and a squeeze and darkening with fear.
- Render resolution is capped at about 1 megapixel, giving 60 fps at 720p and about 53 fps at 1080p on the Iris Xe.
