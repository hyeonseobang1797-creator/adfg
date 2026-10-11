// 사용법: node tools/select2.js -> tools/rated.jsonl + tools/pool/c*.jsonl 에서 스테이지별 퍼즐을 골라 tools/final.jsonl 로 쓴다.
// 난이도 점수 = 사람 기준 가정 깊이(level) + 같은 깊이 안에서의 시도 횟수 순위(0~1)
const fs = require('fs');
const PROFILES = {
  easy:    { lo: 0.0, hi: 3.0, pow: 1.0, boss: 0.6, maxLevel: 3, maxN: 7 },
  normal:  { lo: 1.0, hi: 4.9, pow: 0.9, boss: 0.7, maxLevel: 5, maxN: 9 },
  hard:    { lo: 3.5, hi: 7.9, pow: 0.6, boss: 0.8, maxLevel: 7, maxN: 11 },
  extreme: { lo: 4.0, hi: 8.0, pow: 0.35, boss: 0.8, maxLevel: 7, maxN: 16 }
};
const PROFILE = process.argv[2];
if (!PROFILES[PROFILE]){ console.error('usage: node tools/select2.js easy|normal|hard|extreme'); process.exit(1); }
const PR = PROFILES[PROFILE];
const C = require('./core');
let pool = [];
const add = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).forEach(l => pool.push(JSON.parse(l)));
add(__dirname + '/rated.jsonl');
for (const f of fs.readdirSync(__dirname + '/pool')) if (/^c\d+\.jsonl$/.test(f)) add(__dirname + '/pool/' + f);
// d*: 정답이 몇 개 안 되는 큰 판. 판이 클수록, 정답이 적을수록 어렵다고 본다
for (const f of fs.readdirSync(__dirname + '/pool')) if (/^[db]\d+\.jsonl$/.test(f))
  fs.readFileSync(__dirname + '/pool/' + f, 'utf8').split('\n').filter(Boolean).forEach(l => { const o = JSON.parse(l); o.level = 7; o.effort = o.n * 1000 + (4 - (o.sols || 4)) * 100 + o.k * 10 + Math.random(); pool.push(o); });
// 선이 한두 개뿐인 퍼즐(점이 한 쌍만 나오는 판)은 뺀다
const minK = n => n <= 7 ? 3 : Math.max(5, n - 3);
pool = pool.filter(o => o.level <= PR.maxLevel && o.n <= PR.maxN && o.k >= minK(o.n));
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
const tgt = t => PR.lo + (PR.hi - PR.lo) * Math.pow(t, PR.pow);
bossIdx.forEach(idx => out.push({ idx, p: nearest(Math.min(PR.hi, tgt(idx / (C.TOTAL - 1)) + PR.boss)) }));
normIdx.forEach((idx, j) => out.push({ idx, p: nearest(tgt(j / (normIdx.length - 1))) }));
out.sort((a, b) => a.idx - b.idx);
fs.writeFileSync(__dirname + '/final_' + PROFILE + '.jsonl', out.map(o => JSON.stringify({ idx: o.idx, n: o.p.n, k: o.p.k, level: o.p.level, effort: o.p.effort, enc: o.p.enc })).join('\n') + '\n');
const sz = {}, lv = {};
out.forEach(o => { sz[o.p.n] = (sz[o.p.n] || 0) + 1; lv[o.p.level] = (lv[o.p.level] || 0) + 1; });
console.log('pool', pool.length, 'stages', out.length, 'sizes', JSON.stringify(sz), 'levels', JSON.stringify(lv));
