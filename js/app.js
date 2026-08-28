// Honey Lemon — UI + orchestration. Talks to a "store" (hotseat or online)
// that exposes subscribe(fn) + update(mutator) over a shared room document:
//   { code, players:[{id,name,seat}], started, state:<engine state|null> }
// All rules live in engine.js; all text lives in i18n.js.

import {
  createMatch, currentPlayer, legalTargets, cardIsPlayable,
  currentPlayerHasLegalMove, playCard, discardCard, advanceRound,
  scoreJar, standings,
} from './engine.js';
import { t, cardName, getLang, setLang, LANGS } from './i18n.js';
import { FIREBASE_CONFIG } from './config.js';
import { createHotseatStore } from './net/local.js';
import { createOnlineStore } from './net/firebase.js';

// Emoji render reliably across phones EXCEPT the jar (🫙 is missing on older
// fonts and shows as tofu), so the jar is an inline SVG instead.
const JAR_SVG = `<svg class="ico-jar" viewBox="0 0 24 24" width="1.05em" height="1.05em" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="6.3" y="2.4" width="11.4" height="3.4" rx="1.3"/><path d="M6 5.8h12v13.4A2.4 2.4 0 0 1 15.6 21.6H8.4A2.4 2.4 0 0 1 6 19.2z"/></svg>`;
const ICON = { jar: JAR_SVG, honey: '🍯', lemon: '🍋', lid: '🎀', bear: '🐻', bigbear: '🐻', truck: '🚚' };

const app = {
  store: null,
  doc: null,
  screen: 'landing', // landing | hotseatSetup | lobby | game
  ui: {
    targetIdx: null,      // hand index currently choosing a target for
    passGateFor: null,    // hotseat: seat id we're hiding the hand for until "ready"
    lastGateSeat: null,   // hotseat: which seat we last gated, to avoid re-gating
    showHelp: false,
    showRecipes: false,
    note: null,           // transient message
    copied: false,
  },
};

// ---- Boot ----------------------------------------------------------------
function boot() {
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (room) app.ui.prefillCode = room.toUpperCase();
  render();
}

// ---- Store wiring --------------------------------------------------------
function onDoc(doc) {
  app.doc = doc;
  if (!doc) { render(); return; }

  if (doc.state) {
    doc.state = normalizeState(doc.state);
    app.screen = 'game';
    maybeGateHotseat(doc.state);
  } else if (app.store && app.store.mode === 'online') {
    app.screen = 'lobby';
  }
  render();
}

// In pass-and-play, hide the hand behind a "pass the device" gate whenever a
// new player's turn begins.
function maybeGateHotseat(state) {
  if (!app.store || app.store.mode !== 'hotseat') return;
  if (state.phase !== 'playing') { app.ui.passGateFor = null; return; }
  if (state.turnSeat !== app.ui.lastGateSeat) {
    app.ui.passGateFor = state.turnSeat;
    app.ui.lastGateSeat = state.turnSeat;
  }
}

// Firebase Realtime Database silently drops empty arrays (and empty objects),
// so a state that round-trips through it can come back with `discard`, a
// player's `hand`, `deck`, etc. missing. Restore them so the engine's
// `.push()`/`.length` calls never hit undefined. Idempotent — safe on hotseat
// state too (where nothing was dropped).
function normalizeState(st) {
  if (!st) return st;
  st.deck = st.deck || [];
  st.discard = st.discard || [];
  st.log = st.log || [];
  st.totals = st.totals || {};
  st.players = (st.players || []).map((p) => ({
    ...p,
    hand: p.hand || [],
    jars: (p.jars || []).map((j) => ({ honey: 0, lemon: 0, lidded: false, ...j })),
  }));
  return st;
}

function meId() {
  if (!app.doc || !app.doc.state) return null;
  return app.store.mode === 'hotseat'
    ? currentPlayer(app.doc.state).id
    : app.store.myId;
}

// ---- Moves ---------------------------------------------------------------
function applyMove(fn) {
  const base = app.doc.state;
  let next;
  try { next = fn(base); } catch (e) { console.warn(e); note(e.message); return; }
  app.ui.targetIdx = null;
  app.store.update((doc) => {
    if (doc && doc.state && base && doc.state.version !== base.version) return doc; // stale, drop
    return { ...doc, state: next };
  });
}

