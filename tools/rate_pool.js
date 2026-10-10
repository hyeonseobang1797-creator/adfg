// 사용법: node tools/rate_pool.js -> pool/n*.jsonl 의 퍼즐을 사람 기준으로 다시 재서 tools/rated.jsonl 로 쓴다
const fs = require('fs');
const H = require('./human');
const out = fs.openSync(__dirname + '/rated.jsonl', 'w');
function dec(o){
  return o.enc.split(',').map(t => {
    const [s, d] = t.split(':'); const p = [+s];
    for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? o.n : -o.n));
    return p;
  });
}
for (const f of fs.readdirSync(__dirname + '/pool').sort()){
  if (!/^n\d+\.jsonl$/.test(f)) continue;
  const lines = fs.readFileSync(__dirname + '/pool/' + f, 'utf8').split('\n').filter(Boolean);
  for (const line of lines){
    const o = JSON.parse(line);
    if (o.n < 5) continue;
    const r = H.rate(o.n, dec(o), 5, 60000);
    fs.writeSync(out, JSON.stringify({ n: o.n, k: o.k, level: r.level, effort: r.effort, enc: o.enc }) + '\n');
  }
  console.log('rated', f);
}
