const COLORS = ['#ff4d4d','#3fa9ff','#ffd23f','#3ddc84','#ff8c1a','#c26bff','#00e5d0','#ff6bb5','#a0a8ff','#b5651d','#c8ff3f','#ffffff','#7a5cff','#ff9e9e','#2f8f5b','#d4a5ff','#4d6bff','#ffb36b','#6bffd8','#e04dff','#9aff4d','#ff4d9a','#4dd2ff','#d9b38c'];
const TOTAL = 500;
const KINDS = ['', '어려움', '하드', '쉬움'];

// 스테이지가 올라갈수록 조금씩 계속 어려워진다: 판이 커지고, 선이 길고 구불해지고, 색이 늘어난다
function stageParams(i){
  const d = i / (TOTAL - 1), no = i + 1;
  // 1~60번은 쉬움: 4×4, 5×5, 6×6 중 무작위. 이후는 갈수록 어려워진다.
  // 10스테이지마다 어려움, 300스테이지부터는 어려움과 하드가 번갈아 나온다.
  let kind = no <= 60 ? 3 : 0;
  if (no % 10 === 0) kind = no >= 300 && (no / 10) % 2 === 0 ? 2 : 1;
  const base = no <= 60 ? 4 + Math.floor(mulberry32(no * 31 + 5)() * 3) : 6 + Math.min(4, Math.floor((no - 61) / 440 * 5));
  return {
    kind, d,
    n: Math.min(12, base + [0, 1, 2, 0][kind]),
    pBreak: 0.30 - 0.22 * d - [0, 0.04, 0.07, 0][kind],
    lo: 0.7, hi: 1.0 + 0.3 * d
  };
}
function maxHints(kind){ return kind === 1 || kind === 2 ? 3 : 2; }

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function neighbors(i, n){
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

// 격자를 겹치지 않는 경로로 완전히 분할 -> 항상 풀 수 있는 퍼즐
function generate(n, pBreak, kMin, kMax, seed){
  const rnd = mulberry32(seed), N = n * n;
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++){
    const owner = new Array(N).fill(-1);
    const freeCnt = new Array(N);
    for (let i = 0; i < N; i++) freeCnt[i] = neighbors(i, n).length;
    const take = i => { owner[i] = 1; neighbors(i, n).forEach(x => freeCnt[x]--); };
    const paths = [];
    let left = N, bad = false;
    while (left > 0){
      let best = [], bf = 99;
      for (let i = 0; i < N; i++){
        if (owner[i] !== -1) continue;
        if (freeCnt[i] < bf){ bf = freeCnt[i]; best = [i]; }
        else if (freeCnt[i] === bf) best.push(i);
      }
      let cur = best[Math.floor(rnd() * best.length)];
      const path = [cur]; take(cur); left--;
      for (;;){
        const free = neighbors(cur, n).filter(x => owner[x] === -1);
        if (!free.length) break;
        if (path.length >= 3 && rnd() < pBreak) break;
        free.sort((a, b) => freeCnt[a] - freeCnt[b] + (rnd() - 0.5) * 2.2);
        cur = free[0]; take(cur); left--; path.push(cur);
      }
      if (path.length < 2){ bad = true; break; }
      paths.push(path);
    }
    if (bad) continue;
    if (paths.length >= kMin && paths.length <= kMax) return paths;
    if (!fallback && paths.length <= 16) fallback = paths;
  }
  return fallback;
}

