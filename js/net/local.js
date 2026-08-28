// "Pass & play on this device" store. No network. Holds the shared room
// document in memory and notifies subscribers on every change. Same surface
// as the online store so the UI doesn't care which one it's talking to.

function emptyDoc() {
  return { code: null, players: [], started: false, state: null };
}

export function createHotseatStore() {
  let doc = emptyDoc();
  const subs = [];
  const notify = () => subs.forEach((fn) => fn(doc));

  return {
    mode: 'hotseat',
    code: null,
    myId: null, // in hotseat the UI treats "me" as whoever's turn it is
    isHost: true,

    subscribe(fn) {
      subs.push(fn);
      fn(doc);
    },

    // mutator: (currentDoc) => newDoc
    async update(mutator) {
      doc = mutator(structuredClone(doc)) || doc;
      notify();
    },
  };
}
