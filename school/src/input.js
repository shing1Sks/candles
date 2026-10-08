// Keys and mouse -> the engine's input objects. Look movement accumulates between engine steps and
// is handed to the first step of each frame; presses (use, drop) are edges, delivered exactly once.
// radians per pixel at speed 1.0; [ and ] change the speed (saved). Pitch slightly gentler than yaw.
export const LOOK = { yaw: 0.0022, pitch: 0.0019, speed: Number(localStorage.getItem('homeTime.mouse') || 1) };
export function setMouseSpeed(v) { LOOK.speed = Math.max(0.3, Math.min(2.5, Math.round(v * 10) / 10)); localStorage.setItem('homeTime.mouse', String(LOOK.speed)); return LOOK.speed; }

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = new Set();
    this.dYaw = 0; this.dPitch = 0;
    this.useEdge = false; this.dropEdge = false;
    this.enabled = false;
    addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (!this.enabled) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.useEdge = true;
      if (e.code === 'KeyQ') this.dropEdge = true;
      if (e.code === 'BracketLeft') this.onSpeed?.(setMouseSpeed(LOOK.speed - 0.1));
      if (e.code === 'BracketRight') this.onSpeed?.(setMouseSpeed(LOOK.speed + 0.1));
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouse.add(e.button);
      if (e.button === 0) this.useEdge = true;
      if (e.button === 2) this.dropEdge = true;
    });
    addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // Chrome on Windows sometimes reports one huge jump under pointer lock: drop it
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 200) return;
      this.dYaw -= e.movementX * LOOK.yaw * LOOK.speed;
      this.dPitch -= e.movementY * LOOK.pitch * LOOK.speed;
    });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
  }

  // one engine step's input. first = the first step of this frame (gets the look and the edges)
  sample(first) {
    const k = this.keys;
    const input = {
      move: { x: (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), z: (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0) },
      look: { yaw: 0, pitch: 0 },
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('KeyC') || k.has('ControlLeft'),
      use: false, useHeld: k.has('KeyE') || this.mouse.has(0), drop: false,
      show: k.has('KeyF'),
    };
    if (first) {
      input.look = { yaw: this.dYaw, pitch: this.dPitch };
      this.dYaw = 0; this.dPitch = 0;
      input.use = this.useEdge; input.drop = this.dropEdge;
      this.useEdge = false; this.dropEdge = false;
    }
    return input;
  }
}
