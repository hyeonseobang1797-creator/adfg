const COLORS = ['#ff4d4d','#3fa9ff','#ffd23f','#3ddc84','#ff8c1a','#c26bff','#00e5d0','#ff6bb5','#a0a8ff','#b5651d','#c8ff3f','#ffffff','#7a5cff','#ff9e9e','#2f8f5b','#d4a5ff','#4d6bff','#ffb36b','#6bffd8','#e04dff','#9aff4d','#ff4d9a','#4dd2ff','#d9b38c'];
const TOTAL = 500;

// 스테이지가 올라갈수록 조금씩 계속 어려워진다: 판이 커지고, 선이 길고 구불해지고, 색이 늘어난다
function stageParams(i){
  const d = i / (TOTAL - 1);
  return { kind: 0, n: 4 + Math.min(11, Math.floor(d * 12)), pBreak: 0.30 - 0.22 * d, lo: 0.8, hi: 1.0 + 0.4 * d };
}

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function neighbors(i, n){
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

// 격자를 겹치지 않는 경로로 완전히 분할 -> 항상 풀 수 있는 퍼즐
function generate(n, pBreak, kMin, kMax, seed){
  const rnd = mulberry32(seed), N = n * n;
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++){
    const owner = new Array(N).fill(-1);
    const freeCnt = new Array(N);
    for (let i = 0; i < N; i++) freeCnt[i] = neighbors(i, n).length;
    const take = i => { owner[i] = 1; neighbors(i, n).forEach(x => freeCnt[x]--); };
    const paths = [];
    let left = N, bad = false;
    while (left > 0){
      let best = [], bf = 99;
      for (let i = 0; i < N; i++){
        if (owner[i] !== -1) continue;
        if (freeCnt[i] < bf){ bf = freeCnt[i]; best = [i]; }
        else if (freeCnt[i] === bf) best.push(i);
      }
      let cur = best[Math.floor(rnd() * best.length)];
      const path = [cur]; take(cur); left--;
      for (;;){
        const free = neighbors(cur, n).filter(x => owner[x] === -1);
        if (!free.length) break;
        if (path.length >= 3 && rnd() < pBreak) break;
        free.sort((a, b) => freeCnt[a] - freeCnt[b] + (rnd() - 0.5) * 2.2);
        cur = free[0]; take(cur); left--; path.push(cur);
      }
      if (path.length < 2){ bad = true; break; }
      paths.push(path);
    }
    if (bad) continue;
    if (paths.length >= kMin && paths.length <= kMax) return paths;
    if (!fallback && paths.length <= 16) fallback = paths;
  }
  return fallback;
}

// 해가 몇 개인지 센다 (최대 2개까지). 시간 초과면 aborted
function solve(n, sol, nodeLimit){
  const N = n * n, K = sol.length;
  const owner = new Int8Array(N).fill(-1), head = new Int32Array(K), target = new Int32Array(K), done = new Uint8Array(K);
  const nb = []; for (let i = 0; i < N; i++) nb.push(neighbors(i, n));
  for (let c = 0; c < K; c++){
    head[c] = sol[c][0]; target[c] = sol[c][sol[c].length - 1];
    owner[head[c]] = c; owner[target[c]] = c;
  }
  const found = []; let nodes = 0, aborted = false;
  function ok(){
    for (let i = 0; i < N; i++){
      if (owner[i] !== -1) continue;
      let av = 0; const L = nb[i];
      for (let j = 0; j < L.length; j++){
        const x = L[j], o = owner[x];
        if (o === -1 || (!done[o] && (head[o] === x || target[o] === x))) av++;
      }
      if (av < 2) return false;
    }
    return true;
  }
  function dfs(){
    if (aborted || found.length >= 2) return;
    if (++nodes > nodeLimit){ aborted = true; return; }
    let bc = -1, bo = null;
    for (let c = 0; c < K; c++){
      if (done[c]) continue;
      const opts = nb[head[c]].filter(x => owner[x] === -1 || x === target[c]);
      if (!opts.length) return;
      if (!bo || opts.length < bo.length){ bc = c; bo = opts; }
    }
    if (bc === -1){
      for (let i = 0; i < N; i++) if (owner[i] === -1) return;
      found.push(Array.from(owner)); return;
    }
    const c = bc, oldHead = head[c];
    for (const x of bo){
      if (x === target[c]){ done[c] = 1; if (ok()) dfs(); done[c] = 0; }
      else { owner[x] = c; head[c] = x; if (ok()) dfs(); owner[x] = -1; head[c] = oldHead; }
      if (aborted || found.length >= 2) return;
    }
  }
  dfs();
  return { found, aborted };
}

