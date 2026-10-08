// SCREEN EFFECTS, drawn over the world on one 2D canvas (no blend-mode layers: they cost the Iris Xe
// laptop dearly):
//   edges   - torn dark paper creeping in from the screen edges as danger gets close (12 fps boil)
//   face    - a painted face pushed right up into the camera: the hall-pass stoop, and the jump scares
//   crumple - caught: the world crumples like a paper ball and goes dark
//   black   - fade to / from black, and a text card on it (EXPELLED, HOME TIME, a page)
//   locker  - hiding: the inside of the locker, the corridor seen only through the vent slits
export class FX {
  constructor() {
    this.c = document.getElementById('fx');
    this.x = this.c.getContext('2d');
    this.gl = document.getElementById('gl');
    this.busy = false;
    this.dread = 0;
    this.faceState = null;   // { img, sx, sy, sw, sh, t0, dur, mode }
    this.blackA = 0; this.blackTarget = 0; this.text = null;
    this.creases = null;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.edgeT = 0; this.edgeSeed = [];
  }

  resize() { this.c.width = innerWidth; this.c.height = innerHeight; }

  // a face filling the screen. mode 'stoop': leans in slowly and holds; 'rush': slams in
  face(img, crop, dur, mode = 'stoop') { this.faceState = { img, crop, t0: performance.now(), dur: dur * 1000, mode }; }

  async crumple() {
    this.busy = true;
    const W = innerWidth, H = innerHeight;
    this.creases = Array.from({ length: 16 }, () => [Math.random() * W, Math.random() * H, Math.random() * W, Math.random() * H]);
    this.crumpleT0 = performance.now();
    await new Promise((r) => setTimeout(r, 1500));
    this.gl.style.transform = ''; this.gl.style.filter = '';
    this.creases = null;
    this.blackA = 1; this.blackTarget = 1;
    this.busy = false;
  }

  // home time: the doors open and warm daylight floods the whole screen
  flood() { this.floodT0 = performance.now(); }

  fadeIn(secs = 2) { this.blackTarget = 0; this.fadeRate = 1 / secs; }
  fadeOut(secs = 1) { this.blackTarget = 1; this.fadeRate = 1 / secs; }
  card(lines, secs) { this.text = { lines, until: secs ? performance.now() + secs * 1000 : Infinity }; }
  clearCard() { this.text = null; }

