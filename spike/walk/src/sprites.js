// Paper pieces are semi-transparent cut-outs (soft painted shadows), so they can't rely on the
// depth buffer. Every frame we sort all paper objects far-to-near and hand out renderOrder,
// keeping each puppet's own part order intact. Billboards turn (yaw only) to face the camera.

export class Sprites {
  constructor() {
    this.items = new Set();
  }

  // obj: { root, meshes, billboard = true }
  add(obj) {
    if (obj.billboard === undefined) obj.billboard = true;
    this.items.add(obj);
    return obj;
  }

  remove(obj) {
    this.items.delete(obj);
  }

  // cullDist: static scenery (added with cull: true) beyond this is hidden; it is lost in the fog anyway
  update(camera, cullDist = 80) {
    const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
    const c2 = cullDist * cullDist;
    const list = [];
    for (const o of this.items) {
      if (o.cull) {
        const q = o.root.position, far = (q.x - cx) ** 2 + (q.z - cz) ** 2 > c2;
        if (far !== !!o.culled) { o.culled = far; o.root.visible = !far; }
      }
      if (!o.root.visible) continue;
      const p = o.root.position;
      if (o.billboard) o.root.rotation.y = Math.atan2(cx - p.x, cz - p.z);
      const dx = p.x - cx, dz = p.z - cz, dy = p.y - cy;
      o.d = dx * dx + dz * dz + dy * dy * 0.25 + (o.bias || 0);
      list.push(o);
    }
    list.sort((a, b) => b.d - a.d);
    let ro = 10;
    for (const o of list) for (const m of o.meshes) m.renderOrder = ro++;
  }
}
