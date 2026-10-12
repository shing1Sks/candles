// The game state as numbers: one fixed layout for every recorded row, in pieces (tokens) - the game, the kid, the
// monster's body, what it has sensed, its mind, its guesses of where you are, then every candle, door, wardrobe,
// toy, squeaky toy, gap, the searchlight and the hand. The main model reads and writes rows in this layout.
//   num: a number, divided by its scale     flag: 0 or 1     cat: one of n, one-hot
// Positions are divided by the map's size; timers by their longest.
import { MODES } from './mind/index.js';
import { T } from './level.js';

const W = 37, H = 23; // the house (level.js); checked against the level in schemaJSON
const ACTS = ['none', 'door', 'bash', 'check', 'windup', 'lunge', 'recover', 'yell'];
const STATES = ['play', 'won', 'caught'];
const BEAMS = ['idle', 'warn', 'on'];
const HANDS = ['idle', 'shadow', 'down', 'hold', 'up'];
const HEARD = ['other', 'kid', 'door', 'creak', 'squeak', 'land'];
const FELT = ['candleOut', 'doorInFace', 'lungeMiss', 'gapEscape', 'lostSight', 'spotted', 'checkEmpty', 'beamSpot', 'grabMiss'];
const last = (a) => a[a.length - 1];
const age = (G, at, max) => Math.min(1, Math.max(0, (G.t - at) / max));

const num = (name, get, scale = 1) => ({ name, type: 'num', get, scale });
const flag = (name, get) => ({ name, type: 'flag', get });
const cat = (name, n, get) => ({ name, type: 'cat', n, get }); // get returns 0..n-1
const px = (name, get) => num(name, get, W), pz = (name, get) => num(name, get, H);

