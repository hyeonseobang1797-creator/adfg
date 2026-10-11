// ---------------- 계절 배경 ----------------
const SEASON = { easy: 'summer', normal: 'spring', hard: 'autumn', extreme: 'winter' };
const SKY = {
  summer: ['#082f49', '#0c5a73', '#137a80'],
  spring: ['#2a1b3d', '#5b2a58', '#2f6b4f'],
  autumn: ['#2b1408', '#6b2e10', '#a24a12'],
  winter: ['#0a1630', '#16305a', '#2b5a86']
};
const Bg = (() => {
  const cv = document.createElement('canvas');
  cv.id = 'bg';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:-1;pointer-events:none;background:none;border-radius:0;aspect-ratio:auto;max-width:none';
  document.body.insertBefore(cv, document.body.firstChild);
  const g = cv.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PETAL = ['#ffb7d5', '#ffd1e6', '#ff9ec7'], LEAF = ['#e8791d', '#d1451b', '#f2b134', '#a63a14'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, parts = [], season = 'summer', raf = 0, last = 0;
  function resize(){
    const d = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  function make(){
    const n = Math.max(24, Math.min(70, Math.round(W * H / 22000)));
    const out = [];
    for (let i = 0; i < n; i++){
      const p = { x: rnd(0, W), y: rnd(0, H), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-1.4, 1.4) };
      if (season === 'summer'){ p.r = rnd(2, 7); p.vy = -rnd(12, 32); p.a = rnd(0.15, 0.4); }
      else if (season === 'spring'){ p.s = rnd(5, 9); p.vy = rnd(22, 42); p.c = PETAL[i % 3]; }
      else if (season === 'autumn'){ p.s = rnd(7, 13); p.vy = rnd(30, 60); p.c = LEAF[i % 4]; }
      else { p.r = rnd(1.2, 3.8); p.vy = rnd(18, 48); }
      out.push(p);
    }
    return out;
  }
  function draw(t){
    g.clearRect(0, 0, W, H);
    if (season === 'summer'){
      const sg = g.createRadialGradient(W * 0.86, H * 0.1, 0, W * 0.86, H * 0.1, Math.max(180, W * 0.35));
      sg.addColorStop(0, 'rgba(255,226,130,0.42)'); sg.addColorStop(1, 'rgba(255,226,130,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
    }
    for (const p of parts){
      const sway = Math.sin(t / 1400 + p.ph) * 18;
      const x = p.x + sway;
      if (season === 'summer'){
        g.strokeStyle = 'rgba(255,255,255,' + p.a + ')'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(x, p.y, p.r, 0, 6.283); g.stroke();
      } else if (season === 'winter'){
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.arc(x, p.y, p.r, 0, 6.283); g.fill();
      } else {
        g.save(); g.translate(x, p.y); g.rotate(p.rot);
        g.fillStyle = p.c;
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * (season === 'spring' ? 0.6 : 0.5), 0, 0, 6.283); g.fill();
        if (season === 'autumn'){ g.strokeStyle = 'rgba(60,20,5,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-p.s, 0); g.lineTo(p.s, 0); g.stroke(); }
        g.restore();
      }
    }
  }
  function step(t){
    raf = requestAnimationFrame(step);
    if (t - last < 33) return;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    for (const p of parts){
      p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.vy > 0 && p.y > H + 20){ p.y = -20; p.x = rnd(0, W); }
      if (p.vy < 0 && p.y < -20){ p.y = H + 20; p.x = rnd(0, W); }
    }
    draw(t);
  }
  function set(s){
    season = s;
    const c = SKY[s];
    document.body.style.background = 'linear-gradient(180deg,' + c[0] + ',' + c[1] + ' 55%,' + c[2] + ') fixed';
    document.body.style.backgroundColor = c[1];
    resize(); parts = make();
    cancelAnimationFrame(raf);
    if (reduce) draw(0); else { last = 0; raf = requestAnimationFrame(step); }
  }
  window.addEventListener('resize', () => { resize(); parts = make(); if (reduce) draw(0); });
  return { set };
})();

// ---------------- 배경음악 (직접 만든 곡을 브라우저에서 소리로 합성한다. 외부 음원이 없어 저작권 문제가 없다) ----------------
const Music = (() => {
  const CFG = {
    easy:    { bpm: 108, root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 'M'], [5, 'M'], [7, 'M'], [5, 'M']], dens: 0.72, oct: 12, lead: 'triangle', bass: 'sine', tick: true, wet: 0.22 },
    normal:  { bpm: 88, root: 62, scale: [0, 2, 4, 7, 9], chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], dens: 0.5, oct: 12, lead: 'sine', bass: 'sine', bell: true, wet: 0.35 },
    hard:    { bpm: 76, root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], dens: 0.5, oct: 12, lead: 'triangle', bass: 'sawtooth', wet: 0.3 },
    extreme: { bpm: 60, root: 64, scale: [0, 3, 5, 7, 10], chords: [[0, 'm'], [8, 'M'], [5, 'M'], [10, 'M']], dens: 0.33, oct: 24, lead: 'sine', bass: 'sine', bell: true, drone: true, wet: 0.5 }
  };
  const TRIAD = { M: [0, 4, 7], m: [0, 3, 7] };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function bus(ctx, out, cfg){
    const input = ctx.createGain(), dry = ctx.createGain(), send = ctx.createGain();
    const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    dry.gain.value = 1; send.gain.value = cfg.wet; dl.delayTime.value = 30 / cfg.bpm * 3; fb.gain.value = 0.42;
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    input.connect(dry); dry.connect(out);
    input.connect(send); send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out);
    return { input };
  }
  function tone(ctx, b, type, f, t, dur, vol, att, filt){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (filt){ const q = ctx.createBiquadFilter(); q.type = 'lowpass'; q.frequency.value = filt; o.connect(q); n = q; }
    n.connect(g); g.connect(b.input);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(ctx, b, t, vol){
    if (!noiseBuf){ noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), g = ctx.createGain(), h = ctx.createBiquadFilter();
    s.buffer = noiseBuf; h.type = 'highpass'; h.frequency.value = 6000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(h); h.connect(g); g.connect(b.input); s.start(t);
  }
  // 한 박자(8분음표) 분량을 예약한다. step은 0부터 올라간다. 네 마디(32스텝)가 한 바퀴.
  function schedule(ctx, b, cfg, step, t, st){
    const sd = 30 / cfg.bpm, bar = Math.floor(step / 8) % 4, ch = cfg.chords[bar], base = cfg.root + ch[0];
    if (step % 8 === 0){
      TRIAD[ch[1]].forEach((iv, i) => tone(ctx, b, 'sine', mtof(base + 12 + iv), t, sd * 8 * 0.98, 0.035, 0.7 + i * 0.08));
    }
    if (step % 4 === 0) tone(ctx, b, cfg.bass, mtof(base - 12), t, sd * 3, cfg.bass === 'sawtooth' ? 0.07 : 0.11, 0.02, cfg.bass === 'sawtooth' ? 420 : 0);
    if (cfg.tick && step % 2 === 1) noise(ctx, b, t, 0.025);
    if (cfg.drone && step % 32 === 0){
      tone(ctx, b, 'sine', mtof(cfg.root - 24), t, sd * 32, 0.05, 2.5);
      tone(ctx, b, 'sine', mtof(cfg.root - 24 + 7), t, sd * 32, 0.03, 3);
    }
    if (Math.random() < cfg.dens){
      const n = cfg.scale.length;
      st.pos = Math.max(0, Math.min(n * 2 - 1, st.pos + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      const m = cfg.root + cfg.scale[st.pos % n] + 12 * Math.floor(st.pos / n) + cfg.oct - 12;
      const dur = sd * (1 + Math.floor(Math.random() * 3));
      tone(ctx, b, cfg.lead, mtof(m), t, dur * 1.6, 0.09, 0.012);
      if (cfg.bell) tone(ctx, b, 'sine', mtof(m) * 2.01, t, dur, 0.025, 0.008);
    }
  }
  // 소리 파일을 만들 때나 시험할 때 쓴다: 지정한 초만큼 미리 예약한다.
  function renderSchedule(ctx, mode, seconds){
    const cfg = CFG[mode], out = ctx.createGain(), comp = ctx.createDynamicsCompressor();
    out.gain.value = 1.0; out.connect(comp); comp.connect(ctx.destination);
    const b = bus(ctx, out, cfg), st = { pos: 3 }, sd = 30 / cfg.bpm;
    for (let s = 0, t = 0; t < seconds; s++, t += sd) schedule(ctx, b, cfg, s, t, st);
  }

  let ctx = null, master = null, cur = null, timer = 0, step = 0, nextT = 0, mode = 'easy', want = false, st = { pos: 3 };
  const btn = document.getElementById('musicBtn');
  function paint(){ if (btn){ btn.setAttribute('aria-pressed', want ? 'true' : 'false'); btn.textContent = want ? '♪ 음악 켬' : '♪ 음악 끔'; } }
  function ensure(){
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    return true;
  }
  function loop(){
    const cfg = CFG[mode], sd = 30 / cfg.bpm;
    while (nextT < ctx.currentTime + 0.5){ schedule(ctx, cur, cfg, step, nextT, st); nextT += sd; step++; }
  }
  function begin(){
    clearInterval(timer);
    if (cur) try { cur.input.disconnect(); } catch (e) {}
    cur = bus(ctx, master, CFG[mode]); step = 0; st = { pos: 3 }; nextT = ctx.currentTime + 0.1;
    timer = setInterval(loop, 120);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(1.0, ctx.currentTime, 0.5);
  }
  function start(){
    want = true; paint();
    try { localStorage.setItem('dotsMusic', '1'); } catch (e) {}
    if (!ensure()) return;
    ctx.resume(); begin();
  }
  function stop(){
    want = false; paint();
    try { localStorage.setItem('dotsMusic', '0'); } catch (e) {}
    if (!ctx) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    clearInterval(timer);
  }
  function setMode(m){
    mode = m;
    if (ctx && want){
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      clearInterval(timer);
      setTimeout(() => { if (want) begin(); }, 450);
    }
  }
  if (btn) btn.onclick = () => { want ? stop() : start(); };
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (want) ctx.resume();
  });
  // 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허락한다. 끈 적이 없으면 첫 터치에서 시작한다.
  let pref = '1'; try { pref = localStorage.getItem('dotsMusic') || '1'; } catch (e) {}
  want = pref === '1'; paint();
  if (want){
    const first = () => { document.removeEventListener('pointerdown', first); document.removeEventListener('keydown', first); if (want) start(); };
    document.addEventListener('pointerdown', first); document.addEventListener('keydown', first);
  }
  return { setMode, start, stop, renderSchedule };
})();

