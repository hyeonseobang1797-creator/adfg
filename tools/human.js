// 사람이 푸는 방식에 가까운 난이도 측정기.
// 규칙: (1) 갈 곳이 한 곳뿐인 선은 그대로 간다 (2) 어떤 선도 지나갈 수 없는 죽은 칸이 생기면 모순
// 막히면 "한 수 앞(L=1), 두 수 앞(L=2)…을 가정해서 모순이 나는 후보를 지운다".
// 난이도 = 끝까지 풀리는 데 필요한 가장 얕은 가정 깊이 L, 그 안에서 시도해 본 가정 수 E.
const { neighbors } = require('./core');

function make(n, sol){
  const N = n * n, K = sol.length;
  const nb = []; for (let i = 0; i < N; i++) nb.push(neighbors(i, n));
  const st = { owner: new Int8Array(N).fill(-1), head: new Int32Array(K), done: new Uint8Array(K), bans: new Set(), left: N - 2 * K };
  const target = new Int32Array(K);
  for (let c = 0; c < K; c++){
    st.head[c] = sol[c][0]; target[c] = sol[c][sol[c].length - 1];
    st.owner[st.head[c]] = c; st.owner[target[c]] = c;
  }
  return { n, N, K, nb, target, st };
}
const clone = s => ({ owner: s.owner.slice(), head: s.head.slice(), done: s.done.slice(), bans: new Set(s.bans), left: s.left });

function options(P, s, c){
  const h = s.head[c], out = [];
  for (const x of P.nb[h]){
    if ((s.owner[x] === -1 || x === P.target[c]) && !s.bans.has((c * P.N + h) * P.N + x)) out.push(x);
  }
  return out;
}
function apply(P, s, c, x){
  if (x === P.target[c]) s.done[c] = 1;
  else { s.owner[x] = c; s.head[c] = x; s.left--; }
}
function deadCell(P, s){
  for (let i = 0; i < P.N; i++){
    if (s.owner[i] !== -1) continue;
    let av = 0;
    for (const x of P.nb[i]){
      const o = s.owner[x];
      if (o === -1 || (!s.done[o] && (s.head[o] === x || P.target[o] === x))) av++;
    }
    if (av < 2) return true;
  }
  return false;
}
// 'ok' | 'contra' | 'solved'
function propagate(P, s){
  for (;;){
    if (deadCell(P, s)) return 'contra';
    let moved = false, open = 0;
    for (let c = 0; c < P.K; c++){
      if (s.done[c]) continue;
      open++;
      const o = options(P, s, c);
      if (o.length === 0) return 'contra';
      if (o.length === 1){ apply(P, s, c, o[0]); moved = true; }
    }
    if (open === 0) return s.left === 0 ? 'solved' : 'contra';
    if (!moved) return 'ok';
  }
}
function run(P, s, L, ctx){
  for (;;){
    const r = propagate(P, s);
    if (r !== 'ok') return r;
    if (L === 0) return 'stuck';
    let changed = false;
    for (let c = 0; c < P.K && !changed; c++){
      if (s.done[c]) continue;
      for (const x of options(P, s, c)){
        if (++ctx.trials > ctx.limit){ ctx.over = true; return 'stuck'; }
        const t = clone(s); apply(P, t, c, x);
        const res = run(P, t, L - 1, ctx);
        if (ctx.over) return 'stuck';
        if (res === 'contra'){ s.bans.add((c * P.N + s.head[c]) * P.N + x); changed = true; break; }
        if (res === 'solved'){ Object.assign(s, t); return 'solved'; }
      }
    }
    if (!changed) return 'stuck';
  }
}
// 반환: { level, effort }  level 6 = 한도 안에서 못 풂
function rate(n, sol, maxL = 4, limit = 60000){
  const P = make(n, sol);
  let effort = 0;
  for (let L = 0; L <= maxL; L++){
    const ctx = { trials: 0, limit, over: false };
    const r = run(P, clone(P.st), L, ctx);
    effort += ctx.trials;
    if (r === 'solved') return { level: L, effort };
    if (ctx.over) break;
  }
  return { level: maxL + 1, effort };
}
module.exports = { rate };
