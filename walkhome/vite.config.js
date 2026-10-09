// The Long Way Home. Shared assets come from ../assets (served at /audio, /art ...).
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: '../assets',
  server: { port: 5184, strictPort: true, fs: { allow: ['..'] } },
  build: { target: 'es2022' },
});
