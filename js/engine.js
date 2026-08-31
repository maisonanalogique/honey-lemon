// Honey Lemon (蜂蜜檸檬) — pure game engine.
// No DOM, no network. Given a state + an action, produce the next state.
// Every display string lives in i18n.js; this file deals only in structured data.

// ---- Card catalogue -------------------------------------------------------
// A card is a plain object: { type, value? }.
//   jar | honey | lemon | lid | bear(value: 1|2|3) | bigbear | truck
//
// Full 48-card deck composition, per the rulebook.
export const DECK_COMPOSITION = [
  ['jar', 8],
  ['honey', 26],
  ['lemon', 3],
  ['lid', 5],
  ['bear1', 1],
  ['bear2', 1],
  ['bear3', 2],
  ['bigbear', 1],
  ['truck', 1],
];

// The recipe -> coins scoring ladder. Anything not listed is worth 0.
export const RECIPES = [
  { honey: 3, lemon: 1, coins: 8 },
  { honey: 3, lemon: 0, coins: 4 },
  { honey: 2, lemon: 0, coins: 2 },
  { honey: 1, lemon: 0, coins: 1 },
];

// Rounds per player-count, from the rulebook.
//   2 players -> 3 rounds; 3 players -> 4 rounds; 4 players -> teams, 3 rounds.
export function roundsFor(playerCount) {
  if (playerCount === 3) return 4;
  return 3;
}

// ---- Small helpers --------------------------------------------------------
let _id = 0;
function uid(prefix) {
  _id += 1;
  return `${prefix}${Date.now().toString(36)}${_id}`;
}

function cardFromToken(token) {
  if (token === 'bear1') return { type: 'bear', value: 1 };
  if (token === 'bear2') return { type: 'bear', value: 2 };
  if (token === 'bear3') return { type: 'bear', value: 3 };
  return { type: token };
}

// A deterministic-friendly shuffle. Pass a random fn for reproducible tests.
export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const cards = [];
  for (const [token, count] of DECK_COMPOSITION) {
    for (let i = 0; i < count; i += 1) cards.push(cardFromToken(token));
  }
  return cards;
}

function newJar() {
  return { id: uid('jar'), honey: 0, lemon: 0, lidded: false };
}

// ---- Scoring --------------------------------------------------------------
export function scoreJar(jar) {
  for (const r of RECIPES) {
    if (jar.honey === r.honey && jar.lemon === r.lemon) return r.coins;
  }
  return 0;
}

export function scorePlayerJars(player) {
  return player.jars.reduce((sum, j) => sum + scoreJar(j), 0);
}

// ---- Match / round lifecycle ---------------------------------------------
// players: [{ id, name }]. Seats are assigned in array order.
export function createMatch(players, rand = Math.random) {
  const teamMode = players.length === 4;
  const state = {
    phase: 'playing',
    players: players.map((p, seat) => ({
      id: p.id,
      name: p.name,
      seat,
      // 4-player team pairing from the rulebook: seats 0&2 vs 1&3 (A,C / B,D).
      team: teamMode ? seat % 2 : null,
      hand: [],
      jars: [],
    })),
    deck: [],
    discard: [],
    turnSeat: 0,
    round: 1,
    totalRounds: roundsFor(players.length),
    teamMode,
    // Cumulative coins across rounds, keyed by player id.
    totals: Object.fromEntries(players.map((p) => [p.id, 0])),
    roundScores: null, // filled in at round end
    log: [],
    version: 0,
  };
  return startRound(state, rand);
}

// Deal a fresh round: one jar in front of each player, shuffle the rest,
// then each player draws one starting hand card.
export function startRound(state, rand = Math.random) {
  const s = clone(state);
  let deck = buildDeck();

  // Each player takes one jar off the top of the (unshuffled) jar supply.
  for (const p of s.players) {
    p.jars = [newJar()];
    p.hand = [];
    const idx = deck.findIndex((c) => c.type === 'jar');
    deck.splice(idx, 1); // remove one jar from the supply
  }

  deck = shuffle(deck, rand);

  // Starting hand: one card each.
  for (const p of s.players) {
    p.hand.push(deck.pop());
  }

  s.deck = deck;
  s.discard = [];
  s.phase = 'playing';
  s.turnSeat = 0;
  s.roundScores = null;
  s.log = [{ t: 'roundStart', round: s.round }];
  s.version += 1;

  // The first player draws for their turn immediately.
  return beginTurn(s);
}

