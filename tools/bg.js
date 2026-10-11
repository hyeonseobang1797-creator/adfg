// ---------------- 계절 배경 ----------------
const SEASON = { easy: 'summer', normal: 'spring', hard: 'autumn', extreme: 'winter' };
const SKY = {
  summer: ['#0a3f66', '#2a8fbf', '#8fd3e0'],
  spring: ['#3b2f66', '#a8628f', '#f2b8c0'],
  autumn: ['#241528', '#9a4a2c', '#f0a050'],
  winter: ['#040a1a', '#0e2250', '#34609a']
};
const Bg = (() => {
  const cv = document.createElement('canvas');
  cv.id = 'bg';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;background:none;border-radius:0;aspect-ratio:auto;max-width:none';
  document.body.insertBefore(cv, document.body.firstChild);
  const g = cv.getContext('2d');
  const scene = document.createElement('canvas'), sg = scene.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lcg = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  let W = 0, H = 0, D = 1, season = 'summer', parts = [], clouds = [], stars = [], gulls = [], raf = 0, last = 0;

  // ----- 그리기 도우미 -----
  function hills(c, y0, amp, f, ph, top, bot){
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.4);
    c.lineTo(W, H); c.closePath();
    const gr = c.createLinearGradient(0, y0 - amp, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    c.fillStyle = gr; c.fill();
  }
  function roundTree(c, x, base, h, cols, r){
    c.fillStyle = '#3a2417';
    c.beginPath(); c.moveTo(x - h * 0.035, base); c.lineTo(x - h * 0.02, base - h * 0.5); c.lineTo(x + h * 0.02, base - h * 0.5); c.lineTo(x + h * 0.035, base); c.fill();
    for (let i = 0; i < 46; i++){
      const a = r() * 6.283, d = Math.sqrt(r());
      const cx = x + Math.cos(a) * d * h * 0.34, cy = base - h * 0.64 + Math.sin(a) * d * h * 0.32, rr = h * (0.06 + r() * 0.09);
      c.globalAlpha = 0.88; c.fillStyle = cols[Math.floor(r() * cols.length)];
      c.beginPath(); c.arc(cx, cy, rr, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  }
  function pine(c, x, base, h, snow){
    c.fillStyle = '#2b1d14'; c.fillRect(x - h * 0.03, base - h * 0.12, h * 0.06, h * 0.12);
    for (let i = 0; i < 4; i++){
      const w = h * (0.34 - i * 0.07), y = base - h * (0.1 + i * 0.22), t = y - h * 0.3;
      c.fillStyle = i % 2 ? '#0f3a3f' : '#0c3236';
      c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, t); c.lineTo(x + w, y); c.closePath(); c.fill();
      if (snow){ c.fillStyle = 'rgba(235,245,255,0.92)'; c.beginPath(); c.moveTo(x - w * 0.62, y - (y - t) * 0.38); c.lineTo(x, t); c.lineTo(x + w * 0.62, y - (y - t) * 0.38); c.quadraticCurveTo(x + w * 0.2, y - (y - t) * 0.5, x, y - (y - t) * 0.42); c.quadraticCurveTo(x - w * 0.2, y - (y - t) * 0.5, x - w * 0.62, y - (y - t) * 0.38); c.fill(); }
    }
  }
  function palm(c, x, base, h){
    c.strokeStyle = '#4a3320'; c.lineWidth = h * 0.045; c.lineCap = 'round';
    const tx = x + h * 0.22, ty = base - h;
    c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + h * 0.02, base - h * 0.55, tx, ty); c.stroke();
    for (let i = 0; i < 8; i++){
      const a = -3.4 + i * 0.52, len = h * (0.34 + (i % 2) * 0.06);
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.45 + len * 0.35;
      c.fillStyle = i % 2 ? '#0f5a3a' : '#157047';
      c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.5 - len * 0.2, ex, ey);
      c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.3 + len * 0.12, tx, ty); c.fill();
    }
  }
  function cherry(c, x, base, h, r){
    c.strokeStyle = '#3b2620'; c.lineCap = 'round';
    c.lineWidth = h * 0.05; c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x - h * 0.04, base - h * 0.35, x + h * 0.02, base - h * 0.6); c.stroke();
    c.lineWidth = h * 0.025;
    for (const s of [-1, 1]){ c.beginPath(); c.moveTo(x, base - h * 0.4); c.quadraticCurveTo(x + s * h * 0.15, base - h * 0.55, x + s * h * 0.3, base - h * 0.68); c.stroke(); }
    const cols = ['#ffc2d6', '#ffa8c5', '#ffd9e6', '#f78fb3', '#ffe8f0'];
    for (let i = 0; i < 90; i++){
      const a = r() * 6.283, d = Math.sqrt(r());
      const cx = x + Math.cos(a) * d * h * 0.42, cy = base - h * 0.66 + Math.sin(a) * d * h * 0.3, rr = h * (0.025 + r() * 0.05);
      c.globalAlpha = 0.85; c.fillStyle = cols[Math.floor(r() * 5)];
      c.beginPath(); c.arc(cx, cy, rr, 0, 6.283); c.fill();
    }
    c.globalAlpha = 1;
  }
  function cloud(c, x, y, s, a, tint){
    for (let k = 0; k < 6; k++){
      const cx = x + (k - 2.5) * s * 0.5, cy = y + Math.sin(k * 1.7) * s * 0.12, rr = s * (0.5 + 0.16 * Math.sin(k * 2.3));
      const gr = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, 'rgba(' + tint + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + tint + ',0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rr, 0, 6.283); c.fill();
    }
  }

  // ----- 풍경(크기가 바뀔 때만 한 번 그린다) -----
  function buildScene(){
    scene.width = cv.width; scene.height = cv.height;
    sg.setTransform(D, 0, 0, D, 0, 0); sg.clearRect(0, 0, W, H);
    const r = lcg(season.charCodeAt(0) * 977), hz = H * 0.7;
    if (season === 'summer'){
      sg.fillStyle = 'rgba(30,110,125,0.55)'; hills(sg, hz - 8, 7, 0.011, 1, 'rgba(30,110,125,0.55)', 'rgba(30,110,125,0.55)');
      const sea = sg.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#1aa0bd'); sea.addColorStop(0.5, '#0d6f93'); sea.addColorStop(1, '#06344f');
      sg.fillStyle = sea; sg.fillRect(0, hz, W, H - hz);
      const hg = sg.createLinearGradient(0, hz - 24, 0, hz + 14); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.7, 'rgba(255,255,255,0.35)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = hg; sg.fillRect(0, hz - 24, W, 38);
      for (let i = 0; i < 16; i++){
        const k = i / 15, y = hz + (H - hz) * Math.pow(k, 1.6) + 6;
        sg.strokeStyle = 'rgba(255,255,255,' + (0.06 + 0.12 * k) + ')'; sg.lineWidth = 1 + k * 1.6;
        sg.beginPath(); for (let x = 0; x <= W; x += 10) sg.lineTo(x, y + Math.sin(x * (0.02 - k * 0.008) + i * 1.7) * (1 + k * 3)); sg.stroke();
      }
      hills(sg, H * 0.935, 9, 0.012, 2, '#e8c98a', '#b08850');
      palm(sg, W * 0.1, H * 0.95, Math.min(H * 0.34, 300));
      palm(sg, W * 0.9, H * 0.96, Math.min(H * 0.26, 230));
    } else if (season === 'spring'){
      hills(sg, H * 0.62, 18, 0.007, 0.5, 'rgba(140,190,170,0.75)', 'rgba(90,150,130,0.75)');
      hills(sg, H * 0.72, 22, 0.009, 2.2, '#5aa56a', '#2f7149');
      cherry(sg, W * 0.78, H * 0.8, Math.min(H * 0.36, 320), r);
      hills(sg, H * 0.84, 16, 0.011, 4, '#3d8a50', '#1b4d2f');
      cherry(sg, W * 0.12, H * 0.9, Math.min(H * 0.42, 380), r);
      hills(sg, H * 0.94, 10, 0.014, 1, '#2f7a44', '#14391f');
      for (let i = 0; i < 70; i++){ sg.fillStyle = ['#ffffff', '#ffd1e6', '#fff2a8', '#ffb3d1'][Math.floor(r() * 4)]; sg.globalAlpha = 0.9; sg.beginPath(); sg.arc(r() * W, H * 0.94 + r() * H * 0.06, 1.5 + r() * 1.8, 0, 6.283); sg.fill(); }
      sg.globalAlpha = 1;
    } else if (season === 'autumn'){
      hills(sg, H * 0.63, 20, 0.007, 0.8, 'rgba(160,80,50,0.8)', 'rgba(110,50,30,0.8)');
      const cols = ['#e8791d', '#d1451b', '#f2b134', '#b23a14', '#f4c04a'];
      for (let i = 0; i < 7; i++) roundTree(sg, W * (0.06 + i * 0.15 + r() * 0.05), H * (0.76 + r() * 0.03), H * (0.2 + r() * 0.08), cols, r);
      hills(sg, H * 0.82, 16, 0.01, 3, '#8a4a1e', '#3d1f0c');
      roundTree(sg, W * 0.82, H * 0.92, Math.min(H * 0.4, 360), cols, r);
      roundTree(sg, W * 0.1, H * 0.95, Math.min(H * 0.34, 300), cols, r);
      hills(sg, H * 0.95, 8, 0.015, 1, '#5a2b10', '#26120a');
      for (let i = 0; i < 90; i++){ sg.save(); sg.translate(r() * W, H * 0.93 + r() * H * 0.07); sg.rotate(r() * 6.28); sg.fillStyle = cols[Math.floor(r() * 5)]; sg.beginPath(); sg.ellipse(0, 0, 4 + r() * 4, 2 + r() * 2, 0, 0, 6.283); sg.fill(); sg.restore(); }
    } else {
      hills(sg, H * 0.64, 22, 0.006, 0.4, 'rgba(150,180,215,0.85)', 'rgba(100,135,180,0.85)');
      for (let i = 0; i < 9; i++) pine(sg, W * (0.04 + i * 0.12 + r() * 0.04), H * (0.74 + r() * 0.03), H * (0.13 + r() * 0.07), true);
      hills(sg, H * 0.78, 18, 0.009, 2.4, '#dfeaf6', '#9db5d3');
      // 작은 오두막
      const cx = W * 0.8, cy = H * 0.855, w = Math.min(W * 0.14, 120);
      sg.fillStyle = '#3a2a22'; sg.fillRect(cx - w / 2, cy - w * 0.45, w, w * 0.45);
      sg.fillStyle = '#e9f2fb'; sg.beginPath(); sg.moveTo(cx - w * 0.62, cy - w * 0.45); sg.lineTo(cx, cy - w * 0.95); sg.lineTo(cx + w * 0.62, cy - w * 0.45); sg.closePath(); sg.fill();
      const wg = sg.createRadialGradient(cx, cy - w * 0.22, 0, cx, cy - w * 0.22, w * 0.5); wg.addColorStop(0, 'rgba(255,200,90,0.55)'); wg.addColorStop(1, 'rgba(255,200,90,0)');
      sg.fillStyle = wg; sg.fillRect(cx - w, cy - w, w * 2, w * 1.2);
      sg.fillStyle = '#ffd36b'; sg.fillRect(cx - w * 0.12, cy - w * 0.32, w * 0.24, w * 0.2);
      hills(sg, H * 0.9, 12, 0.011, 1.2, '#f2f7fc', '#b6c9e0');
      for (let i = 0; i < 4; i++) pine(sg, W * (0.06 + i * 0.07 + r() * 0.03), H * (0.93 + r() * 0.03), H * (0.2 + r() * 0.08), true);
    }
    // 위쪽을 어둡게 눌러 제목과 버튼 글자가 잘 보이게 한다
    const ov = sg.createLinearGradient(0, 0, 0, H * 0.62); ov.addColorStop(0, 'rgba(5,8,20,0.55)'); ov.addColorStop(1, 'rgba(5,8,20,0)');
    sg.fillStyle = ov; sg.fillRect(0, 0, W, H);
  }

  // ----- 떨어지는 것들의 모양 -----
  function petal(c, s, flip){
    c.scale(Math.max(0.25, Math.abs(flip)), 1);
    const gr = c.createLinearGradient(0, -s, 0, s); gr.addColorStop(0, '#ffe3ee'); gr.addColorStop(1, '#ff9fc2');
    c.fillStyle = gr; c.beginPath();
    c.moveTo(0, s); c.bezierCurveTo(-s * 1.1, s * 0.3, -s * 0.9, -s * 0.9, -s * 0.14, -s); c.lineTo(0, -s * 0.76); c.lineTo(s * 0.14, -s);
    c.bezierCurveTo(s * 0.9, -s * 0.9, s * 1.1, s * 0.3, 0, s); c.fill();
  }
  const MAPLE = [[0, -1], [0.14, -0.62], [0.42, -0.78], [0.36, -0.3], [0.9, -0.4], [0.62, 0], [0.84, 0.3], [0.3, 0.22], [0.1, 0.62]];
  function leaf(c, s, col, kind, flip){
    c.scale(Math.max(0.3, Math.abs(flip)), 1);
    c.fillStyle = col; c.beginPath();
    if (kind){
      c.moveTo(0, -s); MAPLE.forEach(p => c.lineTo(p[0] * s, p[1] * s)); c.lineTo(0, s * 0.78);
      for (let i = MAPLE.length - 1; i >= 0; i--) c.lineTo(-MAPLE[i][0] * s, MAPLE[i][1] * s);
    } else {
      c.moveTo(0, -s); c.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.8, s * 0.5, 0, s * 0.8); c.bezierCurveTo(-s * 0.8, s * 0.5, -s * 0.9, -s * 0.5, 0, -s);
    }
    c.fill();
    c.strokeStyle = 'rgba(70,25,5,0.55)'; c.lineWidth = Math.max(0.8, s * 0.07);
    c.beginPath(); c.moveTo(0, -s * 0.8); c.lineTo(0, s * 1.05); c.stroke();
  }
  function flake(c, r){
    if (r < 2.6){
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r * 1.8, 0, 6.283); c.fill(); return;
    }
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1; c.lineCap = 'round';
    const L = r * 2.2;
    for (let i = 0; i < 6; i++){
      c.save(); c.rotate(i * Math.PI / 3);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -L); c.moveTo(0, -L * 0.55); c.lineTo(-L * 0.28, -L * 0.8); c.moveTo(0, -L * 0.55); c.lineTo(L * 0.28, -L * 0.8); c.stroke();
      c.restore();
    }
  }
  function gull(c, x, y, s, t){
    const f = Math.sin(t / 220) * s * 0.35;
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - s, y - f); c.quadraticCurveTo(x - s * 0.4, y - s * 0.45 - f, x, y); c.quadraticCurveTo(x + s * 0.4, y - s * 0.45 - f, x + s, y - f); c.stroke();
  }

  // ----- 움직이는 것들 -----
  function make(){
    const n = Math.max(22, Math.min(60, Math.round(W * H / 26000)));
    parts = [];
    for (let i = 0; i < n; i++){
      const p = { x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1.2, 1.2), tum: rnd(0, 6.28), tv: rnd(1.5, 3.5) };
      if (season === 'summer'){ p.r = rnd(1.5, 3.2); p.vy = -rnd(8, 22); p.a = rnd(0.35, 0.8); }
      else if (season === 'spring'){ p.s = rnd(5, 8); p.vy = rnd(24, 44); }
      else if (season === 'autumn'){ p.s = rnd(8, 13); p.vy = rnd(34, 62); p.c = ['#e8791d', '#d1451b', '#f2b134', '#b23a14'][i % 4]; p.k = i % 3 === 0 ? 0 : 1; }
      else { p.r = rnd(1.2, 4.4); p.vy = rnd(16, 46); }
      parts.push(p);
    }
    clouds = [];
    for (let i = 0; i < 5; i++) clouds.push({ x: rnd(0, W), y: rnd(H * 0.06, H * 0.34), s: rnd(50, 110), v: rnd(4, 11) });
    stars = [];
    for (let i = 0; i < 90; i++) stars.push({ x: rnd(0, W), y: rnd(0, H * 0.55), r: rnd(0.4, 1.4), ph: rnd(0, 6.28) });
    gulls = [];
    for (let i = 0; i < 3; i++) gulls.push({ x: rnd(0, W), y: rnd(H * 0.12, H * 0.4), s: rnd(7, 12), v: rnd(18, 32) });
  }
  function sky(t){
    if (season === 'summer'){
      const sx = W * 0.8, sy = H * 0.18;
      const gl = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(220, W * 0.4)); gl.addColorStop(0, 'rgba(255,236,160,0.6)'); gl.addColorStop(1, 'rgba(255,236,160,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      g.save(); g.translate(sx, sy); g.rotate(t / 20000);
      for (let i = 0; i < 12; i++){ g.rotate(Math.PI / 6); g.fillStyle = 'rgba(255,240,180,0.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-18, -Math.max(W, H)); g.lineTo(18, -Math.max(W, H)); g.fill(); }
      g.restore();
      g.fillStyle = '#fff7cf'; g.beginPath(); g.arc(sx, sy, 34, 0, 6.283); g.fill();
    } else if (season === 'autumn'){
      const sx = W * 0.68, sy = H * 0.66;
      const gl = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(260, W * 0.5)); gl.addColorStop(0, 'rgba(255,170,70,0.7)'); gl.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,214,140,0.9)'; g.beginPath(); g.arc(sx, sy, 40, 0, 6.283); g.fill();
    } else if (season === 'winter'){
      for (const s of stars){ g.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.5 * Math.abs(Math.sin(t / 900 + s.ph))) + ')'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); }
      const mx = W * 0.8, my = H * 0.16;
      const gl = g.createRadialGradient(mx, my, 0, mx, my, 130); gl.addColorStop(0, 'rgba(210,225,255,0.45)'); gl.addColorStop(1, 'rgba(210,225,255,0)');
      g.fillStyle = gl; g.fillRect(mx - 140, my - 140, 280, 280);
      g.fillStyle = '#f2f6ff'; g.beginPath(); g.arc(mx, my, 26, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(160,175,205,0.35)'; for (const c of [[-8, -6, 6], [7, 5, 5], [-3, 10, 3.5]]){ g.beginPath(); g.arc(mx + c[0], my + c[1], c[2], 0, 6.283); g.fill(); }
    }
    if (season !== 'winter'){
      const tint = season === 'spring' ? '255,225,235' : season === 'autumn' ? '255,215,170' : '255,255,255';
      for (const c of clouds) cloud(g, c.x, c.y, c.s, season === 'summer' ? 0.5 : 0.32, tint);
    }
  }
  function drawParts(t){
    for (const p of parts){
      const x = p.x + Math.sin(t / 1300 + p.ph) * 20;
      g.save(); g.translate(x, p.y); g.rotate(p.rot);
      const flip = Math.cos(p.tum + t / 1000 * p.tv);
      if (season === 'summer'){
        g.rotate(-p.rot);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.r * 2.4); gr.addColorStop(0, 'rgba(255,248,200,' + p.a + ')'); gr.addColorStop(1, 'rgba(255,248,200,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.r * 2.4, 0, 6.283); g.fill();
      } else if (season === 'spring') petal(g, p.s, flip);
      else if (season === 'autumn') leaf(g, p.s, p.c, p.k, flip);
      else flake(g, p.r);
      g.restore();
    }
    if (season === 'summer') for (const b of gulls) gull(g, b.x, b.y, b.s, t);
  }
  function frame(t){
    g.clearRect(0, 0, W, H);
    sky(t);
    g.drawImage(scene, 0, 0, W, H);
    drawParts(t);
  }
  function step(t){
    raf = requestAnimationFrame(step);
    if (t - last < 33) return;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    for (const p of parts){
      p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.vy > 0 && p.y > H + 24){ p.y = -24; p.x = rnd(0, W); }
      if (p.vy < 0 && p.y < -24){ p.y = H + 24; p.x = rnd(0, W); }
    }
    for (const c of clouds){ c.x += c.v * dt; if (c.x - c.s * 2 > W) c.x = -c.s * 2; }
    for (const b of gulls){ b.x += b.v * dt; if (b.x > W + 30) b.x = -30; }
    frame(t);
  }
  function resize(){
    D = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    g.setTransform(D, 0, 0, D, 0, 0);
    buildScene();
  }
  function set(s){
    season = s;
    const c = SKY[s];
    document.body.style.background = 'linear-gradient(180deg,' + c[0] + ',' + c[1] + ' 55%,' + c[2] + ') fixed';
    document.body.style.backgroundColor = c[1];
    resize(); make();
    cancelAnimationFrame(raf);
    if (reduce) frame(0); else { last = 0; raf = requestAnimationFrame(step); }
  }
  window.addEventListener('resize', () => { resize(); make(); if (reduce) frame(0); });
  return { set };
})();

