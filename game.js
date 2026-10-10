'use strict';

const COLORS = ['#ff4d4d','#3fa9ff','#ffd23f','#3ddc84','#ff8c1a','#c26bff','#00e5d0','#ff6bb5','#a0a8ff','#b5651d'];

// 레벨 정의: [격자 크기, 색(선) 개수]
const LEVEL_DEFS = [
  [4,3],[5,4],[5,5],[6,5],[6,6],[7,6],[7,7],[8,7],[8,8],[9,8],[9,9],[10,9]
];

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

// 격자를 겹치지 않는 경로 k개로 완전히 분할 -> 항상 풀 수 있는 퍼즐
function generate(n, k, seed){
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 5000; attempt++){
    const owner = new Array(n * n).fill(-1);
    const paths = [];
    let ok = true;
    for (let p = 0; p < k && ok; p++){
      // 남은 칸 중 자유 이웃이 가장 적은 칸에서 시작 (고립 방지)
      let best = [], bestFree = 99;
      for (let i = 0; i < n * n; i++){
        if (owner[i] !== -1) continue;
        const f = neighbors(i, n).filter(x => owner[x] === -1).length;
        if (f < bestFree){ bestFree = f; best = [i]; }
        else if (f === bestFree) best.push(i);
      }
      if (!best.length){ ok = false; break; }
      let cur = best[Math.floor(rnd() * best.length)];
      const path = [cur];
      owner[cur] = p;
      const remainingPaths = k - p - 1;
      const total = n * n;
      let used = owner.filter(x => x !== -1).length;
      // 마지막 경로는 남은 칸 전부 먹어야 함
      for (;;){
        const free = neighbors(cur, n).filter(x => owner[x] === -1);
        if (!free.length) break;
        if (p < k - 1 && path.length >= 3 && rnd() < 0.18 && total - used >= 2 * remainingPaths) break;
        // 자유 이웃이 적은 칸 우선 (벽 따라가기)
        free.sort((a, b) =>
          neighbors(a, n).filter(x => owner[x] === -1).length -
          neighbors(b, n).filter(x => owner[x] === -1).length + (rnd() - 0.5) * 2);
        cur = free[0];
        owner[cur] = p; path.push(cur); used++;
      }
      paths.push(path);
    }
    if (!ok) continue;
    if (owner.some(x => x === -1)) continue;
    if (paths.some(p => p.length < 3)) continue;
    return paths.map(p => [p[0], p[p.length - 1]]);
  }
  return null;
}

function makeLevel(idx){
  const [n, k] = LEVEL_DEFS[idx % LEVEL_DEFS.length];
  const seed = 1000 + idx * 7919;
  let pairs = generate(n, k, seed);
  if (!pairs) pairs = generate(n, k - 1, seed + 1);
  return { n, pairs };
}

if (typeof module !== 'undefined') module.exports = { generate, makeLevel, LEVEL_DEFS, neighbors };

// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, pairs, endOf, paths, active = -1, moves = 0, solved = false;
  const unlocked = loadProgress();

  function loadProgress(){ try { return +localStorage.getItem('dotsUnlocked') || 0; } catch(e){ return 0; } }
  function saveProgress(v){ try { localStorage.setItem('dotsUnlocked', v); } catch(e){} }

  function load(idx){
    levelIdx = ((idx % LEVEL_DEFS.length) + LEVEL_DEFS.length) % LEVEL_DEFS.length;
    const lv = makeLevel(levelIdx);
    n = lv.n; pairs = lv.pairs;
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
    $('msg').textContent = '🎉 클리어! (' + moves + '번 이동)';
    if (levelIdx + 1 > unlocked) saveProgress(levelIdx + 1);
  }

  function updateUI(){
    $('lvl').textContent = '레벨 ' + (levelIdx + 1) + ' / ' + LEVEL_DEFS.length;
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
    ctx.strokeStyle = '#2a3147'; ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++){
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(W, i * s); ctx.stroke();
    }
    const ctr = i => [(i % n + .5) * s, (Math.floor(i / n) + .5) * s];
    paths.forEach((p, c) => {
      if (!p.length) return;
      const col = COLORS[c % COLORS.length];
      // 칸 배경
      ctx.globalAlpha = .18; ctx.fillStyle = col;
      p.forEach(i => { ctx.fillRect((i % n) * s + 1, Math.floor(i / n) * s + 1, s - 2, s - 2); });
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
  $('reset').onclick = () => load(levelIdx);
  $('prev').onclick = () => load(levelIdx - 1);
  $('next').onclick = () => load(levelIdx + 1);
  load(Math.min(unlocked, LEVEL_DEFS.length - 1));
})();
