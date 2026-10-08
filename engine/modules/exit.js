// THE WAY OUT. With three or more stars, a ground-floor dead end you come near may turn out to be the
// front entrance: the odds rise with every star. At the doors, one roll: daylight, or the doors open
// onto another corridor and your stars peel off into the dark.
import { forgetChunk } from '../layout/forget.js';
import { hash32 } from '../rng.js';
import { hallLine } from '../story.js';

const DEFAULTS = { minStars: 3, base: 0.08, perStar: 0.05, cap: 0.6, reachPer: 0.03, reachCap: 0.35 };
export const exitHazard = (n, X = DEFAULTS) => (n < X.minStars ? 0 : Math.min(X.cap, X.base + X.perStar * n));
export const reachChance = (n, X = DEFAULTS) => Math.min(X.reachCap, X.reachPer * n);

export const exit = {
  id: 'exit',
  init() {},
  step(S, input, ctx) {
    if (S.phase !== 'play') return;
    const X = ctx.rules.exit, P = S.player, L = ctx.layout, C = ctx.rules.layout.chunk;
    // dead ends near you on the ground floor get their one roll, the first time they come near
    if (P.floor === 0) {
      const pi = Math.floor(P.x / C), pj = Math.floor(P.z / C);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const c = L.chunk(0, pi + di, pj + dj);
        if (!c.deadEnd || S.layout.deadEndsSeen[c.key]) continue;
        S.layout.deadEndsSeen[c.key] = true;
        const open = Object.keys(S.layout.entrances).length, max = S.clock.bell ? X.maxAfterBell : X.maxBefore;
        // a dead end that isn't the way out may be the Hall: chained doors (mostly in the old wing)
        const hall = () => {
          if (hash32(S.seed, 'hall', c.key) % 100 >= (c.wing === 'old' ? 60 : 12)) return;
          (S.layout.hallDoors ??= {})[c.key] = true;
          S.interact[`${c.key}:hall`] = { kind: 'hallDoor', x: c.deadEnd.x, z: c.deadEnd.z, floor: 0, r: 1.8, chunk: c.key };
          ctx.emit('hallDoorsAppear', { key: c.key });
        };
        if (open >= max) { hall(); continue; }
        if (!ctx.rng.chance(S.clock.bell ? X.cap : exitHazard(S.held.stars, X))) { hall(); continue; }
        S.layout.entrances[c.key] = true;
        S.interact[`${c.key}:entrance`] = { kind: 'entrance', x: c.deadEnd.x, z: c.deadEnd.z, floor: 0, r: 1.8, chunk: c.key };
        ctx.emit('entranceAppears', { key: c.key, x: c.deadEnd.x, z: c.deadEnd.z, side: c.deadEnd.side });
      }
    }
    // the doors
    const u = P.used;
    // with every page, the chain is gone: the true ending (research/07 phase 4)
    if (u?.kind === 'hallDoor' && S.held.pages.length >= ctx.rules.pages.total) { S.phase = 'home'; ctx.emit('trueEnding', { key: S.interact[u.id]?.chunk }); return; }
    if (u?.kind === 'hallDoor') { ctx.emit('hallDoor', { text: hallLine(S.held.pages.length), key: S.interact[u.id]?.chunk }); return; }
    if (u?.kind !== 'entrance') return;
    const forced = S.director.forceReach;
    const ok = forced !== undefined ? forced : ctx.rng.chance(reachChance(S.held.stars, X));
    if (ok) { S.phase = 'home'; ctx.emit('homeTime', { stars: S.held.stars }); return; }
    const key = S.interact[u.id]?.chunk;
    const lost = S.held.stars;
    S.held.stars = 0;
    delete S.interact[u.id];
    if (key) forgetChunk(S, key);
    ctx.emit('exitFail', { lost });
  },
};
