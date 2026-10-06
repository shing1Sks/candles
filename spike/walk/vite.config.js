import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// The prototype reuses the concept-sheet brush engine and designs from ../concepts, and serves the
// project's assets folder (assets/audio -> /audio/...).
export default defineConfig({
  publicDir: fileURLToPath(new URL('../../assets', import.meta.url)),
  server: { port: 5181, strictPort: true, fs: { allow: ['..', '../..'] } },
  build: { target: 'es2022' },
});
