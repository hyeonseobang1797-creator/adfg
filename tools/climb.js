// 사용법: node tools/climb.js <n> <초>
// 큰 판에서 선이 적고 해가 하나뿐인 퍼즐을 만든다: 경계를 한 칸씩 옮기며 해의 개수를 줄여 나간다.
const fs = require('fs');
const C = require('./core'), H = require('./human');
const N = +process.argv[2], secs = +process.argv[3];
const K = { 7: [5, 7], 8: [5, 8], 9: [6, 9], 10: [7, 10], 11: [8, 11], 12: [9, 12] }[N];
fs.mkdirSync(__dirname + '/pool', { recursive: true });
const file = __dirname + '/pool/c' + N + '.jsonl';
fs.writeFileSync(file, '');
const rnd = C.mulberry32(N * 104729 + 7), end = Date.now() + secs * 1000;
const seen = new Set();
const enc = sol => sol.map(p => p[0] + ':' + p.slice(1).map((c, k) => { const d = c - p[k]; return d === 1 ? 'R' : d === -1 ? 'L' : d === N ? 'D' : 'U'; }).join('')).join(',');
function count(sol){
  const r = C.solve(N, sol, 150000, 12);
  return r.aborted ? 30 : r.found.length;
}
function mutate(sol){
  const out = sol.map(p => p.slice());
  for (let t = 0; t < 40; t++){
    const a = Math.floor(rnd() * out.length), A = out[a];
    if (A.length < 3) continue;
    const front = rnd() < 0.5;
    const e = front ? A[0] : A[A.length - 1];
    for (const f of C.neighbors(e, N)){
      for (let b = 0; b < out.length; b++){
        if (b === a) continue;
        const B = out[b];
        if (B[0] === f){ B.unshift(e); front ? A.shift() : A.pop(); return out; }
        if (B[B.length - 1] === f){ B.push(e); front ? A.shift() : A.pop(); return out; }
      }
    }
  }
  return null;
}
let made = 0, restarts = 0;
while (Date.now() < end){
  restarts++;
  let cur = C.generate(N, 0.02 + rnd() * 0.06, K[0], K[1], Math.floor(rnd() * 2e9));
  if (!cur) continue;
  let cc = count(cur);
  for (let it = 0; it < 400 && Date.now() < end && cc > 1; it++){
    const m = mutate(cur); if (!m) break;
    const mc = count(m);
    if (mc <= cc){ cur = m; cc = mc; }
  }
  if (cc !== 1) continue;
  const sig = C.signature(N, cur); if (seen.has(sig)) continue; seen.add(sig);
  const r = H.rate(N, cur, 6, 120000);
  made++;
  fs.appendFileSync(file, JSON.stringify({ n: N, k: cur.length, level: r.level, effort: r.effort, enc: enc(cur) }) + '\n');
}
console.log('n=' + N, 'restarts', restarts, 'unique made', made);
