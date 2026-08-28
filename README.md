# 蜂蜜檸檬 · Honey Lemon

A bilingual (Traditional Chinese / English) digital version of the *Honey Lemon*
card game, playable in any phone browser. Build valuable honey-lemon jars, sabotage
your rivals, and sell to the buyer's truck for the most coins.

Two ways to play:

- **Pass & play on one device** — works right now, no setup, no accounts, nothing
  stored anywhere.
- **Online with friends** — each player on their own phone via a room code. Requires
  a free Firebase project (5-minute setup, steps below).

Toggle 中 / EN anytime with the button in the top-right. Language is per-device, so a
Chinese speaker and an English speaker can share one game.

---

## Project layout

```
index.html          entry point
css/styles.css      all styling (mobile-first, light + dark)
js/engine.js        pure game rules (no DOM, no network) — unit-tested
js/engine.test.mjs  engine smoke tests:  node js/engine.test.mjs
js/i18n.js          all text, zh-Hant + en
js/config.js        <-- paste your Firebase config here to enable online play
js/app.js           UI + orchestration
js/net/local.js     "pass & play" transport (in-memory)
js/net/firebase.js  online transport (Firebase Realtime Database)
```

The game rules live entirely in `engine.js` and are covered by tests; the UI is a thin
layer on top. Both play modes share the same engine and UI — only the transport differs.

---

## Run locally

ES modules need to be served over HTTP (opening `index.html` directly won't work).

```bash
cd honey-lemon
python3 -m http.server 8777
# then open http://localhost:8777 on your computer or phone (same Wi-Fi)
```

This is enough to play **pass & play** immediately.

---

## Enable online play (Firebase)

You only need to do this once.

1. Go to <https://console.firebase.google.com> and **Add project** (any name, e.g.
   `honey-lemon`). You can turn off Google Analytics — it isn't needed.
2. In the left menu open **Build → Realtime Database → Create Database**.
   - Pick a location near you.
   - Start in **test mode** for now (we'll tighten this later — see Security below).
3. Open **Project settings** (gear icon, top-left) → scroll to **Your apps** →
   click the **Web** icon `</>` → register an app (nickname only, no Hosting needed).
4. Firebase shows you a `firebaseConfig` object. Copy it into `js/config.js`,
   replacing the `export const FIREBASE_CONFIG = null;` line:

   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project",
     appId: "1:...:web:...",
   };
   ```

   > These values are safe to commit publicly — they identify the project, they are
   > not secrets. Security is enforced by database rules, not by hiding these.

5. Reload the page — the **online** buttons light up. Create a room, share the link,
   and friends join by code.

### Security note (read this)

"Test mode" leaves the database open to anyone who has the config for ~30 days. That's
fine for casual play among friends in the short term, but **not** something to leave
running long-term. When we do the online-hardening pass we'll add:

- anonymous auth + rules that only let players in a room touch that room, and
- automatic cleanup of old rooms.

Until then, treat the database as public and don't put anything sensitive in nicknames.
No emails, passwords, or accounts are ever collected — only the game state and the
nicknames players type.

---

## Deploy (GitHub Pages)

This is a static site — no build step.

```bash
# from the honey-lemon folder, after committing:
gh repo create honey-lemon --private --source=. --push   # or use the GitHub UI
```

Then in the repo on GitHub: **Settings → Pages → Build and deployment →
Source: Deploy from a branch → `main` / root**. Your game will be live at
`https://<you>.github.io/honey-lemon/` within a minute — that's the link you text
to friends.

---

## Game rules (summary)

Goal: sell the most valuable honey-lemon jars.

| Recipe | Coins |
|---|---|
| 1 honey | 1 |
| 2 honey | 2 |
| 3 honey | 4 |
| 3 honey + 1 lemon | 8 |
| anything else | 0 |

Each turn: draw one card, then play one (you must play unless you truly can't).
Any card can target anyone. Jars hold ingredients; lids seal them; bears eat honey;
the Big Bear eats everything uncovered; the truck ends the round and scores everyone.
More honey isn't better — a 4th honey ruins a jar, which is how you sabotage rivals.

Rounds: 2 players → 3 rounds · 3 players → 4 rounds · 4 players → teams (seats 1&3
vs 2&4), 3 rounds.

*Original game design belongs to its creators; this is a digital adaptation.*
