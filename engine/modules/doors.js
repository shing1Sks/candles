// DOORS: open, close, locked. A door can't be closed on you while you're standing in its doorway.
export const doors = {
  id: 'doors',
  init() {},
  step(S, input, ctx) {
    const u = S.player.used;
    if (!u || u.kind !== 'door') return;
    const found = ctx.layout.doorById(u.id);
    if (!found) return;
    const st = (S.doors[u.id] ??= { open: false });
    if (st.locked) { ctx.emit('doorLocked', { id: u.id }); return; }
    // with chalk in your hand, an open door not yet marked gets an X: the school cannot forget it
    if (st.open && S.held.chalk > 0 && !st.chalked) {
      st.chalked = true; S.held.chalk--;
      S.layout.pinned[found.chunk.key] = true;
      ctx.emit('doorChalked', { id: u.id, chunk: found.chunk.key });
      return;
    }
    if (st.open) {
      const g = ctx.layout.doorGap(found.room), P = S.player, r = ctx.rules.player.radius;
      if (P.x > g.x0 - r && P.x < g.x1 + r && P.z > g.z0 - r && P.z < g.z1 + r) return;
    }
    st.open = !st.open;
    ctx.emit(st.open ? 'doorOpen' : 'doorClose', { id: u.id });
  },
};
