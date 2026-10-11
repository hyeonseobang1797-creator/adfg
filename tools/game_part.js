// ---------------- 게임 ----------------
if (typeof document !== 'undefined') (function(){
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  let levelIdx = 0, n, sol, pairs, endOf, paths, active = -1, moves = 0, solved = false, kind = 0;
  let unlocked = 0;   // 현재 난이도에서 연 스테이지. 로그아웃 상태에서는 저장하지 않는다
  const unlockedBy = { easy: 0, normal: 0, hard: 0, extreme: 0 };
  const MODES = ['easy', 'normal', 'hard', 'extreme'];
  function renderModes(){ document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === MODE)); }
  function switchLevel(m){
    if (m === MODE) return;
    unlockedBy[MODE] = unlocked; MODE = m; unlocked = unlockedBy[m];
    try { localStorage.setItem('dotsMode', m); } catch (e) {}
    renderModes(); buildSelect(); load(unlocked);
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
    moves++; checkWin(); draw(); updateUI();
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
  // ---------------- 계정 ----------------
  let db = null, account = null;   // account = { key, name, hash }
  const AUTO = 'dotsAuto';
  const enc = new TextEncoder();
  const hex = u8 => Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyOf = name => 'u' + hex(enc.encode(name.toLowerCase()));
  function cheapHash(str){
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57, out = '';
    for (let r = 0; r < 4000; r++)
      for (let i = 0; i < str.length; i++){
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
      }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    out = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
    return out;
  }
  async function hashPw(name, pw, salt){
    if (!(window.crypto && crypto.subtle)) return 'c' + cheapHash(salt + name.toLowerCase() + pw);
    const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt + name.toLowerCase()), iterations: 100000 }, k, 256);
    return hex(new Uint8Array(bits));
  }
  function saveProgress(v){
    if (!account || !db) return;
    db.doc('accounts/' + account.key).update({ ['prog_' + MODE]: v }).catch(() => { $('msg').textContent = '진행 저장에 실패했어요'; });
  }
  function setAuto(on){
    try {
      if (on && account) localStorage.setItem(AUTO, JSON.stringify({ key: account.key, hash: account.hash }));
      else localStorage.removeItem(AUTO);
    } catch (e) {}
  }
  function autoOn(){ try { return !!localStorage.getItem(AUTO); } catch (e) { return false; } }
  function renderAcct(){
    const out = !account;
    $('guestBox').hidden = !out;
    $('userBox').hidden = out;
    if (!out){ $('who').textContent = account.name; $('auto').checked = autoOn(); }
    $('guestBox').querySelector('button').disabled = !db;
    $('note').textContent = out ? (db ? '로그아웃 상태에서는 진행이 저장되지 않아요' : '이 화면에서는 로그인을 쓸 수 없어요') : '진행이 자동으로 저장돼요';
  }
  function enter(acc, data, auto){
    account = acc;
    MODES.forEach(m => { unlockedBy[m] = Math.min(TOTAL - 1, +data['prog_' + m] || (m === 'extreme' ? +data.unlocked : 0) || 0); });
    unlocked = unlockedBy[MODE];
    setAuto(auto); renderAcct(); buildSelect(); load(unlocked);
  }
  function logout(){
    account = null; setAuto(false); unlocked = 0; MODES.forEach(m => { unlockedBy[m] = 0; });
    renderAcct(); buildSelect(); load(0);
  }
  let mode = 'login';
  function setMode(m){
    mode = m;
    $('tabLogin').classList.toggle('on', m === 'login');
    $('tabSignup').classList.toggle('on', m === 'signup');
    $('pw2row').hidden = m !== 'signup';
    $('go').textContent = m === 'login' ? '로그인' : '회원가입';
    $('err').textContent = '';
  }
  async function submitAuth(e){
    e.preventDefault();
    const name = $('uid').value.trim(), pw = $('pw').value, err = $('err');
    err.textContent = '';
    if (!db){ err.textContent = '로그인을 쓸 수 없어요'; return; }
    if (!/^[A-Za-z0-9_가-힣]{2,16}$/.test(name)){ err.textContent = '아이디는 2~16자의 글자, 숫자, _ 만 쓸 수 있어요'; return; }
    if (pw.length < 4){ err.textContent = '비밀번호는 4자 이상이어야 해요'; return; }
    $('go').disabled = true;
    try {
      const ref = db.doc('accounts/' + keyOf(name)), snap = await ref.get();
      if (mode === 'signup'){
        if (pw !== $('pw2').value){ err.textContent = '비밀번호가 서로 달라요'; return; }
        if (snap.exists){ err.textContent = '이미 있는 아이디예요'; return; }
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await hashPw(name, pw, salt);
        await ref.set({ name, salt, hash, unlocked: 0, created: Date.now() });
        enter({ key: keyOf(name), name, hash }, { unlocked: 0 }, $('autoNew').checked);
      } else {
        const d = snap.exists && snap.data();
        const hash = d ? await hashPw(d.name, pw, d.salt) : '';
        if (!d || hash !== d.hash){ err.textContent = '아이디 또는 비밀번호가 맞지 않아요'; return; }
        enter({ key: keyOf(name), name: d.name, hash }, d, $('autoNew').checked);
      }
      $('auth').hidden = true; $('pw').value = ''; $('pw2').value = '';
    } catch (ex) {
      err.textContent = '처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요';
    } finally { $('go').disabled = false; }
  }
  $('openAuth').onclick = () => { setMode('login'); $('auth').hidden = false; $('uid').focus(); };
  $('closeAuth').onclick = () => { $('auth').hidden = true; };
  $('tabLogin').onclick = () => setMode('login');
  $('tabSignup').onclick = () => setMode('signup');
  $('authForm').addEventListener('submit', submitAuth);
  $('logout').onclick = logout;
  $('auto').onchange = e => setAuto(e.target.checked);

  document.querySelectorAll('#modes button').forEach(b => { b.onclick = () => switchLevel(b.dataset.mode); });
  renderModes();
  load(0);
  renderAcct();
  (async function initAuth(){
    try {
      db = window.claude && window.claude.use ? await window.claude.use('db') : null;
    } catch (e) { db = null; }
    renderAcct();
    if (!db) return;
    try {
      const saved = JSON.parse(localStorage.getItem(AUTO) || 'null');
      if (!saved) return;
      const snap = await db.doc('accounts/' + saved.key).get();
      const d = snap.exists && snap.data();
      if (d && d.hash === saved.hash) enter({ key: saved.key, name: d.name, hash: d.hash }, d, true);
      else setAuto(false);
    } catch (e) {}
  })();
})();
