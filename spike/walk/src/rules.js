// THE RULEBOOK. Every number that decides how this world behaves lives here, in one place.
// Later the neural models learn these rules from play; the data twin (research/01) maps each one.
// Times in seconds, distances in metres, hazards in events per second.

export const RULES = {
  player: {
    walk: 2.4, sprint: 4.4, eyeHeight: 1.36,
    fov: 64, sprintFov: 71,
    radius: 0.35,
    // mouse look: radians per pixel. Pitch stays gentle; the paper cards read flat if you stare up or down
    lookYaw: 0.0021, lookPitch: 0.0013, pitchMax: 0.42,
  },

  // Loose coloured petals drifting through the grey forest. Never a whole field: just strays.
  petals: {
    spawnEvery: [0.6, 1.5],     // one stray appears every this-many seconds...
    maxAmbient: 26,             // ...unless this many are already drifting
    spawnDist: [6, 22],         // around you, mostly ahead
    spawnCone: 1.7,             // radians either side of where you look
    spawnHeight: [1.0, 4.0],
    life: [12, 20],
    catchRadius: 1.15,          // walk into one to catch it
    reachRadius: 2.6,           // or hold reach and it comes to your hand from this far
    reachCone: 0.7,
    maxHeld: 12,                // they get pinned to the back of your hand
    dropCatchDelay: 5,          // a dropped petal can't be re-caught straight away
  },

  // The field: more petals held -> it gets likelier, up to a cap. It blooms right in front of you.
  bloom: {
    minHeld: 3,
    hazardBase: 0.004,
    hazardPerPetal: 0.006,
    hazardCap: 0.06,            // at most ~ once every 17 s of searching
    cooldown: 45,
    ahead: 10, radius: 7, flowers: 230,
    dissolveDist: 4.6, reachDist: 7.5, walkAwayDist: 40,
  },

  // Reaching it for real is rare: a small chance per petal you gave to it.
  reach: { chancePerPetal: 0.03, chanceCap: 0.35 },

  entity: {
    firstWait: 38,
    wait: [14, 30],             // between appearances (shrinks with level, faster in mist)
    // what it does when it appears (weights)
    kinds: { peek: 0.6, wave: 0.22, behind: 0.18 },
    peekDist: [7, 14], waveDist: [9, 18], behindDist: [5.5, 9.5],
    lookToNotice: 0.8,          // seconds of looking straight at a peek before it reacts
    exposureToTurn: 3,          // after this many noticed peeks it may stop hiding...
    turnChance: 0.45,           // ...and turn round to show its other side
    // the hunt (its sad side): stop-motion lunges, mostly when you are not looking
    lungeEvery: [0.35, 1.2], lungeEveryWatched: [0.9, 2.4],
    lungeWhileWatched: 0.2,
    lungeDist: [1.4, 3.2], lungeGrowth: 0.04,  // per second hunted
    catchDist: 1.6, giveUpDist: 46, huntMax: 55,
    // a dropped petal: it goes to it and tries to remember
    distractTime: [6, 9],
  },

  mist: {
    every: [55, 120], lasts: [25, 50],
    farClear: 64, farMist: 19, nearClear: 7, nearMist: 1.5,
    entityHaste: 1.0,           // entity wait timers run (1 + mist * this) times faster
  },

  caught: { teleport: [150, 260], wakeDelay: 2.4, entityRest: 45 },
};

export const rand = ([a, b]) => a + (b - a) * Math.random();
export const chance = (p) => Math.random() < p;
// probability that a Poisson event with rate `hazard` fires within dt
export const fires = (hazard, dt) => Math.random() < 1 - Math.exp(-hazard * dt);
