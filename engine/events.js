// Everything that happens is announced as an event. Voice, sound, screen effects and the data twin
// all listen; none of them change the state.

export function makeEmitter(S) {
  return (type, data = {}) => {
    S.events.push({ tick: S.tick, t: +S.t.toFixed(4), type, ...data });
  };
}
