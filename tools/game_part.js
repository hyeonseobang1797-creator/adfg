// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, sol, pairs, endOf, paths, active = -1, moves = 0, solved = false, kind = 0;
  let cheat = false;   // 설정에서 코드를 넣으면 이번 접속 동안만 스킵이 켜진다 (저장하지 않음)
  const reach = () => cheat ? TOTAL - 1 : unlocked;
  let unlocked = 0;   // 현재 난이도에서 연 스테이지. 로그아웃 상태에서는 저장하지 않는다
  const unlockedBy = { easy: 0, normal: 0, hard: 0, extreme: 0 };
  const MODES = ['easy', 'normal', 'hard', 'extreme'];
  const ALL_MODES = MODES.concat('random');
  const TIERNAME = { easy: '쉬움', normal: '보통', hard: '어려움', extreme: '익스트림' };
  const inMore = () => MODE === 'random' || MODE === 'multi';
  function renderModes(){ const k = inMore() ? 'random' : MODE; document.querySelectorAll('#modes button[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === k)); $('modes').style.setProperty('--i', ALL_MODES.indexOf(k)); }
  function switchLevel(m){
    if (MODE === 'multi') mpClose();
    if (m === MODE) return;
    if (MODES.includes(MODE)) unlockedBy[MODE] = unlocked;
    MODE = m; rTierShown = null;
    try { localStorage.setItem('dotsMode', m); } catch (e) {}
    saveProgress();
    if (m === 'random'){ renderModes(); nextRandom(); return; }
    unlocked = unlockedBy[m];
    renderModes(); Bg.set(SEASON[MODE]); Music.setMode(MODE); buildSelect(); load(unlocked);
  }

  // ---------------- 랜덤 모드: 지금까지 풀지 않은 판 가운데 무작위로, 시간과 최고 기록과 함께 ----------------
  const RKEY = 'dotsRandom';
  const rs = { seen: [], best: {}, played: 0, solved: {} };   // seen: 이미 나온 판, best: 난이도별 최고 기록(밀리초)
  let rnd = { tier: 'easy', band: 'easy', idx: 0, id: 0 }, rTierShown = null;
  const tm = { running: false, acc: 0, last: 0 };
  function loadRandom(){
    try {
      const o = JSON.parse(localStorage.getItem(RKEY) || '{}');
      rs.seen = Array.isArray(o.seen) ? o.seen.filter(Number.isInteger) : [];
      rs.best = o.best && typeof o.best === 'object' ? o.best : {};
      rs.played = +o.played || 0;
      rs.solved = o.solved && typeof o.solved === 'object' ? o.solved : {};
    } catch (e) {}
  }
  function saveRandom(){ try { localStorage.setItem(RKEY, JSON.stringify(rs)); } catch (e) {} }
  const fmtTime = ms => { const s = ms / 1000; return s < 60 ? s.toFixed(1) + '초' : Math.floor(s / 60) + '분 ' + (s % 60).toFixed(1) + '초'; };
  const bandOf = r => r <= RBANDS[0] ? 'easy' : r <= RBANDS[1] ? 'normal' : r <= RBANDS[2] ? 'hard' : 'extreme';
  const rating = () => RRATE[rnd.id];
  let lastBand = null;
  function pickRandom(){
    const seen = new Set(rs.seen), total = RTIERS.length * TOTAL;
    let reshuffled = false;
    const build = ex => { const g = { easy: [], normal: [], hard: [], extreme: [] };
      for (let id = 0; id < total; id++) if (!RSKIP.has(id) && !(ex && seen.has(id))) g[bandOf(RRATE[id])].push(id); return g; };
    let g = build(true), bands = Object.keys(g).filter(k => g[k].length);
    if (!bands.length){ rs.seen = []; reshuffled = true; g = build(false); bands = Object.keys(g).filter(k => g[k].length); }
    const alt = bands.filter(k => k !== lastBand); if (alt.length) bands = alt;
    const band = bands[Math.floor(Math.random() * bands.length)], arr = g[band];
    const id = arr[Math.floor(Math.random() * arr.length)];
    lastBand = band; rs.seen.push(id); rs.played++; saveRandom();
    return { id, band, src: RTIERS[Math.floor(id / TOTAL)], idx: id % TOTAL, reshuffled };
  }
  function nextRandom(){
    const p = pickRandom(); rnd = { id: p.id, band: p.band, tier: p.src, idx: p.idx };
    renderModes(); load(0);
    if (p.reshuffled) $('msg').textContent = '모든 판을 풀어서 다시 섞었어요';
  }
  const hintKey = () => MODE === 'random' ? 'r' + rnd.id : MODE === 'multi' ? 'm' + mp.ser + ':' + rnd.id : levelIdx;
  const modalOpen = () => !$('settings').hidden || !$('sel').hidden || !$('records').hidden;

  function load(idx){
    { const cb = $('clearBanner'); clearTimeout(cb._t1); clearTimeout(cb._t2); cb.hidden = true; cb.classList.remove('out'); }
    let lv;
    if (inMore()){
      levelIdx = rnd.idx; lv = makeLevel(rnd.idx, rnd.tier);
      if (rTierShown !== rnd.band){ rTierShown = rnd.band; Bg.set(SEASON[rnd.band]); Music.setMode(rnd.band); }
    } else {
      levelIdx = Math.max(0, Math.min(Math.min(idx, reach()), TOTAL - 1));
      lv = makeLevel(levelIdx);
    }
    cv.dataset.puz = inMore() ? rnd.id : '';
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
    draw(); updateUI(); if (mp.on) mpLine(active, true);
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
    if (endOf[cell] === c && p.length > 1){ pairs[c].forEach(i => fxBurst(i, COLORS[c % COLORS.length], 14)); popBeads(c); fxSweep(p, COLORS[c % COLORS.length]); Sfx.connect(); buzz(18); }
    else { Sfx.tick(p.length); fxTrail(cell, COLORS[c % COLORS.length]); }
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
    draw(); uiSoon(); if (mp.on) mpLine(active);
  }

  function end(){
    if (active === -1) return;
    const done = active;
    active = -1;
    checkWin();
    draw(); updateUI(); if (mp.on) mpLine(done, true);
  }

  function checkWin(){
    if (!paths.every((_, c) => isComplete(c))) return;
    const filled = paths.reduce((s, p) => s + p.length, 0);
    if (filled !== n * n) { $('msg').textContent = '모든 칸을 채워야 해요!'; return; }
    solved = true; showClear(); fxConfetti(); fxFinale(); Sfx.clear(); buzz([20, 50, 20, 50, 40]);
    if (MODE === 'multi'){
      tm.running = false; mpWon();
      return;
    }
    if (MODE === 'random'){
      tm.running = false;
      const t = Math.round(tm.acc), used = (hintUsed[hintKey()] || 0) > 0, prev = rs.best[rnd.band];
      let newRec = false;
      if (!used && (prev == null || t < prev)){ rs.best[rnd.band] = t; newRec = true; }
      rs.solved[rnd.band] = (rs.solved[rnd.band] || 0) + 1; saveRandom();
      if (newRec){ Sfx.record(); fxConfetti(); setTimeout(fxConfetti, 350); buzz([30, 60, 30, 60, 30, 60, 80]); }
      $('msg').textContent = used ? '클리어! ' + fmtTime(t) + ' (힌트를 써서 기록에서 제외)' : newRec ? '신기록! ' + fmtTime(t) : '클리어! ' + fmtTime(t) + ' (최고 ' + fmtTime(prev) + ')';
      $('cbStage').textContent = TIERNAME[rnd.band] + ' · 난이도 ' + rating() + ' · ' + fmtTime(t) + (newRec ? ' · 신기록!' : '');
      const cid = rnd.id;
      setTimeout(() => { if (solved && MODE === 'random' && rnd.id === cid) nextRandom(); }, 3400);
      updateUI();
      return;
    }
    $('msg').textContent = levelIdx + 1 >= TOTAL ? '🏆 전체 클리어!' : '🎉 클리어! 잠시 후 다음 스테이지로 넘어가요';
    if (levelIdx === unlocked && levelIdx + 1 < TOTAL){ unlocked = levelIdx + 1; unlockedBy[MODE] = unlocked; saveProgress(); }
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
    const R = MODE === 'random', M = MODE === 'multi', RR = R || M;
    setT('lvlLab', M ? '멀티' : R ? '랜덤' : '스테이지');
    document.body.classList.toggle('rnd', RR);
    setT('lvlN', RR ? TIERNAME[rnd.band] : levelIdx + 1);
    setT('lvlOf', RR ? '난이도 ' + rating() + ' · ' + n + '×' + n : '/ ' + TOTAL);
    setH('diff', RR || kind !== 2); setT('diff', KINDS[kind]);
    { const dc = $('diff'), cn = 'chip k' + kind; if (dc.className !== cn) dc.className = cn; }
    setT('hintTxt', '힌트 ' + hintsLeft() + '/' + maxHints(kind)); setD('hint', solved || hintsLeft() <= 0);
    setD('prev', R || (!M && levelIdx === 0));
    setT('prevTxt', M ? '나가기' : '이전'); { const pb = $('prev'); if (pb.classList.contains('leave') !== M) pb.classList.toggle('leave', M); }
    setD('pick', RR);
    setT('nextTxt', R ? '새 판' : cheat && !(solved || levelIdx < unlocked) ? '스킵' : '다음');
    setD('next', M ? true : R ? false : (!(solved || levelIdx < reach()) || levelIdx >= TOTAL - 1));
    { const go = solved && (R || levelIdx < TOTAL - 1), nx = $('next'); if (nx.classList.contains('go') !== go) nx.classList.toggle('go', go); }
    setH('rbar', !RR);
    if (R){ const b = rs.best[rnd.band]; setT('rBest', b != null ? '최고 ' + fmtTime(b) : '최고 기록 없음'); }
    if (M) setT('rBest', '방 ' + mp.code + ' · ' + Math.max(1, mpViewers().length) + '명');
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
  const popAt = {};   // 점이 이어졌을 때 통통 커지는 시각
  const popBeads = c => { if (reduceFx) return; const now = performance.now(); pairs[c].forEach(i => { popAt[i] = now; }); };
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
  // 선을 따라 빛이 달린다: 이어진 선 전체가 차례로 반짝이고, 끝에서 끝으로 빛 알갱이가 지나간다
  function fxSweep(path, col){
    if (reduceFx || !path || path.length < 2) return;
    const t0 = performance.now(), pts = path.map(cellXY), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const life = Math.min(900, 260 + pts.length * 45);
    fxs.push({ k: 'sweep', pts, cum, col, t0, life });
    for (let i = 0; i < 3; i++){ const q = pts[Math.floor(Math.random() * pts.length)]; fxStar(q[0] + (Math.random() - 0.5) * 0.3, q[1] + (Math.random() - 0.5) * 0.3, '#ffffff', Math.random() * life * 0.8, 0.28); }
    const step = pts.length > 40 ? 2 : 1;
    for (let i = 0; i < pts.length; i += step) fxs.push({ k: 'cell', x: pts[i][0], y: pts[i][1], col, t0: t0 + (life * i / pts.length) * 0.85, life: 420 });
  }
  // 이동 흔적: 선을 긋는 손가락 끝에서 작은 빛 알갱이가 흩날린다
  function fxTrail(cell, col){
    if (reduceFx || fxs.length > 160) return;
    const [x, y] = cellXY(cell), t0 = performance.now();
    for (let i = 0; i < 2; i++) fxs.push({ k: 'trail', x: x + (Math.random() - 0.5) * 0.25, y: y + (Math.random() - 0.5) * 0.25, vx: (Math.random() - 0.5) * 0.9, vy: -0.2 - Math.random() * 0.7, col, t0, life: 380 + Math.random() * 260 });
  }
  // 반짝이는 별빛(네 갈래)
  function fxStar(x, y, col, delay, size){
    if (reduceFx) return;
    fxs.push({ k: 'star', x, y, col, t0: performance.now() + (delay || 0), life: 620 + Math.random() * 240, sz: size || (0.32 + Math.random() * 0.3), rot: (Math.random() - 0.5) * 0.5 });
  }
  // 판을 다 채웠을 때: 가운데서 퍼지는 물결, 하늘로 터지는 불꽃, 판이 살짝 부풀며 빛난다
  function fxFinale(){
    if (reduceFx) return;
    const t0 = performance.now(), cx = n / 2, cy = n / 2;
    for (let i = 0; i < 3; i++) fxs.push({ k: 'wave', x: cx, y: cy, r1: n * 0.85, col: i === 1 ? '#ffe08a' : '#ffffff', t0: t0 + i * 170, life: 900 });
    fxs.push({ k: 'flash', x: cx, y: cy, t0, life: 520 });
    for (let i = 0; i < 6; i++){
      const cell = Math.floor(Math.random() * n * n), col = COLORS[(i * 5 + Math.floor(Math.random() * 7)) % COLORS.length], d = 160 + i * 190 + Math.random() * 120;
      const [x, y] = cellXY(cell), rise = 460;
      fxs.push({ k: 'rocket', x0: x + (Math.random() - 0.5) * 1.2, y0: n + 0.4, x, y, col, t0: t0 + d - rise, life: rise });
      for (let k = 0; k < 26; k++){ const a = k / 26 * 6.283 + Math.random() * 0.2, v = 1.4 + Math.random() * 2.2; fxs.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, col, t0: t0 + d, life: 800 + Math.random() * 400 }); }
      for (let k = 0; k < 6; k++){ const a = Math.random() * 6.283, v = 0.4 + Math.random() * 1.2; fxs.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: '#ffffff', t0: t0 + d, life: 600 + Math.random() * 300 }); }
      fxs.push({ k: 'ring', x, y, col, t0: t0 + d, life: 600, r1: 1.4 });
      fxStar(x, y, '#ffffff', d, 0.55);
    }
    for (let i = 0; i < 12; i++) fxStar(Math.random() * n, Math.random() * n, i % 3 === 0 ? '#ffe08a' : '#ffffff', 200 + Math.random() * 1300);
    kick(cv.parentElement, 'pop');
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
    if (inMore()){
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
        const sp = beadSprite(col, ρ, done, s), pu = popAt[i] ? (t - popAt[i]) / 420 : 1, kk = pu < 1 ? 1 + 0.3 * Math.sin(Math.PI * Math.pow(pu, 0.7)) : 1; c.drawImage(sp, x - sp.width * kk / 2, y - sp.height * kk / 2, sp.width * kk, sp.height * kk);
      });
    });
    // 효과
    for (let i = fxs.length - 1; i >= 0; i--){
      const f = fxs[i], age = t - f.t0, u = age / f.life;
      if (u >= 1){ fxs.splice(i, 1); continue; }
      if (age < 0) continue;
      c.globalCompositeOperation = f.k === 'conf' ? 'source-over' : 'lighter';
      if (f.k === 'flash'){
        const gr = c.createRadialGradient(f.x * s, f.y * s, 0, f.x * s, f.y * s, s * n * 0.75); gr.addColorStop(0, 'rgba(255,248,225,' + (0.55 * (1 - u)) + ')'); gr.addColorStop(1, 'rgba(255,248,225,0)');
        c.fillStyle = gr; c.fillRect(0, 0, s * n, s * n); continue;
      }
      if (f.k === 'rocket'){
        const e = 1 - Math.pow(1 - u, 2), hx = (f.x0 + (f.x - f.x0) * e) * s, hy = (f.y0 + (f.y - f.y0) * e) * s;
        for (let q = 0; q < 8; q++){ const e2 = Math.max(0, 1 - Math.pow(1 - Math.max(0, u - q * 0.03), 2)), px = (f.x0 + (f.x - f.x0) * e2) * s, py = (f.y0 + (f.y - f.y0) * e2) * s; c.fillStyle = alphaOf(f.col, (1 - q / 8) * 0.55); c.beginPath(); c.arc(px, py, s * 0.05 * (1 - q / 10), 0, 6.283); c.fill(); }
        c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(hx, hy, s * 0.06, 0, 6.283); c.fill(); continue;
      }
      if (f.k === 'star'){
        const a = Math.sin(Math.PI * u), r = s * f.sz * (0.35 + 0.65 * a), x = f.x * s, y = f.y * s;
        c.save(); c.translate(x, y); c.rotate(f.rot + u * 0.6);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.9); gr.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a) + ')'); gr.addColorStop(1, alphaOf(f.col, 0));
        c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r * 0.9, 0, 6.283); c.fill();
        c.fillStyle = 'rgba(255,255,255,' + (0.95 * a) + ')'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.11, -r * 0.11); c.lineTo(r, 0); c.lineTo(r * 0.11, r * 0.11); c.lineTo(0, r); c.lineTo(-r * 0.11, r * 0.11); c.lineTo(-r, 0); c.lineTo(-r * 0.11, -r * 0.11); c.closePath(); c.fill();
        c.restore(); continue;
      }
      if (f.k === 'sweep'){
        const L = f.cum[f.cum.length - 1], d = L * (1 - Math.pow(1 - u, 2));
        for (let q = 0; q < 7; q++){
          const dd = Math.max(0, d - q * 0.28); let j = 1; while (j < f.cum.length - 1 && f.cum[j] < dd) j++;
          const seg = (f.cum[j] - f.cum[j - 1]) || 1, r = Math.min(1, Math.max(0, (dd - f.cum[j - 1]) / seg));
          const x = (f.pts[j - 1][0] + (f.pts[j][0] - f.pts[j - 1][0]) * r) * s, y = (f.pts[j - 1][1] + (f.pts[j][1] - f.pts[j - 1][1]) * r) * s;
          const rad = s * (0.34 - q * 0.032), a = (1 - q / 7) * (1 - u * u);
          const gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,' + (a * 0.95) + ')'); gr.addColorStop(0.35, alphaOf(f.col, a * 0.55)); gr.addColorStop(1, alphaOf(f.col, 0));
          c.fillStyle = gr; c.beginPath(); c.arc(x, y, rad, 0, 6.283); c.fill();
        }
        continue;
      }
      if (f.k === 'cell'){
        const a = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.42, x = f.x * s, y = f.y * s;
        const gr = c.createRadialGradient(x, y, 0, x, y, s * 0.62); gr.addColorStop(0, alphaOf(f.col, a)); gr.addColorStop(1, alphaOf(f.col, 0));
        c.fillStyle = gr; c.fillRect(x - s * 0.62, y - s * 0.62, s * 1.24, s * 1.24); continue;
      }
      if (f.k === 'trail'){
        f.x += f.vx * dt; f.y += f.vy * dt;
        const x = f.x * s, y = f.y * s, rad = s * 0.09 * (1 - u * 0.5);
        const gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,' + (0.85 * (1 - u)) + ')'); gr.addColorStop(0.4, alphaOf(f.col, 0.5 * (1 - u))); gr.addColorStop(1, alphaOf(f.col, 0));
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, rad, 0, 6.283); c.fill(); continue;
      }
      if (f.k === 'wave'){
        c.strokeStyle = alphaOf(f.col, (1 - u) * 0.55); c.lineWidth = s * 0.16 * (1 - u) + 1;
        c.beginPath(); c.arc(f.x * s, f.y * s, s * f.r1 * (1 - Math.pow(1 - u, 2)), 0, 6.283); c.stroke(); continue;
      }
      if (f.k === 'ring'){
        c.strokeStyle = alphaOf(f.col, (1 - u) * 0.9); c.lineWidth = s * 0.07 * (1 - u) + 1;
        c.beginPath(); c.arc(f.x * s, f.y * s, s * (0.25 + f.r1 * u), 0, 6.283); c.stroke();
      } else if (f.k === 'spark'){
        const px = f.x, py = f.y, drag = Math.max(0, 1 - 1.4 * dt);
        f.vx *= drag; f.vy = f.vy * drag + 3.2 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        const a = Math.pow(1 - u, 1.3);
        c.strokeStyle = alphaOf(f.col, a * 0.8); c.lineWidth = Math.max(1, s * 0.05 * (1 - u * 0.6)); c.lineCap = 'round';
        c.beginPath(); c.moveTo(px * s - f.vx * s * 0.03, py * s - f.vy * s * 0.03); c.lineTo(f.x * s, f.y * s); c.stroke();
        c.fillStyle = 'rgba(255,255,255,' + (a * 0.9) + ')'; c.beginPath(); c.arc(f.x * s, f.y * s, Math.max(0.8, s * 0.018), 0, 6.283); c.fill();
      } else {
        f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        c.save(); c.translate(f.x * s, f.y * s); c.rotate(f.rot); c.scale(1, Math.cos(f.rot * 2.3 + f.x));
        c.fillStyle = alphaOf(f.col, 1 - Math.max(0, u - 0.7) / 0.3);
        c.fillRect(-s * 0.06, -s * 0.03, s * 0.12, s * 0.06); c.restore();
      }
    }
    c.globalCompositeOperation = 'source-over';
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
    moves++; fxSweep(line, '#ffffff'); fxRing(sol[c][0], COLORS[c % COLORS.length], true); fxRing(sol[c][sol[c].length - 1], COLORS[c % COLORS.length], true); Sfx.hint(); buzz(10);
    checkWin(); draw(); updateUI(); if (mp.on) mpSt(true);
    if (!solved) $('msg').textContent = fixed ? '잘못 그은 선을 고쳤어요' : '선 하나를 이어 줬어요';
  };
  $('reset').onclick = () => { if (MODE === 'multi'){ if (solved) return; paths = pairs.map(() => []); active = -1; draw(); updateUI(); mpSt(true); return; } load(levelIdx); };
  $('prev').onclick = () => { if (MODE === 'multi'){ mpLeaveSelf(); return; } load(levelIdx - 1); };
  $('next').onclick = () => { if (MODE === 'random'){ nextRandom(); return; } if (solved || levelIdx < reach()) load(levelIdx + 1); };
  function buildSelect(){
    $('selProg').textContent = Math.min(TOTAL, unlocked + 1) + ' / ' + TOTAL + ' 해금';
    const box = $('grid'); box.textContent = '';
    for (let i = 0; i < TOTAL; i++){
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.className = 'k' + stageParams(i).kind + (i === levelIdx ? ' cur' : '') + (i < unlocked ? ' done' : '');
      b.disabled = i > reach();
      b.onclick = () => { load(i); closeModal($('sel')); };
      box.appendChild(b);
    }
  }
  const closeList = () => closeModal($('sel'));
  $('closeSel').onclick = closeList;
  document.addEventListener('pointerdown', e => { if (!$('sel').hidden && !e.target.closest('#sel') && !e.target.closest('#pick')) closeList(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeList(); });
  $('pick').onclick = () => { if (inMore()) return; const s = $('sel'); if (!s.hidden && !s.classList.contains('out')){ closeModal(s); return; } buildSelect(); openModal(s); const c = $('grid').children[levelIdx]; if (c) c.scrollIntoView({block:'center'}); };
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    Sfx.click(); buzz(6);
    if (reduceFx) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, sp = document.createElement('span');
    sp.className = 'rip'; sp.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(sp); setTimeout(() => sp.remove(), 520);
  });

  // ---------------- 멀티플레이: 같은 방(9자리 코드) 사람들이 한 판을 함께 푼다 ----------------
  // 연결은 아티팩트의 room 기능으로 한다. 이 기능이 없는 곳(내려받은 파일 등)에서는 멀티플레이를 쓸 수 없다.
  const mp = { on: false, nr: null, code: '', band: 'easy', ser: 0, seen: [], go: new Set(), unsubs: [], prev: 'easy', myPeer: null, lastSt: 0, stT: 0, endT: 0 };
  const mpViewers = () => mp.nr ? mp.nr.peers().filter(p => p.kind === 'viewer') : [];
  const mpMe = () => { const p = mpViewers().find(p => p.isMe && p.sameTab); return p ? p.peer : mp.myPeer; };
  // 방장: 이미 판을 받은(presence r=1) 사람 가운데 peer 이름이 가장 앞인 사람. 방장이 나가면 다음 사람이 이어받는다
  const mpHost = () => { if (mp.ser === 0) return false; const me = mpMe(); const v = mpViewers().filter(p => p.peer === me || (p.presence && p.presence.r === 1)).map(p => p.peer).sort(); return !!me && v[0] === me; };
  const mpEmit = (t, extra) => { if (!mp.nr) return; try { mp.nr.emit('mp', Object.assign({ t, ser: mp.ser }, extra)).catch(() => {}); } catch (e) {} };
  const encPaths = () => paths.map(p => p.join('.'));
  function decPaths(a){
    if (!Array.isArray(a) || a.length !== pairs.length) return null;
    const used = new Set(), out = [];
    for (let c = 0; c < a.length; c++){
      const s = a[c]; let p = [];
      if (typeof s === 'string' && s && s.length <= 700) p = s.split('.').map(Number);
      const ok = p.every((x, i) => Number.isInteger(x) && x >= 0 && x < n * n && (i === 0 || neighbors(p[i - 1], n).includes(x)));
      if (!ok || (p.length && endOf[p[0]] !== c)) p = [];
      const q = [];
      for (const x of p){ if (used.has(x) || (endOf[x] !== -1 && endOf[x] !== c)) break; used.add(x); q.push(x); }
      out.push(q);
    }
    return out;
  }
  function adoptPaths(a){
    if (active !== -1 || solved) return;
    const d = decPaths(a); if (!d) return;
    paths = d; draw(); updateUI(); checkWin();
  }
  // 같이 그리기: 내가 긋는 선 하나만 보낸다. 받은 쪽은 그 선을 놓고, 겹치는 다른 선은 자른다 (내가 긋는 선과 겹치면 내 선이 우선)
  function decLine(c, s){
    if (!Number.isInteger(c) || c < 0 || c >= pairs.length || typeof s !== 'string' || s.length > 700) return null;
    const p = s ? s.split('.').map(Number) : [];
    if (!p.every((x, i) => Number.isInteger(x) && x >= 0 && x < n * n && (i === 0 || neighbors(p[i - 1], n).includes(x)))) return null;
    if (p.length && endOf[p[0]] !== c) return null;
    const out = [];
    for (const x of p){ if (endOf[x] !== -1 && endOf[x] !== c) break; if (out.includes(x)) break; out.push(x); }
    return out;
  }
  function applyLine(c, s){
    if (solved) return;
    let p = decLine(c, s); if (!p) return;
    mp.lastIn = performance.now();
    if (active === c) return;
    if (active !== -1){ const mine = new Set(paths[active]); const j = p.findIndex(x => mine.has(x)); if (j !== -1) p = p.slice(0, j); }
    paths[c] = p;
    const on = new Set(p);
    paths.forEach((q, k) => { if (k !== c && k !== active){ const j = q.findIndex(x => on.has(x)); if (j !== -1) paths[k] = q.slice(0, j); } });
    if (p.length){
      const col = COLORS[c % COLORS.length], head = p[p.length - 1];
      fxRing(head, col);
      if (p.length > 1 && endOf[head] === c){ pairs[c].forEach(i => fxBurst(i, col, 12)); popBeads(c); fxSweep(p, col); Sfx.connect(); }
    }
    draw(); updateUI(); if (active === -1) checkWin();
  }
  function mpLine(c, force){
    if (!mp.on || c < 0) return;
    mp.lastIn = performance.now();
    (mp.pend = mp.pend || new Set()).add(c);
    const flush = () => { mp.lastLn = performance.now(); const cs = [...mp.pend]; mp.pend.clear(); cs.forEach(k => { if (paths[k]) mpEmit('ln', { c: k, p: paths[k].join('.') }); }); };
    clearTimeout(mp.lnT);
    if (force){ flush(); return; }
    mp.lnT = setTimeout(flush, Math.max(0, 80 - (performance.now() - (mp.lastLn || 0))));
  }
  function mpSt(force){
    if (!mp.on) return;
    clearTimeout(mp.stT);
    const wait = force ? 0 : Math.max(0, 90 - (performance.now() - mp.lastSt));
    mp.stT = setTimeout(() => { mp.lastSt = performance.now(); mpEmit('st', { p: encPaths() }); }, wait);
  }
  function mpInfo(msg, err){ const el = $('mpInfo'); el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  async function getRoom(){ try { if (!(window.claude && window.claude.use)) return null; return await window.claude.use('room'); } catch (e) { return null; } }

  function applyPuz(d){
    mp.ser = d.ser; mp.band = d.band;
    if (!mp.seen.includes(d.id)) mp.seen.push(d.id);
    mp.go.clear(); clearTimeout(mp.endT);
    closeModal($('mpEnd'));
    rnd = { id: d.id, band: d.band, tier: RTIERS[Math.floor(d.id / TOTAL)], idx: d.id % TOTAL };
    MODE = 'multi';
    renderModes(); load(0);
    tm.running = true; tm.last = performance.now();
    if (mp.nr) mp.nr.presence({ r: 1 }).catch(() => {});
    updateUI();
  }
  function pickMp(){
    const total = RTIERS.length * TOTAL, seen = new Set(mp.seen);
    const inBand = ex => { const a = []; for (let id = 0; id < total; id++) if (!RSKIP.has(id) && bandOf(RRATE[id]) === mp.band && !(ex && seen.has(id))) a.push(id); return a; };
    let pool = inBand(true);
    if (!pool.length){ mp.seen = []; pool = inBand(false); }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function mpNew(){
    const id = pickMp(), ser = mp.ser + 1;
    applyPuz({ ser, id, band: mp.band });
    mpEmit('puz', { id, band: mp.band });
  }
  function mpSendPuz(){ if (mp.ser > 0) mpEmit('puz', { id: rnd.id, band: mp.band, p: encPaths() }); }

  function onMp(m){
    const d = m.data;
    if (!mp.on || !d || typeof d !== 'object') return;
    if (m.sameTab){ mp.myPeer = m.peer; if (d.t !== 'ch') return; }
    switch (d.t){
      case 'hello': if (mp.ser > 0) mpSendPuz(); break;
      case 'puz': {
        const id = d.id, total = RTIERS.length * TOTAL;
        if (!Number.isInteger(d.ser) || !Number.isInteger(id) || id < 0 || id >= total || RSKIP.has(id) || !TIERNAME[d.band]) return;
        if (d.ser < mp.ser) return;
        if (d.ser > mp.ser){ applyPuz(d); if (d.p) adoptPaths(d.p); }
        else if (d.id !== rnd.id && d.ser === mp.ser && m.peer < (mpMe() || '~')) applyPuz(d);   // 동시에 새 판을 골랐으면 peer가 앞선 쪽을 따른다
        else if (d.p && !solved) adoptPaths(d.p);
        break;
      }
      case 'st': if (d.ser === mp.ser && !solved) adoptPaths(d.p); break;
      case 'ln': if (d.ser === mp.ser) applyLine(d.c, d.p); break;
      case 'sy': if (d.ser === mp.ser && !solved && active === -1 && performance.now() - (mp.lastIn || 0) > 2500 && Array.isArray(d.p) && JSON.stringify(d.p) !== JSON.stringify(encPaths())) adoptPaths(d.p); break;
      case 'ch':
        if (d.ser !== mp.ser) return;
        if (d.v === 'stop'){ if (!m.sameTab) mpTerminate('상대가 그만하기를 눌러서 방이 사라졌어요'); }
        else if (d.v === 'go'){ mp.go.add(m.peer); mpEndUpdate(); mpTryNext(); }
        break;
    }
  }
  function mpPeersChanged(ch){
    if (!mp.on) return;
    if (ch.joined.some(p => !p.isMe) && mp.ser > 0){ mpSendPuz(); Sfx.hint(); buzz(8); if (MODE === 'multi') $('msg').textContent = '새 친구가 들어왔어요'; }
    if (MODE === 'multi'){
      updateUI(); mpEndUpdate(); mpTryNext();
      if (ch.left.some(p => !p.isMe)){ $('msg').textContent = '상대가 방을 나갔어요'; Sfx.cut(); }
    }
  }
  function mpWon(){
    const t = Math.round(tm.acc);
    $('msg').textContent = '성공! ' + fmtTime(t);
    $('cbStage').textContent = '멀티 · ' + TIERNAME[rnd.band] + ' · ' + fmtTime(t);
    mp.go.clear();
    const ser = mp.ser;
    clearTimeout(mp.endT);
    mp.endT = setTimeout(() => {
      if (!solved || MODE !== 'multi' || mp.ser !== ser) return;
      $('mpEndTxt').textContent = TIERNAME[rnd.band] + ' · 난이도 ' + rating() + ' · ' + fmtTime(t);
      $('mpGo').disabled = false; $('mpGo').textContent = '계속하기'; $('mpWait').textContent = '';
      openModal($('mpEnd'));
    }, reduceFx ? 300 : 1100);
    updateUI();
  }
  function mpEndUpdate(){
    if ($('mpEnd').hidden) return;
    const me = mpMe();
    if (me && mp.go.has(me)){ $('mpGo').disabled = true; $('mpGo').textContent = '기다리는 중…'; $('mpWait').textContent = '모두 계속하기를 누르면 다음 판이 시작돼요 (' + [...mp.go].filter(x => mpViewers().some(p => p.peer === x)).length + '/' + mpViewers().length + ')'; }
  }
  function mpTryNext(){
    if (!solved || MODE !== 'multi' || $('mpEnd').hidden) return;
    const v = mpViewers();
    if (v.length && v.every(p => mp.go.has(p.peer)) && mpHost()) mpNew();
  }
  $('mpGo').onclick = () => {
    const me = mpMe(); if (me) mp.go.add(me);
    mpEmit('ch', { v: 'go' }); mpEndUpdate(); mpTryNext();
  };
  $('mpStop').onclick = () => { mp.stopping = true; mpEmit('ch', { v: 'stop' }); setTimeout(() => mpTerminate('그만하기를 눌러서 방이 사라졌어요'), 700); };

  function mpClose(){
    clearTimeout(mp.stT); clearTimeout(mp.endT); clearTimeout(mp.lnT); clearInterval(mp.syT);
    mp.unsubs.forEach(f => { try { f(); } catch (e) {} }); mp.unsubs = [];
    const nr = mp.nr; mp.nr = null; mp.on = false; mp.stopping = false; mp.ser = 0; mp.seen = []; mp.go.clear(); mp.myPeer = null;
    if (nr) try { nr.leave().catch(() => {}); } catch (e) {}
    closeModal($('mpEnd'));
  }
  function exitMulti(){ const to = mp.prev || 'easy'; MODE = '__'; switchLevel(to); }
  function mpTerminate(msg){
    if (MODE !== 'multi'){ mpClose(); return; }
    mpClose(); exitMulti(); $('msg').textContent = msg;
  }
  function mpLeaveSelf(){ mpClose(); exitMulti(); $('msg').textContent = '방에서 나갔어요'; }

  // 연결 방법: 1) 기기끼리 직접(WebRTC, 어느 브라우저에서나)  2) 안 되면 아티팩트의 room 기능
  const NOROOM = 'noroom';
  async function mpOpen(code, create){
    let lastErr = null;
    if (typeof DotsP2P !== 'undefined' && DotsP2P.supported()){
      try { return await (create ? DotsP2P.host(code) : DotsP2P.join(code)); } catch (e) { lastErr = e; }
      if (create && lastErr && lastErr.type === 'unavailable-id') throw lastErr;
    }
    const room = await getRoom();
    if (room){
      try { return await room.join('mp-' + code); } catch (e) { lastErr = lastErr || e; }
    }
    throw lastErr || { type: 'unsupported' };
  }
  const mpErr = e => e && e.type === 'peer-unavailable' ? '방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.'
    : e && e.type === 'unsupported' ? '이 브라우저에서는 멀티플레이를 쓸 수 없어요.'
    : '연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.';
  async function mpConnect(code, band, create){
    let nr;
    try { nr = await mpOpen(code, create); } catch (e) { return { err: mpErr(e), e }; }
    mp.prev = MODES.includes(MODE) || MODE === 'random' ? MODE : 'easy';
    mp.nr = nr; mp.on = true; mp.code = code; mp.band = band || 'easy'; mp.ser = 0; mp.seen = []; mp.go.clear();
    mp.unsubs.push(nr.on('mp', onMp, () => {}));
    mp.unsubs.push(nr.onPeers(mpPeersChanged, () => {}));
    mp.syT = setInterval(() => { if (mp.on && mp.ser > 0 && !solved && active === -1 && mpHost() && performance.now() - (mp.lastIn || 0) > 2500) mpEmit('sy', { p: encPaths() }); }, 3000);
    if (nr.onClose) mp.unsubs.push(nr.onClose(() => { if (!mp.on) return; if (MODE === 'multi') mpTerminate(mp.stopping ? '그만하기를 눌러서 방이 사라졌어요' : '방장이 나가서 방이 사라졌어요'); else mpClose(); }));
    return { nr };
  }
  const genCode = () => String(100000000 + Math.floor(Math.random() * 900000000));
  async function mpCreate(band){
    mpInfo('방을 만드는 중…');
    let code, r;
    for (let i = 0; i < 4; i++){
      code = genCode(); r = await mpConnect(code, band, true);
      if (!r.err || !(r.e && r.e.type === 'unavailable-id')) break;
    }
    if (r.err){ mpInfo(r.err, true); return; }
    mpNew();
    closeModal($('mp')); mpInfo('');
    const note = '방 코드 ' + code + ' · 위 칩을 누르면 복사돼요';
    $('msg').textContent = note;
    setTimeout(() => { if (MODE === 'multi' && !solved) $('msg').textContent = note; }, 60);
  }
  async function mpJoinRoom(code){
    mpInfo('방을 찾는 중…');
    const r = await mpConnect(code, null, false);
    if (r.err){ mpInfo(r.err, true); return; }
    const t0 = performance.now();
    while (mp.on && mp.ser === 0 && performance.now() - t0 < 5000){
      mpEmit('hello');
      await new Promise(res => setTimeout(res, 700));
    }
    if (!mp.on) return;
    if (mp.ser === 0){ mpClose(); mpInfo('방을 찾을 수 없어요. 방 코드를 다시 확인해 주세요.', true); return; }
    if (mpViewers().length > 4){ mpClose(); exitMulti(); mpInfo('방이 가득 찼어요 (최대 4명)', true); openModal($('mp')); return; }
    closeModal($('mp')); mpInfo('');
    $('msg').textContent = '방에 들어왔어요 · 함께 선을 이어 보세요';
  }
  // 로비 화면
  function mpView(v){
    $('mpMenu').hidden = v !== 'menu'; $('mpCreateView').hidden = v !== 'create'; $('mpJoinView').hidden = v !== 'join'; mpInfo('');
  }
  let mpBand = 'easy';
  $('goRandom').onclick = () => { closeModal($('modeSheet')); if (MODE === 'multi') mpClose(); MODE === 'random' ? 0 : switchLevel('random'); };
  $('goMulti').onclick = () => {
    closeModal($('modeSheet')); mpView('menu'); openModal($('mp'));
    if (!(typeof DotsP2P !== 'undefined' && DotsP2P.supported()) && !(window.claude && window.claude.use)) mpInfo('이 브라우저에서는 멀티플레이를 쓸 수 없어요.', true);
  };
  $('closeModeSheet').onclick = () => closeModal($('modeSheet'));
  $('modeSheet').addEventListener('pointerdown', e => { if (e.target === $('modeSheet')) closeModal($('modeSheet')); });
  $('closeMp').onclick = () => closeModal($('mp'));
  $('mp').addEventListener('pointerdown', e => { if (e.target === $('mp')) closeModal($('mp')); });
  $('mpCreate').onclick = () => mpView('create');
  $('mpJoin').onclick = () => { mpView('join'); setTimeout(() => $('mpCode').focus(), 50); };
  document.querySelectorAll('.mpBack').forEach(b => { b.onclick = () => mpView('menu'); });
  $('mpBands').querySelectorAll('button').forEach(b => { b.onclick = () => { mpBand = b.dataset.band; $('mpBands').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; });
  $('mpMake').onclick = () => mpCreate(mpBand);
  $('mpCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9); });
  $('mpCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('mpEnter').click(); e.stopPropagation(); });
  $('mpEnter').onclick = () => { const c = $('mpCode').value; if (!/^\d{9}$/.test(c)){ mpInfo('방 코드는 숫자 9자리예요', true); return; } mpJoinRoom(c); };
  $('recBtn').addEventListener('click', e => { if (MODE === 'multi' && navigator.clipboard){ navigator.clipboard.writeText(mp.code).then(() => { $('msg').textContent = '방 코드를 복사했어요'; }).catch(() => {}); } });

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
  function paintSwitches(){ const s = Music.get(); $('tgSfx').setAttribute('aria-pressed', String(s.sfx)); $('tgMotion').setAttribute('aria-pressed', String(reduceFx)); }
  function resetAll(){
    MODES.forEach(m => { unlockedBy[m] = 0; }); unlocked = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    for (const k in hintUsed) delete hintUsed[k];
    rs.seen = []; rs.best = {}; rs.played = 0; rs.solved = {}; saveRandom();
    buildSelect();
    if (MODE === 'random'){ rTierShown = null; nextRandom(); } else if (MODE !== 'multi') load(0);
    $('msg').textContent = '처음부터 다시 시작해요';
  }
  function initSettings(){
    const close = () => closeModal($('settings'));
    $('openSettings').onclick = () => { paintSwitches(); $('confirm').hidden = true; $('resetAll').hidden = false; openModal($('settings')); };
    $('closeSettings').onclick = close;
    const paintCode = () => { $('codeMsg').textContent = cheat ? '스테이지 스킵이 켜졌어요 (나가면 해제)' : ''; $('codeIn').value = ''; };
    $('codeBtn').onclick = () => {
      const v = $('codeIn').value.trim();
      if (v === 'Bang8888@'){ cheat = true; paintCode(); buildSelect(); updateUI(); close(); $('msg').textContent = '스킵 모드: 다음 버튼으로 어느 스테이지든 넘어갈 수 있어요'; }
      else { $('codeMsg').textContent = '코드가 올바르지 않아요'; }
    };
    $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('codeBtn').click(); e.stopPropagation(); });
    $('recBtn').onclick = () => {
      if (MODE === 'multi') return;
      const rows = ['easy', 'normal', 'hard', 'extreme'].map(k => '<div class="srow"><div class="l">' + TIERNAME[k] + '</div><div style="text-align:right;font-variant-numeric:tabular-nums">' + (rs.best[k] != null ? fmtTime(rs.best[k]) : '-') + '<div style="font-size:11px;color:var(--muted);font-weight:600">' + (rs.solved[k] || 0) + '판 클리어</div></div></div>').join('');
      $('recBody').innerHTML = rows + '<p class="hint" style="margin:8px 0 0;font-size:12px;color:var(--muted);text-align:center">힌트를 쓰지 않은 클리어만 기록돼요</p>';
      openModal($('records'));
    };
    $('closeRec').onclick = () => closeModal($('records'));
    $('records').addEventListener('pointerdown', e => { if (e.target === $('records')) closeModal($('records')); });
    $('settings').addEventListener('pointerdown', e => { if (e.target === $('settings')) close(); });
    $('tgSfx').onclick = () => { Music.setSfx(!Music.get().sfx); paintSwitches(); };
    $('tgMotion').onclick = () => { applyMotion(!reduceFx); try { localStorage.setItem('dotsMotion', reduceFx ? '1' : '0'); } catch (e) {} paintSwitches(); };
    $('resetAll').onclick = () => { $('confirm').hidden = false; $('resetAll').hidden = true; };
    $('no').onclick = () => { $('confirm').hidden = true; $('resetAll').hidden = false; };
    $('yes').onclick = () => { resetAll(); close(); };
  }

  document.querySelectorAll('#modes button[data-mode]').forEach(b => { b.onclick = () => { if (b.dataset.mode === 'random') openModal($('modeSheet')); else switchLevel(b.dataset.mode); }; });
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
  $('homeBtn').onclick = () => { if (MODE === 'multi'){ mpClose(); exitMulti(); } if (cheat){ cheat = false; $('codeMsg').textContent = ''; load(Math.min(levelIdx, unlocked)); buildSelect(); } document.body.classList.remove('in-game'); $('home').hidden = false; starting = false; };
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
