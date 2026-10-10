// 사용법: node tools/build.js  -> tools/out/*.jsonl 을 읽어 index.html 을 만든다
const fs = require('fs');
const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
const pick = (a, b) => core.slice(core.indexOf(a), core.indexOf(b));
const runtimeHead = pick('const COLORS', '// 격자를') ;   // COLORS, TOTAL, KINDS, stageParams, maxHints, mulberry32, neighbors
const C = require('./core');
const stages = new Array(C.TOTAL).fill(null);
for (const f of fs.readdirSync(__dirname + '/out')){
  for (const line of fs.readFileSync(__dirname + '/out/' + f, 'utf8').split('\n')){
    if (!line) continue;
    const o = JSON.parse(line); stages[o.idx] = o.enc;
  }
}
const missing = stages.map((s, i) => s ? -1 : i + 1).filter(x => x > 0);
if (missing.length) console.error('missing stages:', missing.join(','));
const data = 'const STAGES = ' + JSON.stringify(stages) + ';\n';
const decode = `
// 미리 만들어 둔 퍼즐을 푼다. 경로는 "시작칸:방향들"(R/L/D/U)로 저장돼 있다.
const levelCache = {};
function makeLevel(idx){
  if (levelCache[idx]) return levelCache[idx];
  const P = stageParams(idx), n = P.n;
  const sol = STAGES[idx].split(',').map(t => {
    const [s, d] = t.split(':'); const p = [+s];
    for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? n : -n));
    return p;
  });
  return (levelCache[idx] = { n, sol, pairs: sol.map(p => [p[0], p[p.length - 1]]), kind: P.kind });
}

`;
const out = fs.readFileSync(__dirname + '/shell_top.html', 'utf8') + runtimeHead + data + decode + fs.readFileSync(__dirname + '/game_part.js', 'utf8') + fs.readFileSync(__dirname + '/shell_bottom.html', 'utf8');
fs.writeFileSync(__dirname + '/../index.html', out);
console.log('built, bytes', out.length);
