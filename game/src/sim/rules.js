// Every tunable number in one place. Distances in metres (1 tile = 1 m), times in seconds.
// Starting values come from research (docs/design.md): Dead by Daylight's chase numbers scaled to a
// small maze, Pac-Man's pacing, and Alien: Isolation's "fuzzy director".

export const KID = {
  radius: 0.24,
  run: 3.2,
  creep: 1.4,
  crawl: 1.7, // inside vents, cracks, under tables and beds
  crawlCreep: 1.0,
  accel: 28,
  blowTime: 1.5, // progress is kept if you let go
  blowReach: 1.05,
  noiseRun: 10, // the monster hears running this far (through walls: x0.6)
  noiseCrawl: 3, // tin rattle in the vents
  noiseBlow: 6,
};

export const MON = {
  radius: 0.42,
  patrol: 2.2,
  hunt: 3.0,
  chase: 3.55, // ~111% of the kid's run
  lust: [[15, 0.15], [25, 0.3], [35, 0.45]], // a long unbroken chase makes it faster
  accel: 10,
  lungeRange: 2.0,
  windup: 0.25, // a visible, audible crouch before the lunge
  lungeSpeed: 5.4,
  lungeTime: 0.4,
  missRecover: 1.5, // half speed after a miss
  reach: 0.72, // a touch
  sightLit: 13,
  sightDark: 8, // it lives here: it sees in the dark better than you
  sightClose: 2.2, // sees you this close even behind it
  fov: 0.0, // cos of the half-angle: 180 degrees ahead
  hiddenSeen: 1.4, // under a bed or table you are only seen this close
  pingEvery: [10, 5], // a fuzzy sense of where you are, every 10 s with all candles lit, 5 s with one left...
  pingErr: 4, // ...about a room off
  sameGap: 3, // use the same gap this often in one chase and it waits at the other end instead
  menaceMax: 25, // seconds of close pressure before it backs off...
  breather: 9, // ...for this long
  wake: 4, // grace period at the start
  repath: 0.25,
};

export const HEART = { radius: 15 };
export const CANDLE = { light: 5.5, litAt: 0.22 };
