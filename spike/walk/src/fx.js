// Screen effects drawn over the world:
//   edges    - torn dark paper creeping in from the screen edges as the entity gets close
//   crumple  - caught: the world crumples like a paper ball, goes dark, and you wake elsewhere
//   flood    - you reached the field: colour washes over the grey world, then an ending card

export class FX {
  constructor() {
    this.edgeC = document.getElementById('edges');
    this.ex = this.edgeC.getContext('2d');
    this.black = document.getElementById('black');
    this.flood = document.getElementById('flood');
    this.card = document.getElementById('ending');
    this.creases = document.getElementById('creases');
    this.busy = false;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.edgeC.width = innerWidth; this.edgeC.height = innerHeight;
    this.creases.width = innerWidth; this.creases.height = innerHeight;
  }

  // called on each stop-motion step, so the edges boil at 12 fps
  edges(dread) {
    const c = this.ex, W = innerWidth, H = innerHeight;
    c.clearRect(0, 0, W, H);
    if (dread < 0.05) return;
    const depth = dread * Math.min(W, H) * 0.12;
    c.fillStyle = `rgba(22,20,18,${0.55 + dread * 0.4})`;
    c.strokeStyle = 'rgba(200,196,188,0.25)';
    c.lineWidth = 1.2;
    const side = (len, fn) => {
      c.beginPath();
      fn(0, 0);
      for (let s = 0; s <= len; s += 18) fn(s, depth * (0.35 + Math.random() * 0.65) * (Math.random() < 0.1 ? 1.6 : 1));
      fn(len, 0);
      c.closePath(); c.fill(); c.stroke();
    };
    side(W, (s, d) => c.lineTo(s, d));
    side(W, (s, d) => c.lineTo(s, H - d));
    side(H, (s, d) => c.lineTo(d, s));
    side(H, (s, d) => c.lineTo(W - d, s));
  }

  // caught: crumple -> dark -> (onDark: move the player) -> wake
  async crumple(onDark, wakeDelay) {
    this.busy = true;
    const els = [document.getElementById('gl'), document.getElementById('hands')];
    const cc = this.creases.getContext('2d'), W = innerWidth, H = innerHeight;
    const creases = Array.from({ length: 14 }, () => [Math.random() * W, Math.random() * H, Math.random() * W, Math.random() * H]);
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / 1500);
        const e = k * k;
        for (const el of els) {
          el.style.transform = `scale(${1 - e * 0.55}) rotate(${e * 14}deg) skew(${e * 8}deg, ${-e * 5}deg)`;
          el.style.filter = `brightness(${1 - e * 0.7}) contrast(${1 + e})`;
        }
        cc.clearRect(0, 0, W, H);
        cc.strokeStyle = `rgba(20,18,16,${0.6 * k})`; cc.lineWidth = 2;
        for (const [a, b, x, y] of creases.slice(0, Math.ceil(k * creases.length))) {
          cc.beginPath(); cc.moveTo(a, b); cc.lineTo((a + x) / 2 + (Math.random() - 0.5) * 30, (b + y) / 2); cc.lineTo(x, y); cc.stroke();
        }
        this.black.style.opacity = Math.max(0, (k - 0.6) / 0.4).toFixed(3);
        if (k < 1) requestAnimationFrame(tick); else done();
      };
      tick();
    });
    for (const el of els) { el.style.transform = ''; el.style.filter = ''; }
    cc.clearRect(0, 0, W, H);
    onDark();
    await new Promise((r) => setTimeout(r, wakeDelay * 1000));
    this.black.style.transition = 'opacity 2.2s';
    this.black.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 2300));
    this.black.style.transition = '';
    this.busy = false;
  }

  // reached: the colour floods in; the card waits for "keep walking"
  async floodIn(auto) {
    this.busy = true;
    this.flood.classList.add('show');
    void this.flood.offsetWidth; // let the hidden state apply so the fade-in runs
    this.flood.classList.add('on');
    await new Promise((r) => setTimeout(r, 5200));
    this.card.classList.add('on');
    await new Promise((r) => {
      const btn = document.getElementById('keepWalking');
      btn.onclick = () => r();
      if (auto) setTimeout(r, 4000);
    });
    this.card.classList.remove('on');
    this.flood.classList.remove('on');
    this.busy = false;
    setTimeout(() => { if (!this.flood.classList.contains('on')) this.flood.classList.remove('show'); }, 5200);
  }
}
