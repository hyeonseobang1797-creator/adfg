// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, sol, pairs, endOf, paths, active = -1, moves = 0, solved = false, kind = 0;
  let unlocked = 0;   // 현재 난이도에서 연 스테이지. 로그아웃 상태에서는 저장하지 않는다
  const unlockedBy = { easy: 0, normal: 0, hard: 0, extreme: 0 };
  const MODES = ['easy', 'normal', 'hard', 'extreme'];
  function renderModes(){ document.querySelectorAll('#modes button[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === MODE)); }
  function switchLevel(m){
    if (m === MODE) return;
    unlockedBy[MODE] = unlocked; MODE = m; unlocked = unlockedBy[m];
    try { localStorage.setItem('dotsMode', m); } catch (e) {}
    saveProgress();
    renderModes(); Bg.set(SEASON[MODE]); Music.setMode(MODE); buildSelect(); load(unlocked);
  }


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
      active = c; moves++; fxRing(cell, COLORS[c % COLORS.length]); Sfx.tick(0);
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
    if (o && o[0] !== c){ paths[o[0]] = paths[o[0]].slice(0, o[1]); fxBurst(cell, COLORS[o[0] % COLORS.length], 6); Sfx.cut(); }   // 다른 선 자르기
    p.push(cell);
    fxRing(cell, COLORS[c % COLORS.length]);
    if (endOf[cell] === c && p.length > 1){ pairs[c].forEach(i => fxBurst(i, COLORS[c % COLORS.length], 14)); Sfx.connect(); buzz(18); }
    else Sfx.tick(p.length);
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
    solved = true; fxConfetti(); Sfx.clear(); buzz([20, 50, 20, 50, 40]);
    $('msg').textContent = levelIdx + 1 >= TOTAL ? '🏆 전체 클리어!' : '🎉 클리어! 잠시 후 다음 스테이지로 넘어가요';
    if (levelIdx + 1 > unlocked && levelIdx + 1 < TOTAL){ unlocked = levelIdx + 1; unlockedBy[MODE] = unlocked; saveProgress(); }
    buildSelect();
    if (levelIdx + 1 < TOTAL){
      const cleared = levelIdx;
      setTimeout(() => { if (solved && levelIdx === cleared) load(cleared + 1); }, 2200);
    }
  }

  const hintUsed = {};   // 스테이지마다 따로 주어지고 쌓이지 않는다
  function hintsLeft(){ return maxHints(kind) - (hintUsed[levelIdx] || 0); }

  function updateUI(){
    $('lvl').textContent = '스테이지 ' + (levelIdx + 1) + ' / ' + TOTAL;
    const dc = $('diff'); dc.hidden = kind !== 2; dc.textContent = KINDS[kind]; dc.className = 'chip k' + kind;
    const hb = $('hint'); hb.textContent = '힌트 ' + hintsLeft() + '/' + maxHints(kind); hb.disabled = solved || hintsLeft() <= 0;
    $('prev').disabled = levelIdx === 0;
    $('next').disabled = !(solved || levelIdx < unlocked) || levelIdx >= TOTAL - 1;
    $('next').classList.toggle('go', solved && levelIdx < TOTAL - 1);
    const done = paths.filter((_, c) => isComplete(c)).length;
    $('flows').textContent = '연결 ' + done + '/' + pairs.length;
    const filled = paths.reduce((s, p) => s + p.length, 0);
    $('fill').textContent = '채움 ' + Math.round(filled / (n * n) * 100) + '%';
    if (!solved && done < pairs.length) $('msg').textContent = '';
  }

  // ---------------- 그리기: 윤기 있는 선, 반짝이는 점, 효과 ----------------
  const reduceFx = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fxs = [];   // 잠깐 보였다 사라지는 효과(물결, 불꽃, 색종이)
  const rgbOf = h => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const shade = (h, k) => { const [r, g, b] = rgbOf(h), t = k < 0 ? 0 : 255, a = Math.abs(k); return 'rgb(' + Math.round(r + (t - r) * a) + ',' + Math.round(g + (t - g) * a) + ',' + Math.round(b + (t - b) * a) + ')'; };
  const alphaOf = (h, a) => { const [r, g, b] = rgbOf(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  const cellXY = i => [(i % n + 0.5), (Math.floor(i / n) + 0.5)];   // 칸 단위 좌표(그릴 때 s를 곱한다)
  function fxRing(cell, col, big){ if (reduceFx) return; const [x, y] = cellXY(cell); fxs.push({ k: 'ring', x, y, col, t0: performance.now(), life: big ? 650 : 380, r1: big ? 1.1 : 0.7 }); }
  function fxBurst(cell, col, cnt){
    if (reduceFx) return; const [x, y] = cellXY(cell), t0 = performance.now();
    for (let i = 0; i < cnt; i++){ const a = Math.random() * 6.283, v = 1.2 + Math.random() * 2.6; fxs.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, col, t0, life: 500 + Math.random() * 400 }); }
    fxRing(cell, col, true);
  }
  function fxConfetti(){
    if (reduceFx) return; const t0 = performance.now();
    for (let i = 0; i < 110; i++) fxs.push({ k: 'conf', x: Math.random() * n, y: -0.5 - Math.random() * 2, vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 3, col: COLORS[i % COLORS.length], rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10, t0, life: 1700 + Math.random() * 600 });
  }
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  function fit(){
    const top = cv.getBoundingClientRect().top, msgH = $('msg').offsetHeight + 8;
    const availH = window.innerHeight - top - msgH - 14;
    const availW = document.body.clientWidth - 32;
    const side = Math.max(170, Math.min(availW * 0.94, 500, availH));
    if (!(Math.abs(parseFloat(cv.style.width) - side) <= 0.5)){ cv.style.width = side + 'px'; cv.style.height = side + 'px'; }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  function draw(){ dirty = true; }
  let dirty = true, lastT = 0, lastFit = 0;
  function loop(t){
    requestAnimationFrame(loop);
    if (t - lastT < 30) return;   // 약 30프레임
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (!n) return;
    if (t - lastFit > 300){ lastFit = t; fit(); }
    render(performance.now(), dt);
  }
  function render(t, dt){
    const rect = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.max(200, Math.round(rect.width * dpr));
    if (cv.width !== px){ cv.width = px; cv.height = px; }
    const W = cv.width, s = W / n, gap = Math.max(1.5, s * 0.035), R = s * 0.16, c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W);
    const bg = c.createLinearGradient(0, 0, 0, W); bg.addColorStop(0, '#0d111a'); bg.addColorStop(1, '#090c13');
    c.fillStyle = bg; c.fillRect(0, 0, W, W);
    // 칸
    for (let i = 0; i < n * n; i++){
      const x = (i % n) * s + gap, y = Math.floor(i / n) * s + gap;
      rr(c, x, y, s - gap * 2, s - gap * 2, R);
      c.fillStyle = '#3a4255'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; c.stroke();
    }
    const ctr = i => [(i % n + 0.5) * s, (Math.floor(i / n) + 0.5) * s];
    // 선이 지나간 칸은 선 색으로 은은하게 물든다
    paths.forEach((p, k) => {
      if (!p.length) return;
      const col = COLORS[k % COLORS.length];
      p.forEach(i => {
        const x = (i % n) * s + gap, y = Math.floor(i / n) * s + gap;
        rr(c, x, y, s - gap * 2, s - gap * 2, R); c.fillStyle = alphaOf(col, 0.26); c.fill();
      });
    });
    // 선: 부드럽게 꺾이는 윤기 있는 관
    paths.forEach((p, k) => {
      if (p.length < 2) return;
      const col = COLORS[k % COLORS.length], pts = p.map(ctr), path = new Path2D();
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) path.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], s * 0.22);   // 꺾이는 곳은 약간만 둥글게
      path.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      c.lineCap = 'round'; c.lineJoin = 'round';
      const done = isComplete(k);
      c.strokeStyle = alphaOf(col, done ? 0.3 : 0.2); c.lineWidth = s * 0.62; c.stroke(path);
      c.strokeStyle = shade(col, -0.38); c.lineWidth = s * 0.4; c.stroke(path);
      c.strokeStyle = col; c.lineWidth = s * 0.33; c.stroke(path);
      c.save(); c.translate(-s * 0.02, -s * 0.03); c.strokeStyle = shade(col, 0.4); c.lineWidth = s * 0.15; c.stroke(path); c.restore();
      c.save(); c.translate(-s * 0.045, -s * 0.07); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = s * 0.045; c.stroke(path); c.restore();
      if (done && !reduceFx){   // 이어진 선 위로 빛이 흐른다
        c.save(); c.lineCap = 'butt'; c.setLineDash([s * 0.2, s * 1.5]); c.lineDashOffset = -(t / 14) % (s * 1.7);
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = s * 0.1; c.stroke(path); c.restore();
      }
    });
    // 그리는 중인 선의 머리: 맥박처럼 뛰는 고리
    if (active !== -1 && paths[active].length){
      const h = paths[active][paths[active].length - 1], [x, y] = ctr(h), col = COLORS[active % COLORS.length], pu = 0.5 + 0.5 * Math.sin(t / 130);
      c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * pu) + ')'; c.lineWidth = s * 0.05; c.beginPath(); c.arc(x, y, s * (0.3 + 0.05 * pu), 0, 6.283); c.stroke();
      const gl = c.createRadialGradient(x, y, 0, x, y, s * 0.7); gl.addColorStop(0, alphaOf(col, 0.35)); gl.addColorStop(1, alphaOf(col, 0));
      c.fillStyle = gl; c.beginPath(); c.arc(x, y, s * 0.7, 0, 6.283); c.fill();
    }
    // 점: 입체감 있는 구슬
    pairs.forEach((pr, k) => {
      const col = COLORS[k % COLORS.length], done = isComplete(k);
      pr.forEach(i => {
        const [x, y] = ctr(i), ρ = s * 0.31 * (done ? 1.04 : 1);
        if (!done && !reduceFx){   // 아직 안 이은 점은 잔잔하게 숨 쉰다
          const u = ((t / 2400) + k * 0.13) % 1;
          c.strokeStyle = alphaOf(col, (1 - u) * 0.28); c.lineWidth = s * 0.04; c.beginPath(); c.arc(x, y, ρ * (1.05 + u * 0.55), 0, 6.283); c.stroke();
        }
        c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = s * 0.14; c.shadowOffsetY = s * 0.05;
        const g = c.createRadialGradient(x - ρ * 0.32, y - ρ * 0.38, ρ * 0.08, x, y, ρ);
        g.addColorStop(0, shade(col, 0.7)); g.addColorStop(0.42, col); g.addColorStop(1, shade(col, -0.35));
        c.fillStyle = g; c.beginPath(); c.arc(x, y, ρ, 0, 6.283); c.fill(); c.restore();
        c.strokeStyle = done ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'; c.lineWidth = Math.max(1.2, s * 0.03); c.beginPath(); c.arc(x, y, ρ, 0, 6.283); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x - ρ * 0.34, y - ρ * 0.42, ρ * 0.2, ρ * 0.11, -0.6, 0, 6.283); c.fill();
      });
    });
    // 효과
    for (let i = fxs.length - 1; i >= 0; i--){
      const f = fxs[i], age = t - f.t0, u = age / f.life;
      if (u >= 1){ fxs.splice(i, 1); continue; }
      if (f.k === 'ring'){
        c.strokeStyle = alphaOf(f.col, (1 - u) * 0.9); c.lineWidth = s * 0.07 * (1 - u) + 1;
        c.beginPath(); c.arc(f.x * s, f.y * s, s * (0.25 + f.r1 * u), 0, 6.283); c.stroke();
      } else if (f.k === 'spark'){
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 4 * dt;
        c.fillStyle = alphaOf(f.col, 1 - u); c.beginPath(); c.arc(f.x * s, f.y * s, s * 0.055 * (1 - u * 0.6), 0, 6.283); c.fill();
      } else {
        f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        c.save(); c.translate(f.x * s, f.y * s); c.rotate(f.rot); c.fillStyle = alphaOf(f.col, 1 - Math.max(0, u - 0.7) / 0.3);
        c.fillRect(-s * 0.06, -s * 0.03, s * 0.12, s * 0.06); c.restore();
      }
    }
  }
  requestAnimationFrame(loop);

  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const c = cellFromEvent(e); if (c !== -1) start(c); });
  cv.addEventListener('pointermove', e => { if (active !== -1) move(cellFromEvent(e)); });
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  // 정답 선과 어긋난 부분이 있는지 본다 (그린 선이 정답 선의 앞부분과 같으면 맞는 선)
  function isWrong(c){
    const p = paths[c];
    if (p.length < 2) return false;
    const s = sol[c], ref = p[0] === s[0] ? s : s.slice().reverse();
    return p.some((x, i) => x !== ref[i]);
  }
  $('hint').onclick = () => {
    if (solved || hintsLeft() <= 0) return;
    // 1) 이미 그은 선 중 틀린 것이 있으면 그 선을 정답으로 고친다  2) 없으면 아직 안 이은 선 하나를 그어 준다
    let c = paths.findIndex((_, k) => isWrong(k)), fixed = c !== -1;
    if (!fixed) c = paths.findIndex((_, k) => !isComplete(k));
    if (c === -1) return;
    hintUsed[levelIdx] = (hintUsed[levelIdx] || 0) + 1;
    const line = sol[c].slice();
    paths[c] = line;
    // 정답 선이 지나가는 칸을 차지하고 있던 다른 선은 그 칸 앞에서 잘라 절대 겹치지 않게 한다
    const on = new Set(line);
    paths.forEach((p, k) => { if (k !== c){ const j = p.findIndex(x => on.has(x)); if (j !== -1) paths[k] = p.slice(0, j); } });
    moves++; fxRing(sol[c][0], COLORS[c % COLORS.length], true); fxRing(sol[c][sol[c].length - 1], COLORS[c % COLORS.length], true); Sfx.hint(); buzz(10);
    checkWin(); draw(); updateUI();
    if (!solved) $('msg').textContent = fixed ? '잘못 그은 선을 고쳤어요' : '선 하나를 이어 줬어요';
  };
  $('reset').onclick = () => load(levelIdx);
  $('prev').onclick = () => load(levelIdx - 1);
  $('next').onclick = () => { if (solved || levelIdx < unlocked) load(levelIdx + 1); };
  function buildSelect(){
    const box = $('grid'); box.textContent = '';
    for (let i = 0; i < TOTAL; i++){
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.className = 'k' + stageParams(i).kind + (i === levelIdx ? ' cur' : '') + (i < unlocked ? ' done' : '');
      b.disabled = i > unlocked;
      b.onclick = () => { load(i); $('sel').hidden = true; };
      box.appendChild(b);
    }
  }
  $('pick').onclick = () => { const s = $('sel'); s.hidden = !s.hidden; if (!s.hidden){ buildSelect(); const c = $('grid').children[levelIdx]; if (c) c.scrollIntoView({block:'center'}); } };
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    Sfx.click(); buzz(6);
    if (reduceFx) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, sp = document.createElement('span');
    sp.className = 'rip'; sp.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(sp); setTimeout(() => sp.remove(), 520);
  });
  // ---------------- 저장: 이 기기의 브라우저에 자동으로 ----------------
  const SAVE_KEY = 'dotsProgress';
  function loadSave(){
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      MODES.forEach(m => { unlockedBy[m] = Math.max(0, Math.min(TOTAL - 1, Math.floor(+o[m] || 0))); });
    } catch (e) {}
  }
  function saveProgress(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(unlockedBy)); } catch (e) {} }

  // ---------------- 설정 ----------------
  function paintSwitches(){ const s = Music.get(); $('tgMusic').setAttribute('aria-pressed', String(s.music)); $('tgSfx').setAttribute('aria-pressed', String(s.sfx)); }
  function resetAll(){
    MODES.forEach(m => { unlockedBy[m] = 0; }); unlocked = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    for (const k in hintUsed) delete hintUsed[k];
    buildSelect(); load(0);
    $('msg').textContent = '처음부터 다시 시작해요';
  }
  function initSettings(){
    const close = () => { $('settings').hidden = true; };
    $('openSettings').onclick = () => { paintSwitches(); $('confirm').hidden = true; $('resetAll').hidden = false; $('settings').hidden = false; };
    $('closeSettings').onclick = close;
    $('settings').addEventListener('pointerdown', e => { if (e.target === $('settings')) close(); });
    $('tgMusic').onclick = () => { Music.setMusic(!Music.get().music); paintSwitches(); };
    $('tgSfx').onclick = () => { Music.setSfx(!Music.get().sfx); paintSwitches(); };
    $('resetAll').onclick = () => { $('confirm').hidden = false; $('resetAll').hidden = true; };
    $('no').onclick = () => { $('confirm').hidden = true; $('resetAll').hidden = false; };
    $('yes').onclick = () => { resetAll(); close(); };
  }

  document.querySelectorAll('#modes button[data-mode]').forEach(b => { b.onclick = () => switchLevel(b.dataset.mode); });
  loadSave(); unlocked = unlockedBy[MODE];
  renderModes(); Bg.set(SEASON[MODE]); Music.setMode(MODE);
  buildSelect(); load(unlocked);
  initSettings();
})();
