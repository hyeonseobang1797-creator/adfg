// 사용법: node tools/build.js -> tools/final_<easy|normal|hard|extreme>.jsonl 네 개를 한 파일(index.html)에 넣어 만든다.
// 한 파일 안에서 난이도를 고른다. 진행 상황은 이 기기의 브라우저에 난이도별로 자동 저장된다.
const fs = require('fs');
const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
const runtimeHead = core.slice(core.indexOf('const COLORS'), core.indexOf('// 격자를'));   // COLORS, TOTAL, KINDS, stageParams, maxHints, mulberry32, neighbors
const C = require('./core');
const PROFS = ['easy', 'normal', 'hard', 'extreme'];
const sets = {}, metas = {};
for (const p of PROFS){
  const arr = new Array(C.TOTAL).fill(null), meta = new Array(C.TOTAL).fill(null);
  for (const line of fs.readFileSync(__dirname + '/final_' + p + '.jsonl', 'utf8').split('\n')){
    if (!line) continue;
    const o = JSON.parse(line); if (o.idx < C.TOTAL){ arr[o.idx] = o.n + '|' + o.enc; meta[o.idx] = { n: o.n, k: o.k, level: o.level || 0 }; }
  }
  const missing = arr.map((s, i) => s ? -1 : i + 1).filter(x => x > 0);
  if (missing.length) console.error(p, 'missing stages:', missing.join(','));
  sets[p] = arr; metas[p] = meta;
}
// 랜덤 모드에서 같은 판(돌리거나 뒤집어서 같은 것 포함)이 두 번 나오지 않도록, 겹치는 판 번호를 미리 뽑아 둔다.
const decPaths = (n, enc) => enc.split(',').map(t => { const [s, d] = t.split(':'); const p = [+s]; for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? n : -n)); return p; });
const seenSig = new Set(), skip = [], rate = [];
const MAXN = 10;   // 랜덤 모드는 10×10까지만
PROFS.forEach((p, ti) => sets[p].forEach((st, idx) => {
  const [ns, enc] = st.split('|'), n = +ns, sig = n + ':' + C.signature(n, decPaths(n, enc)), m = metas[p][idx];
  // 난이도 점수(1~100): 풀이에 필요한 가정 깊이와 판 크기를 반반씩 반영한다
  rate[ti * C.TOTAL + idx] = Math.max(1, Math.min(100, Math.round(100 * (0.5 * m.level / 7 + 0.5 * (n - 4) / (MAXN - 4)))));
  if (n > MAXN || seenSig.has(sig)) skip.push(ti * C.TOTAL + idx); else seenSig.add(sig);
}));
// 점수를 네 구간(쉬움/보통/어려움/익스트림)으로 가르되, 각 구간에 판이 비슷하게 들어가도록 사분위수로 정한다
const skipSet = new Set(skip), pool = rate.map((r, id) => skipSet.has(id) ? -1 : r).filter(r => r >= 0).sort((a, b) => a - b);
const bands = [0.25, 0.5, 0.75].map(q => pool[Math.floor(pool.length * q)]);
console.log('random pool:', pool.length, 'puzzles; excluded (duplicates or larger than ' + MAXN + 'x' + MAXN + '):', skip.length, '; band cut-offs:', bands.join('/'));
const data = 'const STAGESETS = ' + JSON.stringify(sets) + ';\nconst RTIERS = ' + JSON.stringify(PROFS) + ';\nconst RSKIP = new Set(' + JSON.stringify(skip) + ');\nconst RRATE = ' + JSON.stringify(rate) + ';\nconst RBANDS = ' + JSON.stringify(bands) + ';\n';
const decode = `
let MODE = 'easy';
try { const m = localStorage.getItem('dotsMode'); if (STAGESETS[m] || m === 'random') MODE = m; } catch (e) {}
// 미리 만들어 둔 퍼즐을 푼다. 경로는 "시작칸:방향들"(R/L/D/U)로 저장돼 있다.
const levelCache = {};
function makeLevel(idx, mode){
  mode = mode || MODE;
  const ck = mode + idx;
  if (levelCache[ck]) return levelCache[ck];
  const P = stageParams(idx), parts = STAGESETS[mode][idx].split('|'), n = +parts[0];
  const sol = parts[1].split(',').map(t => {
    const [s, d] = t.split(':'); const p = [+s];
    for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? n : -n));
    return p;
  });
  return (levelCache[ck] = { n, sol, pairs: sol.map(p => [p[0], p[p.length - 1]]), kind: P.kind });
}

`;
const top = fs.readFileSync(__dirname + '/shell_top.html', 'utf8');
const out = top + runtimeHead + data + decode + fs.readFileSync(__dirname + '/bg.js', 'utf8') + fs.readFileSync(__dirname + '/music.js', 'utf8') + fs.readFileSync(__dirname + '/game_part.js', 'utf8') + fs.readFileSync(__dirname + '/shell_bottom.html', 'utf8');
fs.writeFileSync(__dirname + '/../index.html', out);
console.log('built, bytes', out.length);
