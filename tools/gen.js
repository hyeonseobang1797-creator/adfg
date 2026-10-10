// 사용법: node tools/gen.js <판 크기 n> <시간배율>
// 해가 하나뿐이고, 풀이 탐색이 가장 오래 걸리는(= 깊은 추론이 필요한) 퍼즐을 골라 tools/out/n<N>.jsonl 에 쓴다.
const fs = require('fs');
const C = require('./core');
const N = +process.argv[2], scale = +(process.argv[3] || 1);
fs.mkdirSync(__dirname + '/out', { recursive: true });
const only = process.argv[4] ? process.argv[4].split(',').map(x => +x - 1) : null;
const outFile = __dirname + '/out/n' + N + (only ? 'b' : '') + '.jsonl';
fs.writeFileSync(outFile, '');

function encode(n, sol){
  return sol.map(p => p[0] + ':' + p.slice(1).map((c, k) => {
    const dlt = c - p[k];
    return dlt === 1 ? 'R' : dlt === -1 ? 'L' : dlt === n ? 'D' : 'U';
  }).join('')).join(',');
}

const seen = new Set();
for (let idx = 0; idx < C.TOTAL; idx++){
  const P = C.stageParams(idx);
  if (P.n !== N || (only && !only.includes(idx))) continue;
  const deadline = Date.now() + (P.kind === 3 ? 1 : 2 + 6 * P.d) * 1000 * scale;
  let best = null, tries = 0, uniq = 0;
  const rnd = C.mulberry32(idx * 977 + 13);
  while ((Date.now() < deadline || !best) && tries < 30000){
    tries++;
    const pb = Math.max(0.02, P.pBreak * (0.4 + rnd() * 1.4));
    const kMin = Math.max(3, Math.floor(N * P.lo)), kMax = Math.min(16, Math.ceil(N * (P.hi + rnd() * 0.3)));
    const base = C.generate(N, pb, kMin, kMax, 1000 + idx * 7919 + tries * 131);
    if (!base) continue;
    const r = C.makeUnique(N, base, rnd, Date.now() + 2500, 300000);
    if (!r.unique){ if (tries > 4000) break; continue; }
    uniq++;
    const sig = C.signature(N, r.sol);
    if (seen.has(sig)) continue;
    const h = C.solve(N, r.sol, 3000000);
    if (h.aborted) continue;
    if (!best || (P.kind === 3 ? h.nodes < best.h : h.nodes > best.h)) best = { h: h.nodes, sol: r.sol, sig, k: r.sol.length };
  }
  if (!best){ console.error('NO UNIQUE', idx + 1, N); continue; }
  seen.add(best.sig);
  fs.appendFileSync(outFile, JSON.stringify({ idx, n: N, k: best.k, h: best.h, tries, enc: encode(N, best.sol) }) + '\n');
}
console.log('done n=' + N);
