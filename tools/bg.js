// ---------------- 계절 배경 ----------------
const SEASON = { easy: 'summer', normal: 'spring', hard: 'autumn', extreme: 'winter' };
const SKY = {
  summer: ['#1f6fc4', '#6fb8ea', '#dff3fb'],
  spring: ['#5f9ede', '#b9d8ef', '#fde9e4'],
  autumn: ['#3a4f86', '#d9895a', '#ffd69c'],
  winter: ['#6c96cf', '#b4cdea', '#eaf2fb']
};
const Bg = (() => {
  // 세 장의 캔버스를 겹친다: 하늘(느리게 갱신) / 풍경(크기가 바뀔 때만 그림) / 앞(떨어지는 것들)
  const mk = id => {
    const c = document.createElement('canvas');
    c.id = id; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;background:none;border-radius:0;aspect-ratio:auto;max-width:none';
    return c;
  };
  const cvSky = mk('bgSky'), cvNight = mk('bgNight'), scene = mk('bgScene'), dusk = mk('bgDusk'), cv = mk('bgFront');
  [cvNight, dusk].forEach(l => { l.style.opacity = '0'; l.style.transition = 'opacity 4s ease-in-out'; });
  document.body.insertBefore(cv, document.body.firstChild);
  document.body.insertBefore(dusk, cv);
  document.body.insertBefore(scene, dusk);
  document.body.insertBefore(cvNight, scene);
  document.body.insertBefore(cvSky, cvNight);
  const g = cv.getContext('2d'), gs = cvSky.getContext('2d'), sg = scene.getContext('2d'), gn = cvNight.getContext('2d'), gd = dusk.getContext('2d');
  const nightBase = document.createElement('canvas'), nb = nightBase.getContext('2d');
  const skyBase = document.createElement('canvas'), sb = skyBase.getContext('2d');
  const aurora = document.createElement('canvas'), au = aurora.getContext('2d');
  const sprites = new Map();
  function sprite(key, size, fn){
    let s = sprites.get(key);
    if (!s){ s = document.createElement('canvas'); s.width = s.height = size; const c = s.getContext('2d'); c.translate(size / 2, size / 2); fn(c); sprites.set(key, s); }
    return s;
  }
  let reduce = false;   // 모션 줄이기: 설정에서 정한다
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lcg = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const D = 1;   // 배경은 흐려도 괜찮으니 해상도를 1배로 고정해 폰이 버겁지 않게 한다
  let W = 0, H = 0, mist = null, flies = [], cabin = null, season = 'summer', parts = [], clouds = [], gulls = [], raf = 0, lastP = 0, lastS = 0, hasBase = false;

  // ----- 그리기 도우미 -----
  // 부드러운 1차원 노이즈: 산등성이와 언덕의 윤곽을 자연스럽게 만든다
  function noiseFn(seed){
    const r = lcg(seed), v = []; for (let i = 0; i < 256; i++) v.push(r());
    const sm = t => t * t * (3 - 2 * t);
    return x => { const i = Math.floor(x), f = sm(x - i); return v[i & 255] * (1 - f) + v[(i + 1) & 255] * f; };
  }
  function ridgeY(nf, x, y0, amp, scale, ridged){
    let s = 0, a = 1, f = scale, tot = 0;
    for (let o = 0; o < 5; o++){ let n = nf(x * f + o * 17.3); if (ridged) n = 1 - Math.abs(2 * n - 1); s += n * a; tot += a; a *= 0.5; f *= 2.1; }
    return y0 - (s / tot - 0.5) * amp * 2;
  }
  // 산/언덕 한 겹. fog는 하늘색으로 아래쪽을 흐리게 만들어 거리감을 준다.
  function layer(c, o){
    const nf = noiseFn(o.seed), pts = [];
    c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W + 6; x += 6){ const y = ridgeY(nf, x, o.y0, o.amp, o.scale, o.ridged); pts.push([x, y]); c.lineTo(x, y); }
    c.lineTo(W, H); c.closePath();
    const gr = c.createLinearGradient(0, o.y0 - o.amp, 0, H); gr.addColorStop(0, o.top); gr.addColorStop(1, o.bot);
    c.fillStyle = gr; c.fill();
    if (o.snow){
      c.save(); c.clip();
      const sy = o.y0 - o.amp * o.snow;
      c.beginPath(); c.moveTo(0, 0);
      for (let x = 0; x <= W + 6; x += 6) c.lineTo(x, sy + (nf(x * 0.05 + 40) - 0.5) * o.amp * 0.5);
      c.lineTo(W, 0); c.closePath();
      const sg2 = c.createLinearGradient(0, o.y0 - o.amp, 0, sy + o.amp * 0.3); sg2.addColorStop(0, 'rgba(255,255,255,0.97)'); sg2.addColorStop(1, 'rgba(225,236,250,0.85)');
      c.fillStyle = sg2; c.fill(); c.restore();
    }
    if (o.fog){
      const fg = c.createLinearGradient(0, o.y0 - o.amp, 0, o.y0 + o.amp * 1.2); fg.addColorStop(0, 'rgba(' + o.fog + ',0)'); fg.addColorStop(1, 'rgba(' + o.fog + ',' + (o.fogA || 0.5) + ')');
      c.fillStyle = fg; c.fillRect(0, o.y0 - o.amp, W, o.amp * 2.4);
    }
    return { nf, y: x => ridgeY(nf, x, o.y0, o.amp, o.scale, o.ridged) };
  }
  // 굵기가 점점 가늘어지는 굽은 가지
  function bough(c, x1, y1, cx, cy, x2, y2, w1, w2, col){
    const N = 8, L = [], R = [];
    for (let i = 0; i <= N; i++){
      const t = i / N, mt = 1 - t;
      const px = mt * mt * x1 + 2 * mt * t * cx + t * t * x2, py = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
      const dx = 2 * mt * (cx - x1) + 2 * t * (x2 - cx), dy = 2 * mt * (cy - y1) + 2 * t * (y2 - cy);
      const d = Math.hypot(dx, dy) || 1, w = (w1 + (w2 - w1) * t) / 2;
      L.push([px - dy / d * w, py + dx / d * w]); R.push([px + dy / d * w, py - dx / d * w]);
    }
    c.fillStyle = col; c.beginPath(); c.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= N; i++) c.lineTo(L[i][0], L[i][1]);
    for (let i = N; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
    c.closePath(); c.fill();
  }
  function grow(c, x, y, ang, len, w, depth, o, r, tips){
    if (depth === 0 || len < 2){ tips.push([x, y]); return; }
    const bend = (r() - 0.5) * 0.5, a = ang + bend * 0.5;
    const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
    const mx = x + Math.sin(ang) * len * 0.55, my = y - Math.cos(ang) * len * 0.55;
    const shade = Math.round(48 + depth * 4 + r() * 10);
    bough(c, x, y, mx, my, x2, y2, w, Math.max(0.7, w * 0.66), 'rgb(' + shade + ',' + Math.round(shade * 0.72) + ',' + Math.round(shade * 0.55) + ')');
    if (depth <= o.leafDepth) tips.push([x2, y2]);
    const n = depth > 2 && r() < o.fork3 ? 3 : 2;
    for (let i = 0; i < n; i++){
      let na = ang + (i - (n - 1) / 2) * o.spread * (0.7 + r() * 0.6) + (r() - 0.5) * 0.3;
      na *= 0.92;   // 위쪽(빛)을 향해 조금씩 곧게 자란다
      grow(c, x2, y2, na, len * (o.ratio + r() * 0.1), w * 0.66, depth - 1, o, r, tips);
    }
  }
  // 나무 한 그루: 줄기와 가지를 재귀로 뻗고, 끝마다 잎 덩어리를 어두운 층 → 밝은 층 순서로 쌓는다
  function tree(c, x, base, h, o, r){
    // 그림자
    const sh = c.createRadialGradient(x, base, 0, x, base, h * 0.45); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.translate(0, base); c.scale(1, 0.14); c.translate(0, -base); c.fillStyle = sh; c.beginPath(); c.arc(x, base, h * 0.45, 0, 6.283); c.fill(); c.restore();
    const tips = [];
    // 밑동이 넓은 줄기
    bough(c, x - h * 0.012, base + 2, x, base - h * 0.1, x + h * 0.004, base - h * 0.2, h * 0.075, h * 0.05, '#3b2a1e');
    grow(c, x + h * 0.004, base - h * 0.2, o.lean || 0, h * 0.22, h * 0.05, o.depth, o, r, tips);
    const passes = [
      { cols: o.dark, rad: [0.9, 1.4], a: 0.9 },
      { cols: o.mid, rad: [0.7, 1.1], a: 0.88 },
      { cols: o.light, rad: [0.45, 0.8], a: 0.85, up: true }
    ];
    for (const p of passes){
      for (const t of tips){
        for (let i = 0; i < o.dabs; i++){
          const a = r() * 6.283, d = Math.sqrt(r()) * h * o.fr;
          const px = t[0] + Math.cos(a) * d - (p.up ? h * 0.012 : 0), py = t[1] + Math.sin(a) * d * 0.8 - (p.up ? h * 0.016 : 0);
          const rr = h * o.dab * (p.rad[0] + r() * (p.rad[1] - p.rad[0]));
          c.globalAlpha = p.a * (0.7 + r() * 0.3); c.fillStyle = p.cols[Math.floor(r() * p.cols.length)];
          c.beginPath(); c.ellipse(px, py, rr, rr * 0.8, r() * 3, 0, 6.283); c.fill();
        }
      }
    }
    c.globalAlpha = 1;
  }
  const OAK = (cols) => ({ depth: 7, leafDepth: 3, spread: 0.55, ratio: 0.72, fork3: 0.2, dabs: 7, fr: 0.07, dab: 0.012, dark: cols[0], mid: cols[1], light: cols[2] });
  // 소나무: 줄기에서 뻗은 가지마다 바늘잎이 촘촘히 나고, 가지 위에 눈이 덩이로 쌓인다
  function conifer(c, x, base, h, snow, r){
    if (snow){
      const sh = c.createRadialGradient(x + h * 0.08, base, 0, x + h * 0.08, base, h * 0.3); sh.addColorStop(0, 'rgba(40,70,120,0.35)'); sh.addColorStop(1, 'rgba(40,70,120,0)');
      c.save(); c.translate(0, base); c.scale(1, 0.18); c.translate(0, -base); c.fillStyle = sh; c.beginPath(); c.arc(x + h * 0.08, base, h * 0.3, 0, 6.283); c.fill(); c.restore();
    }
    bough(c, x - h * 0.018, base + 1, x, base - h * 0.25, x + h * 0.003, base - h * 0.5, h * 0.04, h * 0.012, '#2e2018');
    const tiers = 13;
    for (let i = 0; i < tiers; i++){
      const t = i / (tiers - 1), y = base - h * 0.1 - t * h * 0.86, reach = (1 - t) * h * 0.2 + h * 0.014;
      for (let s = -1; s <= 1; s += 2){
        for (let k = 0; k < 6; k++){
          const len = reach * (0.45 + 0.55 * r()), dr = 0.28 + r() * 0.3, yy = y + (r() - 0.5) * h * 0.035;
          const ex = x + s * len, ey = yy + len * dr, cx = x + s * len * 0.5, cy = yy + len * dr * 0.1;
          c.strokeStyle = 'hsl(' + (150 + r() * 12) + ',' + (35 + r() * 10) + '%,' + (12 + r() * 6) + '%)'; c.lineWidth = Math.max(1, h * 0.008); c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
          const nl = Math.max(3, h * (0.035 - t * 0.012));
          for (let j = 1; j <= 9; j++){
            const u = j / 9, mu = 1 - u, px = mu * mu * x + 2 * mu * u * cx + u * u * ex, py = mu * mu * yy + 2 * mu * u * cy + u * u * ey;
            c.strokeStyle = 'hsl(' + (148 + r() * 16) + ',' + (38 + r() * 14) + '%,' + (14 + r() * 12 + u * 5) + '%)'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + s * nl * 0.35, py + nl * (0.9 + r() * 0.4)); c.moveTo(px, py); c.lineTo(px - s * nl * 0.3, py + nl * (0.7 + r() * 0.4)); c.stroke();
          }
          if (snow){
            for (let j = 1; j <= 5; j++){
              const u = j / 6 + (r() - 0.5) * 0.08, mu = 1 - u, px = mu * mu * x + 2 * mu * u * cx + u * u * ex, py = mu * mu * yy + 2 * mu * u * cy + u * u * ey - h * 0.004;
              c.fillStyle = 'rgba(' + (232 + Math.round(r() * 20)) + ',' + (242 + Math.round(r() * 10)) + ',255,' + (0.7 + r() * 0.25) + ')';
              c.beginPath(); c.ellipse(px, py, Math.max(1.5, len * 0.1), Math.max(1, len * 0.045), 0.15 * s, 0, 6.283); c.fill();
            }
          }
        }
      }
    }
    for (let k = 0; k < 18; k++){
      const a = (r() - 0.5) * 1.6, L = h * (0.03 + r() * 0.04), ax = x, ay = base - h * 0.95;
      c.strokeStyle = 'hsl(' + (150 + r() * 10) + ',40%,' + (14 + r() * 8) + '%)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(ax, ay + h * 0.06); c.lineTo(ax + Math.sin(a) * L, ay - Math.cos(a) * L + h * 0.04); c.stroke();
    }
    if (snow){ c.fillStyle = 'rgba(240,247,255,0.95)'; c.beginPath(); c.ellipse(x, base - h * 0.97, h * 0.012, h * 0.03, 0, 0, 6.283); c.fill(); }
  }
  function palm(c, x, base, h, r){
    // 줄기: 살짝 굽고 마디가 있다
    const tx = x + h * 0.2, ty = base - h, cx = x + h * 0.02, cy = base - h * 0.55;
    bough(c, x, base, cx, cy, tx, ty, h * 0.07, h * 0.04, '#6b4a30');
    c.strokeStyle = 'rgba(40,25,15,0.45)'; c.lineWidth = 1;
    for (let i = 1; i < 18; i++){
      const t = i / 18, mt = 1 - t, px = mt * mt * x + 2 * mt * t * cx + t * t * tx, py = mt * mt * base + 2 * mt * t * cy + t * t * ty, w = (h * 0.07 + (h * 0.04 - h * 0.07) * t) / 2;
      c.beginPath(); c.moveTo(px - w, py); c.lineTo(px + w, py + 2); c.stroke();
    }
    // 잎: 휘어진 줄기에 작은 잎살이 빗살처럼 붙는다
    for (let i = 0; i < 11; i++){
      const a = -Math.PI * 1.05 + i * (Math.PI * 1.1 / 10) + (r() - 0.5) * 0.15, len = h * (0.36 + r() * 0.12);
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.35 + len * 0.42, ccx = tx + Math.cos(a) * len * 0.55, ccy = ty + Math.sin(a) * len * 0.55 - len * 0.12;
      c.strokeStyle = '#1a6a42'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(ccx, ccy, ex, ey); c.stroke();
      for (let k = 2; k <= 15; k++){
        const t = k / 16, mt = 1 - t, px = mt * mt * tx + 2 * mt * t * ccx + t * t * ex, py = mt * mt * ty + 2 * mt * t * ccy + t * t * ey, dx = ex - tx, L = (1 - t * 0.7) * len * 0.2;
        c.strokeStyle = k % 2 ? '#127a4a' : '#1e8f52'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + (dx < 0 ? -1 : 1) * L * 0.25, py + L); c.moveTo(px, py); c.lineTo(px - (dx < 0 ? -1 : 1) * L * 0.25, py + L * 0.85); c.stroke();
      }
    }
    c.fillStyle = '#4a321f'; for (let i = 0; i < 3; i++){ c.beginPath(); c.arc(tx + (i - 1) * h * 0.02, ty + h * 0.02, h * 0.018, 0, 6.283); c.fill(); }
  }
  function grass(c, y0, y1, n, hues, r, len){
    for (let i = 0; i < n; i++){
      const x = r() * W, y = y0 + r() * (y1 - y0), L = len * (0.5 + r() * 0.9), lean = (r() - 0.5) * len * 0.5;
      c.strokeStyle = 'hsl(' + (hues[0] + r() * hues[1]) + ',' + (45 + r() * 25) + '%,' + (22 + r() * 22) + '%)'; c.lineWidth = 1 + r() * 0.8;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.4, y - L * 0.6, x + lean, y - L); c.stroke();
    }
  }
  function cloud(c, x, y, s, a, tint){
    for (let k = 0; k < 7; k++){
      const cx = x + (k - 3) * s * 0.42, cy = y + Math.sin(k * 1.7) * s * 0.1, rr = s * (0.46 + 0.16 * Math.sin(k * 2.3));
      const gr = c.createRadialGradient(cx, cy - rr * 0.2, 0, cx, cy, rr);
      gr.addColorStop(0, 'rgba(' + tint + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + tint + ',0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rr, 0, 6.283); c.fill();
    }
  }

  // ----- 풍경(크기가 바뀔 때만 한 번 그린다) -----
  let glints = [], chimney = null;
  function buildScene(){
    scene.width = W; scene.height = H;
    sg.setTransform(D, 0, 0, D, 0, 0); sg.clearRect(0, 0, W, H);
    const r = lcg(season.charCodeAt(0) * 977), hz = H * 0.7, base = Math.min(W, H);
    glints = []; chimney = null; cabin = null;
    if (season === 'summer'){
      layer(sg, { seed: 5, y0: hz - 6, amp: 26, scale: 0.006, ridged: true, top: 'rgba(52,120,140,0.9)', bot: 'rgba(52,120,140,0.9)', fog: '150,215,225', fogA: 0.7 });
      const sea = sg.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#2fb5cc'); sea.addColorStop(0.45, '#0e7b9c'); sea.addColorStop(1, '#05344d');
      sg.fillStyle = sea; sg.fillRect(0, hz, W, H - hz);
      const hg = sg.createLinearGradient(0, hz - 30, 0, hz + 16); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.75, 'rgba(255,255,255,0.4)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = hg; sg.fillRect(0, hz - 30, W, 46);
      for (let i = 0; i < 26; i++){
        const k = i / 25, y = hz + (H - hz) * Math.pow(k, 1.7) + 6;
        sg.strokeStyle = 'rgba(255,255,255,' + (0.05 + 0.13 * k) + ')'; sg.lineWidth = 0.8 + k * 1.8;
        sg.beginPath(); for (let x = 0; x <= W; x += 8) sg.lineTo(x, y + Math.sin(x * (0.03 - k * 0.012) + i * 2.1) * (0.8 + k * 3.4)); sg.stroke();
      }
      for (let i = 0; i < 40; i++){ const k = Math.pow(r(), 1.4); glints.push({ x: W * 0.8 + (r() - 0.5) * (30 + k * W * 0.3), y: hz + 6 + k * (H - hz - 40), w: 4 + r() * 16 * (0.4 + k), ph: r() * 6.28 }); }
      layer(sg, { seed: 9, y0: H * 0.945, amp: 14, scale: 0.01, top: '#f0d9a2', bot: '#b48c52' });
      palm(sg, W * 0.09, H * 0.97, Math.min(H * 0.4, 330), r);
      palm(sg, W * 0.93, H * 0.985, Math.min(H * 0.3, 250), r);
    } else if (season === 'spring'){
      layer(sg, { seed: 3, y0: H * 0.56, amp: 60, scale: 0.0035, ridged: true, top: 'rgba(120,130,175,0.85)', bot: 'rgba(120,130,175,0.85)', fog: '240,190,205', fogA: 0.7 });
      layer(sg, { seed: 4, y0: H * 0.64, amp: 34, scale: 0.005, top: 'rgba(110,160,150,0.9)', bot: 'rgba(80,130,110,0.9)', fog: '240,200,210', fogA: 0.55 });
      const cherryO = { depth: 7, leafDepth: 3, spread: 0.6, ratio: 0.74, fork3: 0.3, dabs: 9, fr: 0.06, dab: 0.011, dark: ['#d9779e', '#c9638c'], mid: ['#f39bbb', '#ee86ab', '#f7b0c8'], light: ['#ffd7e5', '#ffe9f1', '#ffc2d7'] };
      layer(sg, { seed: 6, y0: H * 0.74, amp: 26, scale: 0.007, top: '#6fb06a', bot: '#3d7f48', fog: '230,215,215', fogA: 0.3 });
      tree(sg, W * 0.8, H * 0.8, Math.min(H * 0.42, 360), Object.assign({ lean: -0.05 }, cherryO), r);
      layer(sg, { seed: 7, y0: H * 0.86, amp: 18, scale: 0.01, top: '#4d9a52', bot: '#245c33' });
      tree(sg, W * 0.1, H * 0.93, Math.min(H * 0.5, 440), Object.assign({ lean: 0.06 }, cherryO), r);
      layer(sg, { seed: 8, y0: H * 0.95, amp: 8, scale: 0.014, top: '#3d8a48', bot: '#15401f' });
      grass(sg, H * 0.93, H, 520, [85, 45], r, 18);
      for (let i = 0; i < 90; i++){ sg.fillStyle = ['#ffffff', '#ffd1e6', '#fff2a8', '#ffb3d1'][Math.floor(r() * 4)]; sg.beginPath(); sg.arc(r() * W, H * 0.94 + r() * H * 0.06, 1.2 + r() * 1.8, 0, 6.283); sg.fill(); }
    } else if (season === 'autumn'){
      layer(sg, { seed: 11, y0: H * 0.58, amp: 56, scale: 0.0035, ridged: true, top: 'rgba(130,80,80,0.9)', bot: 'rgba(130,80,80,0.9)', fog: '235,170,110', fogA: 0.75 });
      const warm = [['#7a3412', '#8e3f14'], ['#b8561a', '#c9651e', '#a24a14'], ['#f0a53a', '#e3892a', '#ffc65a']];
      const forest = (y, n, hmin, hmax, fogA) => { for (let i = 0; i < n; i++) tree(sg, W * (i + r() * 0.8) / n, y + r() * H * 0.02, H * (hmin + r() * (hmax - hmin)), Object.assign(OAK(warm), { depth: 6, dabs: 5, lean: (r() - 0.5) * 0.1 }), r); };
      layer(sg, { seed: 12, y0: H * 0.7, amp: 18, scale: 0.007, top: '#8b4a2a', bot: '#6a3520', fog: '230,150,100', fogA: 0.5 });
      forest(H * 0.74, 9, 0.12, 0.18);
      sg.fillStyle = 'rgba(240,170,110,0.28)'; sg.fillRect(0, H * 0.66, W, H * 0.1);
      layer(sg, { seed: 13, y0: H * 0.82, amp: 16, scale: 0.009, top: '#7a4220', bot: '#3f2110' });
      forest(H * 0.86, 5, 0.22, 0.3);
      layer(sg, { seed: 14, y0: H * 0.94, amp: 8, scale: 0.013, top: '#5d3416', bot: '#26140a' });
      tree(sg, W * 0.86, H * 0.97, Math.min(H * 0.55, 480), Object.assign(OAK(warm), { lean: -0.08 }), r);
      tree(sg, W * 0.09, H * 0.98, Math.min(H * 0.46, 400), Object.assign(OAK(warm), { lean: 0.07 }), r);
      grass(sg, H * 0.945, H, 300, [28, 22], r, 15);
      const lc = ['#e8791d', '#d1451b', '#f2b134', '#b23a14', '#f4c04a'];
      for (let i = 0; i < 110; i++){ sg.save(); sg.translate(r() * W, H * 0.94 + r() * H * 0.06); sg.rotate(r() * 6.28); sg.fillStyle = lc[Math.floor(r() * 5)]; sg.beginPath(); sg.ellipse(0, 0, 3.5 + r() * 4, 1.8 + r() * 2, 0, 0, 6.283); sg.fill(); sg.restore(); }
    } else {
      layer(sg, { seed: 21, y0: H * 0.5, amp: 90, scale: 0.0028, ridged: true, top: '#8fa6cc', bot: '#5d78a6', snow: 0.45, fog: '70,105,160', fogA: 0.6 });
      layer(sg, { seed: 22, y0: H * 0.62, amp: 52, scale: 0.0045, ridged: true, top: '#9db3d6', bot: '#6a86b3', snow: 0.3, fog: '90,125,180', fogA: 0.55 });
      layer(sg, { seed: 23, y0: H * 0.72, amp: 22, scale: 0.007, top: '#cfdcee', bot: '#9fb5d2', fog: '120,150,200', fogA: 0.4 });
      for (let i = 0; i < 12; i++) conifer(sg, W * (i + r() * 0.8) / 12, H * (0.76 + r() * 0.02), H * (0.1 + r() * 0.05), true, r);
      layer(sg, { seed: 24, y0: H * 0.82, amp: 16, scale: 0.008, top: '#e4edf8', bot: '#aebfd8' });
      const cx = W * 0.8, cy = H * 0.875, w = Math.min(W * 0.15, 130);
      sg.fillStyle = '#5a4034'; sg.fillRect(cx + w * 0.22, cy - w * 0.95, w * 0.14, w * 0.5);
      sg.fillStyle = '#4a3226'; sg.fillRect(cx - w / 2, cy - w * 0.45, w, w * 0.45);
      sg.strokeStyle = 'rgba(30,18,12,0.5)'; sg.lineWidth = 1; for (let i = 1; i < 6; i++){ sg.beginPath(); sg.moveTo(cx - w / 2, cy - w * 0.45 + i * w * 0.075); sg.lineTo(cx + w / 2, cy - w * 0.45 + i * w * 0.075); sg.stroke(); }
      const wg = sg.createRadialGradient(cx, cy - w * 0.22, 0, cx, cy - w * 0.22, w * 0.55); wg.addColorStop(0, 'rgba(255,200,90,0.6)'); wg.addColorStop(1, 'rgba(255,200,90,0)');
      sg.fillStyle = wg; sg.fillRect(cx - w, cy - w, w * 2, w * 1.2);
      sg.fillStyle = '#ffd36b'; sg.fillRect(cx - w * 0.13, cy - w * 0.32, w * 0.26, w * 0.2);
      sg.fillStyle = '#f2f8fd'; sg.beginPath(); sg.moveTo(cx - w * 0.64, cy - w * 0.43); sg.lineTo(cx, cy - w * 0.95); sg.lineTo(cx + w * 0.64, cy - w * 0.43); sg.quadraticCurveTo(cx, cy - w * 0.5, cx - w * 0.64, cy - w * 0.43); sg.fill();
      layer(sg, { seed: 25, y0: H * 0.92, amp: 10, scale: 0.011, top: '#f4f9fd', bot: '#bccde2' });
      const fh1 = Math.min(H * 0.42, 360, W * 0.55), fh2 = Math.min(H * 0.3, 260, W * 0.4);
      conifer(sg, fh1 * 0.24 + 6, H * 0.97, fh1, true, r);
      conifer(sg, fh1 * 0.5 + fh2 * 0.26 + 14, H * 0.985, fh2, true, r);
      chimney = { x: cx + w * 0.3, y: cy - w * 0.88, w: w }; cabin = { cx, cy, w };
      for (let i = 0; i < 120; i++){ sg.fillStyle = 'rgba(255,255,255,' + (0.4 + r() * 0.5) + ')'; sg.beginPath(); sg.arc(r() * W, H * 0.9 + r() * H * 0.1, 0.6 + r() * 1.1, 0, 6.283); sg.fill(); }
    }
    const vg = sg.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.2)');
    sg.fillStyle = vg; sg.fillRect(0, 0, W, H);
    // 위쪽을 어둡게 눌러 제목과 버튼 글자가 잘 보이게 한다
    const ov = sg.createLinearGradient(0, 0, 0, H * 0.62); ov.addColorStop(0, season === 'winter' ? 'rgba(5,8,20,0.3)' : 'rgba(5,10,28,0.2)'); ov.addColorStop(1, 'rgba(5,8,20,0)');
    sg.fillStyle = ov; sg.fillRect(0, 0, W, H);
    // 사진처럼 아주 가는 알갱이(필름 노이즈)를 한 번만 얹는다
    sg.save(); sg.globalAlpha = 0.16; sg.fillStyle = grainPattern(); sg.fillRect(0, 0, W, H); sg.restore();
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
  // 구름: 위는 햇빛을 받아 밝고 아래는 푸르스름하게 그늘지며, 바닥은 납작하게 퍼진다
  function cloudSprite(s, a, tint){
    const w = Math.ceil(s * 4.4), h = Math.ceil(s * 2.2), cs = document.createElement('canvas'); cs.width = w; cs.height = h;
    const c = cs.getContext('2d'), r = lcg(Math.round(s * 131 + a * 977)), n = 10 + Math.floor(r() * 4), warm = tint.charAt(0) === '2' && tint.indexOf('215') > -1;
    const shade = warm ? '214,170,150' : '176,198,228', puffs = [];
    for (let i = 0; i < n; i++){
      const t = i / (n - 1), ph = Math.sin(t * Math.PI);
      puffs.push({ x: w / 2 + (t - 0.5) * s * 2.7 + (r() - 0.5) * s * 0.3, y: h * 0.56 - ph * s * 0.3 + (r() - 0.5) * s * 0.14, r: s * (0.3 + 0.36 * ph + r() * 0.12) });
    }
    for (const p of puffs){ const g = c.createRadialGradient(p.x, p.y + p.r * 0.2, 0, p.x, p.y + p.r * 0.2, p.r * 1.08); g.addColorStop(0, 'rgba(' + shade + ',' + (a * 0.55) + ')'); g.addColorStop(1, 'rgba(' + shade + ',0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y + p.r * 0.2, p.r * 1.08, 0, 6.283); c.fill(); }
    for (const p of puffs){ const g = c.createRadialGradient(p.x - p.r * 0.22, p.y - p.r * 0.3, 0, p.x, p.y, p.r); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.55, 'rgba(' + tint + ',' + (a * 0.8) + ')'); g.addColorStop(1, 'rgba(' + tint + ',0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); }
    c.globalCompositeOperation = 'destination-out';
    const fl = c.createLinearGradient(0, h * 0.58, 0, h * 0.72); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,0.9)'); c.fillStyle = fl; c.fillRect(0, h * 0.58, w, h * 0.42);
    return cs;
  }
  function mistSprite(rgb, a){
    const w = Math.ceil(Math.max(W, 360) * 1.3), h = 120, cs = document.createElement('canvas'); cs.width = w; cs.height = h;
    const c = cs.getContext('2d');
    for (let i = 0; i < 6; i++){ const x = w * (0.1 + i * 0.16), g = c.createRadialGradient(x, h / 2, 0, x, h / 2, w * 0.2); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.save(); c.translate(x, h / 2); c.scale(1, 0.22 + (i % 3) * 0.06); c.translate(-x, -h / 2 * 1); c.fillStyle = g; c.fillRect(x - w * 0.2, h / 2 - w * 0.2 * 5, w * 0.4, w * 0.4 * 5); c.restore(); }
    return cs;
  }
  function grainPattern(){
    const t = document.createElement('canvas'); t.width = t.height = 96; const c = t.getContext('2d'), d = c.createImageData(96, 96), r = lcg(7);
    for (let i = 0; i < d.data.length; i += 4){ const v = r() < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 18 + r() * 30; }
    c.putImageData(d, 0, 0); return sg.createPattern(t, 'repeat');
  }
  function make(){
    const n = Math.max(14, Math.min(34, Math.round(W * H / 42000)));
    parts = [];
    for (let i = 0; i < n; i++){
      const p = { x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1.2, 1.2), tum: rnd(0, 6.28), tv: rnd(1.5, 3.5) };
      if (season === 'summer'){ p.r = rnd(1.5, 3.2); p.vy = -rnd(8, 22); p.a = rnd(0.35, 0.8); }
      else if (season === 'spring'){ p.s = Math.round(rnd(5, 8)); p.vy = rnd(24, 44); }
      else if (season === 'autumn'){ p.s = Math.round(rnd(8, 13)); p.vy = rnd(34, 62); p.c = ['#e8791d', '#d1451b', '#f2b134', '#b23a14'][i % 4]; p.k = i % 3 === 0 ? 0 : 1; }
      else { p.r = Math.round(rnd(1.2, 4.4) * 2) / 2; p.vy = rnd(16, 46); }
      parts.push(p);
    }
    clouds = [];
    const tint = season === 'spring' ? '255,225,235' : season === 'autumn' ? '255,215,170' : season === 'winter' ? '238,244,255' : '255,255,255';
    for (let i = 0; i < 5; i++){ const s = Math.round(rnd(46, 100)); clouds.push({ x: rnd(0, W), y: rnd(H * 0.05, H * 0.36), s, v: rnd(3, 9), spr: cloudSprite(s, season === 'summer' ? 0.92 : season === 'spring' ? 0.75 : season === 'winter' ? 0.55 : 0.62, tint) }); }
    mist = season === 'summer' ? null : { spr: mistSprite(season === 'spring' ? '255,236,242' : season === 'autumn' ? '255,208,165' : '214,230,250', season === 'winter' ? 0.34 : 0.3), y: H * (season === 'spring' ? 0.7 : season === 'autumn' ? 0.74 : 0.79), v: season === 'winter' ? 5 : 8 };
    flies = [];
    for (let i = 0; i < 14; i++) flies.push({ x: rnd(0, W), y: rnd(H * 0.55, H * 0.97), ph: rnd(0, 6.28), sp: rnd(0.6, 1.4) });
    gulls = [];
    for (let i = 0; i < 3; i++) gulls.push({ x: rnd(0, W), y: rnd(H * 0.12, H * 0.4), s: rnd(7, 12), v: rnd(18, 32) });
    buildSkyBase();
  }
  // 하늘에서 움직이지 않는 부분(해, 달, 햇살)은 한 번만 그려 둔다
  function buildSkyBase(){
    skyBase.width = W; skyBase.height = H; hasBase = true;
    const c = sb;
    // 가늘게 퍼진 높은 구름과 햇살 줄기(해에서 퍼져 나가는 빛)
    const rays = (sx, sy, a0, a1, cnt, col, alpha) => {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < cnt; k++){
        const a = a0 + (a1 - a0) * (k + 0.5) / cnt + Math.sin(k * 12.9) * 0.03, wd = 0.035 + (k % 3) * 0.02, L = Math.max(W, H) * 1.3;
        const g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L); g.addColorStop(0, 'rgba(' + col + ',' + alpha * (0.6 + (k % 4) * 0.15) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - wd) * L, sy + Math.sin(a - wd) * L); c.lineTo(sx + Math.cos(a + wd) * L, sy + Math.sin(a + wd) * L); c.closePath(); c.fill();
      }
      c.restore();
    };
    const sun = (sx, sy, rad, core, halo) => {
      let g = c.createRadialGradient(sx, sy, 0, sx, sy, Math.max(260, W * 0.55)); g.addColorStop(0, 'rgba(' + halo + ',0.7)'); g.addColorStop(0.25, 'rgba(' + halo + ',0.25)'); g.addColorStop(1, 'rgba(' + halo + ',0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      g = c.createRadialGradient(sx, sy, 0, sx, sy, rad * 2.6); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(' + core + ',0.95)'); g.addColorStop(1, 'rgba(' + core + ',0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, rad * 2.6, 0, 6.283); c.fill();
    };
    if (true){
      for (let k = 0; k < 5; k++){
        const cx = W * (0.15 + 0.2 * k) + Math.sin(k * 3.1) * 40, cy = H * (0.1 + 0.05 * ((k * 7) % 5)), g = c.createRadialGradient(cx, cy, 0, cx, cy, W * 0.32);
        g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.save(); c.translate(cx, cy); c.rotate(-0.12); c.scale(1, 0.07); c.translate(-cx, -cy); c.fillStyle = g; c.fillRect(cx - W * 0.32, cy - W * 0.32, W * 0.64, W * 0.64); c.restore();
      }
    }
    if (season === 'summer'){
      const sx = W * 0.8, sy = H * 0.18;
      sun(sx, sy, 24, '255,244,190', '255,238,170');
      rays(sx, sy, 1.9, 2.9, 7, '255,240,190', 0.1);
    } else if (season === 'spring'){
      const sx = W * 0.2, sy = H * 0.17;
      sun(sx, sy, 22, '255,238,200', '255,226,200');
      rays(sx, sy, 0.2, 1.3, 6, '255,236,210', 0.09);
    } else if (season === 'autumn'){
      const sx = W * 0.68, sy = H * 0.66;
      const gl = c.createRadialGradient(sx, sy, 0, sx, sy, Math.max(260, W * 0.5)); gl.addColorStop(0, 'rgba(255,170,70,0.7)'); gl.addColorStop(1, 'rgba(255,170,70,0)');
      c.fillStyle = gl; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,214,140,0.9)'; c.beginPath(); c.arc(sx, sy, 40, 0, 6.283); c.fill();
      rays(sx, sy, -2.3, -0.8, 8, '255,200,130', 0.12);
    } else {
      const sx = W * 0.78, sy = H * 0.15;
      sun(sx, sy, 20, '255,250,238', '235,245,255');
      rays(sx, sy, 1.8, 2.8, 5, '235,245,255', 0.07);
    }
  }
  // ----- 밤: 별, 달, 은하수, 별똥별(겨울에는 오로라도) -----
  let stars = [], shoot = null, nightOn = false, tNight = -99999;
  const ease = u => u * u * (3 - 2 * u);
  const nightF = t => { const u = Math.min(1, Math.max(0, (t - tNight) / 4000)); return nightOn ? ease(u) : 1 - ease(u); };
  const HORIZON = { summer: '#2b5a8c', spring: '#5a4a86', autumn: '#6e4466', winter: '#34609a' };
  function buildNight(){
    nightBase.width = W; nightBase.height = H;
    const c = nb, gr = c.createLinearGradient(0, 0, 0, H * 0.75); gr.addColorStop(0, '#040a1c'); gr.addColorStop(0.55, '#0c1d46'); gr.addColorStop(1, HORIZON[season]);
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    // 은하수: 비스듬히 지나는 옅은 띠
    c.save(); c.translate(W * 0.45, H * 0.3); c.rotate(-0.55);
    const mg = c.createLinearGradient(0, -H * 0.12, 0, H * 0.12); mg.addColorStop(0, 'rgba(180,200,255,0)'); mg.addColorStop(0.5, 'rgba(190,205,255,0.16)'); mg.addColorStop(1, 'rgba(180,200,255,0)');
    c.fillStyle = mg; c.fillRect(-H * 0.9, -H * 0.12, H * 1.8, H * 0.24); c.restore();
    const r = lcg(31);
    for (let i = 0; i < 170; i++){ const x = r() * W, y = Math.pow(r(), 1.3) * H * 0.7, a = 0.15 + r() * 0.5; c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.fillRect(x, y, r() < 0.15 ? 1.6 : 1, r() < 0.15 ? 1.6 : 1); }
    const mx = W * 0.8, my = H * 0.16, mr = Math.max(22, Math.min(W, H) * 0.06);
    let g2 = c.createRadialGradient(mx, my, 0, mx, my, mr * 5); g2.addColorStop(0, 'rgba(200,220,255,0.38)'); g2.addColorStop(0.3, 'rgba(170,195,245,0.12)'); g2.addColorStop(1, 'rgba(170,195,245,0)');
    c.fillStyle = g2; c.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    g2 = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#d9e4f6');
    c.fillStyle = g2; c.beginPath(); c.arc(mx, my, mr, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(150,165,195,0.38)'; for (const k of [[-0.35, -0.25, 0.22], [0.3, 0.2, 0.17], [-0.05, 0.42, 0.12], [0.18, -0.38, 0.1], [-0.42, 0.18, 0.09]]){ c.beginPath(); c.arc(mx + k[0] * mr, my + k[1] * mr, k[2] * mr, 0, 6.283); c.fill(); }
    stars = []; for (let i = 0; i < 40; i++) stars.push({ x: r() * W, y: r() * H * 0.55, r: 0.6 + r() * 1.1, ph: r() * 6.28 });
    if (season === 'winter'){
      aurora.width = W + 60; aurora.height = Math.round(H * 0.5);
      for (let k = 0; k < 3; k++){
        const yy = H * (0.2 + k * 0.07), ag = au.createLinearGradient(0, yy - 60, 0, yy + 60); ag.addColorStop(0, 'rgba(80,255,170,0)'); ag.addColorStop(0.5, 'rgba(80,255,170,0.14)'); ag.addColorStop(1, 'rgba(120,120,255,0)');
        au.fillStyle = ag; au.beginPath(); au.moveTo(0, yy);
        for (let x = 0; x <= W + 60; x += 20) au.lineTo(x, yy + Math.sin(x / 140 + k * 2) * 26);
        au.lineTo(W + 60, yy + 80); au.lineTo(0, yy + 80); au.closePath(); au.fill();
      }
    }
  }
  function nightFrame(t){
    gn.drawImage(nightBase, 0, 0);
    if (season === 'winter'){ gn.globalAlpha = 0.75 + 0.25 * Math.sin(t / 2500); gn.drawImage(aurora, -30 + Math.sin(t / 5000) * 24, 0); gn.globalAlpha = 1; }
    for (const s of stars){ gn.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.55 * Math.abs(Math.sin(t / 900 + s.ph))) + ')'; gn.fillRect(s.x, s.y, s.r * 2, s.r * 2); }
    if (!shoot && Math.random() < 0.012) shoot = { x: rnd(W * 0.1, W * 0.7), y: rnd(H * 0.03, H * 0.25), t0: t, a: rnd(0.35, 0.7) };
    if (shoot){
      const u = (t - shoot.t0) / 650;
      if (u >= 1) shoot = null;
      else { const L = 140, hx = shoot.x + Math.cos(shoot.a) * u * 380, hy = shoot.y + Math.sin(shoot.a) * u * 380, g3 = gn.createLinearGradient(hx, hy, hx - Math.cos(shoot.a) * L, hy - Math.sin(shoot.a) * L); g3.addColorStop(0, 'rgba(255,255,255,' + (1 - u) + ')'); g3.addColorStop(1, 'rgba(255,255,255,0)'); gn.strokeStyle = g3; gn.lineWidth = 1.6; gn.beginPath(); gn.moveTo(hx, hy); gn.lineTo(hx - Math.cos(shoot.a) * L, hy - Math.sin(shoot.a) * L); gn.stroke(); }
    }
  }
  // 풍경 위에 얹는 밤의 푸른 어둠(창문 불빛은 어둠 위에 다시 밝혀 둔다)
  function buildDusk(){
    dusk.width = W; dusk.height = H;
    const gr = gd.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(6,12,40,0.5)'); gr.addColorStop(1, 'rgba(8,14,42,0.62)');
    gd.fillStyle = gr; gd.fillRect(0, 0, W, H);
    if (cabin){
      const { cx, cy, w } = cabin, wg = gd.createRadialGradient(cx, cy - w * 0.22, 0, cx, cy - w * 0.22, w * 0.9); wg.addColorStop(0, 'rgba(255,196,96,0.75)'); wg.addColorStop(1, 'rgba(255,196,96,0)');
      gd.fillStyle = wg; gd.fillRect(cx - w, cy - w * 1.2, w * 2, w * 1.6);
      gd.fillStyle = '#ffd36b'; gd.fillRect(cx - w * 0.13, cy - w * 0.32, w * 0.26, w * 0.2);
    }
  }
  function setNight(v, instant){
    nightOn = !!v; tNight = performance.now() - (instant ? 5000 : 0);
    const d = (reduce || instant) ? '0s' : '4s';
    [cvNight, dusk].forEach(l => { l.style.transition = 'opacity ' + d + ' ease-in-out'; l.style.opacity = nightOn ? '1' : '0'; });
    if (reduce) frame(0);
  }
  function sky(t){
    gs.clearRect(0, 0, W, H);
    if (hasBase) gs.drawImage(skyBase, 0, 0);
    for (const c of clouds) gs.drawImage(c.spr, c.x - c.spr.width / 2, c.y - c.spr.height / 2);
  }
  // 떨어지는 것은 한 번 그린 그림(스프라이트)을 위치만 바꿔 찍는다
  function drawParts(t){
    g.clearRect(0, 0, W, H);
    if (mist){ const mw = mist.spr.width, off = ((t / 1000) * mist.v) % mw; g.drawImage(mist.spr, -off, mist.y - 60); g.drawImage(mist.spr, mw - off, mist.y - 60); }
    for (const p of parts){
      const x = p.x + Math.sin(t / 1300 + p.ph) * 20, flip = Math.cos(p.tum + t / 1000 * p.tv), fb = Math.min(3, Math.floor(Math.abs(flip) * 4));
      let spr, rot = p.rot;
      if (season === 'summer'){
        spr = sprite('pol' + Math.round(p.r * 2), Math.ceil(p.r * 5) + 4, c => { const gr = c.createRadialGradient(0, 0, 0, 0, 0, p.r * 2.4); gr.addColorStop(0, 'rgba(255,248,200,1)'); gr.addColorStop(1, 'rgba(255,248,200,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, p.r * 2.4, 0, 6.283); c.fill(); });
        g.globalAlpha = p.a; g.drawImage(spr, x - spr.width / 2, p.y - spr.height / 2); g.globalAlpha = 1; continue;
      } else if (season === 'spring') spr = sprite('p' + p.s + fb, p.s * 3, c => petal(c, p.s, (fb + 0.5) / 4));
      else if (season === 'autumn') spr = sprite('l' + p.k + p.c + p.s + fb, p.s * 3, c => leaf(c, p.s, p.c, p.k, (fb + 0.5) / 4));
      else spr = sprite('f' + p.r, Math.ceil(p.r * 5) + 8, c => flake(c, p.r));
      g.save(); g.translate(x, p.y); g.rotate(rot); g.drawImage(spr, -spr.width / 2, -spr.height / 2); g.restore();
    }
    if (chimney){
      for (let k = 0; k < 7; k++){
        const u = ((t / 3200) + k / 7) % 1, px = chimney.x + u * chimney.w * 0.6 + Math.sin(u * 7 + k) * 4, py = chimney.y - u * chimney.w * 1.3, rr = 3 + u * 11;
        g.fillStyle = 'rgba(225,233,246,' + ((1 - u) * 0.32) + ')'; g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill();
      }
    }
    const nf = nightF(t);
    if (nf > 0.05 && season !== 'winter' && !reduce){
      const ffs = sprite('ff', 28, c => { const gr = c.createRadialGradient(0, 0, 0, 0, 0, 12); gr.addColorStop(0, 'rgba(255,255,200,1)'); gr.addColorStop(0.3, 'rgba(210,255,120,0.5)'); gr.addColorStop(1, 'rgba(210,255,120,0)'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, 12, 0, 6.283); c.fill(); });
      for (const f of flies){ const a = nf * (0.25 + 0.75 * Math.max(0, Math.sin(t / 650 * f.sp + f.ph))); if (a < 0.03) continue; g.globalAlpha = a; g.drawImage(ffs, f.x + Math.sin(t / 1700 * f.sp + f.ph) * 34 - 14, f.y + Math.cos(t / 2300 + f.ph * 1.3) * 22 - 14); }
      g.globalAlpha = 1;
    }
    if (season === 'summer'){
      for (const s of glints){ g.fillStyle = 'rgba(255,248,210,' + (0.15 + 0.55 * Math.max(0, Math.sin(t / 500 + s.ph))) + ')'; g.fillRect(s.x, s.y, s.w, 1.4); }
      for (const b of gulls) gull(g, b.x, b.y, b.s, t);
    }
  }
  function frame(t){ sky(t); drawParts(t); if (nightOn) nightFrame(t); }
  function step(t){
    raf = requestAnimationFrame(step);
    if (document.hidden) return;
    if (t - lastP >= 45){   // 약 22프레임
      const dt = Math.min(0.1, (t - lastP) / 1000); lastP = t;
      for (const p of parts){
        p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.vy > 0 && p.y > H + 24){ p.y = -24; p.x = rnd(0, W); }
        if (p.vy < 0 && p.y < -24){ p.y = H + 24; p.x = rnd(0, W); }
      }
      for (const b of gulls){ b.x += b.v * dt; if (b.x > W + 30) b.x = -30; }
      drawParts(t);
    }
    if (t - lastS >= 100){   // 하늘은 10프레임이면 충분하다
      const dt = Math.min(0.3, (t - lastS) / 1000); lastS = t;
      for (const c of clouds){ c.x += c.v * dt; if (c.x - c.s * 2.2 > W) c.x = -c.s * 2.2; }
      if (nightF(t) < 0.999) sky(t);
      if (nightOn || nightF(t) > 0.001) nightFrame(t);
    }
  }
  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    cv.width = cvSky.width = cvNight.width = W; cv.height = cvSky.height = cvNight.height = H;
    buildScene(); buildNight(); buildDusk();
  }
  let firstSet = true, swapTimer = 0;
  function apply(s){
    season = s;
    const c = SKY[s];
    document.body.style.background = 'linear-gradient(180deg,' + c[0] + ',' + c[1] + ' 55%,' + c[2] + ') fixed';
    document.body.style.backgroundColor = c[1];
    resize(); make();
    cancelAnimationFrame(raf);
    if (reduce) frame(0); else { lastP = lastS = 0; raf = requestAnimationFrame(step); }
  }
  // 계절이 바뀔 때는 풍경이 서서히 사라졌다가 새 풍경이 서서히 나타난다
  function set(s){
    const layers = [cvSky, scene, cv];
    clearTimeout(swapTimer);
    if (firstSet || reduce){ firstSet = false; layers.forEach(l => { l.style.transition = 'none'; l.style.opacity = '1'; }); apply(s); return; }
    layers.forEach(l => { l.style.transition = 'opacity .22s ease'; l.style.opacity = '0'; });
    swapTimer = setTimeout(() => {
      apply(s);
      requestAnimationFrame(() => layers.forEach(l => { l.style.transition = 'opacity .5s ease'; l.style.opacity = '1'; }));
    }, 230);
  }
  function setReduce(on){
    reduce = !!on;
    if (!W) return;
    cancelAnimationFrame(raf);
    if (reduce) frame(0); else { lastP = lastS = 0; raf = requestAnimationFrame(step); }
  }
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); make(); if (reduce) frame(0); }, 180); });
  // 30초마다 낮과 밤이 바뀐다 (4초에 걸쳐 서서히)
  setInterval(() => { if (!document.hidden && W) setNight(!nightOn); }, 30000);
  return { set, setReduce, setNight, isNight: () => nightOn };
})();
