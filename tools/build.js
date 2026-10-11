// 사용법: node tools/build.js -> tools/final_<easy|normal|hard|extreme>.jsonl 네 개를 한 파일(index.html)에 넣어 만든다.
// 한 파일 안에서 난이도를 고르고, 계정(로그인)은 네 난이도가 함께 쓴다. 진행 상황은 난이도별로 따로 저장된다.
const fs = require('fs');
const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
const runtimeHead = core.slice(core.indexOf('const COLORS'), core.indexOf('// 격자를'));   // COLORS, TOTAL, KINDS, stageParams, maxHints, mulberry32, neighbors
const C = require('./core');
const PROFS = ['easy', 'normal', 'hard', 'extreme'];
const sets = {};
for (const p of PROFS){
  const arr = new Array(C.TOTAL).fill(null);
  for (const line of fs.readFileSync(__dirname + '/final_' + p + '.jsonl', 'utf8').split('\n')){
    if (!line) continue;
    const o = JSON.parse(line); if (o.idx < C.TOTAL) arr[o.idx] = o.n + '|' + o.enc;
  }
  const missing = arr.map((s, i) => s ? -1 : i + 1).filter(x => x > 0);
  if (missing.length) console.error(p, 'missing stages:', missing.join(','));
  sets[p] = arr;
}
const data = 'const STAGESETS = ' + JSON.stringify(sets) + ';\n';
const decode = `
let MODE = 'easy';
try { const m = localStorage.getItem('dotsMode'); if (STAGESETS[m]) MODE = m; } catch (e) {}
// 미리 만들어 둔 퍼즐을 푼다. 경로는 "시작칸:방향들"(R/L/D/U)로 저장돼 있다.
const levelCache = {};
function makeLevel(idx){
  const ck = MODE + idx;
  if (levelCache[ck]) return levelCache[ck];
  const P = stageParams(idx), parts = STAGESETS[MODE][idx].split('|'), n = +parts[0];
  const sol = parts[1].split(',').map(t => {
    const [s, d] = t.split(':'); const p = [+s];
    for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? n : -n));
    return p;
  });
  return (levelCache[ck] = { n, sol, pairs: sol.map(p => [p[0], p[p.length - 1]]), kind: P.kind });
}

`;
let top = fs.readFileSync(__dirname + '/shell_top.html', 'utf8');
top = top.replace('</style>', '  #modes{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}\n  #modes button.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--panel))}\n</style>');
top = top.replace('<div class="bar">', '<div id="modes"><button data-mode="easy">쉬움</button><button data-mode="normal">보통</button><button data-mode="hard">어려움</button><button data-mode="extreme">익스트림</button></div>\n<div class="bar">');
const out = top + runtimeHead + data + decode + fs.readFileSync(__dirname + '/game_part.js', 'utf8') + fs.readFileSync(__dirname + '/shell_bottom.html', 'utf8');
fs.writeFileSync(__dirname + '/../index.html', out);
console.log('built, bytes', out.length);