function doCardTap(idx) {
  const s = app.doc.state;
  const me = meId();
  const cur = currentPlayer(s);
  if (cur.id !== me || app.ui.passGateFor != null) return;

  if (!currentPlayerHasLegalMove(s)) { // forced discard
    applyMove((x) => discardCard(x, me, idx));
    return;
  }
  const card = cur.hand[idx];
  if (!cardIsPlayable(s, card)) { note(t('mustPlay')); return; }

  if (card.type === 'bigbear') {
    askConfirm(t('confirmBigbear'), () => applyMove((x) => playCard(x, me, idx, {})));
    return;
  }
  if (card.type === 'truck') {
    askConfirm(t('confirmTruck'), () => applyMove((x) => playCard(x, me, idx, {})));
    return;
  }
  app.ui.targetIdx = idx;
  render();
}

// In-app confirmation (never window.confirm — that blocks and reads poorly on
// phones). Stashes a callback the confirm sheet's button will run.
function askConfirm(msg, onOk) {
  app.ui.confirm = { msg, onOk };
  render();
}

function doPlayTarget(target) {
  const idx = app.ui.targetIdx;
  if (idx == null) return;
  applyMove((x) => playCard(x, meId(), idx, target));
}

// ---- Lobby / setup actions ----------------------------------------------
function startHotseat(names) {
  const players = names.map((n, i) => ({ id: `h${i}`, name: n }));
  const state = createMatch(players);
  app.store = createHotseatStore();
  app.ui.lastGateSeat = null;
  app.store.subscribe(onDoc);
  app.store.update(() => ({
    code: null,
    players: players.map((p, i) => ({ ...p, seat: i })),
    started: true,
    state,
  }));
}

async function goOnline(mode, name, code) {
  if (!FIREBASE_CONFIG) { note('Online not configured yet'); return; }
  note(null);
  try {
    app.store = await createOnlineStore({ config: FIREBASE_CONFIG, mode, name, code });
  } catch (e) {
    note(e.message === 'room-not-found' ? '房間不存在 / Room not found' : (e.message || 'error'));
    return;
  }
  app.store.subscribe(onDoc);
  app.screen = 'lobby';
  render();
}

function startMatch() {
  const players = lobbyPlayers(app.doc).map((p) => ({ id: p.id, name: p.name }));
  const state = createMatch(players);
  app.store.update((doc) => ({ ...doc, started: true, state }));
}

function playAgain() {
  const players = app.doc.state.players.map((p) => ({ id: p.id, name: p.name }));
  const state = createMatch(players);
  app.ui.lastGateSeat = null;
  app.store.update((doc) => ({ ...doc, state }));
}

// ---- Rendering -----------------------------------------------------------
function render() {
  const root = document.getElementById('app');
  document.documentElement.lang = getLang();
  let body = '';
  if (app.screen === 'landing') body = renderLanding();
  else if (app.screen === 'hotseatSetup') body = renderHotseatSetup();
  else if (app.screen === 'lobby') body = renderLobby();
  else if (app.screen === 'game') body = renderGame();
  root.innerHTML = body + renderOverlays();
}

function topBar(extra = '') {
  const other = LANGS.find((l) => l !== getLang());
  return `<div class="topbar">
    <div class="brand">${ICON.honey}${ICON.lemon} <b>${t('appTitle')}</b></div>
    <div class="topbtns">
      ${extra}
      <button class="chip" data-act="recipes">${t('recipes')}</button>
      <button class="chip" data-act="help">${t('howToPlay')}</button>
      <button class="chip" data-act="lang" data-lang="${other}">${getLang() === 'zh-Hant' ? 'EN' : '中'}</button>
    </div>
  </div>`;
}

