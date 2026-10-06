// The boy's inner voice: short hand-written lines on screen.
// Never explains anything; only says what he feels or notices. Each line belongs to an event.

export const LINES = {
  start: ['the forest is quiet today.'],
  firstPetal: ['a petal. it\'s warm.'],
  petals: ['i\'ll keep this one.', 'they\'re all different colours.', 'my hand is starting to look like a flower.', 'more. there\'s always one more.'],
  bloom: ['there. it\'s right there.', 'it\'s here. it\'s really here.', 'they flew back to it.'],
  gone: ['it was right here.', 'every time.', 'almost.', 'i was so close.'],
  reached: ['i touched it.'],
  peek: ['someone\'s there.', 'behind the tree.', 'it\'s leaning out further.', 'it wants me to see it.'],
  wave: ['it waved at me.', 'it waved again.', 'why does it wave.'],
  behind: ['...', 'it was behind me.', 'how long was it there.'],
  turned: ['it turned around.', 'that side is crying.'],
  hunt: ['don\'t look away.', 'run.'],
  distracted: ['it\'s looking at the petal.', 'it stopped.'],
  remember: ['does it remember?', 'it looks so sad.', 'it\'s trying to remember something.'],
  dropEmpty: ['i have nothing to give it.'],
  caught: ['where am i.', 'my hand is empty.'],
  mist: ['the fog is coming in.', 'i can\'t see the trees.'],
};

export class Dialogue {
  constructor(el) {
    this.el = el;
    this.queue = [];
    this.cur = null;
    this.gap = 0;
    this.used = {};
  }

  say(kind, urgent = false) {
    const pool = LINES[kind];
    if (!pool) return;
    this.used[kind] = (this.used[kind] ?? -1) + 1;
    const line = pool[this.used[kind] % pool.length];
    if (urgent) { this.queue = [line]; this.cur = null; this.gap = 0; }
    else if (this.queue.length < 2) this.queue.push(line);
  }

  update(dt) {
    if (!this.cur) {
      this.gap -= dt;
      if (this.gap <= 0 && this.queue.length) this.cur = { text: this.queue.shift(), t: 0 };
      else return;
    }
    const c = this.cur;
    c.t += dt;
    const shown = Math.min(c.text.length, Math.floor(c.t * 20));
    const hold = c.text.length / 20 + 3.2;
    this.el.textContent = c.text.slice(0, shown);
    this.el.style.opacity = c.t < hold ? 1 : Math.max(0, 1 - (c.t - hold) / 1.2);
    if (c.t > hold + 1.2) { this.cur = null; this.el.textContent = ''; this.gap = 1.5; }
  }
}
