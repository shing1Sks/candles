// ?record: capture the data twin while you play (the same lines the headless sim writes), and
// press F9 to download the night as JSONL.
import { snapshot, TWIN_EVERY } from '../../engine/twin.js';

export function startRecorder(getWorld, onStep) {
  const lines = [];
  let buffered = [];
  onStep((world, input, events) => {
    buffered.push(...events);
    if (world.S.tick % TWIN_EVERY === 0) { lines.push(JSON.stringify(snapshot(world.S, input, buffered))); buffered = []; }
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/x-ndjson' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hometime_twin_seed${getWorld().S.seed}_${lines.length}lines.jsonl`;
    a.click();
  });
  return lines;
}
