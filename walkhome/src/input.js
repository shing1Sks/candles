// Keys and mouse. Look movement accumulates between frames; presses are edges, delivered once.
// radians per pixel at speed 1.0; [ and ] change the speed (saved).
export const LOOK = { yaw: 0.0022, pitch: 0.0019, speed: Number(localStorage.getItem('walkhome.mouse') || 1) };
export function setMouseSpeed(v) { LOOK.speed = Math.max(0.3, Math.min(2.5, Math.round(v * 10) / 10)); localStorage.setItem('walkhome.mouse', String(LOOK.speed)); return LOOK.speed; }

export class Input {
  constructor() {
    this.keys = new Set(); this.mouse = new Set();
    this.dYaw = 0; this.dPitch = 0; this.edges = new Set(); this.enabled = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!this.enabled || e.repeat) return;
      this.keys.add(e.code); this.edges.add(e.code);
      if (e.code === 'BracketLeft') this.onSpeed?.(setMouseSpeed(LOOK.speed - 0.1));
      if (e.code === 'BracketRight') this.onSpeed?.(setMouseSpeed(LOOK.speed + 0.1));
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => { if (!this.enabled) return; this.mouse.add(e.button); this.edges.add('Mouse' + e.button); });
    addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // Chrome on Windows sometimes reports one huge jump under pointer lock: drop it
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 200) return;
      this.dYaw -= e.movementX * LOOK.yaw * LOOK.speed; this.dPitch -= e.movementY * LOOK.pitch * LOOK.speed;
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
  }
  sample() {
    const k = this.keys, e = this.edges;
    const i = {
      move: { x: (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), z: (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0) },
      look: { yaw: this.dYaw, pitch: this.dPitch },
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('KeyC') || k.has('ControlLeft'),
      carry: e.has('KeyE'), pet: k.has('KeyF'), tug: e.has('Mouse2') || e.has('KeyQ'), tugHeld: this.mouse.has(2) || k.has('KeyQ'),
      call: e.has('KeyR'),
    };
    this.dYaw = 0; this.dPitch = 0; e.clear();
    return i;
  }
}