// 풀이가 여러 개면 두 풀이가 갈리는 곳에서 선을 둘로 쪼개 해를 하나로 만든다
function makeUnique(n, sol, rnd, deadline){
  sol = sol.map(p => p.slice());
  for (let round = 0; round < 40 && Date.now() < deadline; round++){
    const r = solve(n, sol, 15000);
    if (!r.aborted && r.found.length === 1) return { sol, unique: true };
    if (sol.length >= COLORS.length) break;
    const mine = new Array(n * n);
    sol.forEach((p, c) => p.forEach(x => mine[x] = c));
    let cand = [];
    if (r.found.length >= 2) {
      const other = r.found[1].some((v, i) => v !== mine[i]) ? r.found[1] : r.found[0];
      for (let i = 0; i < n * n; i++) if (other[i] !== mine[i]) cand.push(i);
    } else {
      sol.forEach(p => { if (p.length >= 4) cand.push(p[p.length >> 1]); });
    }
    let did = false;
    for (let t = 0; t < 60 && cand.length && !did; t++){
      const x = cand[Math.floor(rnd() * cand.length)];
      const c = mine[x], p = sol[c], j = p.indexOf(x);
      for (const cut of rnd() < .5 ? [j, j - 1] : [j - 1, j]){
        // p[0..cut] 와 p[cut+1..] 모두 길이 2 이상
        if (cut >= 1 && p.length - cut - 1 >= 2){
          sol.splice(c, 1, p.slice(0, cut + 1), p.slice(cut + 1)); did = true; break;
        }
      }
    }
    if (!did) break;
  }
  return { sol, unique: false };
}

const levelCache = {};
function makeLevel(idx){
  if (levelCache[idx]) return levelCache[idx];
  const P = stageParams(idx);
  let pairs = null, res = null;
  const deadline = Date.now() + 500;
  for (let t = 0; t < 6; t++){
    let base = null;
    for (let s = 0; !base && s < 20; s++)
      base = generate(P.n, P.pBreak, Math.max(3, Math.floor(P.n * P.lo)), Math.min(16, Math.ceil(P.n * P.hi)), 1000 + idx * 7919 + s + t * 131);
    const r = makeUnique(P.n, base, mulberry32(77 + idx + t), deadline);
    if (!res || (r.unique && !res.unique)) res = r;
    if (res.unique || Date.now() > deadline) break;
  }
  pairs = res.sol;
  return (levelCache[idx] = { n: P.n, sol: pairs, pairs: pairs.map(p => [p[0], p[p.length - 1]]), kind: P.kind, unique: res.unique });
}

if (typeof module !== 'undefined') module.exports = { solve, makeLevel, stageParams, TOTAL };

// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, sol, pairs, endOf, paths, active = -1, moves = 0, solved = false, kind = 0;
  let unlocked = loadProgress();

  function loadProgress(){ try { return Math.min(TOTAL - 1, +localStorage.getItem('dotsUnlocked500') || 0); } catch(e){ return 0; } }
  function saveProgress(v){ try { localStorage.setItem('dotsUnlocked500', v); } catch(e){} }

  function load(idx){
    levelIdx = Math.max(0, Math.min(Math.min(idx, unlocked), TOTAL - 1));
    const lv = makeLevel(levelIdx);
    n = lv.n; pairs = lv.pairs; sol = lv.sol; kind = lv.kind;
    endOf = new Array(n * n).fill(-1);
    pairs.forEach((p, c) => { endOf[p[0]] = c; endOf[p[1]] = c; });
    paths = pairs.map(() => []);
    active = -1; moves = 0; solved = false;
    $('msg').textContent = '';
    draw(); updateUI();
  }

  function ownerAt(cell){
    for (let c = 0; c < paths.length; c++){
      const i = paths[c].indexOf(cell);
      if (i !== -1) return [c, i];
    }
    return null;
  }
  function isComplete(c){
    const p = paths[c];
    return p.length > 1 && endOf[p[0]] === c && endOf[p[p.length - 1]] === c && p[0] !== p[p.length - 1];
  }

  function cellFromEvent(e){
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
    return Math.floor(y * n) * n + Math.floor(x * n);
  }

  function start(cell){
    if (solved) return;
    if (endOf[cell] !== -1){
      const c = endOf[cell];
      paths[c] = [cell];
      active = c; moves++;
    } else {
      const o = ownerAt(cell);
      if (!o) return;
      const [c, i] = o;
      paths[c] = paths[c].slice(0, i + 1);
      active = c; moves++;
    }
    draw(); updateUI();
  }

  function stepTo(cell){
    const c = active, p = paths[c], head = p[p.length - 1];
    if (cell === head) return;
    const idx = p.indexOf(cell);
    if (idx !== -1){ paths[c] = p.slice(0, idx + 1); return; }   // 되돌리기
    if (!neighbors(head, n).includes(cell)) return;
    // 이미 도착 지점에 닿았으면 더 못 늘림
    if (p.length > 1 && endOf[head] === c) return;
    if (endOf[cell] !== -1 && endOf[cell] !== c) return;          // 남의 점은 통과 불가
    const o = ownerAt(cell);
    if (o && o[0] !== c) paths[o[0]] = paths[o[0]].slice(0, o[1]); // 다른 선 자르기
    p.push(cell);
  }

  function move(cell){
    if (active === -1 || cell === -1) return;
    const p = paths[active];
    let head = p[p.length - 1];
    // 빠르게 드래그해도 칸을 건너뛰지 않도록 한 칸씩 이동
    let guard = 0;
    while (head !== cell && guard++ < n * 2){
      const hr = Math.floor(head / n), hc = head % n, tr = Math.floor(cell / n), tc = cell % n;
      let next;
      if (Math.abs(tr - hr) >= Math.abs(tc - hc)) next = head + Math.sign(tr - hr) * n;
      else next = head + Math.sign(tc - hc);
      const before = paths[active].length;
      stepTo(next);
      const q = paths[active];
      const nh = q[q.length - 1];
      if (nh === head && q.length === before) break;
      head = nh;
    }
    draw(); updateUI();
  }

  function end(){
    if (active === -1) return;
    active = -1;
    checkWin();
    draw(); updateUI();
  }

  function checkWin(){
    if (!paths.every((_, c) => isComplete(c))) return;
    const filled = paths.reduce((s, p) => s + p.length, 0);
    if (filled !== n * n) { $('msg').textContent = '모든 칸을 채워야 해요!'; return; }
    solved = true;
    $('msg').textContent = levelIdx + 1 >= TOTAL ? '🏆 전체 클리어!' : '🎉 클리어! 잠시 후 다음 스테이지로 넘어가요';
    if (levelIdx + 1 > unlocked && levelIdx + 1 < TOTAL){ unlocked = levelIdx + 1; saveProgress(unlocked); }
    buildSelect();
    if (levelIdx + 1 < TOTAL){
      const cleared = levelIdx;
      setTimeout(() => { if (solved && levelIdx === cleared) load(cleared + 1); }, 1200);
    }
  }

  function updateUI(){
    $('lvl').textContent = '스테이지 ' + (levelIdx + 1) + ' / ' + TOTAL;
    $('prev').disabled = levelIdx === 0;
    $('next').disabled = !(solved || levelIdx < unlocked) || levelIdx >= TOTAL - 1;
    $('next').classList.toggle('go', solved && levelIdx < TOTAL - 1);
    const done = paths.filter((_, c) => isComplete(c)).length;
    $('flows').textContent = '연결 ' + done + '/' + pairs.length;
    const filled = paths.reduce((s, p) => s + p.length, 0);
    $('fill').textContent = '채움 ' + Math.round(filled / (n * n) * 100) + '%';
    if (!solved && done < pairs.length) $('msg').textContent = '';
  }

  function draw(){
    const W = cv.width, s = W / n;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0b0e15'; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#3a4152';
    for (let i = 0; i < n * n; i++)
      ctx.fillRect((i % n) * s + 2, Math.floor(i / n) * s + 2, s - 4, s - 4);
    const ctr = i => [(i % n + .5) * s, (Math.floor(i / n) + .5) * s];
    paths.forEach((p, c) => {
      if (!p.length) return;
      const col = COLORS[c % COLORS.length];
      // 칸 배경
      ctx.globalAlpha = .35; ctx.fillStyle = col;
      p.forEach(i => { ctx.fillRect((i % n) * s + 2, Math.floor(i / n) * s + 2, s - 4, s - 4); });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = s * .34; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      p.forEach((i, k) => { const [x, y] = ctr(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });
    pairs.forEach((pr, c) => {
      ctx.fillStyle = COLORS[c % COLORS.length];
      pr.forEach(i => {
        const [x, y] = ctr(i);
        ctx.beginPath(); ctx.arc(x, y, s * .31, 0, Math.PI * 2); ctx.fill();
        if (isComplete(c)){ ctx.strokeStyle = '#fff8'; ctx.lineWidth = 2; ctx.stroke(); }
      });
    });
  }

  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const c = cellFromEvent(e); if (c !== -1) start(c); });
  cv.addEventListener('pointermove', e => { if (active !== -1) move(cellFromEvent(e)); });
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  $('hint').onclick = () => {
    if (solved) return;
    const c = paths.findIndex((_, k) => !isComplete(k));
    if (c === -1) return;
    const line = sol[c].slice();
    paths[c] = line;
    paths.forEach((p, k) => { if (k !== c){ const j = p.findIndex(x => line.includes(x)); if (j !== -1) paths[k] = p.slice(0, j); } });
    moves++; checkWin(); draw(); updateUI();
  };
  $('reset').onclick = () => load(levelIdx);
  $('prev').onclick = () => load(levelIdx - 1);
  $('next').onclick = () => { if (solved || levelIdx < unlocked) load(levelIdx + 1); };
  function buildSelect(){
    const box = $('grid'); box.textContent = '';
    for (let i = 0; i < TOTAL; i++){
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.className = 'k' + (i % 3) + (i === levelIdx ? ' cur' : '') + (i < unlocked ? ' done' : '');
      b.disabled = i > unlocked;
      b.onclick = () => { load(i); $('sel').hidden = true; };
      box.appendChild(b);
    }
  }
  $('pick').onclick = () => { const s = $('sel'); s.hidden = !s.hidden; if (!s.hidden){ buildSelect(); const c = $('grid').children[levelIdx]; if (c) c.scrollIntoView({block:'center'}); } };
  load(unlocked);
})();
