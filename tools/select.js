// 사용법: node tools/select.js -> tools/pool/*.jsonl 에서 스테이지별 퍼즐을 골라 tools/final.jsonl 로 쓴다.
// 일반 스테이지는 풀이 난이도(탐색 노드 수) 순으로 쉬운 것부터 차례로, 10번째마다 나오는 어려움/하드는 그보다 어려운 구간에서 고른다.
const fs = require('fs');
const C = require('./core');
const pool = [];
for (const f of fs.readdirSync(__dirname + '/pool'))
  for (const line of fs.readFileSync(__dirname + '/pool/' + f, 'utf8').split('\n'))
    if (line) pool.push(JSON.parse(line));
// 같은 난이도면 작은 판, 선이 많은 쪽이 먼저
pool.sort((a, b) => a.h - b.h || a.n - b.n || b.k - a.k);
const bossIdx = [], normIdx = [];
for (let i = 0; i < C.TOTAL; i++) (C.stageParams(i).kind === 1 || C.stageParams(i).kind === 2 ? bossIdx : normIdx).push(i);
const cut = Math.floor(pool.length * 0.82);
const lowPart = pool.slice(0, cut), highPart = pool.slice(cut);
const at = (arr, j, m) => arr[Math.min(arr.length - 1, Math.floor(j / Math.max(1, m - 1) * (arr.length - 1)))];
const out = [];
normIdx.forEach((idx, j) => out.push({ idx, p: at(lowPart, j, normIdx.length) }));
bossIdx.forEach((idx, j) => out.push({ idx, p: at(highPart, j, bossIdx.length) }));
out.sort((a, b) => a.idx - b.idx);
fs.writeFileSync(__dirname + '/final.jsonl', out.map(o => JSON.stringify({ idx: o.idx, n: o.p.n, k: o.p.k, h: o.p.h, enc: o.p.enc })).join('\n') + '\n');
const sz = {}; out.forEach(o => sz[o.p.n] = (sz[o.p.n] || 0) + 1);
console.log('pool', pool.length, 'stages', out.length, 'sizes', JSON.stringify(sz), 'h first', out[0].p.h, 'h last normal', out.filter(o => normIdx.includes(o.idx)).pop().p.h, 'h max', out.reduce((m, o) => Math.max(m, o.p.h), 0));
