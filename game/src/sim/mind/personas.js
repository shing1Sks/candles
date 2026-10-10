// Five monster types, one goal: catch the kid. Each is a set of traits (0..1) on the same mind; every game jitters
// its type's traits a little, so no two games play the same.
//   smart       predicts where you are going, cuts you off, waits at gap exits, drops guesses it can see are empty
//   aggression  runs more, lunges from further, smashes doors
//   patience    its moods cool slower, it waits longer in ambush, it backs off later
//   ears        how much it trusts what it hears (and how easily a thrown toy lures it)
//   guard       how much it holds the lit candles rather than roaming
//   thorough    how often it looks inside wardrobes
//   temper      how hard setbacks hit its anger
//   tools       how keen the giant is on its searchlight and hand
//   temp        how adventurous its choices are at rest (moods move it)
export const PERSONAS = {
  pathfinder: { smart: 0.1, aggression: 0.5, patience: 0.5, ears: 0.5, guard: 0.3, thorough: 0.3, temper: 0.4, tools: 0.3, temp: 0.6 },
  brute: { smart: 0.3, aggression: 0.9, patience: 0.2, ears: 0.4, guard: 0.3, thorough: 0.2, temper: 0.75, tools: 0.5, temp: 0.6 },
  stalker: { smart: 0.9, aggression: 0.5, patience: 0.9, ears: 0.6, guard: 0.5, thorough: 0.6, temper: 0.2, tools: 0.6, temp: 0.6 },
  hound: { smart: 0.5, aggression: 0.6, patience: 0.5, ears: 0.95, guard: 0.2, thorough: 0.4, temper: 0.5, tools: 0.4, temp: 0.6 },
  warden: { smart: 0.6, aggression: 0.65, patience: 0.8, ears: 0.4, guard: 0.75, thorough: 0.8, temper: 0.25, tools: 0.8, temp: 0.6 },
};
export const PERSONA_TYPES = Object.keys(PERSONAS);
const TRAITS = ['smart', 'aggression', 'patience', 'ears', 'guard', 'thorough', 'temper', 'tools'];

// a normal draw (Box-Muller) from a uniform stream
function gauss(rand) {
  const u = Math.max(1e-12, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function samplePersona(type, rand) {
  const base = PERSONAS[type];
  if (!base) throw new Error(`unknown persona ${type}`);
  const p = { type, temp: base.temp };
  for (const k of TRAITS) p[k] = Math.max(0, Math.min(1, base[k] + gauss(rand) * 0.08));
  return p;
}
