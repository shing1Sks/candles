// THE RULEBOOK. Every number the school runs on lives here, and so does every deck (kits, lessons,
// twists, valuables). This file is what the models will eventually learn.

export const RULES = {
  DT: 1 / 60, // the engine's fixed step

  player: {
    walk: 2.2, run: 4.2, crouch: 1.1, carry: 1.8,       // m/s
    radius: 0.3, eye: 1.45, eyeCrouch: 0.95,
    noise: { run: 1.0, walk: 0.35, crouch: 0.05 },     // what the Headmaster hears
    reach: 1.2, reachCone: 0.61,                       // use: metres, and radians either side of the view
    pitchMax: 0.7,                                     // look up/down range (about 40 degrees) outside lessons that widen it
    stepEvery: { walk: 0.62, run: 0.85, crouch: 0.5 }, // metres per footstep sound
  },

  headmaster: {
    firstAfter: [45, 75],        // seconds before his first patrol of the night
    every: [70, 140],            // between patrols
    lateAt: 150, lateFactor: 0.6, // after 2:30 he comes more often
    spawnDist: [30, 50],         // metres from you, out of sight
    killRadius: 26,              // lights within this of you die as he approaches
    lightEvery: 0.8, restoreEvery: 0.4,
    patrol: 1.3, chase: 3.6, chaseBell: 4.6, // m/s
    hear: { noise: 0.3, dist: 14 },
    sight: { dist: 18, half: 0.52 },          // half-angle of his view cone, radians
    loseAfter: 6, patrolFor: [40, 70],
    catch: 1.0, passDist: 3, stoop: 2.5, pinStar: 4,
    leaveDist: 20, leaveMax: 20, // he's gone once out of sight this far away, or after this long walking off
    glimpseDist: [10, 15], glimpseHold: 3.5, glimpseFlee: 7,   // seen far off, briefly, then gone
    checksLockersAt: 120, lockerCheckP: 0.15,                 // from 2:00 he opens some lockers he passes
    doublesBackAt: 150,                                       // from 2:30, losing you, he comes back your way
  },

  // the night's conductor (research/05 R1-R5, R37, R38)
  director: {
    firstVisit: [20, 40],            // seconds into Act II before his first visit (none in Act I)
    firstGlimpse: [150, 240],        // ...except one glimpse of him, this many seconds into the night
    glimpsesBeforePatrol: 2,         // Act II shows him from afar before he ever patrols
    decay: 1.5, decayAftermath: 4, decayQuiet: 0.2, decayFastAbove: 40, darkRate: 0.5,
    silenceAfter: 35, silenceRate: 0.35, // nothing happening for a while is itself frightening
    floorPerMinute: 0.25,                // the night never gets less frightening than this: +0.25 per game minute past 1:00
    peakHold: 8, peakExit: 70, escapeAftermathAbove: 40, aftermath: [45, 60],
    ambientEvery: { calm: [18, 32], unease: [22, 38], dread: [32, 55], aftermath: [25, 40] },
    ambient: [
      { kind: 'deskLid', acts: [1, 2, 3, 4] }, { kind: 'ballStairs', acts: [1, 2, 3] }, { kind: 'tap', acts: [1, 2, 3] },
      { kind: 'paClick', acts: [1, 2, 3, 4] }, { kind: 'phone', acts: [2, 3] }, { kind: 'laugh', acts: [2, 3, 4] },
      { kind: 'piano', acts: [1, 2, 3, 4] }, { kind: 'register', acts: [2, 3] }, { kind: 'chairAbove', acts: [1, 2, 3], above: true },
      { kind: 'doorAhead', acts: [2, 3, 4] }, { kind: 'coatFall', acts: [1, 2, 3] }, { kind: 'whistle', acts: [1, 2] },
      { kind: 'dinnerBell', acts: [3] }, { kind: 'keysFar', acts: [1, 2], tell: true }, { kind: 'hymnFar', acts: [1, 2, 3, 4] },
    ],
    falseAfterTension: 30, falseAfterBuild: 30,
    falseScares: ['coatFalls', 'skeletonSwings', 'radiatorBang', 'cutout', 'hamster'],
    firstApparition: 60, apparitionPerSecond: 1 / 90,
  },

  // the last bell: the school is ordinary for this many seconds, then the lights go out across this many
  opening: { bellAt: 7, sweep: 3.5 },

  // rare nights (modules/rare.js): the chance a night has one, and when (seconds into the night, at the first quiet moment after)
  rare: {
    chance: 0.34, window: [200, 560],
    procession: { n: 10, gap: 0.9, speed: 0.9, span: 6, look: 2.2, lookAfter: 3, vanish: 4 }, // metres, m/s, seconds
    fireDrill: { secs: 20 },
    sanctuary: { wait: 90 }, // gone if you haven't walked into it by then
  },

  stars: { max: 12 },

  // the night's clock, in minutes: 60 is 1:00, 210 is 3:30 (home time, the final bell)
  clock: {
    start: 60, perSecond: 1 / 20, bell: 210,
    jumps: { starEarned: 6, hmSee: 4, runAlong: 10, lessonAbandoned: 3, exitFail: 15 },
  },

  exit: { minStars: 3, base: 0.08, perStar: 0.05, cap: 0.6, reachPer: 0.03, reachCap: 0.35, maxBefore: 1, maxAfterBell: 2 },

  stairs: { turnLimit: 2.09 }, // turning more than ~120 degrees from the climb is looking back

  detention: { lines: 5, lineSecs: 4, snoreEvery: [6, 12], quiet: 2 },

  // the room roll (spec 6.4)
  classroom: {
    lessonP: { handin: 0.6, eyes: 0.4 },     // story is always the infants room's lesson
    teacherP: { teacher: 0.85, none: 0.15 },
    twistN: { 0: 0.5, 1: 0.35, 2: 0.15 }, lateAt: 150, maxTwists: 3,
    twists: ['oneTooMany', 'turned', 'lockedIn', 'lightsOut', 'visitor', 'wrongBoard'],
    valuables: { drawer: 0.4, pass: 0.25, page: 0.2, chalk: 0.5 },
    abandonClock: 3,
    grid: { standard: [4, 4], small: [3, 3], infants: [3, 3] }, // columns x rows of desks
    // not every door is a lesson (research/07 phase 3): by act I, II, III+
    //   empty: chairs up, a calm room, things to take   aftermath: the class gone mid-lesson
    //   loneChild: one child left, who talks to you     facingWall: the class stood facing the back wall; touch nothing
    sceneP: [
      { lesson: 0.55, empty: 0.25, aftermath: 0.05, loneChild: 0.15 },
      { lesson: 0.6, empty: 0.1, aftermath: 0.12, loneChild: 0.1, facingWall: 0.08 },
      { lesson: 0.6, empty: 0.05, aftermath: 0.15, loneChild: 0.08, facingWall: 0.12 },
    ],
    emptyValuables: { drawer: 0.7, pass: 0.35, page: 0.25, chalk: 0.6 },
    preRoll: 6, // metres from a classroom door at which its room is rolled (and starts to be heard)
    studentsByAct: [[6, 9], [9, 12], [12, 15]],                // how many seats are filled: Act I, II, III+
  },

  lessons: {
    handin: {
      hymn: 70, hymnBase: 30, hymnPerStudent: 2, lightsOutBonus: 15, // the hymn: base + per student (70 s is the file length cap)
      chalk: [3, 7], look: [1.5, 2.5],      // seconds of squeaking, seconds she looks
      slow: 0.6, turn: 0.4, firstSlow: 1.0, firstTurn: 0.8, // the warning before she looks: chalk slows, shoulder lifts
      strikes: 3,                           // the third time she sees you move is doom
      moveThreshold: 0.3, seenCost: 10, headsUp: 3,
      unfinishedP: 0.25,
      sweep: 1.35, // holding use takes every paper within this many metres
    },
    eyes: {
      need: 40, lookUpLimit: 0.4, noise: 0.3, grace: 1.5, lieAfter: [10, 26], // one whisper will lie to you
      edgeEvery: [4, 9],
      edge: { footsteps: 1, hand: 1, breath: 1, standUp: 0.8, flicker: 0.8, whisper: 0.6 },
    },
    story: { lines: 10, lineEvery: 5.5, skipCool: 4, hintLine: 2, skip: 1 },
  },

  twists: {
    visitor: { noise: 0.3, dist: 7 },
    wrongBoard: { truthful: 0.7 },
  },

  pages: { total: 5 },

  layout: {
    chunk: 24,            // metres per chunk side
    corridorW: 3.4, corridorH: 2.85, roomH: 3.2, floorH: 3.6,
    inset: 0.6,           // wall between a corridor and a room
    portP: 0.45,          // chance a non-lattice port is open
    lightEvery: 4.0,      // ceiling tubes along corridors: pools of light with dark gaps
    roomP: { classroom: 0.7, cupboard: 0.3 },
    kits: { standard: [8, 9], small: [6, 7], infants: [8, 9], cupboard: [2, 2] }, // [along the door wall, depth]
    kitP: { standard: 0.55, small: 0.25, infants: 0.2 },
    stairMod: 3,          // a lattice cross is a stair column when hash % stairMod == 0
    thirteenEvery: 8,     // one stair in N has a 13th step
    lockerW: 0.5, lockerD: 0.45,
    // chance a chunk behind you is re-rolled, per minute: base + perClock x hours past 1:00; checked every `every` s
    forget: { base: 0.01, perClock: 0.04, every: 5 },
  },
};
