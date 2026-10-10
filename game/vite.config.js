import { defineConfig } from 'vite';

// cross-origin isolation lets the model's WebAssembly backend use threads (SharedArrayBuffer)
const isolate = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
export default defineConfig({ server: { port: 5190, strictPort: true, headers: isolate }, preview: { headers: isolate } });
