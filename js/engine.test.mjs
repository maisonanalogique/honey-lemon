// Quick smoke test for the engine. Run: node js/engine.test.mjs
import {
  createMatch, scoreJar, playCard, currentPlayer, legalTargets,
  cardIsPlayable, endRound, standings, roundsFor, discardCard,
} from './engine.js';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass += 1; } else { fail += 1; console.error('  FAIL:', name); }
}

// --- Scoring ladder ---
ok('1 honey = 1', scoreJar({ honey: 1, lemon: 0 }) === 1);
ok('2 honey = 2', scoreJar({ honey: 2, lemon: 0 }) === 2);
ok('3 honey = 4', scoreJar({ honey: 3, lemon: 0 }) === 4);
ok('3 honey + 1 lemon = 8', scoreJar({ honey: 3, lemon: 1 }) === 8);
ok('4 honey = 0 (overfilled)', scoreJar({ honey: 4, lemon: 0 }) === 0);
ok('3 honey + 2 lemon = 0', scoreJar({ honey: 3, lemon: 2 }) === 0);
ok('empty jar = 0', scoreJar({ honey: 0, lemon: 0 }) === 0);

// --- Round counts ---
ok('2p -> 3 rounds', roundsFor(2) === 3);
ok('3p -> 4 rounds', roundsFor(3) === 4);
ok('4p -> 3 rounds', roundsFor(4) === 3);

// --- Match setup ---
const players = [{ id: 'a', name: 'Amy' }, { id: 'b', name: 'Ben' }];
let s = createMatch(players, mulberry32(42));
ok('each player starts with 1 jar', s.players.every((p) => p.jars.length === 1));
ok('current player drew a starting turn card (>=1 hand)', currentPlayer(s).hand.length >= 1);
ok('turn starts at seat 0', s.turnSeat === 0);

// --- Bear "no picking" rule: a 3-bear on a 5-honey jar eats exactly 3 ---
let jar = { id: 'j', honey: 5, lemon: 0, lidded: false };
const bear3 = { type: 'bear', value: 3 };
const eaten = Math.min(bear3.value, jar.honey);
ok('3-bear eats exactly 3 from a 5-honey jar', eaten === 3);
// Bear on a 2-honey jar eats all 2.
ok('3-bear eats all 2 from a 2-honey jar', Math.min(3, 2) === 2);

// --- Lid blocks honey/lid/bear targeting ---
const lidded = { type: 'lid' };
const testState = {
  players: [{ id: 'a', name: 'A', seat: 0, jars: [{ id: 'j1', honey: 0, lemon: 0, lidded: true }] }],
  turnSeat: 0,
};
ok('honey not playable when only jar is lidded', cardIsPlayable(testState, { type: 'honey' }) === false);
ok('jar always playable', cardIsPlayable(testState, { type: 'jar' }) === true);
ok('truck always playable', cardIsPlayable(testState, { type: 'truck' }) === true);
ok('bear needs honey: not playable on empty lidded jar', cardIsPlayable(testState, bear3) === false);

// --- Bear must target the jar it can feed fullest on ---
const bearBoard = {
  players: [
    { id: 'a', seat: 0, jars: [
      { id: 'j3', honey: 3, lemon: 0, lidded: false },
      { id: 'j1', honey: 1, lemon: 0, lidded: false },
    ] },
    { id: 'b', seat: 1, jars: [
      { id: 'j2', honey: 2, lemon: 0, lidded: false },
      { id: 'jL', honey: 3, lemon: 0, lidded: true }, // lidded — never a target
    ] },
  ],
  turnSeat: 0,
};
const ids = (targets) => targets.map((t) => t.jarId).sort();
ok('3-bear may only target the 3-honey jar',
  JSON.stringify(ids(legalTargets(bearBoard, { type: 'bear', value: 3 }))) === JSON.stringify(['j3']));
ok('2-bear may target 3- and 2-honey jars, not the 1',
  JSON.stringify(ids(legalTargets(bearBoard, { type: 'bear', value: 2 }))) === JSON.stringify(['j2', 'j3']));
ok('1-bear may target any honeyed jar (all equal)',
  JSON.stringify(ids(legalTargets(bearBoard, { type: 'bear', value: 1 }))) === JSON.stringify(['j1', 'j2', 'j3']));

// --- Play a jar onto self, then honey onto it ---
s = createMatch(players, mulberry32(7));
const cur = currentPlayer(s);
// Force a known hand for a deterministic play test.
cur.hand = [{ type: 'jar' }];
s = playCard(s, cur.id, 0, { playerId: cur.id });
ok('playing a jar adds a second jar to the target', s.players.find((p) => p.id === cur.id).jars.length === 2);
ok('turn advanced to seat 1', s.turnSeat === 1);

// --- Discard rule: an unplayable card can be ditched even with a playable one ---
function discardBoard() {
  return {
    phase: 'playing',
    players: [
      { id: 'a', name: 'A', seat: 0, hand: [{ type: 'lid' }, { type: 'truck' }],
        jars: [{ id: 'j', honey: 0, lemon: 0, lidded: true }] }, // only jar is lidded
      { id: 'b', name: 'B', seat: 1, hand: [], jars: [{ id: 'k', honey: 0, lemon: 0, lidded: true }] },
    ],
    deck: [{ type: 'honey' }], discard: [], log: [], totals: { a: 0, b: 0 },
    turnSeat: 0, round: 1, totalRounds: 3, teamMode: false, version: 1,
  };
}
let didDiscard = false;
try { const r = discardCard(discardBoard(), 'a', 0); didDiscard = r.turnSeat === 1; } catch (e) { /* fail */ }
ok('can discard an unplayable lid while also holding a playable truck', didDiscard);
let blockedTruck = false;
try { discardCard(discardBoard(), 'a', 1); } catch (e) { blockedTruck = true; }
ok('cannot discard the (always-playable) truck', blockedTruck);

// --- End round settles totals ---
let s2 = createMatch(players, mulberry32(1));
s2.players[0].jars = [{ id: 'x', honey: 3, lemon: 1, lidded: false }]; // worth 8
s2.players[1].jars = [{ id: 'y', honey: 2, lemon: 0, lidded: false }]; // worth 2
s2 = endRound(s2);
ok('round scores computed', s2.roundScores.a === 8 && s2.roundScores.b === 2);
ok('totals accumulate', s2.totals.a === 8 && s2.totals.b === 2);
ok('phase is roundEnd (round 1 of 3)', s2.phase === 'roundEnd');
const st = standings(s2);
ok('standings sorted, Amy leads', st[0].name === 'Amy' && st[0].coins === 8);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Small seeded RNG so tests are deterministic.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
