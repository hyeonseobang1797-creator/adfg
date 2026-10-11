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

  let ctx = null, master = null, sfxOut = null, cur = null, timer = 0, step = 0, nextT = 0, mode = 'easy', playing = false, st = { pos: 3 };
  let musicOn = true, sfxOn = true;
  try { const s = JSON.parse(localStorage.getItem('dotsSettings') || '{}'); if (s.music === false) musicOn = false; if (s.sfx === false) sfxOn = false; } catch (e) {}
  const saveSettings = () => { try { localStorage.setItem('dotsSettings', JSON.stringify({ music: musicOn, sfx: sfxOn })); } catch (e) {} };
  function ensure(){
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    sfxOut = ctx.createGain(); sfxOut.gain.value = 0.9; sfxOut.connect(comp);
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
    timer = setInterval(loop, 120); playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(1.0, ctx.currentTime, 0.5);
  }
  function startMusic(){ if (!musicOn || !ensure()) return; ctx.resume(); begin(); }
  function stopMusic(){ playing = false; clearInterval(timer); if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.15); }
  function setMusic(on){ musicOn = on; saveSettings(); on ? startMusic() : stopMusic(); }
  function setSfx(on){ sfxOn = on; saveSettings(); }
  function setMode(m){
    mode = m;
    if (ctx && musicOn && playing){
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      clearInterval(timer);
      setTimeout(() => { if (musicOn) begin(); }, 450);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  // 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허락한다. 음악이 켜져 있으면 첫 터치에서 시작한다.
  if (musicOn){
    const first = () => { document.removeEventListener('pointerdown', first); document.removeEventListener('keydown', first); if (musicOn && !playing) startMusic(); };
    document.addEventListener('pointerdown', first); document.addEventListener('keydown', first);
  }
  // 효과음: 설정에서 켜져 있을 때만 낸다
  function sfx(fn){
    if (!sfxOn) return;
    try { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); fn(ctx, sfxOut, ctx.currentTime); } catch (e) {}
  }
  return { setMode, setMusic, setSfx, get: () => ({ music: musicOn, sfx: sfxOn }), renderSchedule, sfx };
})();

const Sfx = (() => {
  const P = [0, 2, 4, 7, 9], mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function tn(ctx, out, type, f, t, dur, vol, att){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    tick(i){ Music.sfx((c, o, t) => { const m = 72 + P[i % 5] + 12 * (Math.floor(i / 5) % 2); tn(c, o, 'triangle', mtof(m), t, 0.16, 0.07, 0.004); tn(c, o, 'sine', mtof(m) * 2, t, 0.08, 0.02, 0.004); }); },
    connect(){ Music.sfx((c, o, t) => { [79, 86].forEach((m, k) => { tn(c, o, 'sine', mtof(m), t + k * 0.08, 0.45, 0.13, 0.005); tn(c, o, 'triangle', mtof(m) * 2, t + k * 0.08, 0.25, 0.04, 0.005); }); }); },
    clear(){ Music.sfx((c, o, t) => { [72, 76, 79, 84, 88, 91].forEach((m, k) => { tn(c, o, 'sine', mtof(m), t + k * 0.09, 0.7, 0.12, 0.006); tn(c, o, 'triangle', mtof(m) * 2, t + k * 0.09, 0.35, 0.04, 0.006); }); }); },
    click(){ Music.sfx((c, o, t) => { tn(c, o, 'sine', 880, t, 0.06, 0.05, 0.002); tn(c, o, 'sine', 1320, t + 0.01, 0.05, 0.02, 0.002); }); },
    cut(){ Music.sfx((c, o, t) => { tn(c, o, 'sine', 170, t, 0.12, 0.09, 0.004); }); },
    hint(){ Music.sfx((c, o, t) => { [88, 91, 95].forEach((m, k) => tn(c, o, 'sine', mtof(m), t + k * 0.06, 0.5, 0.06, 0.005)); }); }
  };
})();