// Draw one card for whoever's turn it now is (if the deck has cards).
function beginTurn(state) {
  const s = state; // caller already cloned
  const p = currentPlayer(s);
  if (s.deck.length > 0) {
    p.hand.push(s.deck.pop());
    s.log.push({ t: 'draw', player: p.id });
  }
  return s;
}

// ---- Queries used by the UI ----------------------------------------------
export function currentPlayer(state) {
  return state.players.find((p) => p.seat === state.turnSeat);
}

export function allJars(state) {
  return state.players.flatMap((p) => p.jars.map((j) => ({ ownerId: p.id, jar: j })));
}

function anyUnliddedJar(state) {
  return state.players.some((p) => p.jars.some((j) => !j.lidded));
}

function anyUnlidddedHoney(state) {
  return state.players.some((p) => p.jars.some((j) => !j.lidded && j.honey > 0));
}

// Can the given hand card be legally played right now? (Used for the
// "you must play a card unless you truly can't" rule.)
export function cardIsPlayable(state, card) {
  switch (card.type) {
    case 'jar':
    case 'bigbear':
    case 'truck':
      return true;
    case 'honey':
    case 'lemon':
    case 'lid':
      return anyUnliddedJar(state);
    case 'bear':
      return anyUnlidddedHoney(state);
    default:
      return false;
  }
}

// The list of legal targets for a card the current player is holding.
// Returns an array of targets; shape depends on the card:
//   jar             -> [{ playerId }]
//   honey/lemon/lid -> [{ playerId, jarId }] (unlidded jars)
//   bear            -> [{ playerId, jarId }] (unlidded jars with honey > 0)
//   bigbear/truck   -> [{}] (no target needed)
export function legalTargets(state, card) {
  switch (card.type) {
    case 'jar':
      return state.players.map((p) => ({ playerId: p.id }));
    case 'honey':
    case 'lemon':
    case 'lid': {
      const out = [];
      for (const p of state.players)
        for (const j of p.jars) if (!j.lidded) out.push({ playerId: p.id, jarId: j.id });
      return out;
    }
    case 'bear': {
      // A bear must go for a jar that fills it up: it targets the jar(s) that
      // maximize honey eaten = min(value, jarHoney). So a 3-bear must eat a
      // 3+-honey jar if any exists (own or another's), only then a 2-, then a
      // 1-honey jar; a 2-bear must eat a 2+-honey jar over a 1-honey one.
      const jars = [];
      for (const p of state.players)
        for (const j of p.jars)
          if (!j.lidded && j.honey > 0) {
            jars.push({ playerId: p.id, jarId: j.id, eaten: Math.min(card.value, j.honey) });
          }
      if (!jars.length) return [];
      const best = Math.max(...jars.map((j) => j.eaten));
      return jars.filter((j) => j.eaten === best).map((j) => ({ playerId: j.playerId, jarId: j.jarId }));
    }
    case 'bigbear':
    case 'truck':
      return [{}];
    default:
      return [];
  }
}

export function currentPlayerHasLegalMove(state) {
  return currentPlayer(state).hand.some((c) => cardIsPlayable(state, c));
}

// ---- Applying moves -------------------------------------------------------
function findJar(state, playerId, jarId) {
  const p = state.players.find((x) => x.id === playerId);
  return p ? p.jars.find((j) => j.id === jarId) : null;
}

