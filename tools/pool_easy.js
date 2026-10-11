// 사용법: node tools/pool_easy.js <n> <초>
// 점(선)이 많아 선이 짧고, 따라가기만 해도 풀리는 아주 쉬운 퍼즐을 모은다.
const fs = require('fs');
const C = require('./core'), H = require('./human');
const N = +process.argv[2], secs = +process.argv[3];
const K = { 4: [5, 8], 5: [7, 11], 6: [9, 14] }[N];
const rnd = C.mulberry32(N * 9973 + 3), end = Date.now() + secs * 1000;
const file = __dirname + '/pool/e' + N + '.jsonl';
fs.writeFileSync(file, '');
const seen = new Set();
const enc = sol => sol.map(p => p[0] + ':' + p.slice(1).map((c, k) => { const d = c - p[k]; return d === 1 ? 'R' : d === -1 ? 'L' : d === N ? 'D' : 'U'; }).join('')).join(',');
let kept = 0;
while (Date.now() < end){
  const sol = C.generate(N, 0.3 + rnd() * 0.5, K[0], K[1], Math.floor(rnd() * 2e9));
  if (!sol) continue;
  const r = C.solve(N, sol, 100000);
  if (r.aborted || r.found.length !== 1) continue;
  const sig = C.signature(N, sol); if (seen.has(sig)) continue; seen.add(sig);
  const h = H.rate(N, sol, 1, 20000);
  if (h.level > 1) continue;
  kept++;
  fs.appendFileSync(file, JSON.stringify({ n: N, k: sol.length, level: h.level, effort: h.effort, enc: enc(sol) }) + '\n');
}
console.log('n=' + N, 'kept', kept);
