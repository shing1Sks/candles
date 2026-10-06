// The boy's hands, first person, drawn on a 2D overlay every frame.
// Poses blend: rest/walk (hands low at your sides, swinging), sprint (arms pumping), reach (both
// forward). Fingers hang from their knuckle pins on springs, so they flop with every step and turn.
// Caught petals are pinned to the back of the left hand around one pin: a flower forming as you
// collect them.

const lerp = (a, b, k) => a + (b - a) * k;

export class Hands {
  constructor(canvas, A) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.P = A.hands;
    this.pin = A.pinCanvas;
    this.petals = A.handPetals;
    this.reach = 0; this.sprint = 0;
    this.sides = [-1, 1].map(() => ({ ang: this.P.fingers.map(() => 0), vel: this.P.fingers.map(() => 0) }));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.c.width = innerWidth * dpr; this.c.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(dt, { walk, sprint, bob, turn, reaching, tremble, held, hidden }) {
    const ctx = this.ctx, W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    if (hidden) return;
    this.reach += ((reaching ? 1 : 0) - this.reach) * Math.min(1, dt * 5);
    this.sprint += ((sprint ? 1 : 0) - this.sprint) * Math.min(1, dt * 4);
    const r = this.reach, sp = this.sprint * (1 - r);
    const now = performance.now() / 1000;
    const s = (H / 720) * lerp(0.82, 0.9, r);
    const jolt = Math.cos(bob * 2) * walk * (1 + sp * 1.5);

    [-1, 1].forEach((side, si) => {
      const st = this.sides[si];
      const swing = Math.sin(bob) * side; // left and right swing in opposite phase
      // rest / walk: low at your sides, the whole hand and a bit of sleeve in view
      let cx = W / 2 + side * H * 0.5 + turn * -30;
      let cy = H * 1.0 + swing * H * 0.035 * walk + Math.sin(now * 1.1 + si) * 4;
      let rot = 0.3 + swing * 0.05 * walk;
      // sprint: arms pump, hands come up and in
      cx = lerp(cx, W / 2 + side * H * 0.42, sp);
      cy = lerp(cy, H * (0.96 + swing * 0.11), sp);
      rot = lerp(rot, 0.45 + swing * 0.28, sp);
      // reach: both hands forward, toward the middle
      cx = lerp(cx, W / 2 + side * H * 0.2, r);
      cy = lerp(cy, H * 0.8 + Math.sin(now * 2 + si) * 3, r);
      rot = lerp(rot, 0.16, r);

      for (let i = 0; i < st.ang.length; i++) {
        const target = (i - 2) * 0.12 * (1 - r * 0.6) + 0.16 * (1 - r) + jolt * 0.16 * (i % 2 ? 1 : -1) - turn * 0.18 * side
          + (tremble ? Math.sin(now * 22 + i) * 0.06 : 0);
        st.vel[i] += ((target - st.ang[i]) * 60 - st.vel[i] * 7) * dt;
        st.ang[i] += st.vel[i] * dt;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      if (side > 0) ctx.scale(-1, 1);
      ctx.rotate(rot);
      const { sleeve, palm, fingers } = this.P;
      ctx.drawImage(sleeve.canvas, sleeve.x, sleeve.y, sleeve.w, sleeve.h);
      ctx.scale(-1, 1); // backs of the hands: thumbs toward the middle
      fingers.forEach((f, i) => {
        ctx.save();
        ctx.translate(f.pivot[0], f.pivot[1]);
        ctx.rotate(st.ang[i]);
        ctx.drawImage(f.canvas, f.x - f.pivot[0], f.y - f.pivot[1], f.w, f.h);
        ctx.restore();
      });
      ctx.drawImage(palm.canvas, palm.x, palm.y, palm.w, palm.h);
      for (const f of fingers) ctx.drawImage(this.pin, f.pivot[0] - 8.3, f.pivot[1] - 8.3, 19, 19);
      if (side < 0 && held.length) this.flower(ctx, held, now);
      ctx.restore();
    });
  }

  // the petals you have caught, pinned in a ring on the back of the left hand
  flower(ctx, held, now) {
    const cx = 0, cy = -80;
    held.forEach((colour, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + Math.sin(now * 1.5 + i) * 0.04;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.drawImage(this.petals[colour], 4, -14, 58, 28);
      ctx.restore();
    });
    ctx.drawImage(this.pin, cx - 12, cy - 12, 27, 27);
  }
}
