// 사용법: node tools/build.js [easy|normal|hard|extreme] -> tools/final_<난이도>.jsonl 로 dist/dots-<난이도>.html 을 만든다 (인자 없으면 extreme 을 index.html 로)
const fs = require('fs');
const PROF = process.argv[2] || 'extreme';
const NAMES = { easy: '쉬운 버전', normal: '보통 버전', hard: '어려운 버전', extreme: '익스트림 버전' };
const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
const pick = (a, b) => core.slice(core.indexOf(a), core.indexOf(b));
const runtimeHead = pick('const COLORS', '// 격자를') ;   // COLORS, TOTAL, KINDS, stageParams, maxHints, mulberry32, neighbors
const C = require('./core');
const stages = new Array(C.TOTAL).fill(null);
for (const line of fs.readFileSync(__dirname + '/final_' + PROF + '.jsonl', 'utf8').split('\n')){
  if (!line) continue;
  const o = JSON.parse(line); stages[o.idx] = o.n + '|' + o.enc;
}
const missing = stages.map((s, i) => s ? -1 : i + 1).filter(x => x > 0);
if (missing.length) console.error('missing stages:', missing.join(','));
const data = 'const STAGES = ' + JSON.stringify(stages) + ';\n';
const decode = `
// 미리 만들어 둔 퍼즐을 푼다. 경로는 "시작칸:방향들"(R/L/D/U)로 저장돼 있다.
const levelCache = {};
function makeLevel(idx){
  if (levelCache[idx]) return levelCache[idx];
  const P = stageParams(idx), parts = STAGES[idx].split('|'), n = +parts[0];
  const sol = parts[1].split(',').map(t => {
    const [s, d] = t.split(':'); const p = [+s];
    for (const ch of d) p.push(p[p.length - 1] + (ch === 'R' ? 1 : ch === 'L' ? -1 : ch === 'D' ? n : -n));
    return p;
  });
  return (levelCache[idx] = { n, sol, pairs: sol.map(p => [p[0], p[p.length - 1]]), kind: P.kind });
}

`;
const out = fs.readFileSync(__dirname + '/shell_top.html', 'utf8') + runtimeHead + data + decode + fs.readFileSync(__dirname + '/game_part.js', 'utf8') + fs.readFileSync(__dirname + '/shell_bottom.html', 'utf8');
let res = out.replace('<title>점 잇기 퍼즐</title>', '<title>점 잇기 퍼즐 - ' + NAMES[PROF] + '</title>').replace(/dotsLocalDb/g, 'dotsLocalDb_' + PROF).replace(/'dotsAuto'/g, "'dotsAuto_" + PROF + "'");
if (process.argv[2]){ fs.mkdirSync(__dirname + '/../dist', { recursive: true }); fs.writeFileSync(__dirname + '/../dist/dots-' + PROF + '.html', res); }
else fs.writeFileSync(__dirname + '/../index.html', out);
console.log('built, bytes', out.length);