// 해가 몇 개인지 센다 (최대 2개까지). 시간 초과면 aborted
function solve(n, sol, nodeLimit){
  const N = n * n, K = sol.length;
  const owner = new Int8Array(N).fill(-1), head = new Int32Array(K), target = new Int32Array(K), done = new Uint8Array(K);
  const nb = []; for (let i = 0; i < N; i++) nb.push(neighbors(i, n));
  for (let c = 0; c < K; c++){
    head[c] = sol[c][0]; target[c] = sol[c][sol[c].length - 1];
    owner[head[c]] = c; owner[target[c]] = c;
  }
  const found = []; let nodes = 0, aborted = false;
  function ok(){
    for (let i = 0; i < N; i++){
      if (owner[i] !== -1) continue;
      let av = 0; const L = nb[i];
      for (let j = 0; j < L.length; j++){
        const x = L[j], o = owner[x];
        if (o === -1 || (!done[o] && (head[o] === x || target[o] === x))) av++;
      }
      if (av < 2) return false;
    }
    return true;
  }
  function dfs(){
    if (aborted || found.length >= 2) return;
    if (++nodes > nodeLimit){ aborted = true; return; }
    let bc = -1, bo = null;
    for (let c = 0; c < K; c++){
      if (done[c]) continue;
      const opts = nb[head[c]].filter(x => owner[x] === -1 || x === target[c]);
      if (!opts.length) return;
      if (!bo || opts.length < bo.length){ bc = c; bo = opts; }
    }
    if (bc === -1){
      for (let i = 0; i < N; i++) if (owner[i] === -1) return;
      found.push(Array.from(owner)); return;
    }
    const c = bc, oldHead = head[c];
    for (const x of bo){
      if (x === target[c]){ done[c] = 1; if (ok()) dfs(); done[c] = 0; }
      else { owner[x] = c; head[c] = x; if (ok()) dfs(); owner[x] = -1; head[c] = oldHead; }
      if (aborted || found.length >= 2) return;
    }
  }
  dfs();
  return { found, aborted, nodes };
}

// 풀이가 여러 개면 두 풀이가 갈리는 곳에서 선을 둘로 쪼개 해를 하나로 만든다
function makeUnique(n, sol, rnd, deadline, nodeLimit){
  sol = sol.map(p => p.slice());
  for (let round = 0; round < 40 && Date.now() < deadline; round++){
    const r = solve(n, sol, nodeLimit || 15000);
    if (!r.aborted && r.found.length === 1) return { sol, unique: true };
    if (sol.length >= COLORS.length) break;
    const mine = new Array(n * n);
    sol.forEach((p, c) => p.forEach(x => mine[x] = c));
    let cand = [];
    if (r.found.length >= 2) {
      const other = r.found[1].some((v, i) => v !== mine[i]) ? r.found[1] : r.found[0];
      for (let i = 0; i < n * n; i++) if (other[i] !== mine[i]) cand.push(i);
    } else {
      sol.forEach(p => { if (p.length >= 4) cand.push(p[p.length >> 1]); });
    }
    let did = false;
    for (let t = 0; t < 60 && cand.length && !did; t++){
      const x = cand[Math.floor(rnd() * cand.length)];
      const c = mine[x], p = sol[c], j = p.indexOf(x);
      for (const cut of rnd() < .5 ? [j, j - 1] : [j - 1, j]){
        // p[0..cut] 와 p[cut+1..] 모두 길이 2 이상
        if (cut >= 1 && p.length - cut - 1 >= 2){
          sol.splice(c, 1, p.slice(0, cut + 1), p.slice(cut + 1)); did = true; break;
        }
      }
    }
    if (!did) break;
  }
  return { sol, unique: false };
}

// 회전·뒤집기·색 바꿈이 같으면 같은 퍼즐로 본다
function signature(n, sol){
  const pts = sol.map(p => [p[0], p[p.length - 1]].map(c => [Math.floor(c / n), c % n]));
  let best = null;
  for (let tr = 0; tr < 8; tr++){
    const f = pt => {
      let r = pt[0], c = pt[1];
      if (tr & 4){ const t = r; r = c; c = t; }
      if (tr & 1) r = n - 1 - r;
      if (tr & 2) c = n - 1 - c;
      return r * n + c;
    };
    const key = pts.map(pr => pr.map(f).sort((x, y) => x - y).join('-')).sort().join('|');
    if (best === null || key < best) best = key;
  }
  return best;
}


module.exports = { COLORS, TOTAL, KINDS, stageParams, maxHints, mulberry32, neighbors, generate, solve, makeUnique, signature };