function renderLanding() {
  const online = !!FIREBASE_CONFIG;
  const code = app.ui.prefillCode || '';
  return `${topBar()}
  <div class="screen center">
    <div class="hero">
      <div class="hero-emoji">${ICON.honey}${ICON.lemon}</div>
      <h1>${t('appTitle')}</h1>
      <p class="tagline">${t('tagline')}</p>
    </div>
    <div class="card">
      <input id="name" class="input" maxlength="12" placeholder="${t('enterName')}" value="${esc(app.ui.name || '')}" />
      <button class="btn primary" data-act="toHotseat">📱 ${t('playOnDevice')}</button>
      <div class="online-block ${online ? '' : 'disabled'}">
        <button class="btn" data-act="online-create" ${online ? '' : 'disabled'}>🌐 ${t('createRoom')} (online)</button>
        <div class="join-row">
          <input id="code" class="input code" maxlength="4" placeholder="${t('enterCode')}" value="${esc(code)}" />
          <button class="btn" data-act="online-join" ${online ? '' : 'disabled'}>${t('joinRoom')}</button>
        </div>
        ${online ? '' : `<p class="hint">🔌 貼上 Firebase 設定即可開啟線上對戰 · Paste Firebase config to enable online</p>`}
      </div>
    </div>
    ${app.ui.note ? `<p class="note">${esc(app.ui.note)}</p>` : ''}
    <div class="credits">
      <div><span class="credit-role">${t('creditDesign')}</span> ${t('designerName')}</div>
      <div><span class="credit-role">${t('creditDev')}</span> ${t('developerName')}</div>
    </div>
  </div>`;
}

function renderHotseatSetup() {
  const names = app.ui.setupNames || ['', ''];
  const rows = names.map((n, i) => `
    <input class="input pname" data-i="${i}" maxlength="12"
      placeholder="${t('yourName')} ${i + 1}" value="${esc(n)}" />`).join('');
  return `${topBar()}
  <div class="screen">
    <button class="link" data-act="landing">‹ ${t('cancel')}</button>
    <h2>${t('playersSetup')}</h2>
    <p class="hint">${t('playersInRoom')} (2–4)</p>
    <div class="card">
      ${rows}
      ${names.length < 4 ? `<button class="btn ghost" data-act="addPlayer">＋</button>` : ''}
      <button class="btn primary" data-act="startHotseat">${t('startGame')}</button>
      ${app.ui.note ? `<p class="note">${esc(app.ui.note)}</p>` : ''}
    </div>
  </div>`;
}

function renderLobby() {
  const doc = app.doc || {};
  const players = lobbyPlayers(doc);
  const link = `${location.origin}${location.pathname}?room=${doc.code || ''}`;
  return `${topBar()}
  <div class="screen">
    <h2>${t('roomCode')}</h2>
    <div class="roomcode">${doc.code || '…'}</div>
    <button class="btn" data-act="copyLink" data-link="${esc(link)}">${app.ui.copied ? t('linkCopied') : t('copyLink')}</button>
    <p class="hint">${t('share')}</p>
    <div class="card">
      <h3>${t('playersInRoom')} (${players.length}/4)</h3>
      <ul class="playerlist">
        ${players.map((p) => `<li>${ICON.jar} ${esc(p.name)}${p.id === app.store.myId ? ' ·你' : ''}</li>`).join('')}
      </ul>
      ${app.store.isHost
      ? `<button class="btn primary" data-act="startMatch" ${players.length >= 2 ? '' : 'disabled'}>${t('startGame')}</button>
         ${players.length < 2 ? `<p class="hint">${t('needTwoPlayers')}</p>` : ''}`
      : `<p class="hint">${t('waitingHost')}</p>`}
    </div>
  </div>`;
}

function renderGame() {
  const s = app.doc.state;
  const me = meId();
  const cur = currentPlayer(s);
  const myTurn = cur.id === me && app.ui.passGateFor == null && s.phase === 'playing';

  let targeting = null;
  if (myTurn && app.ui.targetIdx != null) {
    const card = cur.hand[app.ui.targetIdx];
    targeting = { card, targets: legalTargets(s, card) };
  }

  const mats = s.players
    .map((p) => renderMat(p, s, me, targeting))
    .join('');

  return `${topBar(`<span class="chip flat">${t('round', { n: s.round })}${t('ofRounds', { n: s.totalRounds })}</span>
     <span class="chip flat">🂠 ${t('deckLeft', { n: s.deck.length })}</span>`)}
  <div class="screen game">
    <div class="turnbar ${myTurn ? 'mine' : ''}">
      ${cur.id === me && s.phase === 'playing' && app.ui.passGateFor == null ? t('yourTurn') : t('turnOf', { name: esc(cur.name) })}
    </div>
    ${app.ui.note ? `<p class="note">${esc(app.ui.note)}</p>` : ''}
    <div class="mats">${mats}</div>
    ${renderHandArea(s, me, cur, myTurn, targeting)}
    ${renderLog(s)}
  </div>`;
}

