// 사용법: node tools/select_easy.js -> tools/pool/e*.jsonl (점이 많은 아주 쉬운 퍼즐)에서 쉬운 버전 스테이지를 골라 tools/final_easy.jsonl 로 쓴다.
// 작은 판·많은 점·낮은 난이도 순으로 놓고, 번호가 올라갈수록 조금씩 커진다.
const fs = require('fs');
const C = require('./core');
const pool = [];
for (const f of fs.readdirSync(__dirname + '/pool')) if (/^e\d+\.jsonl$/.test(f))
  fs.readFileSync(__dirname + '/pool/' + f, 'utf8').split('\n').filter(Boolean).forEach(l => pool.push(JSON.parse(l)));
// 쉬운 순: 난이도 낮음, 판 작음, 점 많음
pool.sort((a, b) => a.level - b.level || a.n - b.n || b.k - a.k || a.effort - b.effort);
const bossIdx = [], normIdx = [];
for (let i = 0; i < C.TOTAL; i++) (C.stageParams(i).kind === 1 || C.stageParams(i).kind === 2 ? bossIdx : normIdx).push(i);
const cut = Math.floor(pool.length * 0.9);
const pick = (arr, j, m) => arr[Math.min(arr.length - 1, Math.floor(j / Math.max(1, m - 1) * (arr.length - 1)))];
const out = [];
normIdx.forEach((idx, j) => out.push({ idx, p: pick(pool.slice(0, cut), j, normIdx.length) }));
bossIdx.forEach((idx, j) => out.push({ idx, p: pick(pool.slice(cut), j, bossIdx.length) }));
out.sort((a, b) => a.idx - b.idx);
fs.writeFileSync(__dirname + '/final_easy.jsonl', out.map(o => JSON.stringify({ idx: o.idx, n: o.p.n, k: o.p.k, level: o.p.level, effort: o.p.effort, enc: o.p.enc })).join('\n') + '\n');
const sz = {}, lv = {}, ks = {};
out.forEach(o => { sz[o.p.n] = (sz[o.p.n] || 0) + 1; lv[o.p.level] = (lv[o.p.level] || 0) + 1; });
console.log('pool', pool.length, 'stages', out.length, 'sizes', JSON.stringify(sz), 'levels', JSON.stringify(lv));
