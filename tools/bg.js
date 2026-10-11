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
  // 소나무: 층층이 아래로 처진 가지, 위에는 눈
  function conifer(c, x, base, h, snow, r){
    bough(c, x - h * 0.02, base, x, base - h * 0.2, x + h * 0.004, base - h * 0.4, h * 0.05, h * 0.02, '#2e2018');
    const n = 11;
    for (let i = 0; i < n; i++){
      const t = i / (n - 1), y = base - h * 0.14 - t * h * 0.84, half = (1 - t * 0.92) * h * 0.24 + h * 0.015;
      for (let s = -1; s <= 1; s += 2){
        for (let k = 0; k < 16; k++){
          const reach = half * (0.3 + 0.7 * (k / 15)) * (0.85 + r() * 0.25), droop = reach * (0.34 + r() * 0.12), yy = y + (r() - 0.5) * h * 0.02;
          c.strokeStyle = 'hsl(' + (150 + r() * 14) + ',' + (38 + r() * 12) + '%,' + (13 + r() * 9 + t * 5) + '%)'; c.lineWidth = Math.max(1.6, h * (0.03 - t * 0.012)); c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(x + s * reach * 0.55, yy - reach * 0.12, x + s * reach, yy + droop); c.stroke();
          if (snow && r() < 0.8){
            c.strokeStyle = 'rgba(240,247,255,' + (0.55 + r() * 0.35) + ')'; c.lineWidth = Math.max(1.2, h * 0.016);
            c.beginPath(); c.moveTo(x + s * reach * 0.12, yy - 1); c.quadraticCurveTo(x + s * reach * 0.55, yy - reach * 0.15, x + s * reach * 0.95, yy + droop * 0.8); c.stroke();
          }
        }
      }
    }
    c.fillStyle = snow ? '#eef5fc' : '#14402f'; c.beginPath(); c.moveTo(x, base - h); c.lineTo(x - h * 0.03, base - h * 0.88); c.lineTo(x + h * 0.03, base - h * 0.88); c.fill();
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
  let glints = [];
  function buildScene(){
    scene.width = cv.width; scene.height = cv.height;
    sg.setTransform(D, 0, 0, D, 0, 0); sg.clearRect(0, 0, W, H);
    const r = lcg(season.charCodeAt(0) * 977), hz = H * 0.7, base = Math.min(W, H);
    glints = [];
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
      for (let i = 0; i < 70; i++){ const k = Math.pow(r(), 1.4); glints.push({ x: W * 0.8 + (r() - 0.5) * (30 + k * W * 0.3), y: hz + 6 + k * (H - hz - 40), w: 4 + r() * 16 * (0.4 + k), ph: r() * 6.28 }); }
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
      sg.fillStyle = '#4a3226'; sg.fillRect(cx - w / 2, cy - w * 0.45, w, w * 0.45);
      sg.strokeStyle = 'rgba(30,18,12,0.5)'; sg.lineWidth = 1; for (let i = 1; i < 6; i++){ sg.beginPath(); sg.moveTo(cx - w / 2, cy - w * 0.45 + i * w * 0.075); sg.lineTo(cx + w / 2, cy - w * 0.45 + i * w * 0.075); sg.stroke(); }
      const wg = sg.createRadialGradient(cx, cy - w * 0.22, 0, cx, cy - w * 0.22, w * 0.55); wg.addColorStop(0, 'rgba(255,200,90,0.6)'); wg.addColorStop(1, 'rgba(255,200,90,0)');
      sg.fillStyle = wg; sg.fillRect(cx - w, cy - w, w * 2, w * 1.2);
      sg.fillStyle = '#ffd36b'; sg.fillRect(cx - w * 0.13, cy - w * 0.32, w * 0.26, w * 0.2);
      sg.fillStyle = '#f2f8fd'; sg.beginPath(); sg.moveTo(cx - w * 0.64, cy - w * 0.43); sg.lineTo(cx, cy - w * 0.95); sg.lineTo(cx + w * 0.64, cy - w * 0.43); sg.quadraticCurveTo(cx, cy - w * 0.5, cx - w * 0.64, cy - w * 0.43); sg.fill();
      layer(sg, { seed: 25, y0: H * 0.92, amp: 10, scale: 0.011, top: '#f4f9fd', bot: '#bccde2' });
      conifer(sg, W * 0.07, H * 0.97, Math.min(H * 0.42, 360), true, r);
      conifer(sg, W * 0.17, H * 0.985, Math.min(H * 0.3, 260), true, r);
      for (let i = 0; i < 120; i++){ sg.fillStyle = 'rgba(255,255,255,' + (0.4 + r() * 0.5) + ')'; sg.beginPath(); sg.arc(r() * W, H * 0.9 + r() * H * 0.1, 0.6 + r() * 1.1, 0, 6.283); sg.fill(); }
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
      for (let k = 0; k < 3; k++){
        const yy = H * (0.2 + k * 0.07), ag = g.createLinearGradient(0, yy - 60, 0, yy + 60); ag.addColorStop(0, 'rgba(80,255,170,0)'); ag.addColorStop(0.5, 'rgba(80,255,170,' + (0.09 + 0.04 * Math.sin(t / 2500 + k)) + ')'); ag.addColorStop(1, 'rgba(120,120,255,0)');
        g.fillStyle = ag; g.beginPath(); g.moveTo(0, yy);
        for (let x = 0; x <= W; x += 20) g.lineTo(x, yy + Math.sin(x / 140 + t / 3000 + k * 2) * 26);
        g.lineTo(W, yy + 80); g.lineTo(0, yy + 80); g.closePath(); g.fill();
      }
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
    if (season === 'summer'){
      for (const s of glints){ g.fillStyle = 'rgba(255,248,210,' + (0.15 + 0.55 * Math.max(0, Math.sin(t / 500 + s.ph))) + ')'; g.fillRect(s.x, s.y, s.w, 1.4); }
      for (const b of gulls) gull(g, b.x, b.y, b.s, t);
    }
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