function renderMat(p, s, me, targeting) {
  const isMe = p.id === me;
  const isCurrent = p.seat === s.turnSeat;
  const total = s.totals[p.id] || 0;
  const jarTarget = targeting && targeting.card.type === 'jar';
  const clickablePlayer = jarTarget && targeting.targets.some((tg) => tg.playerId === p.id);

  const jars = p.jars.map((j) => renderJar(p.id, j, targeting)).join('');
  return `<div class="mat ${isCurrent ? 'current' : ''} ${isMe ? 'me' : ''} ${clickablePlayer ? 'target' : ''}"
      ${clickablePlayer ? `data-act="target-player" data-pid="${p.id}"` : ''}>
    <div class="mat-head">
      <span class="pname">${esc(p.name)}${isMe ? ` <span class="tag">${t('targetSelf')}</span>` : ''}</span>
      ${s.teamMode ? `<span class="tag team${p.team}">${t('team', { n: p.team + 1 })}</span>` : ''}
      <span class="coins">🪙 ${total}</span>
    </div>
    <div class="jars">${jars || `<span class="hint">${t('empty')}</span>`}</div>
  </div>`;
}

function renderJar(ownerId, jar, targeting) {
  const value = scoreJar(jar);
  const isTarget = targeting && !['jar', 'bigbear', 'truck'].includes(targeting.card.type)
    && targeting.targets.some((tg) => tg.playerId === ownerId && tg.jarId === jar.id);
  const contents = (jar.honey || jar.lemon)
    ? `${ICON.honey.repeat(Math.min(jar.honey, 6))}${jar.honey > 6 ? `×${jar.honey}` : ''}${ICON.lemon.repeat(jar.lemon)}`
    : `<span class="jar-empty">${ICON.jar}</span>`;
  return `<div class="jar ${jar.lidded ? 'lidded' : ''} ${isTarget ? 'target' : ''}"
      ${isTarget ? `data-act="target-jar" data-pid="${ownerId}" data-jar="${jar.id}"` : ''}>
    <div class="jar-contents">${contents}</div>
    <div class="jar-meta">
      ${jar.lidded ? `<span class="lid">${ICON.lid}</span>` : ''}
      ${value > 0 ? `<span class="jar-val">🪙${value}</span>` : ''}
    </div>
  </div>`;
}

function renderHandArea(s, me, cur, myTurn, targeting) {
  // Pass-and-play gate.
  if (app.store.mode === 'hotseat' && app.ui.passGateFor != null && s.phase === 'playing') {
    return `<div class="hand gate">
      <p>${t('passDevice', { name: esc(cur.name) })}</p>
      <button class="btn primary" data-act="ready">${t('imReady')}</button>
    </div>`;
  }

  const iAmActor = cur.id === me;
  const hand = iAmActor ? cur.hand : (s.players.find((p) => p.id === me)?.hand || []);
  const forced = iAmActor && !currentPlayerHasLegalMove(s);

  let banner = '';
  if (!iAmActor) banner = t('notYourTurn');
  else if (targeting) banner = t('pickTarget');
  else if (forced) banner = t('noMoves');
  else banner = t('tapCardToPlay');

  const cards = hand.map((c, i) => {
    const selected = targeting && app.ui.targetIdx === i;
    const playable = iAmActor && (forced || cardIsPlayable(s, c));
    const badge = c.type === 'bear' ? `<span class="bear-n">${c.value}</span>` : '';
    return `<button class="handcard ${selected ? 'sel' : ''} ${playable ? '' : 'dim'}"
        ${iAmActor && myTurn ? `data-act="card" data-idx="${i}"` : ''}>
      <span class="hc-icon">${ICON[c.type]}${badge}</span>
      <span class="hc-name">${cardName(c)}</span>
    </button>`;
  }).join('');

  return `<div class="hand">
    <div class="hand-banner">${banner}
      ${targeting ? `<button class="link" data-act="cancelTarget">${t('cancel')}</button>` : ''}
    </div>
    <div class="handcards">${cards}</div>
  </div>`;
}

