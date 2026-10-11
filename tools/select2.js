// 사용법: node tools/select2.js -> tools/rated.jsonl + tools/pool/c*.jsonl 에서 스테이지별 퍼즐을 골라 tools/final.jsonl 로 쓴다.
// 난이도 점수 = 사람 기준 가정 깊이(level) + 같은 깊이 안에서의 시도 횟수 순위(0~1)
const fs = require('fs');
const C = require('./core');
let pool = [];
const add = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(l => pool.push(JSON.parse(l)));
add(__dirname + '/rated.jsonl');
for (const f of fs.readdirSync(__dirname + '/pool')) if (/^[cb]\d+\.jsonl$/.test(f)) add(__dirname + '/pool/' + f);
const byLevel = {};
pool.forEach(o => (byLevel[o.level] = byLevel[o.level] || []).push(o));
for (const L of Object.values(byLevel)){
  L.sort((a, b) => a.effort - b.effort || b.n - a.n);
  L.forEach((o, i) => o.score = o.level + (L.length > 1 ? i / (L.length - 1) : 0.5));
}
pool.sort((a, b) => a.score - b.score);
const used = new Uint8Array(pool.length);
function nearest(target){
  let lo = 0, hi = pool.length - 1;
  while (lo < hi){ const mid = (lo + hi) >> 1; if (pool[mid].score < target) lo = mid + 1; else hi = mid; }
  for (let d = 0; d < pool.length; d++)
    for (const j of [lo + d, lo - d]) if (j >= 0 && j < pool.length && !used[j]){ used[j] = 1; return pool[j]; }
}
const bossIdx = [], normIdx = [];
for (let i = 0; i < C.TOTAL; i++) (C.stageParams(i).kind === 1 || C.stageParams(i).kind === 2 ? bossIdx : normIdx).push(i);
const out = [];
// 어려움/하드 스테이지는 같은 지점의 일반 스테이지보다 한 단계 더 깊은 퍼즐
bossIdx.forEach(idx => out.push({ idx, p: nearest(Math.min(6.9, 1.6 + 3.9 * Math.pow(idx / (C.TOTAL - 1), 0.8) + 0.9)) }));
normIdx.forEach((idx, j) => out.push({ idx, p: nearest(1.0 + 3.7 * Math.pow(j / (normIdx.length - 1), 0.8)) }));
out.sort((a, b) => a.idx - b.idx);
fs.writeFileSync(__dirname + '/final.jsonl', out.map(o => JSON.stringify({ idx: o.idx, n: o.p.n, k: o.p.k, level: o.p.level, effort: o.p.effort, enc: o.p.enc })).join('\n') + '\n');
const sz = {}, lv = {};
out.forEach(o => { sz[o.p.n] = (sz[o.p.n] || 0) + 1; lv[o.p.level] = (lv[o.p.level] || 0) + 1; });
console.log('pool', pool.length, 'stages', out.length, 'sizes', JSON.stringify(sz), 'levels', JSON.stringify(lv));
