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
  useReach: 1.35, // doors and wardrobes within this reach
  noiseDoor: 6, // opening or shutting a door
  noiseCreak: 7, // a creaky board under a running or walking foot
  noiseSqueak: 9, // stepping on a squeaky toy
  noiseLand: 13, // a thrown toy landing (heard through walls at x0.65)
  throwSpeed: 10,
  throwRange: 7.5,
  pickReach: 0.6,
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
  pingEvery: [7, 3.5], // it almost always knows roughly where you are: every 7 s, every 3.5 s with one candle left...
  pingErr: 3, // ...about 3 m off (you, in turn, can always see its eye over the walls)
  sameGap: 3, // use the same gap this often in one chase and it waits at the other end instead
  menaceMax: 25, // seconds of close pressure before it backs off...
  breather: 9, // ...for this long
  wake: 4, // grace period at the start
  repath: 0.25,
  doorOpen: 0.6, // a shut door costs it this long to open...
  doorBash: 0.9, // ...or to smash through when it is chasing you
  rage: 5, // after a candle goes out it is faster for a while
  rageBoost: 0.25,
  checkNear: 3.5, // while searching it looks in wardrobes this close...
  checkChance: 0.4, // ...this often
  checkOpen: 0.7, // opening a wardrobe door takes this long
};

// The giant's eye: every so often it hangs a searchlight over part of the house. Out in it, you are seen.
export const BEAM = {
  first: 45,
  every: [50, 26], // seconds between sweeps, all candles lit .. one left
  warn: 1.6, // the light swells before it is fully on
  on: 4.5,
  radius: 2.5,
  drift: 0.8,
};

export const HEART = { radius: 15 };
export const CANDLE = { light: 5.5, litAt: 0.22 };

// The giant's hand: once you have blown out a couple of candles it gets impatient and reaches down into the
// house near where it thinks you are. A shadow spreads first; then the hand comes down. Be under something.
export const REACH = {
  after: 2, // candles out before it starts
  first: 35, // seconds after that until the first reach
  every: [75, 40], // seconds between reaches, few candles out .. one left
  aim: 2.5, // it aims about this far off you
  shadow: 2.2, // the warning
  down: 0.35,
  hold: 0.9,
  up: 1.0,
  radius: 1.35,
};
