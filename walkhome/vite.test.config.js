// For the playtest tools: a second server with no hot reload, so editing the code doesn't
// reload a page that's in the middle of a long scripted run. WH_PORT=5185 python tools/...
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: '../assets',
  server: { port: 5185, strictPort: true, hmr: false, watch: null, fs: { allow: ['..'] } },
});
