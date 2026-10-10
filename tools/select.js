// 사용법: node tools/select.js -> tools/pool/*.jsonl 에서 스테이지별 퍼즐을 골라 tools/final.jsonl 로 쓴다.
// 일반 스테이지는 풀이 난이도(탐색 노드 수) 순으로 쉬운 것부터 차례로, 10번째마다 나오는 어려움/하드는 그보다 어려운 구간에서 고른다.
const fs = require('fs');
const C = require('./core');
const pool = [];
for (const f of fs.readdirSync(__dirname + '/pool'))
  for (const line of fs.readFileSync(__dirname + '/pool/' + f, 'utf8').split('\n'))
    if (line) pool.push(JSON.parse(line));
// 같은 난이도면 큰 판, 선이 적은 쪽이 먼저
pool.sort((a, b) => a.h - b.h || b.n - a.n || a.k - b.k);
const bossIdx = [], normIdx = [];
for (let i = 0; i < C.TOTAL; i++) (C.stageParams(i).kind === 1 || C.stageParams(i).kind === 2 ? bossIdx : normIdx).push(i);
const hMax = pool[Math.floor(pool.length * 0.997)].h, hMin = pool[0].h;
const used = new Uint8Array(pool.length);
function nearest(target){
  let lo = 0, hi = pool.length - 1;
  while (lo < hi){ const mid = (lo + hi) >> 1; if (pool[mid].h < target) lo = mid + 1; else hi = mid; }
  for (let d = 0; d < pool.length; d++){
    for (const j of [lo + d, lo - d]) if (j >= 0 && j < pool.length && !used[j]){ used[j] = 1; return pool[j]; }
  }
}
const geo = (a, b, t) => a * Math.pow(b / a, t);
const out = [];
// 어려움/하드(10번째마다)를 먼저 고르고, 남은 퍼즐로 일반 스테이지를 서서히 어렵게 이어 붙인다
bossIdx.forEach((idx, j) => {
  const t = idx / (C.TOTAL - 1);
  out.push({ idx, p: nearest(geo(300, 40000, t)) });
});
normIdx.forEach((idx, j) => out.push({ idx, p: nearest(geo(20, 6000, j / (normIdx.length - 1))) }));
out.sort((a, b) => a.idx - b.idx);
fs.writeFileSync(__dirname + '/final.jsonl', out.map(o => JSON.stringify({ idx: o.idx, n: o.p.n, k: o.p.k, h: o.p.h, enc: o.p.enc })).join('\n') + '\n');
const sz = {}; out.forEach(o => sz[o.p.n] = (sz[o.p.n] || 0) + 1);
console.log('pool', pool.length, 'hMax', hMax, 'stages', out.length, 'sizes', JSON.stringify(sz));
