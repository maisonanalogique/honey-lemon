// All user-facing text lives here, keyed by language.
// zh-Hant (Traditional Chinese) is the default; en is the toggle.
// Nothing in the UI hard-codes a string — it all comes through t().

export const LANGS = ['zh-Hant', 'en'];
export const DEFAULT_LANG = 'zh-Hant';

const STRINGS = {
  'zh-Hant': {
    appTitle: '蜂蜜檸檬',
    tagline: '賣出蜂蜜檸檬賺大錢',
    langName: '中文',
    creditDesign: '遊戲設計',
    creditDev: '遊戲開發',
    designerName: '韋凌亦',
    developerName: '謝瑋紘',

    // Lobby
    playOnDevice: '本機遊玩（輪流傳著玩）',
    playersSetup: '玩家設定',
    confirmYes: '確定',
    createRoom: '建立房間',
    joinRoom: '加入房間',
    roomCode: '房間代碼',
    yourName: '你的暱稱',
    enterName: '輸入暱稱',
    enterCode: '輸入房間代碼',
    startGame: '開始遊戲',
    waitingHost: '等待房主開始…',
    playersInRoom: '房間內玩家',
    needTwoPlayers: '至少需要 2 位玩家',
    copyLink: '複製邀請連結',
    linkCopied: '已複製！',
    share: '把連結傳給朋友，用手機加入',

    // Board
    round: '第 {n} 局',
    ofRounds: '／共 {n} 局',
    deckLeft: '牌堆剩 {n} 張',
    yourTurn: '輪到你了',
    turnOf: '輪到 {name}',
    yourJars: '你的罐子',
    coins: '{n} 金幣',
    team: '隊伍 {n}',
    lidded: '已蓋蓋子',
    empty: '（空）',
    honeyCount: '蜂蜜 ×{n}',
    lemonCount: '檸檬 ×{n}',

    // Hand + actions
    yourHand: '你的手牌',
    playCard: '出牌',
    mustPlay: '每回合必須出一張牌',
    pickTarget: '選擇目標',
    cancel: '取消',
    discard: '棄牌',
    noMoves: '沒有可出的牌，請棄一張',
    tapCardToPlay: '點一張牌來出牌',
    notYourTurn: '還沒輪到你',
    passDevice: '把裝置交給 {name}',
    imReady: '我準備好了',

    // Cards
    card_jar: '罐子',
    card_honey: '蜂蜜',
    card_lemon: '檸檬',
    card_lid: '蓋子',
    card_bear: '小熊（吃 {n}）',
    card_bigbear: '大熊',
    card_truck: '收購車',

    // Targets / prompts
    targetWhichJar: '要作用在哪個罐子？',
    targetWhichPlayer: '要放在誰面前？',
    targetSelf: '（你自己）',
    confirmTruck: '出收購車會立刻結束這一局並結算，確定嗎？',
    confirmBigbear: '大熊會吃掉所有沒蓋蓋子的蜂蜜和檸檬（包括你自己的），確定嗎？',

    // Log lines
    log_roundStart: '— 第 {round} 局開始 —',
    log_draw: '{name} 抽了一張牌',
    log_jar: '{by} 給 {target} 加了一個罐子',
    log_honey: '{by} 在 {target} 的罐子加了蜂蜜',
    log_lemon: '{by} 在 {target} 的罐子加了檸檬',
    log_lid: '{by} 蓋住了 {target} 的罐子',
    log_bear: '🐻 {by} 的小熊吃掉了 {target} 罐子裡的 {n} 份蜂蜜',
    log_bigbear: '🐻 {by} 放出大熊，吃光所有沒蓋的蜂蜜和檸檬！',
    log_truck: '🚚 {by} 出了收購車，這一局結束！',
    log_discard: '{by} 棄掉一張牌',

    // Round / match end
    roundOver: '第 {n} 局結束',
    roundEarnings: '本局金幣',
    totalCoins: '累計金幣',
    nextRound: '下一局',
    matchOver: '遊戲結束！',
    winner: '🏆 {name} 獲勝！',
    winnerTeam: '🏆 隊伍 {n} 獲勝！',
    tie: '平手！',
    playAgain: '再玩一次',

    // Recipe cheat-sheet
    recipes: '收購價目表',
    recipe_1: '1 份蜂蜜',
    recipe_2: '2 份蜂蜜',
    recipe_3: '3 份蜂蜜',
    recipe_3_1: '3 份蜂蜜 + 1 份檸檬',
    recipeElse: '其他配方賣不到錢',
    coin: '金幣',

    // How to play
    howToPlay: '玩法說明',
    close: '關閉',
    rulesBody: [
      '目標：調配出值錢的蜂蜜檸檬，賣給收購車賺最多金幣。',
      '每回合：先抽一張牌，再從手牌出一張（一定要出牌，只有真的無牌可出時才能棄牌）。',
      '任何牌都可以作用在任何人身上——包括你自己和對手。',
      '罐子：裝蜂蜜和檸檬的容器，要有罐子才能加料。',
      '蜂蜜／檸檬：加進罐子的原料。可以故意加到別人快完成的罐子裡把配方弄壞。',
      '蓋子：蓋住罐子，之後不能再加料、熊也吃不到。可保護自己，也可蓋住別人的空罐子搗亂。',
      '小熊：吃掉一個沒蓋蓋子罐子裡的蜂蜜，數量如牌面（吃 3 的熊一定吃滿 3，不夠才全吃，不能只吃一部分）。',
      '大熊：吃光場上所有沒蓋蓋子的蜂蜜和檸檬，包括你自己的。',
      '收購車：一出牌就結束這一局並結算金幣。手上有收購車時，抓準自己金幣最高的時機出牌。',
    ],
  },

  en: {
    appTitle: 'Honey Lemon',
    tagline: 'Sell honey lemon, make a fortune',
    langName: 'EN',
    creditDesign: 'Game design',
    creditDev: 'Development',
    designerName: 'Ling-Yi Wei',
    developerName: 'Wei-Hung Hsieh',

    playOnDevice: 'Play on this device (pass & play)',
    playersSetup: 'Players',
    confirmYes: 'Confirm',
    createRoom: 'Create room',
    joinRoom: 'Join room',
    roomCode: 'Room code',
    yourName: 'Your nickname',
    enterName: 'Enter a nickname',
    enterCode: 'Enter room code',
    startGame: 'Start game',
    waitingHost: 'Waiting for host to start…',
    playersInRoom: 'Players in room',
    needTwoPlayers: 'Need at least 2 players',
    copyLink: 'Copy invite link',
    linkCopied: 'Copied!',
    share: 'Send the link to friends to join on their phones',

    round: 'Round {n}',
    ofRounds: ' of {n}',
    deckLeft: '{n} cards left',
    yourTurn: 'Your turn',
    turnOf: "{name}'s turn",
    yourJars: 'Your jars',
    coins: '{n} coins',
    team: 'Team {n}',
    lidded: 'Lidded',
    empty: '(empty)',
    honeyCount: 'Honey ×{n}',
    lemonCount: 'Lemon ×{n}',

    yourHand: 'Your hand',
    playCard: 'Play',
    mustPlay: 'You must play a card each turn',
    pickTarget: 'Pick a target',
    cancel: 'Cancel',
    discard: 'Discard',
    noMoves: 'No playable card — discard one',
    tapCardToPlay: 'Tap a card to play it',
    notYourTurn: 'Not your turn yet',
    passDevice: 'Pass the device to {name}',
    imReady: "I'm ready",

    card_jar: 'Jar',
    card_honey: 'Honey',
    card_lemon: 'Lemon',
    card_lid: 'Lid',
    card_bear: 'Bear (eats {n})',
    card_bigbear: 'Big Bear',
    card_truck: "Buyer's Truck",

    targetWhichJar: 'Which jar?',
    targetWhichPlayer: 'In front of whom?',
    targetSelf: '(you)',
    confirmTruck: 'The truck ends this round immediately and scores it. Sure?',
    confirmBigbear: 'Big Bear eats ALL uncovered honey and lemon, including yours. Sure?',

    log_roundStart: '— Round {round} begins —',
    log_draw: '{name} drew a card',
    log_jar: '{by} gave {target} a jar',
    log_honey: '{by} added honey to {target}',
    log_lemon: '{by} added lemon to {target}',
    log_lid: "{by} put a lid on {target}'s jar",
    log_bear: "🐻 {by}'s bear ate {n} honey from {target}'s jar",
    log_bigbear: '🐻 {by} unleashed the Big Bear — all uncovered honey and lemon gone!',
    log_truck: '🚚 {by} played the truck — the round is over!',
    log_discard: '{by} discarded a card',

    roundOver: 'Round {n} over',
    roundEarnings: 'This round',
    totalCoins: 'Total coins',
    nextRound: 'Next round',
    matchOver: 'Game over!',
    winner: '🏆 {name} wins!',
    winnerTeam: '🏆 Team {n} wins!',
    tie: "It's a tie!",
    playAgain: 'Play again',

    recipes: 'Price list',
    recipe_1: '1 honey',
    recipe_2: '2 honey',
    recipe_3: '3 honey',
    recipe_3_1: '3 honey + 1 lemon',
    recipeElse: 'Any other mix sells for nothing',
    coin: 'coins',

    howToPlay: 'How to play',
    close: 'Close',
    rulesBody: [
      'Goal: mix up valuable honey-lemon jars and sell them to the truck for the most coins.',
      'Each turn: draw one card, then play one from your hand (you must play — only discard if you truly can’t).',
      'Any card can target anyone — yourself or an opponent.',
      'Jar: the container. You need a jar before you can add anything to it.',
      'Honey / Lemon: ingredients. You can deliberately drop one into a rival’s almost-finished jar to wreck the recipe.',
      'Lid: seals a jar — no more ingredients, and bears can’t touch it. Protect your own, or slap one on a rival’s empty jar.',
      'Bear: eats honey from one uncovered jar, exactly the amount shown (a 3-bear always eats a full 3, or all of it if there’s less — never a partial nibble).',
      'Big Bear: devours every uncovered honey and lemon on the table, including your own.',
      'Truck: playing it ends the round instantly and scores everyone. Holding it? Time it for when your coins are highest.',
    ],
  },
};

let _lang = DEFAULT_LANG;

export function getLang() { return _lang; }
export function setLang(lang) { if (LANGS.includes(lang)) _lang = lang; }

// t('round', { n: 2 }) -> "第 2 局". Missing keys fall back to the key itself.
export function t(key, params) {
  const table = STRINGS[_lang] || STRINGS[DEFAULT_LANG];
  let val = table[key];
  if (val === undefined) val = STRINGS[DEFAULT_LANG][key];
  if (val === undefined) return key;
  if (Array.isArray(val)) return val;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replaceAll(`{${k}}`, v);
    }
  }
  return val;
}

// Localized card name from a { type, value } descriptor.
export function cardName(card) {
  if (card.type === 'bear') return t('card_bear', { n: card.value });
  return t(`card_${card.type}`);
}
