// The school app. The engine lives in ../engine (shared with the headless sim), assets in ../assets.
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: '../assets',
  server: { port: 5182, strictPort: true, fs: { allow: ['..'] } },
  build: { target: 'es2022' },
});