function renderLog(s) {
  const lines = (s.log || []).slice(-5).map(logLine).filter(Boolean);
  return `<div class="log">${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
}

function logLine(e) {
  const nameOf = (id) => esc((app.doc.state.players.find((p) => p.id === id) || {}).name || '?');
  switch (e.t) {
    case 'roundStart': return t('log_roundStart', { round: e.round });
    case 'play': {
      const by = nameOf(e.by);
      const target = esc(e.targetName || '');
      if (e.card.type === 'jar') return t('log_jar', { by, target });
      if (e.card.type === 'honey') return t('log_honey', { by, target });
      if (e.card.type === 'lemon') return t('log_lemon', { by, target });
      if (e.card.type === 'lid') return t('log_lid', { by, target });
      if (e.card.type === 'bear') return t('log_bear', { by, target, n: e.eaten });
      if (e.card.type === 'bigbear') return t('log_bigbear', { by });
      if (e.card.type === 'truck') return t('log_truck', { by });
      return '';
    }
    case 'discard': return t('log_discard', { by: nameOf(e.by) });
    default: return '';
  }
}

// ---- Overlays ------------------------------------------------------------
function renderOverlays() {
  let html = '';
  if (app.ui.confirm) {
    html += `<div class="overlay"><div class="sheet confirm">
      <div class="sheet-body">
        <p class="confirm-msg">${esc(app.ui.confirm.msg)}</p>
        <div class="confirm-btns">
          <button class="btn" data-act="confirmCancel">${t('cancel')}</button>
          <button class="btn primary" data-act="confirmOk">${t('confirmYes')}</button>
        </div>
      </div></div></div>`;
  }
  if (app.ui.showHelp) html += renderHelp();
  if (app.ui.showRecipes) html += renderRecipes();
  if (app.doc && app.doc.state) {
    if (app.doc.state.phase === 'roundEnd') html += renderRoundEnd();
    else if (app.doc.state.phase === 'matchEnd') html += renderMatchEnd();
  }
  return html;
}

function renderHelp() {
  const body = t('rulesBody').map((line) => `<li>${line}</li>`).join('');
  return overlay(t('howToPlay'), `<ul class="rules">${body}</ul>`);
}

function renderRecipes() {
  const rows = [
    [`${ICON.honey}`, t('recipe_1'), 1],
    [`${ICON.honey}${ICON.honey}`, t('recipe_2'), 2],
    [`${ICON.honey}${ICON.honey}${ICON.honey}`, t('recipe_3'), 4],
    [`${ICON.honey}${ICON.honey}${ICON.honey}${ICON.lemon}`, t('recipe_3_1'), 8],
  ].map(([ico, label, coins]) => `<tr><td class="r-ico">${ico}</td><td>${label}</td><td class="r-coin">🪙 ${coins}</td></tr>`).join('');
  return overlay(t('recipes'),
    `<table class="recipes"><tbody>${rows}</tbody></table><p class="hint">${t('recipeElse')}</p>`);
}

function renderRoundEnd() {
  const s = app.doc.state;
  const rows = s.players.map((p) => `<tr><td>${esc(p.name)}</td>
    <td>+${s.roundScores[p.id]}</td><td><b>${s.totals[p.id]}</b></td></tr>`).join('');
  const canAdvance = app.store.mode === 'hotseat' || app.store.isHost;
  return overlay(t('roundOver', { n: s.round }),
    `<table class="scoretable">
       <thead><tr><th></th><th>${t('roundEarnings')}</th><th>${t('totalCoins')}</th></tr></thead>
       <tbody>${rows}</tbody></table>
     ${canAdvance ? `<button class="btn primary" data-act="nextRound">${t('nextRound')}</button>`
      : `<p class="hint">${t('waitingHost')}</p>`}`, false);
}

function renderMatchEnd() {
  const s = app.doc.state;
  const st = standings(s);
  const top = st[0];
  const tie = st.length > 1 && st[1].coins === top.coins;
  const title = tie ? t('tie')
    : (s.teamMode ? t('winnerTeam', { n: top.team + 1 }) : t('winner', { name: esc(top.name) }));
  const rows = st.map((r) => `<tr><td>${s.teamMode ? t('team', { n: r.team + 1 }) + ' — ' + esc(r.members.join(', ')) : esc(r.name)}</td><td><b>🪙 ${r.coins}</b></td></tr>`).join('');
  const canRestart = app.store.mode === 'hotseat' || app.store.isHost;
  return overlay(`${t('matchOver')}<br>${title}`,
    `<table class="scoretable"><tbody>${rows}</tbody></table>
     ${canRestart ? `<button class="btn primary" data-act="playAgain">${t('playAgain')}</button>` : ''}`, false);
}

function overlay(title, inner, closable = true) {
  return `<div class="overlay">
    <div class="sheet">
      <div class="sheet-head"><h2>${title}</h2>
        ${closable ? `<button class="x" data-act="closeOverlay">✕</button>` : ''}</div>
      <div class="sheet-body">${inner}</div>
    </div>
  </div>`;
}

// ---- Helpers -------------------------------------------------------------
// Lobby players come from Firebase as a map {id:{name,joinedAt}} (online) or an
// array (hotseat). Normalize to an array sorted by join time.
function lobbyPlayers(doc) {
  const p = (doc && doc.players) || {};
  const arr = Array.isArray(p) ? p.slice() : Object.entries(p).map(([id, v]) => ({ id, ...v }));
  return arr.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function note(msg) { app.ui.note = msg; }

// ---- Event delegation ----------------------------------------------------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const S = app.ui;

  switch (act) {
    case 'lang': setLang(el.dataset.lang); render(); break;
    case 'help': S.showHelp = true; render(); break;
    case 'recipes': S.showRecipes = true; render(); break;
    case 'closeOverlay': S.showHelp = false; S.showRecipes = false; render(); break;
    case 'confirmCancel': S.confirm = null; render(); break;
    case 'confirmOk': { const c = S.confirm; S.confirm = null; c && c.onOk(); break; }
    case 'landing': app.screen = 'landing'; note(null); render(); break;

    case 'toHotseat': {
      const name = (document.getElementById('name') || {}).value?.trim();
      S.setupNames = [name || (getLang() === 'zh-Hant' ? '玩家1' : 'Player 1'), ''];
      app.screen = 'hotseatSetup'; note(null); render();
      break;
    }
    case 'addPlayer': {
      captureSetupNames();
      if (S.setupNames.length < 4) S.setupNames.push('');
      render();
      break;
    }
    case 'startHotseat': {
      captureSetupNames();
      const names = S.setupNames.map((n, i) => n.trim() || `${getLang() === 'zh-Hant' ? '玩家' : 'P'}${i + 1}`);
      if (names.length < 2) { note(t('needTwoPlayers')); render(); return; }
      note(null);
      startHotseat(names.slice(0, 4));
      break;
    }

    case 'online-create': {
      const name = (document.getElementById('name') || {}).value?.trim() || 'Host';
      goOnline('create', name);
      break;
    }
    case 'online-join': {
      const name = (document.getElementById('name') || {}).value?.trim() || 'Player';
      const code = (document.getElementById('code') || {}).value?.trim().toUpperCase();
      if (!code) { note(t('enterCode')); render(); return; }
      goOnline('join', name, code);
      break;
    }
    case 'copyLink':
      navigator.clipboard?.writeText(el.dataset.link).then(() => { S.copied = true; render(); });
      break;
    case 'startMatch': startMatch(); break;

    case 'ready': S.passGateFor = null; render(); break;
    case 'card': doCardTap(Number(el.dataset.idx)); break;
    case 'target-jar': doPlayTarget({ playerId: el.dataset.pid, jarId: el.dataset.jar }); break;
    case 'target-player': doPlayTarget({ playerId: el.dataset.pid }); break;
    case 'cancelTarget': S.targetIdx = null; render(); break;
    case 'nextRound': applyMove((x) => advanceRound(x)); break;
    case 'playAgain': playAgain(); break;
    default: break;
  }
});

function captureSetupNames() {
  const inputs = [...document.querySelectorAll('.pname')];
  if (inputs.length) app.ui.setupNames = inputs.map((el) => el.value);
}

boot();
