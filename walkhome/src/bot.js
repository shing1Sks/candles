// A PLAYTESTER. Walks the whole road the way a careful, frightened player might: keeps to the
// pavement, glances back now and then (often once he's about), runs when it's bad, picks Biscuit
// up when he's terrified, strokes him, tugs the lead when he won't come. Logs everything, so a
// whole night can be read afterwards as a timeline (05 R42: "where did it stop being scary?").
import { T as roadT, regionAt } from './sim/road.js';

export class Bot {
  constructor() { this.t = 0; this.nextLook = 6; this.lookUntil = 0; this.tens = 0; this.log = []; this.lastLog = -99; this.calmFor = 0; }
  drive(inp, w, dt) {
    const P = w.player, D = w.dog, Tm = w.tall, Dir = w.director;
    this.t += dt;
    const danger = Tm.active && Tm.mode !== 'glimpse';
    // look back now and then
    if (this.t > this.nextLook) { this.lookUntil = this.t + 0.9; this.nextLook = this.t + (danger ? 3.5 + Math.random() * 2 : 8 + Math.random() * 6); }
    const back = this.t < this.lookUntil;
    // steer along the road, keeping to the pavement-ish line
    // Biscuit's run off: go to him (across the road if that's where the whimpering is)
    const lost = D.lost, wantL = lost && lost.s - P.s < 25 && lost.s > P.s - 2 ? Math.sign(D.l || 1) * 4.2 : 3.95;
    const tg = roadT(P.s), roadYaw = Math.atan2(-tg.x, -tg.z);
    let want = roadYaw - (wantL - P.l) * 0.12 * (P.l < wantL ? -1 : 1) * 0;
    want += Math.max(-0.7, Math.min(0.7, (P.l - wantL) * 0.35));
    if (back) want += Math.PI;
    let d = want - P.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    inp.look.yaw = d * Math.min(1, dt * (back ? 14 : 5)); inp.look.pitch = (-0.1 - P.pitch) * Math.min(1, dt * 4);
    inp.move.x = 0; inp.move.z = back ? 0 : -1;
    // run when it's bad (and there's breath)
    inp.run = (Dir.phase === 'hunt' || Dir.phase === 'peak') && P.stamina > 0.25 && !back;
    // Biscuit
    inp.carry = false;
    if (!D.carried && D.state === 'hide' && Math.hypot(D.x - P.x, D.z - P.z) < 1.3) inp.carry = true;
    if (D.carried) { this.calmFor = Dir.phase === 'calm' || Dir.phase === 'after' ? this.calmFor + dt : 0; if (this.calmFor > 12) { inp.carry = true; this.calmFor = 0; } }
    inp.pet = D.fear > 0.45 && !inp.run;
    this.tens = D.tension > 0.85 ? this.tens + dt : 0;
    inp.tug = this.tens > 1.6; if (inp.tug) this.tens = 0;
    inp.call = false;
    // the log
    if (this.t - this.lastLog > 5) {
      this.lastLog = this.t;
      this.log.push({ t: +this.t.toFixed(0), s: +P.s.toFixed(0), r: regionAt(P.s).id, ph: Dir.phase, fear: +Dir.fear.toFixed(2), tall: Tm.active ? `${Tm.mode}@${(Tm.s - P.s).toFixed(0)}` : '-', dog: D.carried ? 'carried' : D.state, dfear: +D.fear.toFixed(2), enc: w.deck.activeId && w.deck.active ? w.deck.activeId : '-', fps: +w.fps().toFixed(0) });
    }
  }
}