const TOKEN_DEFS = [
  { kind: 'game', count: 1, fields: [
    num('t', (G) => G.t, 300), cat('state', 3, (G) => STATES.indexOf(G.state)),
    num('candlesOut', (G) => G.candles.filter((c) => !c.lit).length, 6),
  ] },
  { kind: 'kid', count: 1, fields: [
    px('x', (G) => G.kid.x), pz('z', (G) => G.kid.z), num('vx', (G) => G.kid.vx, 4), num('vz', (G) => G.kid.vz, 4),
    num('fx', (G) => G.kid.fx), num('fz', (G) => G.kid.fz), flag('crawl', (G) => G.kid.crawl), flag('running', (G) => G.kid.running),
    num('noise', (G) => G.kid.noise, 13), cat('hidden', 4, (G) => G.kid.hidden + 1), cat('held', 8, (G) => G.kid.held + 1),
    cat('blowing', 7, (G) => G.kid.blowing + 1), flag('stickFree', (G) => !!G.kid.stickFree), flag('blowHeld', (G) => G.kid.blowHeld),
    num('hiddenFor', (G) => age(G, G.kid.hiddenAt, 2)), num('stride', (G) => G.kid.stride, 0.62),
  ] },
  { kind: 'monster', count: 1, fields: [
    px('x', (G) => G.monster.x), pz('z', (G) => G.monster.z), num('vx', (G) => G.monster.vx, 6), num('vz', (G) => G.monster.vz, 6),
    num('hx', (G) => G.monster.hx), num('hz', (G) => G.monster.hz), num('speed', (G) => G.monster.speed, 6),
    cat('act', ACTS.length, (G) => ACTS.indexOf(G.monster.act)), num('actT', (G) => G.monster.actT, 1.5), num('actId', (G) => G.monster.actId + 1, 11),
    flag('awake', (G) => G.monster.awake), flag('sees', (G) => G.monster.sees), num('lust', (G) => G.monster.lust, 0.45),
    num('rage', (G) => G.monster.rage, 5), num('cool', (G) => Math.max(0, G.monster.cool), 1), num('yellCool', (G) => Math.max(0, G.monster.yellCool), 6),
    num('stuckT', (G) => G.monster.stuckT, 0.6), num('stride', (G) => G.monster.stride, 1.25),
  ] },
  { kind: 'sense', count: 1, fields: [
    num('pingT', (G) => Math.max(0, G.sense.pingT), 7), flag('seenEver', (G) => !!G.sense.lastSeen),
    px('lastSeenX', (G) => G.sense.lastSeen?.x ?? 0), pz('lastSeenZ', (G) => G.sense.lastSeen?.z ?? 0),
    num('lastSeenAge', (G) => age(G, G.sense.lastSeenT, 10)), num('sightT', (G) => G.sense.sightT, 40),
    num('unseenT', (G) => Math.min(1, G.sense.unseenT)), num('kidGap', (G) => G.sense.kidGap + 1, 11),
  ] },
  // what the monster sensed during the last step and has not read yet: its mind acts on it next step
  { kind: 'pending', count: 1, fields: [
    flag('heard', (G) => G.sense.heard.length > 0), px('heardX', (G) => last(G.sense.heard)?.x ?? 0), pz('heardZ', (G) => last(G.sense.heard)?.z ?? 0),
    cat('heardKind', HEARD.length, (G) => Math.max(0, HEARD.indexOf(last(G.sense.heard)?.kind))),
    flag('alert', (G) => G.sense.alertsSeen.length > 0), px('alertX', (G) => last(G.sense.alertsSeen)?.x ?? 0), pz('alertZ', (G) => last(G.sense.alertsSeen)?.z ?? 0),
    flag('ping', (G) => !!G.sense.ping), px('pingX', (G) => G.sense.ping?.x ?? 0), pz('pingZ', (G) => G.sense.ping?.z ?? 0),
    flag('hideSeen', (G) => G.sense.hideSeen >= 0), flag('gapSeen', (G) => G.sense.gapSeen >= 0), flag('shoved', (G) => G.monster.shoved),
    ...FELT.map((k) => flag(`felt_${k}`, (G) => G.sense.felt.some((f) => f.kind === k))),
  ] },
  { kind: 'mind', count: 1, fields: [
    cat('mode', MODES.length, (G) => Math.max(0, MODES.indexOf(G.mind?.mode))), num('modeT', (G) => Math.min(G.mind?.modeT ?? 0, 30), 30),
    flag('hasTarget', (G) => !!G.mind?.target), px('targetX', (G) => G.mind?.target?.x ?? 0), pz('targetZ', (G) => G.mind?.target?.z ?? 0),
    num('anger', (G) => G.mind?.anger ?? 0), num('frustration', (G) => G.mind?.frustration ?? 0), num('confidence', (G) => G.mind?.confidence ?? 0),
    num('furyT', (G) => G.mind?.furyT ?? 0, 4), num('spentT', (G) => G.mind?.spentT ?? 0, 2.5), num('menace', (G) => Math.min(G.mind?.menace ?? 0, 40), 25),
  ] },
  { kind: 'belief', count: 4, fields: [
    flag('present', (G, i) => !!G.mind?.beliefs?.[i]), px('x', (G, i) => G.mind?.beliefs?.[i]?.x ?? 0), pz('z', (G, i) => G.mind?.beliefs?.[i]?.z ?? 0),
    num('spread', (G, i) => G.mind?.beliefs?.[i]?.spread ?? 0, 12), num('w', (G, i) => G.mind?.beliefs?.[i]?.w ?? 0),
  ] },
  { kind: 'candle', count: 6, fields: [
    px('x', (G, i) => G.candles[i].x), pz('z', (G, i) => G.candles[i].z), flag('lit', (G, i) => G.candles[i].lit),
    num('progress', (G, i) => Math.min(1.1, G.candles[i].progress)),
  ] },
  { kind: 'door', count: 11, fields: [
    px('x', (G, i) => G.doors[i].x), pz('z', (G, i) => G.doors[i].z), flag('open', (G, i) => G.doors[i].open),
    num('changed', (G, i) => age(G, G.doors[i].changedAt, 5)),
  ] },
  { kind: 'wardrobe', count: 3, fields: [
    px('x', (G, i) => G.wardrobes[i].fx), pz('z', (G, i) => G.wardrobes[i].fz), num('opened', (G, i) => age(G, G.wardrobes[i].openAt, 2)),
  ] },
  { kind: 'toy', count: 7, fields: [
    px('x', (G, i) => G.items[i].x), pz('z', (G, i) => G.items[i].z), flag('held', (G, i) => G.items[i].held), flag('flying', (G, i) => !!G.items[i].fly),
    num('dx', (G, i) => G.items[i].fly?.dx ?? 0), num('dz', (G, i) => G.items[i].fly?.dz ?? 0), num('flown', (G, i) => G.items[i].fly?.d ?? 0, 7.5),
  ] },
  { kind: 'squeak', count: 5, fields: [
    px('x', (G, i) => G.squeaks[i].x), pz('z', (G, i) => G.squeaks[i].z), num('cool', (G, i) => Math.max(0, G.squeaks[i].cool), 1.5),
  ] },
  { kind: 'passage', count: 10, fields: [
    num('uses', (G, i) => G.mind?.gapUses?.[i] ?? 0, 3),
  ] },
  { kind: 'beam', count: 1, fields: [
    cat('state', 3, (G) => BEAMS.indexOf(G.beam.state)), num('t', (G) => Math.min(G.beam.t, 5), 5), px('x', (G) => G.beam.x), pz('z', (G) => G.beam.z),
    num('dx', (G) => G.beam.dx), num('dz', (G) => G.beam.dz), flag('spotted', (G) => G.beam.spotted), num('cool', (G) => Math.max(0, G.beam.cool), 50),
  ] },
  { kind: 'hand', count: 1, fields: [
    cat('state', 5, (G) => HANDS.indexOf(G.reach.state)), num('t', (G) => Math.min(G.reach.t, 2.5), 2.5), px('x', (G) => G.reach.x), pz('z', (G) => G.reach.z),
    flag('armed', (G) => G.reach.cool >= 0), num('cool', (G) => Math.max(0, G.reach.cool), 75),
  ] },
];

