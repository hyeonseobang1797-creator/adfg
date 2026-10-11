// 사용법: node tools/pool_big.js <n> <초>
// 정답이 하나가 아니어도 되는 큰 판을 무작위로 만들고, 사람 기준(가정 깊이·시도 횟수)으로 어려운 것만 모은다.
const fs = require('fs');
const C = require('./core'), H = require('./human');
const N = +process.argv[2], secs = +process.argv[3];
const kMin = Math.max(5, N - 1), kMax = Math.min(16, Math.ceil(N * 1.35));
const rnd = C.mulberry32(N * 2654435 + 11), end = Date.now() + secs * 1000;
const file = __dirname + '/pool/b' + N + '.jsonl';
fs.writeFileSync(file, '');
const seen = new Set();
const enc = sol => sol.map(p => p[0] + ':' + p.slice(1).map((c, k) => { const d = c - p[k]; return d === 1 ? 'R' : d === -1 ? 'L' : d === N ? 'D' : 'U'; }).join('')).join(',');
let tries = 0, kept = 0;
while (Date.now() < end){
  tries++;
  const sol = C.generate(N, 0.02 + rnd() * 0.10, kMin, kMax, Math.floor(rnd() * 2e9));
  if (!sol) continue;
  const sig = C.signature(N, sol); if (seen.has(sig)) continue; seen.add(sig);
  const r = H.rate(N, sol, 4, 60000);
  if (r.level >= 3){
    kept++;
    fs.appendFileSync(file, JSON.stringify({ n: N, k: sol.length, level: r.level, effort: r.effort, enc: enc(sol) }) + '\n');
  }
}
console.log('n=' + N, 'tries', tries, 'kept', kept);
