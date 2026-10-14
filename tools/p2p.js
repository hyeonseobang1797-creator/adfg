// ---------------- 기기끼리 직접 연결하는 방 (WebRTC) ----------------
// 방 코드 하나가 방장의 연결 이름이 된다. 방장이 모두와 연결하고 소식을 나눠 준다.
// PeerJS의 공개 중개 서버는 처음 연결을 맺을 때만 쓰고, 그 뒤의 데이터는 기기끼리 직접 오간다.
// 반환하는 방 객체는 아티팩트의 room 기능과 같은 모양(emit/on/peers/onPeers/presence/leave)이다.
const DotsP2P = (() => {
  const cfg = () => Object.assign({ debug: 0 }, (typeof window !== 'undefined' && window.DOTS_PEER) || {});
  const ID = code => 'dotsmp-' + code;
  const supported = () => typeof window !== 'undefined' && !!window.RTCPeerConnection && !!window.Peer;
  function makeRoom(peer, selfId, isHost, hostConn){
    const evh = {}, ph = [], closeH = [];
    const conns = {};
    let peers = {}, snapshot = [], dead = false;
    peers[selfId] = { peer: selfId, presence: {} };
    const one = (id, pr) => ({ peer: id, by: null, isMe: id === selfId, sameTab: id === selfId, kind: 'viewer', guest: false, presence: Object.freeze(Object.assign({}, pr)), updatedAt: Date.now() });
    const rebuild = () => { snapshot = Object.keys(peers).map(id => one(id, peers[id].presence)); };
    const refresh = (joined, left, updated) => {
      rebuild();
      const pick = ids => snapshot.filter(p => ids.includes(p.peer));
      const ch = { peers: snapshot, joined: pick(joined || []), left: (left || []).map(id => one(id, {})), updated: pick(updated || []) };
      ph.slice().forEach(f => { try { f(ch); } catch (e) {} });
    };
    rebuild();
    const deliver = (topic, data, from) => {
      (evh[topic] || []).slice().forEach(f => { try { f({ topic, data, peer: from, by: null, isMe: from === selfId, sameTab: from === selfId, kind: 'viewer', guest: false }); } catch (e) {} });
    };
    const list = () => Object.keys(peers).map(id => ({ peer: id, presence: peers[id].presence }));
    const sendAll = (m, except) => { for (const id in conns) if (id !== except) { try { conns[id].send(m); } catch (e) {} } };
    const broadcastPeers = () => sendAll({ k: 'peers', list: list() });
    const clean = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    if (isHost){
      peer.on('connection', conn => {
        conn.on('open', () => {
          if (dead) { try { conn.close(); } catch (e) {} return; }
          conns[conn.peer] = conn; peers[conn.peer] = { peer: conn.peer, presence: {} };
          broadcastPeers(); refresh([conn.peer]);
        });
        conn.on('data', d => {
          if (!d || typeof d !== 'object' || !peers[conn.peer]) return;
          if (d.k === 'ev' && typeof d.topic === 'string'){ deliver(d.topic, d.data, conn.peer); sendAll({ k: 'ev', topic: d.topic, data: d.data, peer: conn.peer }, conn.peer); }
          else if (d.k === 'pr'){ peers[conn.peer].presence = clean(d.presence); broadcastPeers(); refresh([], [], [conn.peer]); }
        });
        const gone = () => { if (!peers[conn.peer]) return; delete peers[conn.peer]; delete conns[conn.peer]; broadcastPeers(); refresh([], [conn.peer]); };
        conn.on('close', gone); conn.on('error', gone);
      });
    } else {
      hostConn.on('data', d => {
        if (!d || typeof d !== 'object') return;
        if (d.k === 'ev' && typeof d.topic === 'string') deliver(d.topic, d.data, String(d.peer));
        else if (d.k === 'peers' && Array.isArray(d.list)){
          const next = {}; d.list.forEach(p => { if (p && typeof p.peer === 'string') next[p.peer] = { peer: p.peer, presence: clean(p.presence) }; });
          const joined = Object.keys(next).filter(id => !peers[id]), left = Object.keys(peers).filter(id => !next[id]);
          const updated = Object.keys(next).filter(id => peers[id] && JSON.stringify(peers[id].presence) !== JSON.stringify(next[id].presence));
          peers = next; refresh(joined, left, updated);
        }
      });
      const closed = () => { if (dead) return; dead = true; closeH.slice().forEach(f => { try { f(); } catch (e) {} }); };
      hostConn.on('close', closed); hostConn.on('error', closed);
    }
    const room = {
      name: 'p2p',
      emit: async (topic, data) => {
        const copy = JSON.parse(JSON.stringify(data === undefined ? null : data));
        if (isHost) sendAll({ k: 'ev', topic, data: copy, peer: selfId }); else { try { hostConn.send({ k: 'ev', topic, data: copy }); } catch (e) {} }
        setTimeout(() => { if (!dead) deliver(topic, copy, selfId); }, 0);
      },
      on: (topic, f) => { (evh[topic] = evh[topic] || []).push(f); return () => { evh[topic] = (evh[topic] || []).filter(x => x !== f); }; },
      presence: async patch => {
        const mine = Object.assign({}, peers[selfId] && peers[selfId].presence, patch);
        for (const k in mine) if (mine[k] === null) delete mine[k];
        if (peers[selfId]) peers[selfId].presence = mine;
        if (isHost){ broadcastPeers(); refresh([], [], [selfId]); }
        else { refresh([], [], [selfId]); try { hostConn.send({ k: 'pr', presence: mine }); } catch (e) {} }
      },
      peers: () => snapshot,
      onPeers: f => { ph.push(f); Promise.resolve().then(() => { if (ph.includes(f)) f({ peers: snapshot, joined: snapshot, left: [], updated: [] }); }); return () => { const i = ph.indexOf(f); if (i >= 0) ph.splice(i, 1); }; },
      onClose: f => { closeH.push(f); return () => { const i = closeH.indexOf(f); if (i >= 0) closeH.splice(i, 1); }; },
      connected: () => !dead,
      leave: async () => { dead = true; try { peer.destroy(); } catch (e) {} }
    };
    return room;
  }
  const guard = (peer, reject, ms) => {
    let done = false;
    const t = setTimeout(() => fail({ type: 'timeout' }), ms || 9000);
    function fail(e){ if (done) return; done = true; clearTimeout(t); try { peer.destroy(); } catch (x) {} reject(e); }
    return { fail, ok: () => { done = true; clearTimeout(t); }, isDone: () => done };
  };
  function host(code){
    return new Promise((resolve, reject) => {
      if (!supported()) return reject({ type: 'unsupported' });
      let peer; try { peer = new Peer(ID(code), cfg()); } catch (e) { return reject({ type: 'unsupported' }); }
      const g = guard(peer, reject);
      peer.on('open', id => { if (g.isDone()) return; g.ok(); resolve(makeRoom(peer, id, true)); });
      peer.on('error', e => { if (!g.isDone()) g.fail({ type: e && e.type || 'error' }); });
    });
  }
  function join(code){
    return new Promise((resolve, reject) => {
      if (!supported()) return reject({ type: 'unsupported' });
      let peer; try { peer = new Peer(undefined, cfg()); } catch (e) { return reject({ type: 'unsupported' }); }
      const g = guard(peer, reject);
      peer.on('error', e => { if (!g.isDone()) g.fail({ type: e && e.type || 'error' }); });
      peer.on('open', id => {
        if (g.isDone()) return;
        const conn = peer.connect(ID(code), { serialization: 'json', reliable: true });
        conn.on('open', () => { if (g.isDone()) return; g.ok(); resolve(makeRoom(peer, id, false, conn)); });
        conn.on('error', () => { if (!g.isDone()) g.fail({ type: 'peer-unavailable' }); });
      });
    });
  }
  return { host, join, supported };
})();