const width = (fields) => fields.reduce((s, f) => s + (f.type === 'cat' ? f.n : 1), 0);
let off = 0;
const TOKENS = TOKEN_DEFS.map((t) => { const w = width(t.fields), o = off; off += w * t.count; return { ...t, width: w, offset: o }; });
export const STATE_SIZE = off;

export const KI_FIELDS = ['mx', 'mz', 'creep', 'blow', 'use', 'throw'];
export const GI_FIELDS = ['mx', 'mz', 'run', 'lunge', 'use', 'bash', 'yell', 'light', 'reach', 'ax', 'az', 'lx', 'lz'];
export const KI_SIZE = KI_FIELDS.length, GI_SIZE = GI_FIELDS.length;

// every event the world and the minds emit, in a fixed order
// the details an event carries, as one short string (who, why, which way)
export function eventDetail(e) {
  switch (e.type) {
    case 'door': return `${e.open ? 'open' : 'shut'}:${e.by}${e.bash ? ':bash' : ''}`;
    case 'doorTry': return e.bash ? 'bash' : 'open';
    case 'yell': case 'fury': return e.why || '';
    case 'tactic': return `${e.name}:${e.why}`;
    case 'mood': return `${e.anger.toFixed(2)},${e.frustration.toFixed(2)},${e.why || ''}`;
    case 'mode': return e.mode;
    case 'caught': return e.by;
    case 'land': return e.wall ? 'wall' : 'floor';
    case 'squeak': case 'pickup': return e.kind || '';
    case 'kstep': return [e.run && 'run', e.crawl && 'crawl', e.duct && 'duct'].filter(Boolean).join(',');
    case 'mstep': return e.run ? 'run' : '';
    default: return '';
  }
}

export const EVENT_TYPES = [
  'kstep', 'blowStart', 'blowStop', 'blowNothing', 'candleOut', 'slam', 'won', 'caught',
  'door', 'useNothing', 'shutRefused', 'hide', 'unhide', 'unhideRefused',
  'creak', 'squeak', 'pickup', 'throw', 'throwRefused', 'land',
  'beam', 'beamSpot', 'reach', 'grab', 'grabbed',
  'wake', 'mstep', 'spotted', 'windup', 'lunge', 'doorTry', 'checkOpen', 'checkEmpty', 'found', 'yell',
  'mode', 'lost', 'mood', 'tactic', 'fury', 'spent', 'hideSeen',
];
const EVENT_ID = new Map(EVENT_TYPES.map((t, i) => [t, i]));
export function eventId(type) {
  const id = EVENT_ID.get(type);
  if (id === undefined) throw new Error(`event type "${type}" is not in the schema`);
  return id;
}

export function encode(G, out, o) {
  for (const t of TOKENS) for (let i = 0; i < t.count; i++) for (const f of t.fields) {
    if (f.type === 'cat') {
      const k = f.get(G, i);
      for (let j = 0; j < f.n; j++) out[o + j] = j === k ? 1 : 0;
      o += f.n;
    } else {
      const v = f.type === 'flag' ? (f.get(G, i) ? 1 : 0) : f.get(G, i) / f.scale;
      out[o++] = Number.isFinite(v) ? v : 0;
    }
  }
  return o;
}
export function encodeKI(ki, out, o) { for (const f of KI_FIELDS) out[o++] = +(ki[f] || 0); return o; }
export function encodeGI(gi, out, o) {
  for (const f of GI_FIELDS) out[o++] = f === 'ax' ? (gi.ax || 0) / W : f === 'az' ? (gi.az || 0) / H : +(gi[f] || 0);
  return o;
}

export function schemaJSON(L) {
  if (L && (L.w !== W || L.h !== H)) throw new Error('schema built for a 37 x 23 house');
  return {
    version: 2, tickSeconds: 0.05, stateSize: STATE_SIZE,
    // the house: every tile's type, and which door (if any) it belongs to (a shut door blocks like a wall)
    map: L ? { w: W, h: H, tileTypes: Object.keys(T), tiles: Array.from(L.tiles), doorAt: Array.from({ length: W * H }, (_, i) => L.doorAt(i % W, Math.floor(i / W))) } : { w: W, h: H },
    tokens: TOKENS.map((t) => ({ kind: t.kind, count: t.count, width: t.width, offset: t.offset,
      fields: t.fields.map((f) => (f.type === 'cat' ? { name: f.name, type: f.type, n: f.n } : { name: f.name, type: f.type, scale: f.scale ?? 1 })) })),
    kiFields: KI_FIELDS, giFields: GI_FIELDS, eventTypes: EVENT_TYPES,
    categories: { act: ACTS, state: STATES, beam: BEAMS, hand: HANDS, mode: MODES, heardKind: HEARD },
    personaTraits: ['smart', 'aggression', 'patience', 'ears', 'guard', 'thorough', 'temper', 'tools', 'temp'],
  };
}
