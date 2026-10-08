// A PAINTER THREAD. Cards are painted here, off the main thread, on CPU-backed canvases (faster than
// the GPU for thousands of small brush strokes on the Iris Xe), several at once across workers. Each
// job returns the picture (an ImageBitmap, for the game) and a PNG (for the cache).
import { Painter } from './paint.js';
import { headmaster, teacher, TEACHERS, hallPass, wallTexture, floorTexture, ceilingTexture, doorTexture, noticeTexture, photoTexture } from './school.js';
import { teacherBack, blackboardTexture, windowTexture, displayTexture, planksTexture } from './rooms.js';
import { friezeCanvas, pageCanvas, rugCanvas, lockerTexture, wallTileTexture, wallPanelTexture, floorLinoTexture } from './textures.js';
import { dressAtlas, hallDoorsTexture } from './dressing.js';
import { kidSpec, paintKid, roadSafetyCutout } from './kids.js';

const JOBS = {
  headmaster: [640, 1160, 77, (p) => headmaster(p)],
  teacher: [660, 1000, 41, (p) => teacher(p)],
  teacherBack: [660, 1000, 41, (p) => teacherBack(p)],
  passCard: [420, 310, 4, (p) => hallPass(p)],
  cutout: [480, 980, 61, (p) => roadSafetyCutout(p)],
};

// pictures whose painters make their own canvas
const MADE = {
  board: () => blackboardTexture(1009, false),
  boardEyes: () => blackboardTexture(1010, false, ['Eyes on your own paper.', 'No talking. No looking up.']),
  boardStory: () => blackboardTexture(1011, false, ['Story Time', 'Sit nicely. Listen to the end.']),
  frieze: () => friezeCanvas(), rug: () => rugCanvas(),
  page: (a) => pageCanvas(a.n),
  // the school's surfaces
  wall: () => wallTexture(101, false), wall2: () => wallTexture(202, false), floor: () => floorTexture(303), ceiling: () => ceilingTexture(404),
  planks: () => planksTexture(505), locker: () => lockerTexture(606), locker2: () => lockerTexture(617), locker3: () => lockerTexture(628),
  door: () => doorTexture(707, false, '2B'), door2: () => doorTexture(708, false, '3A'), door3: () => doorTexture(709, false, '4C'), doorFace: () => doorTexture(710, true, '4B'),
  notice: () => noticeTexture(808), photo1: () => photoTexture(901, 1), photo2: () => photoTexture(902, 2), photo3: () => photoTexture(903, 3),
  wallTile: () => wallTileTexture(111), wallPanel: () => wallPanelTexture(222), floorLino: () => floorLinoTexture(333),
  dress: () => dressAtlas(), hallDoors: () => hallDoorsTexture(),
  window: () => windowTexture(1001), display: () => displayTexture(1101),
};

function job(name, args) {
  if (name === 'teacherVariant') { // one of the teachers (art/school.js TEACHERS), front or back
    const sp = TEACHERS[args.i % TEACHERS.length];
    return [660, 1000, 41 + args.i, (p) => (args.view === 'b' ? teacherBack(p, sp) : teacher(p, sp)), 1];
  }
  if (name === 'kid') {
    const { i, view, scale, wrong } = args;
    const spec = kidSpec(200 + i, { wrong });
    return [420, 660, 300 + i, (p) => paintKid(p, spec, view === 'b' ? { back: true } : view === 's' ? { snap: 2.3 } : {}), scale];
  }
  return [...JOBS[name], 1];
}

self.onmessage = async (e) => {
  const { id, name, args } = e.data;
  try {
    if (MADE[name]) {
      const c = MADE[name](args || {});
      const blob = await c.convertToBlob({ type: 'image/png' });
      const bitmap = c.transferToImageBitmap();
      self.postMessage({ id, bitmap, blob }, [bitmap]);
      return;
    }
    const [w, h, seed, draw, scale] = job(name, args || {});
    const c = new OffscreenCanvas(Math.round(w * scale), Math.round(h * scale));
    const x = c.getContext('2d', { willReadFrequently: true });
    x.scale(scale, scale);
    draw(new Painter(x, seed));
    const blob = await c.convertToBlob({ type: 'image/png' });
    const bitmap = c.transferToImageBitmap();
    self.postMessage({ id, bitmap, blob }, [bitmap]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