  draw(dt) {
    const c = this.x, W = this.c.width, H = this.c.height, now = performance.now();
    c.clearRect(0, 0, W, H);
    // crumple: transform the world canvas, draw creases
    if (this.creases) {
      const k = Math.min(1, (now - this.crumpleT0) / 1500), e = k * k;
      this.gl.style.transform = `scale(${1 - e * 0.55}) rotate(${e * 14}deg) skew(${e * 8}deg, ${-e * 5}deg)`;
      this.gl.style.filter = `brightness(${1 - e * 0.7}) contrast(${1 + e})`;
      c.strokeStyle = `rgba(20,18,16,${0.6 * k})`; c.lineWidth = 2;
      for (const [a, b, x, y] of this.creases.slice(0, Math.ceil(k * this.creases.length))) {
        c.beginPath(); c.moveTo(a, b); c.lineTo((a + x) / 2 + (Math.random() - 0.5) * 30, (b + y) / 2); c.lineTo(x, y); c.stroke();
      }
      c.fillStyle = `rgba(0,0,0,${Math.max(0, (k - 0.6) / 0.4)})`; c.fillRect(0, 0, W, H);
    }
    // torn edges, re-torn at 12 fps
    this.edgeT += dt;
    if (this.dread > 0.05) {
      if (this.edgeT > 1 / 12 || !this.edgeSeed.length) { this.edgeT = 0; this.edgeSeed = Array.from({ length: 400 }, () => Math.random()); }
      const depth = this.dread * Math.min(W, H) * 0.13;
      c.fillStyle = `rgba(14,12,11,${0.6 + this.dread * 0.35})`;
      c.strokeStyle = 'rgba(200,196,188,0.22)'; c.lineWidth = 1.2;
      let r = 0;
      const rnd = () => this.edgeSeed[(r++) % this.edgeSeed.length];
      const side = (len, fn) => {
        c.beginPath(); fn(0, 0);
        for (let s = 0; s <= len; s += 18) fn(s, depth * (0.35 + rnd() * 0.65) * (rnd() < 0.1 ? 1.6 : 1));
        fn(len, 0); c.closePath(); c.fill(); c.stroke();
      };
      side(W, (s, d) => c.lineTo(s, d)); side(W, (s, d) => c.lineTo(s, H - d));
      side(H, (s, d) => c.lineTo(d, s)); side(H, (s, d) => c.lineTo(W - d, s));
    }
    // hiding in a locker: black metal, and the world through four slits at eye height
    this.hideK = Math.max(0, Math.min(1, (this.hideK || 0) + (this.hidden ? dt * 5 : -dt * 5)));
    if (this.hideK > 0) {
      c.save(); c.globalAlpha = this.hideK;
      c.fillStyle = 'rgb(8,8,7)'; c.fillRect(0, 0, W, H);
      const sw = W * 0.34, sh = H * 0.028, x0 = W / 2 - sw / 2, breathe = Math.sin(now / 900) * 2;
      for (let k = 0; k < 4; k++) {
        const y = H * 0.4 + k * sh * 2.1 + breathe;
        c.clearRect(x0, y, sw, sh);
        c.fillStyle = 'rgba(8,8,7,0.6)'; c.fillRect(x0, y, sw, sh * 0.3); // the lip of each slat
      }
      // the inside of the door: a scratched number, faintly
      c.fillStyle = 'rgba(120,116,108,0.12)'; c.font = 'bold 28px Georgia'; c.textAlign = 'center'; c.fillText('L', W / 2, H * 0.3);
      c.restore();
    }
    // the face
    const f = this.faceState;
    if (f) {
      const k = (now - f.t0) / f.dur;
      if (k >= 1) this.faceState = null;
      else {
        const [sx, sy, sw, sh] = f.crop;
        const lean = f.mode === 'rush' ? Math.min(1, k * 6) : Math.min(1, k * 2.5) ** 0.7;
        const hold = f.mode === 'rush' ? 1 : (k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1);
        const scale = f.mode === 'page' ? Math.min((H * 0.72) / sh, (W * 0.72) / sw) * (0.92 + 0.08 * lean) : (0.35 + 0.95 * lean) * (H / sh) * 1.25;
        const jx = f.mode === 'rush' ? (Math.random() - 0.5) * 18 : Math.sin(now / 90) * 2;
        c.save();
        c.globalAlpha = hold;
        c.fillStyle = `rgba(0,0,0,${0.55 * lean})`; c.fillRect(0, 0, W, H);
        c.translate(W / 2 + jx, H * 0.52);
        c.drawImage(f.img, sx, sy, sw, sh, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale);
        c.restore();
      }
    }
    // daylight
    if (this.floodT0) {
      const k = Math.min(1, (now - this.floodT0) / 3000);
      const g = c.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, Math.max(W, H) * (0.2 + k));
      g.addColorStop(0, `rgba(255,246,220,${Math.min(1, k * 1.4)})`); g.addColorStop(1, `rgba(255,232,180,${k * 0.9})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (k >= 1 && now - this.floodT0 > 6000) this.floodT0 = 0;
    }
    // black, and a card on it
    if (this.blackA !== this.blackTarget) {
      const step = (this.fadeRate || 1) * dt;
      this.blackA = this.blackA < this.blackTarget ? Math.min(this.blackTarget, this.blackA + step) : Math.max(this.blackTarget, this.blackA - step);
    }
    if (this.blackA > 0) { c.fillStyle = `rgba(0,0,0,${this.blackA})`; c.fillRect(0, 0, W, H); }
    if (this.text) {
      if (now > this.text.until) this.text = null;
      else {
        c.fillStyle = '#d8d4ca'; c.textAlign = 'center';
        this.text.lines.forEach((ln, i) => { c.font = i === 0 ? '44px Georgia' : 'italic 19px Georgia'; c.fillText(ln, W / 2, H / 2 - 10 + i * 46); });
      }
    }
  }
}
