// Online store backed by Firebase Realtime Database. Same surface as the
// hotseat store: subscribe(fn) + update(mutator). The whole room lives at
// rooms/{CODE} as one JSON document:
//   { code, players: [{id,name,seat}], started: bool, state: <game state|null> }
//
// Only the current player ever writes game state, so moves serialize
// naturally; we still use transactions so lobby joins don't clobber.
//
// The Firebase SDK is imported lazily (dynamic import) so that pass-and-play
// mode never needs the network or the library at all.

const SDK = '10.12.0';
const MAX_PLAYERS = 4;

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/0/1
  let s = '';
  for (let i = 0; i < 4; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function genId() {
  return `p${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

// mode: 'create' | 'join'. isPublic (create only) lists the room on the homepage.
export async function createOnlineStore({ config, mode, code, name, isPublic }) {
  const { initializeApp } = await import(
    `https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`
  );
  const { getDatabase, ref, onValue, runTransaction, get, set } = await import(
    `https://www.gstatic.com/firebasejs/${SDK}/firebase-database.js`
  );

  const myId = genId();
  // Unique app name so re-joining / a second store in the same tab doesn't
  // throw "Firebase App named '[DEFAULT]' already exists".
  const app = initializeApp(config, `hl-${myId}`);
  const db = getDatabase(app);
  let roomCode;

  if (mode === 'create') {
    roomCode = genCode();
    await set(ref(db, `rooms/${roomCode}`), {
      code: roomCode,
      // players is a MAP keyed by id, not an array: each client writes only its
      // own child, so joins never race and need no read-modify-write transaction.
      players: { [myId]: { name, joinedAt: Date.now() } },
      started: false,
      public: !!isPublic,
      state: null,
      createdAt: Date.now(),
    });
  } else {
    roomCode = (code || '').toUpperCase().trim();
    const snap = await get(ref(db, `rooms/${roomCode}`));
    if (!snap.exists()) throw new Error('room-not-found');
    const room = snap.val();
    if (room.started) throw new Error('cannot-join');
    if (Object.keys(room.players || {}).length >= MAX_PLAYERS) throw new Error('cannot-join');
    await set(ref(db, `rooms/${roomCode}/players/${myId}`), { name, joinedAt: Date.now() });
  }

  const roomRef = ref(db, `rooms/${roomCode}`);
  let unsub = null;

  return {
    mode: 'online',
    code: roomCode,
    myId,
    isHost: mode === 'create',

    subscribe(fn) {
      unsub = onValue(roomRef, (snap) => fn(snap.val()));
    },

    // mutator: (currentDoc) => newDoc. Runs inside a transaction.
    async update(mutator) {
      // Only the acting player writes game state, so contention is minimal; the
      // transaction just guards a rare concurrent write. Return room unchanged
      // on the null first-pass so RTDB re-runs with real server data.
      await runTransaction(roomRef, (room) => (room ? mutator(room) : room));
    },

    // Leave the lobby (pre-game only). The host closes the whole room; anyone
    // else just removes their own player entry.
    async leave() {
      if (mode === 'create') await set(roomRef, null);
      else await set(ref(db, `rooms/${roomCode}/players/${myId}`), null);
    },

    // Stop listening — call when leaving so a stale listener can't fire.
    disconnect() {
      if (unsub) unsub();
      unsub = null;
    },
  };
}

// Live list of open, public, joinable rooms for the homepage. Calls onList with
// an array of { code, count, hostName, createdAt }. Returns an unsubscribe fn.
// Uses a server-side filter on `started` so active games' large state isn't
// downloaded; public/full/stale filtering happens client-side.
export async function browseRooms(config, onList) {
  const { initializeApp, getApps } = await import(
    `https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`
  );
  const { getDatabase, ref, query, orderByChild, equalTo, onValue } = await import(
    `https://www.gstatic.com/firebasejs/${SDK}/firebase-database.js`
  );
  const existing = getApps().find((a) => a.name === 'hl-browse');
  const app = existing || initializeApp(config, 'hl-browse');
  const db = getDatabase(app);
  const openRooms = query(ref(db, 'rooms'), orderByChild('started'), equalTo(false));
  const HOUR = 60 * 60 * 1000;

  return onValue(openRooms, (snap) => {
    const rooms = snap.val() || {};
    const now = Date.now();
    const list = Object.entries(rooms)
      .filter(([, r]) => r && r.public && !r.started)
      .map(([roomCode, r]) => {
        const arr = Object.values(r.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
        return { code: roomCode, count: arr.length, hostName: arr[0] ? arr[0].name : '?', createdAt: r.createdAt || 0 };
      })
      .filter((x) => x.count >= 1 && x.count < 4 && now - x.createdAt < HOUR)
      .sort((a, b) => b.createdAt - a.createdAt);
    onList(list);
  }, () => onList([]));
}
