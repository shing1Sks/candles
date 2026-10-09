// THE ROAD HOME. One curve, about 1.6 km, from the end of our street to the house on the hill.
// s is the distance walked along it (and z = -s exactly, so s is always just -z). The road wanders
// gently left and right, rolls a little, humps over the canal bridge, then climbs the hill at the end;
// you can see the house's window from the start, and it never seems to get nearer.
// Pure functions only: the sim, the renderer and the tools all share this.

export const ROAD = {
  length: 1600,
  half: 2.8,        // half the carriageway
  kerb: 0.25,
  pave: 1.65,       // pavement width
  yard: 2.7,        // front garden depth
  get front() { return this.half + this.kerb + this.pave + this.yard; }, // where the house fronts stand (7.4)
  homeS: 1600,
  segment: 24,
};

// the regions you walk through, in order; each has its own look, sound and encounters
export const REGIONS = [
  { id: 'ourStreet', from: 0, to: 250, name: 'our street' },
  { id: 'longStreet', from: 250, to: 600, name: 'the long street' },
  { id: 'highStreet', from: 600, to: 950, name: 'the high street' },
  { id: 'parkEdge', from: 950, to: 1250, name: 'the park' },
  { id: 'hill', from: 1250, to: 1640, name: 'the hill' },
];
export function regionAt(s) {
  for (const r of REGIONS) if (s < r.to) return r;
  return REGIONS[REGIONS.length - 1];
}
// 0..1 blend toward the next region over the last 30 m of this one (for gradual transitions)
export function regionBlend(s) {
  const r = regionAt(s);
  return Math.max(0, Math.min(1, (s - (r.to - 30)) / 30));
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// sideways wander: big lazy bends and a small wobble; straight at the very start so the first view is long
export function wander(s) {
  const k = smooth(0, 60, s);
  return k * (2.4 * Math.sin(s * 0.031) + 9 * Math.sin(s * 0.0042 + 0.6) - 9 * Math.sin(0.6));
}
// height: a gentle roll, the canal bridge's hump in the park, the long climb at the end
export function height(s) {
  const roll = 1.2 * Math.sin(s * 0.011) * smooth(30, 120, s);
  const bridge = 1.6 * Math.exp(-((s - 1105) ** 2) / (2 * 14 ** 2));
  const hill = 34 * Math.pow(smooth(1220, 1620, s), 1.3);
  return roll + bridge + hill;
}

// the centre line at s, in world space
export function C(s, out = { x: 0, y: 0, z: 0 }) { out.x = wander(s); out.y = height(s); out.z = -s; return out; }
// unit normal to the right of the direction of travel (+x when the road runs straight to -z)
export function N(s, out = { x: 0, z: 0 }) {
  const dx = wander(s + 0.5) - wander(s - 0.5), dz = -1, l = Math.hypot(dx, dz);
  out.x = -dz / l; out.z = dx / l; return out;
}
// tangent (direction of travel), unit, horizontal
export function T(s, out = { x: 0, z: 0 }) { const n = N(s); out.x = n.z; out.z = -n.x; return out; }
// a point at distance s along the road, l to the right of the centre line, y above the road surface
export function at(s, l, y = 0, out = { x: 0, y: 0, z: 0 }) {
  const c = C(s), n = N(s);
  out.x = c.x + n.x * l; out.y = c.y + y; out.z = c.z + n.z * l; return out;
}
// world (x, z) -> road coordinates. z = -s at the centre line, and the normal is nearly ±x, so a
// couple of fixed-point steps land on the exact s whose normal line passes through the point.
export function toRoad(x, z) {
  let s = -z;
  for (let i = 0; i < 3; i++) {
    const c = C(s), n = N(s), l = (x - c.x) * n.x + (z - c.z) * n.z;
    s = -(z - n.z * l);
  }
  const c = C(s), n = N(s);
  return { s, l: (x - c.x) * n.x + (z - c.z) * n.z };
}
// ground height under a world point: the road's height at that s (gardens rise very slightly away
// from the road so the houses sit up on their plots)
export function groundAt(x, z) {
  const { s, l } = toRoad(x, z);
  const lift = Math.abs(l) > ROAD.half + ROAD.kerb ? 0.12 : 0;
  return height(s) + lift;
}