// Play the card at handIndex from the current player onto `target`.
// Throws on an illegal move; the UI is expected to only offer legal ones.
export function playCard(state, playerId, handIndex, target = {}) {
  const s = clone(state);
  const actor = currentPlayer(s);
  if (actor.id !== playerId) throw new Error('not your turn');

  const card = actor.hand[handIndex];
  if (!card) throw new Error('no such card');
  if (!cardIsPlayable(s, card)) throw new Error('card not playable');

  actor.hand.splice(handIndex, 1);
  const entry = { t: 'play', by: actor.id, card: describe(card), target: { ...target } };

  switch (card.type) {
    case 'jar': {
      const owner = s.players.find((p) => p.id === target.playerId);
      owner.jars.push(newJar());
      entry.targetName = owner.name;
      break;
    }
    case 'honey': {
      const jar = findJar(s, target.playerId, target.jarId);
      jar.honey += 1;
      entry.targetName = ownerName(s, target.playerId);
      break;
    }
    case 'lemon': {
      const jar = findJar(s, target.playerId, target.jarId);
      jar.lemon += 1;
      entry.targetName = ownerName(s, target.playerId);
      break;
    }
    case 'lid': {
      const jar = findJar(s, target.playerId, target.jarId);
      jar.lidded = true;
      entry.targetName = ownerName(s, target.playerId);
      break;
    }
    case 'bear': {
      // The chosen jar must be one the bear is allowed to eat (fullest-first).
      const allowed = legalTargets(s, card)
        .some((tg) => tg.playerId === target.playerId && tg.jarId === target.jarId);
      if (!allowed) throw new Error('bear must eat a fullest jar');
      const jar = findJar(s, target.playerId, target.jarId);
      // Eat exactly `value` honey, or all of it if there's less (no picking).
      const eaten = Math.min(card.value, jar.honey);
      jar.honey -= eaten;
      entry.eaten = eaten;
      entry.targetName = ownerName(s, target.playerId);
      break;
    }
    case 'bigbear': {
      // Eats ALL uncovered honey and lemon everywhere, including the actor's.
      for (const p of s.players)
        for (const j of p.jars)
          if (!j.lidded) { j.honey = 0; j.lemon = 0; }
      break;
    }
    case 'truck': {
      s.discard.push(card);
      s.log.push(entry);
      return endRound(s);
    }
    default:
      throw new Error(`unknown card ${card.type}`);
  }

  s.discard.push(card);
  s.log.push(entry);
  return endTurn(s);
}

// Discard a card. Allowed for any card that has no legal play right now —
// whether or not the rest of your hand is playable. (You still can't ditch a
// playable card to dodge playing it; and jar/bigbear/truck are always playable,
// so they can never be discarded.) This lets a player sitting on a stuck card
// (e.g. a lid with every jar already lidded) plus a truck choose to bin the
// stuck card instead of being forced to play the truck.
export function discardCard(state, playerId, handIndex) {
  const s = clone(state);
  const actor = currentPlayer(s);
  if (actor.id !== playerId) throw new Error('not your turn');
  const card = actor.hand[handIndex];
  if (!card) throw new Error('no such card');
  if (cardIsPlayable(s, card)) throw new Error('that card is playable — play it');
  actor.hand.splice(handIndex, 1);
  s.discard.push(card);
  s.log.push({ t: 'discard', by: actor.id, card: describe(card) });
  return endTurn(s);
}

// Advance to the next seat and draw for them.
function endTurn(state) {
  const s = state; // already cloned
  s.turnSeat = (s.turnSeat + 1) % s.players.length;
  s.version += 1;
  // If the deck is exhausted and the next player has an empty hand, the round
  // can't continue — settle it. (Rare; the truck usually ends things first.)
  const next = currentPlayer(s);
  if (s.deck.length === 0 && next.hand.length === 0) return endRound(s);
  return beginTurn(s);
}

// ---- Round / match settlement --------------------------------------------
export function endRound(state) {
  const s = clone(state);
  const perPlayer = {};
  for (const p of s.players) {
    const gained = scorePlayerJars(p);
    perPlayer[p.id] = gained;
    s.totals[p.id] += gained;
  }
  s.roundScores = perPlayer;
  s.phase = s.round >= s.totalRounds ? 'matchEnd' : 'roundEnd';
  s.log.push({ t: 'roundEnd', round: s.round, scores: perPlayer });
  s.version += 1;
  return s;
}

// Called from the UI after players have seen the round-end summary.
export function advanceRound(state, rand = Math.random) {
  if (state.phase !== 'roundEnd') return state;
  const s = clone(state);
  s.round += 1;
  return startRound(s, rand);
}

// Final standings. For team mode, teammates' totals are summed.
export function standings(state) {
  if (state.teamMode) {
    const teams = {};
    for (const p of state.players) {
      teams[p.team] = teams[p.team] || { team: p.team, members: [], coins: 0 };
      teams[p.team].members.push(p.name);
      teams[p.team].coins += state.totals[p.id];
    }
    return Object.values(teams).sort((a, b) => b.coins - a.coins);
  }
  return state.players
    .map((p) => ({ name: p.name, coins: state.totals[p.id] }))
    .sort((a, b) => b.coins - a.coins);
}

// ---- Misc -----------------------------------------------------------------
// A language-neutral descriptor the UI turns into localized text.
function describe(card) {
  return card.type === 'bear' ? { type: 'bear', value: card.value } : { type: card.type };
}

function ownerName(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  return p ? p.name : '?';
}

// Structured clone is available in Node 17+ and all modern browsers.
function clone(x) {
  return typeof structuredClone === 'function'
    ? structuredClone(x)
    : JSON.parse(JSON.stringify(x));
}
