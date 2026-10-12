// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, sol, pairs, endOf, paths, active = -1, moves = 0, solved = false, kind = 0;
  let unlocked = 0;   // 현재 난이도에서 연 스테이지. 로그아웃 상태에서는 저장하지 않는다
  const unlockedBy = { easy: 0, normal: 0, hard: 0, extreme: 0 };
  const MODES = ['easy', 'normal', 'hard', 'extreme'];
  const ALL_MODES = MODES.concat('random');
  const TIERNAME = { easy: '쉬움', normal: '보통', hard: '어려움', extreme: '익스트림' };
  function renderModes(){ document.querySelectorAll('#modes button[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === MODE)); $('modes').style.setProperty('--i', ALL_MODES.indexOf(MODE)); }
  function switchLevel(m){
    if (m === MODE) return;
    if (MODE !== 'random') unlockedBy[MODE] = unlocked;
    MODE = m; rTierShown = null;
    try { localStorage.setItem('dotsMode', m); } catch (e) {}
    saveProgress();
    if (m === 'random'){ renderModes(); nextRandom(); return; }
    unlocked = unlockedBy[m];
    renderModes(); Bg.set(SEASON[MODE]); Music.setMode(MODE); buildSelect(); load(unlocked);
  }

  // ---------------- 랜덤 모드: 지금까지 풀지 않은 판 가운데 무작위로, 시간과 최고 기록과 함께 ----------------
  const RKEY = 'dotsRandom';
  const rs = { seen: [], best: {}, played: 0 };   // seen: 이미 나온 판, best: 난이도별 최고 기록(밀리초)
  let rnd = { tier: 'easy', idx: 0, id: 0 }, rTierShown = null;
  const tm = { running: false, acc: 0, last: 0 };
  function loadRandom(){
    try {
      const o = JSON.parse(localStorage.getItem(RKEY) || '{}');
      rs.seen = Array.isArray(o.seen) ? o.seen.filter(Number.isInteger) : [];
      rs.best = o.best && typeof o.best === 'object' ? o.best : {};
      rs.played = +o.played || 0;
    } catch (e) {}
  }
  function saveRandom(){ try { localStorage.setItem(RKEY, JSON.stringify(rs)); } catch (e) {} }
  const fmtTime = ms => { const s = ms / 1000; return s < 60 ? s.toFixed(1) + '초' : Math.floor(s / 60) + '분 ' + (s % 60).toFixed(1) + '초'; };
  const rating = () => Math.min(100, Math.round(RTIERS.indexOf(rnd.tier) * 25 + 25 * rnd.idx / (TOTAL - 1)));
  function pickRandom(){
    const seen = new Set(rs.seen), total = RTIERS.length * TOTAL;
    let pool = [], reshuffled = false;
    for (let id = 0; id < total; id++) if (!RSKIP.has(id) && !seen.has(id)) pool.push(id);
    if (!pool.length){ rs.seen = []; reshuffled = true; for (let id = 0; id < total; id++) if (!RSKIP.has(id)) pool.push(id); }
    const id = pool[Math.floor(Math.random() * pool.length)];
    rs.seen.push(id); rs.played++; saveRandom();
    return { id, tier: RTIERS[Math.floor(id / TOTAL)], idx: id % TOTAL, reshuffled };
  }
  function nextRandom(){
    const p = pickRandom(); rnd = { id: p.id, tier: p.tier, idx: p.idx };
    renderModes(); load(0);
    if (p.reshuffled) $('msg').textContent = '모든 판을 풀어서 다시 섞었어요';
  }
  const hintKey = () => MODE === 'random' ? 'r' + rnd.id : levelIdx;
  const modalOpen = () => !$('settings').hidden || !$('sel').hidden;

  function load(idx){
    { const cb = $('clearBanner'); clearTimeout(cb._t1); clearTimeout(cb._t2); cb.hidden = true; cb.classList.remove('out'); }
    let lv;
    if (MODE === 'random'){
      levelIdx = rnd.idx; lv = makeLevel(rnd.idx, rnd.tier);
      if (rTierShown !== rnd.tier){ rTierShown = rnd.tier; Bg.set(SEASON[rnd.tier]); Music.setMode(rnd.tier); }
    } else {
      levelIdx = Math.max(0, Math.min(Math.min(idx, unlocked), TOTAL - 1));
      lv = makeLevel(levelIdx);
    }
    n = lv.n; pairs = lv.pairs; sol = lv.sol; kind = lv.kind;
    endOf = new Array(n * n).fill(-1);
    pairs.forEach((p, c) => { endOf[p[0]] = c; endOf[p[1]] = c; });
    paths = pairs.map(() => []);
    active = -1; moves = 0; solved = false;
    tm.running = false; tm.acc = 0;
    $('msg').textContent = '';
    draw(); updateUI(); kick(cv, 'stagein');
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

  let rectCache = null;   // 손가락이 움직일 때마다 화면 배치를 다시 재면 느려서, 눌렀을 때 한 번만 잰다
  function cellFromEvent(e){
    const r = rectCache || (rectCache = cv.getBoundingClientRect());
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
    return Math.floor(y * n) * n + Math.floor(x * n);
  }

  function start(cell){
    if (solved) return;
    if (MODE === 'random' && !tm.running){ tm.running = true; tm.last = performance.now(); }
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

  let uiPending = false;
  function uiSoon(){ if (uiPending) return; uiPending = true; requestAnimationFrame(() => { uiPending = false; updateUI(); }); }

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
    draw(); uiSoon();
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
    solved = true; showClear(); fxConfetti(); Sfx.clear(); buzz([20, 50, 20, 50, 40]);
    if (MODE === 'random'){
      tm.running = false;
      const t = Math.round(tm.acc), used = (hintUsed[hintKey()] || 0) > 0, prev = rs.best[rnd.tier];
      let newRec = false;
      if (!used && (prev == null || t < prev)){ rs.best[rnd.tier] = t; newRec = true; }
      saveRandom();
      $('msg').textContent = used ? '클리어! ' + fmtTime(t) + ' (힌트를 써서 기록에서 제외)' : newRec ? '신기록! ' + fmtTime(t) : '클리어! ' + fmtTime(t) + ' (최고 ' + fmtTime(prev) + ')';
      $('cbStage').textContent = TIERNAME[rnd.tier] + ' · ' + fmtTime(t) + (newRec ? ' · 신기록!' : '');
      const cid = rnd.id;
      setTimeout(() => { if (solved && MODE === 'random' && rnd.id === cid) nextRandom(); }, 2800);
      updateUI();
      return;
    }
    $('msg').textContent = levelIdx + 1 >= TOTAL ? '🏆 전체 클리어!' : '🎉 클리어! 잠시 후 다음 스테이지로 넘어가요';
    if (levelIdx + 1 > unlocked && levelIdx + 1 < TOTAL){ unlocked = levelIdx + 1; unlockedBy[MODE] = unlocked; saveProgress(); }
    buildSelect();
    if (levelIdx + 1 < TOTAL){
      const cleared = levelIdx;
      setTimeout(() => { if (solved && levelIdx === cleared) load(cleared + 1); }, 2200);
    }
  }

  function showClear(){
    const b = $('clearBanner');
    $('cbStage').textContent = '스테이지 ' + (levelIdx + 1) + (levelIdx + 1 >= TOTAL ? ' · 전체 클리어' : '');
    clearTimeout(b._t1); clearTimeout(b._t2); b.classList.remove('out'); b.hidden = false;
    if (reduceFx){ b._t2 = setTimeout(() => { b.hidden = true; }, 1400); return; }
    b._t1 = setTimeout(() => b.classList.add('out'), 1500);
    b._t2 = setTimeout(() => { b.hidden = true; b.classList.remove('out'); }, 1800);
  }
  const hintUsed = {};   // 스테이지마다 따로 주어지고 쌓이지 않는다
  function hintsLeft(){ return maxHints(kind) - (hintUsed[hintKey()] || 0); }

  // 값이 바뀔 때만 화면에 쓴다 (선을 긋는 동안 매 프레임 글자와 속성을 다시 쓰면 화면 배치를 계속 다시 계산해서 느려진다)
  const setT = (id, v) => { const el = $(id); v = String(v); if (el._v !== v){ el._v = v; el.textContent = v; } };
  const setH = (id, v) => { const el = $(id); if (el.hidden !== v) el.hidden = v; };
  const setD = (id, v) => { const el = $(id); if (el.disabled !== v) el.disabled = v; };
  function updateUI(){
    const R = MODE === 'random';
    setT('lvlLab', R ? '랜덤' : '스테이지');
    setT('lvlN', R ? TIERNAME[rnd.tier] : levelIdx + 1);
    setT('lvlOf', R ? '난이도 ' + rating() : '/ ' + TOTAL);
    setH('diff', R || kind !== 2); setT('diff', KINDS[kind]);
    { const dc = $('diff'), cn = 'chip k' + kind; if (dc.className !== cn) dc.className = cn; }
    setT('hintTxt', '힌트 ' + hintsLeft() + '/' + maxHints(kind)); setD('hint', solved || hintsLeft() <= 0);
    setD('prev', R || levelIdx === 0);
    setD('pick', R);
    setT('nextTxt', R ? '새 판' : '다음');
    setD('next', R ? false : (!(solved || levelIdx < unlocked) || levelIdx >= TOTAL - 1));
    { const go = solved && (R || levelIdx < TOTAL - 1), nx = $('next'); if (nx.classList.contains('go') !== go) nx.classList.toggle('go', go); }
    setH('rbar', !R);
    if (R){ const b = rs.best[rnd.tier]; setT('rBest', b != null ? '최고 ' + fmtTime(b) : '최고 기록 없음'); }
    const done = paths.filter((_, c) => isComplete(c)).length;
    setT('flows', '연결 ' + done + '/' + pairs.length);
    const filled = paths.reduce((s, p) => s + p.length, 0), pct = Math.round(filled / (n * n) * 100);
    setT('fill', '채움 ' + pct + '%');
    { const fb = $('fillBar'), w = pct + '%'; if (fb._w !== w){ fb._w = w; fb.style.width = w; } }
    if (!solved && done < pairs.length && $('msg').textContent) $('msg').textContent = '';
  }

  // ---------------- 그리기: 윤기 있는 선, 반짝이는 점, 효과 ----------------
  // 모션 줄이기: 저장된 선택이 있으면 그것을, 없으면 기기의 '동작 줄이기' 설정을 따른다
  let reduceFx = (() => {
    try { const v = localStorage.getItem('dotsMotion'); if (v === '1') return true; if (v === '0') return false; } catch (e) {}
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  })();
  function applyMotion(on){
    reduceFx = !!on;
    document.documentElement.classList.toggle('reduce', reduceFx);
    if (reduceFx) fxs.length = 0;
    Bg.setReduce(reduceFx);
  }
  // 창은 서서히 나타나고 사라진다 (모션 줄이기에서는 바로)
  function openModal(el){ clearTimeout(el._ct); el.classList.remove('out'); el.hidden = false; }
  function closeModal(el){
    if (el.hidden || el.classList.contains('out')) return;
    if (reduceFx){ el.hidden = true; return; }
    el.classList.add('out');
    el._ct = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 190);
  }
  // 스테이지가 바뀌면 판이 살짝 떠오르고, 안내 글이 바뀌면 부드럽게 나타난다
  function kick(el, cls){ if (reduceFx) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  const cellsCv = document.createElement('canvas'); let cellsKey = '';
  const beadCache = new Map();
  // 구슬은 그림자와 빛 반사까지 한 번만 그려 두고 위치만 바꿔 찍는다
  function beadSprite(col, rho, done, s){
    const key = col + '|' + Math.round(rho) + '|' + (done ? 1 : 0);
    let sp = beadCache.get(key);
    if (sp) return sp;
    const pad = Math.ceil(s * 0.3), size = Math.ceil(rho * 2 + pad * 2);
    sp = document.createElement('canvas'); sp.width = sp.height = size;
    const c = sp.getContext('2d'), x = size / 2, y = size / 2;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = s * 0.14; c.shadowOffsetY = s * 0.05;
    const g2 = c.createRadialGradient(x - rho * 0.32, y - rho * 0.38, rho * 0.08, x, y, rho);
    g2.addColorStop(0, shade(col, 0.7)); g2.addColorStop(0.42, col); g2.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g2; c.beginPath(); c.arc(x, y, rho, 0, 6.283); c.fill(); c.restore();
    c.strokeStyle = done ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'; c.lineWidth = Math.max(1.2, s * 0.03); c.beginPath(); c.arc(x, y, rho, 0, 6.283); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x - rho * 0.34, y - rho * 0.42, rho * 0.2, rho * 0.11, -0.6, 0, 6.283); c.fill();
    beadCache.set(key, sp); return sp;
  }
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
    const wrap = cv.parentElement, top = wrap.getBoundingClientRect().top;
    const availH = window.innerHeight - top - $('under').offsetHeight - 8 - 12 - 14;   // 아래 안내와 독, 간격, 판 테두리
    const availW = $('app').clientWidth - 12;
    const side = Math.max(170, Math.min(availW * 0.94, 500, availH));
    boardCss = side; rectCache = null;
    if (!(Math.abs(parseFloat(cv.style.width) - side) <= 0.5)){ cv.style.width = side + 'px'; cv.style.height = side + 'px'; }
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  function draw(){ dirty = true; }
  let dirty = true, lastT = 0, lastFit = 0, boardCss = 0, slowDraw = false;
  function loop(t){
    requestAnimationFrame(loop);
    // 그리는 중에는 부드럽게, 가만히 있을 때는 느리게. 한 번 그리는 데 오래 걸리는 기기는 프레임을 줄여 손가락 반응을 지킨다
    if (t - lastT < ((active !== -1 || fxs.length) ? (slowDraw ? 33 : 16) : 66)) return;
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (!n) return;
    if (MODE === 'random'){
      const now = performance.now();
      if (tm.running){ if (!document.hidden && !modalOpen()) tm.acc += Math.min(now - tm.last, 200); tm.last = now; }
      const txt = fmtTime(tm.acc); if ($('rTime').textContent !== txt) $('rTime').textContent = txt;
    }
    if (t - lastFit > 1000){ lastFit = t; fit(); }
    const r0 = performance.now(); render(r0, dt); const took = performance.now() - r0;
    slowDraw = slowDraw ? took > 6 : took > 11;
  }
  function render(t, dt){
    if (!boardCss) fit();   // 판 크기를 먼저 정해 두지 않으면 캔버스가 매 프레임 커진다
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.min(2048, Math.max(200, Math.round(boardCss * dpr)));
    if (cv.width !== px){ cv.width = px; cv.height = px; }
    const W = cv.width, s = W / n, gap = Math.max(1.5, s * 0.035), R = s * 0.16, c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W);
    const ck = W + ':' + n;
    if (cellsKey !== ck){
      cellsKey = ck; cellsCv.width = cellsCv.height = W;
      const cc = cellsCv.getContext('2d');
      const bg = cc.createLinearGradient(0, 0, 0, W); bg.addColorStop(0, '#0d111a'); bg.addColorStop(1, '#090c13');
      cc.fillStyle = bg; cc.fillRect(0, 0, W, W);
      for (let i = 0; i < n * n; i++){
        const x = (i % n) * s + gap, y = Math.floor(i / n) * s + gap;
        rr(cc, x, y, s - gap * 2, s - gap * 2, R);
        cc.fillStyle = '#3a4255'; cc.fill();
        cc.strokeStyle = 'rgba(255,255,255,0.06)'; cc.lineWidth = 1; cc.stroke();
      }
    }
    c.drawImage(cellsCv, 0, 0);
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
        const sp = beadSprite(col, ρ, done, s); c.drawImage(sp, x - sp.width / 2, y - sp.height / 2);
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

  cv.addEventListener('pointerdown', e => { rectCache = null; cv.setPointerCapture(e.pointerId); const c = cellFromEvent(e); if (c !== -1) start(c); });
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
    hintUsed[hintKey()] = (hintUsed[hintKey()] || 0) + 1;
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
  $('next').onclick = () => { if (MODE === 'random'){ nextRandom(); return; } if (solved || levelIdx < unlocked) load(levelIdx + 1); };
  function buildSelect(){
    $('selProg').textContent = Math.min(TOTAL, unlocked + 1) + ' / ' + TOTAL + ' 해금';
    const box = $('grid'); box.textContent = '';
    for (let i = 0; i < TOTAL; i++){
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.className = 'k' + stageParams(i).kind + (i === levelIdx ? ' cur' : '') + (i < unlocked ? ' done' : '');
      b.disabled = i > unlocked;
      b.onclick = () => { load(i); closeModal($('sel')); };
      box.appendChild(b);
    }
  }
  const closeList = () => closeModal($('sel'));
  $('closeSel').onclick = closeList;
  document.addEventListener('pointerdown', e => { if (!$('sel').hidden && !e.target.closest('#sel') && !e.target.closest('#pick')) closeList(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeList(); });
  $('pick').onclick = () => { if (MODE === 'random') return; const s = $('sel'); if (!s.hidden && !s.classList.contains('out')){ closeModal(s); return; } buildSelect(); openModal(s); const c = $('grid').children[levelIdx]; if (c) c.scrollIntoView({block:'center'}); };
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
  function paintSwitches(){ const s = Music.get(); $('tgMusic').setAttribute('aria-pressed', String(s.music)); $('tgSfx').setAttribute('aria-pressed', String(s.sfx)); $('tgMotion').setAttribute('aria-pressed', String(reduceFx)); }
  function resetAll(){
    MODES.forEach(m => { unlockedBy[m] = 0; }); unlocked = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    for (const k in hintUsed) delete hintUsed[k];
    rs.seen = []; rs.best = {}; rs.played = 0; saveRandom();
    buildSelect();
    if (MODE === 'random'){ rTierShown = null; nextRandom(); } else load(0);
    $('msg').textContent = '처음부터 다시 시작해요';
  }
  function initSettings(){
    const close = () => closeModal($('settings'));
    $('openSettings').onclick = () => { paintSwitches(); $('confirm').hidden = true; $('resetAll').hidden = false; openModal($('settings')); };
    $('closeSettings').onclick = close;
    $('settings').addEventListener('pointerdown', e => { if (e.target === $('settings')) close(); });
    $('tgMusic').onclick = () => { Music.setMusic(!Music.get().music); paintSwitches(); };
    $('tgSfx').onclick = () => { Music.setSfx(!Music.get().sfx); paintSwitches(); };
    $('tgMotion').onclick = () => { applyMotion(!reduceFx); try { localStorage.setItem('dotsMotion', reduceFx ? '1' : '0'); } catch (e) {} paintSwitches(); };
    $('resetAll').onclick = () => { $('confirm').hidden = false; $('resetAll').hidden = true; };
    $('no').onclick = () => { $('confirm').hidden = true; $('resetAll').hidden = false; };
    $('yes').onclick = () => { resetAll(); close(); };
  }

  document.querySelectorAll('#modes button[data-mode]').forEach(b => { b.onclick = () => switchLevel(b.dataset.mode); });
  applyMotion(reduceFx);
  loadSave(); loadRandom();
  if (MODE === 'random'){
    renderModes(); buildSelect(); nextRandom();
  } else {
    unlocked = unlockedBy[MODE];
    renderModes(); Bg.set(SEASON[MODE]); Music.setMode(MODE);
    buildSelect(); load(unlocked);
  }
  initSettings();
  fit();
  new MutationObserver(() => { if ($('msg').textContent) kick($('msg'), 'msgpop'); }).observe($('msg'), { childList: true, characterData: true, subtree: true });
  $('homeBtn').onclick = () => { document.body.classList.remove('in-game'); $('home').hidden = false; starting = false; };
  // PLAY: 0.7초 동안 까맣게 → "로딩중..." 1.6초 → 0.7초 동안 게임 화면이 서서히 나타난다 (모두 3초)
  let starting = false;
  $('playBtn').onclick = () => {
    if (starting) return; starting = true;
    const fade = $('fade'), txt = $('loadTxt'), k = reduceFx ? [150, 900, 1000] : [700, 2150, 2300];
    fade.classList.add('on');
    setTimeout(() => { txt.classList.add('show'); document.body.classList.add('in-game'); $('home').hidden = true; fit(); }, k[0]);
    setTimeout(() => { txt.classList.remove('show'); }, k[1]);
    setTimeout(() => { fade.classList.remove('on'); }, k[2]);
  };
})();
