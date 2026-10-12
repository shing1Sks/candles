// Ships a model with the game: splits public/models/NAME/FILE into parts of 24 MB (static hosts cap a file's size;
// Cloudflare Pages at 25 MiB) and writes their sizes and md5 into play.json's `ship`. The game's loader reads them
// (src/model/worker.js) and caches the bytes by the md5. play.json and the parts are committed (.gitignore); the build
// copies only shipped models (vite.config.js).
// usage: node tools/ship_model.mjs NAME [FILE=packed_brain.onnx]
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [name, file = 'packed_brain.onnx'] = process.argv.slice(2);
if (!name) { console.error('usage: node tools/ship_model.mjs NAME [FILE]'); process.exit(1); }
const dir = `public/models/${name}`, PART = 24 * 1024 * 1024;
const bytes = readFileSync(`${dir}/${file}`);
for (const f of readdirSync(dir)) if (f.startsWith(file + '.') && /\.\d+$/.test(f)) rmSync(`${dir}/${f}`); // old parts
const parts = [];
for (let o = 0, i = 0; o < bytes.length; o += PART, i++) {
  const b = bytes.subarray(o, o + PART);
  writeFileSync(`${dir}/${file}.${i}`, b);
  parts.push(b.length);
}
const meta = JSON.parse(readFileSync(`${dir}/play.json`, 'utf8'));
meta.ship = { file, parts, md5: createHash('md5').update(bytes).digest('hex') };
writeFileSync(`${dir}/play.json`, JSON.stringify(meta));
console.log(`${dir}: ${file} (${(bytes.length / 1e6).toFixed(1)} MB) in ${parts.length} parts, md5 ${meta.ship.md5}`);
