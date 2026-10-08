// GOLD STARS: earned by finishing a lesson, stuck to the back of your hand (max 12). Dropping one
// lives in the player module. The exit hazard and the reach roll arrive with the night (Task 9).
export function award(S, ctx, why) {
  if (S.held.stars < ctx.rules.stars.max) S.held.stars++;
  ctx.emit('starEarned', { why, held: S.held.stars });
}
