import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

// cross-origin isolation lets the model's WebAssembly backend use threads (SharedArrayBuffer)
const isolate = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

// The build takes from public/ only what the game needs: the research models and the clips (gigabytes) stay here.
// A model ships as its play.json and parts (tools/ship_model.mjs)
const ships = (name) => existsSync(`public/models/${name}/play.json`) && existsSync(`public/models/${name}/packed_brain.onnx.0`);
function keep(path) {
  const [top, name, file] = relative('public', path).split(sep);
  if (top === 'clips' || /^nightmare_v\d/.test(top)) return false;
  if (top !== 'models' || !name) return true;
  return ships(name) && (!file || file === 'play.json' || /\.onnx\.\d+$/.test(file));
}
// The model's runtime (onnxruntime-web) loads its WebAssembly and starts its threads from its own files, served at
// /ort/ (in dev from node_modules): bundled into the model's worker, its threads would start the worker instead
const ORT = 'node_modules/onnxruntime-web/dist/', ORT_FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];
const shipPublic = {
  name: 'ship-public', apply: 'build',
  closeBundle() {
    cpSync('public', 'dist', { recursive: true, filter: keep });
    for (const f of ORT_FILES) cpSync(ORT + f, `dist/ort/${f}`);
  },
};

export default defineConfig({
  server: { port: 5190, strictPort: true, headers: isolate },
  preview: { headers: isolate },
  build: { copyPublicDir: false, chunkSizeWarningLimit: 1200 },
  resolve: { alias: [{ find: /^onnxruntime-web\/webgpu$/, replacement: resolve(ORT, 'ort.webgpu.min.mjs') }] }, // the runtime without its files inside
  plugins: [shipPublic],
});
