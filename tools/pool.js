// 사용법: node tools/pool.js <판 크기 n> <초>
// 선(색)이 적은 판을 무작위로 많이 만들어, 해가 딱 하나인 것만 풀이 난이도(탐색 노드 수)와 함께 모은다.
const fs = require('fs');
const C = require('./core');
const N = +process.argv[2], secs = +process.argv[3];
const K = { 4: [3, 4], 5: [3, 5], 6: [4, 7], 7: [5, 8], 8: [6, 9], 9: [6, 10] }[N];
fs.mkdirSync(__dirname + '/pool', { recursive: true });
const file = __dirname + '/pool/n' + N + '.jsonl';
fs.writeFileSync(file, '');
const seen = new Set(), rnd = C.mulberry32(N * 7919 + 1);
const end = Date.now() + secs * 1000;
let tries = 0, kept = 0;
function encode(n, sol){
  return sol.map(p => p[0] + ':' + p.slice(1).map((c, k) => {
    const d = c - p[k]; return d === 1 ? 'R' : d === -1 ? 'L' : d === n ? 'D' : 'U';
  }).join('')).join(',');
}
while (Date.now() < end){
  tries++;
  const pb = 0.01 + rnd() * 0.10;
  const base = C.generate(N, pb, K[0], K[1], Math.floor(rnd() * 2e9));
  if (!base) continue;
  const r = C.solve(N, base, 1000000);
  if (r.aborted || r.found.length !== 1) continue;
  const sig = C.signature(N, base);
  if (seen.has(sig)) continue;
  seen.add(sig); kept++;
  fs.appendFileSync(file, JSON.stringify({ n: N, k: base.length, h: r.nodes, enc: encode(N, base) }) + '\n');
}
console.log('n=' + N, 'tries', tries, 'unique kept', kept);
