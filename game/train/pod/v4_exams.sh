#!/bin/bash
# The exams of a v4 model on the machine, both against the nightmare (the monster it was trained on), with the play
# decode (kid exact, the monster's mind drawn, the rest at 0.3, top-p 0.9, snap, peak, coherent catches, walls):
#   the rollout exam (tools/dream_exam.mjs: GAMES seeded games by the rules and inside the model) and the mechanics
#   exam (tools/mechanics/exam.mjs: 383 cases, RUNS runs each), each over PARTS processes.
# usage: v4_exams.sh NAME [GAMES=40] [RUNS=3] [PARTS=16]     NAME: onnx/NAME -> runs/exams_NAME/
[ -d /venv/main/bin ] && export PATH=/venv/main/bin:$PATH
export PATH=/opt/node-v24.19.0-linux-x64/bin:$PATH
cd /workspace/gn/game
NAME=$1; GAMES=${2:-40}; RUNS=${3:-3}; PARTS=${4:-16}
M=/workspace/gn/onnx/$NAME; P=/workspace/gn/game/public/nightmare.json; O=/workspace/gn/runs/exams_$NAME; mkdir -p "$O"
[ -d node_modules/onnxruntime-web ] || npm install --no-save --no-audit --no-fund onnxruntime-web@1.30.0 > /dev/null 2>&1
DECODE="--mix 0.3 --mind 1 --mixfor kid=0 --top_p 0.9 --snap --peak --cohere --walls"
for k in $(seq 0 $((PARTS - 1))); do
  node tools/dream_exam.mjs "$M" --games "$GAMES" --seconds 120 --part "$k/$PARTS" --threads 2 --nightmare 1 --policy "$P" --keys 0.35 $DECODE \
    --out "$O/d$k.json" > "$O/d$k.log" 2>&1 &
  node tools/mechanics/exam.mjs "$M" --runs "$RUNS" --part "$k/$PARTS" --threads 2 --monster nightmare --policy "$P" --out "$O/m$k.json" > "$O/m$k.log" 2>&1 &
done
wait
node tools/dream_exam.mjs --merge "$O"/d*.json --out "$O/dream.json" > "$O/dream.txt"
grep -h "^game" "$O"/d*.log | sort -n -k2 >> "$O/dream.txt"
# the mechanics parts as one report: by family, and every case that did not pass every run
node -e "
const fs = require('fs'), rows = [];
for (const f of fs.readdirSync('$O').filter((f) => /^m\d+\.json$/.test(f))) for (const m of Object.values(JSON.parse(fs.readFileSync('$O/' + f)).models)) rows.push(...m.rows);
const fam = {};
for (const r of rows) { const f = (fam[r.fam] ||= { cases: 0, ok: 0, pass: 0, runs: 0 }); f.cases++; f.pass += r.pass; f.runs += r.runs; if (r.pass === r.runs) f.ok++; }
const all = rows.reduce((a, r) => a + r.pass, 0), runs = rows.reduce((a, r) => a + r.runs, 0);
let out = 'mechanics: ' + all + '/' + runs + ' runs (' + (100 * all / runs).toFixed(0) + '%), ' + rows.filter((r) => r.pass === r.runs).length + '/' + rows.length + ' cases every run\n';
for (const [k, f] of Object.entries(fam)) out += '  ' + k.padEnd(10) + ' ' + f.ok + '/' + f.cases + ' cases every run, ' + f.pass + '/' + f.runs + ' runs\n';
out += '\nnot every run:\n' + rows.filter((r) => r.pass < r.runs).map((r) => '  ' + r.id + ' ' + r.pass + '/' + r.runs + '  ' + r.what + (r.rules_ok ? '' : '  [rules fail too]') + (r.example_fail ? '\n      e.g. ' + r.example_fail : '')).join('\n');
fs.writeFileSync('$O/mechanics.txt', out); fs.writeFileSync('$O/mechanics.json', JSON.stringify(rows));
console.log(out.split('\n').slice(0, 14).join('\n'));
"
echo "exams done: $O"
