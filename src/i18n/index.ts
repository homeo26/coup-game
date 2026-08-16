/**
 * i18n — lightweight typed dictionary for English + Arabic.
 * Follows the lawazem convention: native layout stays LTR and RTL is
 * applied manually per-component (row-reverse / textAlign), driven by
 * the `isRTL` flag from the active language.
 */
import { getLocales } from 'expo-localization';

export type Lang = 'en' | 'ar';

export const dict = {
  // App chrome
  appName: { en: 'Coup', ar: 'كو' },
  tabPlay: { en: 'Play', ar: 'اللعب' },
  tabRules: { en: 'Rules', ar: 'القواعد' },
  tabSettings: { en: 'More', ar: 'المزيد' },

  // Home
  homeTitle: { en: 'COUP', ar: 'COUP' },
  homeTag: { en: 'Bluff. Challenge. Survive.', ar: 'خادِع. تحدَّ. انجُ.' },
  yourName: { en: 'Your name', ar: 'اسمك' },
  createGame: { en: 'Create game', ar: 'إنشاء لعبة' },
  joinGame: { en: 'Join game', ar: 'الانضمام إلى لعبة' },
  roomCode: { en: 'Room code', ar: 'رمز الغرفة' },
  join: { en: 'Join', ar: 'انضمام' },
  nameNeeded: { en: 'Enter your name first', ar: 'أدخل اسمك أولاً' },
  codeNeeded: { en: 'Enter the 4-letter room code', ar: 'أدخل رمز الغرفة المكوّن من 4 أحرف' },
  roomNotFound: { en: 'Room not found', ar: 'الغرفة غير موجودة' },
  roomFull: { en: 'Room is full (6 players max)', ar: 'الغرفة ممتلئة (6 لاعبين كحد أقصى)' },
  roomStarted: { en: 'This game has already started', ar: 'هذه اللعبة بدأت بالفعل' },
  offline: { en: 'No connection — check your internet and try again', ar: 'لا يوجد اتصال — تحقق من الإنترنت وحاول مجدداً' },

  // Lobby
  lobby: { en: 'Lobby', ar: 'صالة الانتظار' },
  shareCode: { en: 'Share this code with your friends', ar: 'شارك هذا الرمز مع أصدقائك' },
  players: { en: 'Players', ar: 'اللاعبون' },
  host: { en: 'Host', ar: 'المضيف' },
  you: { en: 'You', ar: 'أنت' },
  startGame: { en: 'Start game', ar: 'ابدأ اللعبة' },
  needTwo: { en: 'Waiting for at least 2 players…', ar: 'بانتظار لاعبَين على الأقل…' },
  waitingHost: { en: 'Waiting for the host to start…', ar: 'بانتظار المضيف ليبدأ…' },
  leave: { en: 'Leave', ar: 'مغادرة' },
  leaveGameTitle: { en: 'Leave the game?', ar: 'مغادرة اللعبة؟' },
  leaveGameBody: {
    en: 'You will forfeit and reveal your cards.',
    ar: 'ستنسحب وتُكشف بطاقاتك.',
  },
  leaveLobbyBody: {
    en: 'You can rejoin anytime with the room code.',
    ar: 'يمكنك العودة في أي وقت باستخدام رمز الغرفة.',
  },

  // Roles
  duke: { en: 'Duke', ar: 'الدوق' },
  assassin: { en: 'Assassin', ar: 'القاتل' },
  captain: { en: 'Captain', ar: 'القبطان' },
  ambassador: { en: 'Ambassador', ar: 'السفير' },
  contessa: { en: 'Contessa', ar: 'الكونتيسة' },

  // Actions
  income: { en: 'Income', ar: 'دخل' },
  incomeDesc: { en: 'Take 1 coin', ar: 'خذ عملة واحدة' },
  foreign_aid: { en: 'Foreign Aid', ar: 'معونة خارجية' },
  foreignAidDesc: { en: 'Take 2 coins', ar: 'خذ عملتين' },
  coupAction: { en: 'Coup', ar: 'انقلاب' },
  coupDesc: { en: 'Pay 7 — unstoppable kill', ar: 'ادفع 7 — ضربة لا تُصد' },
  tax: { en: 'Tax', ar: 'ضريبة' },
  taxDesc: { en: 'Take 3 coins', ar: 'خذ 3 عملات' },
  assassinate: { en: 'Assassinate', ar: 'اغتيال' },
  assassinateDesc: { en: 'Pay 3 — target loses a card', ar: 'ادفع 3 — يخسر الهدف بطاقة' },
  steal: { en: 'Steal', ar: 'سرقة' },
  stealDesc: { en: 'Take 2 coins from a player', ar: 'خذ عملتين من لاعب' },
  exchange: { en: 'Exchange', ar: 'تبادل' },
  exchangeDesc: { en: 'Swap cards with the Court', ar: 'بادل بطاقاتك مع المحكمة' },

  // Game table
  coins: { en: 'coins', ar: 'عملات' },
  courtDeck: { en: 'Court', ar: 'المحكمة' },
  yourTurn: { en: 'Your turn', ar: 'دورك' },
  turnOf: { en: "{name}'s turn", ar: 'دور {name}' },
  chooseTarget: { en: 'Choose a target', ar: 'اختر هدفاً' },
  mustCoup: { en: '10+ coins — you must Coup', ar: '10 عملات أو أكثر — يجب أن تنفذ انقلاباً' },
  challenge: { en: 'Challenge', ar: 'تحدّي' },
  allow: { en: 'Allow', ar: 'سماح' },
  blockAction: { en: 'Block', ar: 'صدّ' },
  blockWith: { en: 'Block with {role}', ar: 'صدّ بـ{role}' },
  claims: { en: '{name} claims {role}', ar: '{name} يدّعي أن لديه {role}' },
  declares: { en: '{name}: {action}', ar: '{name}: {action}' },
  onPlayer: { en: 'on {name}', ar: 'على {name}' },
  waitingOthers: { en: 'Waiting for other players…', ar: 'بانتظار اللاعبين الآخرين…' },
  loseCardTitle: { en: 'Choose a card to lose', ar: 'اختر بطاقة لتخسرها' },
  exchangeTitle: { en: 'Choose {n} cards to keep', ar: 'اختر {n} بطاقات لتحتفظ بها' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  eliminated: { en: 'Eliminated', ar: 'خرج من اللعبة' },
  youWin: { en: 'You win!', ar: 'أنت الفائز!' },
  winnerIs: { en: '{name} wins!', ar: '{name} هو الفائز!' },
  playAgain: { en: 'Play again', ar: 'العب مجدداً' },
  backHome: { en: 'Back to home', ar: 'العودة للرئيسية' },
  ok: { en: 'OK', ar: 'حسناً' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },

  // Log lines
  logIncome: { en: '{a} took Income (+1)', ar: '{a} أخذ دخلاً (+1)' },
  logForeignAid: { en: '{a} took Foreign Aid (+2)', ar: '{a} أخذ معونة خارجية (+2)' },
  logForeignAidBlocked: { en: 'Foreign Aid was blocked', ar: 'تم صدّ المعونة الخارجية' },
  logTax: { en: '{a} collected Tax (+3)', ar: '{a} جمع الضريبة (+3)' },
  logCoup: { en: '{a} launched a Coup on {b}', ar: '{a} نفّذ انقلاباً على {b}' },
  logAssassinate: { en: '{a} sent the Assassin after {b}', ar: '{a} أرسل القاتل خلف {b}' },
  logAssassinateBlocked: { en: 'The assassination was blocked', ar: 'تم صدّ الاغتيال' },
  logSteal: { en: '{a} stole {n} from {b}', ar: '{a} سرق {n} من {b}' },
  logStealBlocked: { en: 'The steal was blocked', ar: 'تم صدّ السرقة' },
  logExchange: { en: '{a} exchanged with the Court', ar: '{a} تبادل مع المحكمة' },
  logDeclared: { en: '{a} claims {r}: {act}', ar: '{a} يدّعي {r}: {act}' },
  logForeignAidDeclared: { en: '{a}: Foreign Aid', ar: '{a}: معونة خارجية' },
  logBlockDeclared: { en: '{a} claims {r} to block', ar: '{a} يدّعي {r} للصدّ' },
  logChallenge: { en: '{a} challenges {b}!', ar: '{a} يتحدى {b}!' },
  logChallengeFailed: {
    en: '{b} had the {r} — {a} loses a card. {b} draws a new card.',
    ar: '{b} كان لديه {r} فعلاً — {a} يخسر بطاقة، و{b} يسحب بطاقة جديدة.',
  },
  logChallengeWon: { en: '{b} was bluffing — loses a card', ar: '{b} كان يخادع — يخسر بطاقة' },
  logLostCard: { en: '{a} lost their {r}', ar: '{a} خسر {r}' },
  logEliminated: { en: '{a} is out of the game', ar: '{a} خرج من اللعبة' },
  logForfeit: { en: '{a} left the game', ar: '{a} غادر اللعبة' },
  logWinner: { en: '{a} wins the game!', ar: '{a} فاز باللعبة!' },

  // Rules screen
  rulesTitle: { en: 'How to play', ar: 'طريقة اللعب' },
  rolesTitle: { en: 'The characters', ar: 'الشخصيات' },
  dukeBlurb: {
    en: 'Tax: take 3 coins. Blocks Foreign Aid.',
    ar: 'الضريبة: خذ 3 عملات. يصدّ المعونة الخارجية.',
  },
  assassinBlurb: {
    en: 'Pay 3 coins to make a player lose a card. Blocked by the Contessa.',
    ar: 'ادفع 3 عملات ليخسر لاعبٌ بطاقة. تصدّه الكونتيسة.',
  },
  captainBlurb: {
    en: 'Steal 2 coins from a player. Blocks stealing.',
    ar: 'اسرق عملتين من لاعب. يصدّ السرقة.',
  },
  ambassadorBlurb: {
    en: 'Exchange cards with the Court deck. Blocks stealing.',
    ar: 'بادل بطاقاتك مع المحكمة. يصدّ السرقة.',
  },
  contessaBlurb: {
    en: 'Blocks assassination.',
    ar: 'تصدّ الاغتيال.',
  },
  generalActions: { en: 'General actions', ar: 'الإجراءات العامة' },
  generalActionsText: {
    en: 'Income: take 1 coin (cannot be blocked or challenged).\nForeign Aid: take 2 coins (blockable by a Duke claim).\nCoup: pay 7 coins — the target loses a card. Cannot be blocked or challenged.',
    ar: 'الدخل: خذ عملة واحدة (لا يُصد ولا يُتحدى).\nالمعونة الخارجية: خذ عملتين (يصدّها من يدّعي الدوق).\nالانقلاب: ادفع 7 عملات — يخسر الهدف بطاقة. لا يُصد ولا يُتحدى.',
  },
  rulesGoal: { en: 'Goal', ar: 'الهدف' },
  rulesGoalText: {
    en: 'Be the last player with influence. Your two face-down cards are your two lives — lose both and you are out.',
    ar: 'كن آخر لاعب يملك نفوذاً. بطاقتاك المقلوبتان هما حياتاك — اخسرهما وتخرج من اللعبة.',
  },
  rulesBluff: { en: 'Bluffing & challenges', ar: 'الخداع والتحدي' },
  rulesBluffText: {
    en: 'On your turn you may claim ANY character — even one you do not have. Anyone can challenge. If the claimer proves the card, the challenger loses a card and the claimer swaps the shown card for a new one from the Court. If the claimer was bluffing, they lose a card and the action fails (its cost is refunded).',
    ar: 'في دورك يمكنك ادعاء أي شخصية — حتى لو لم تكن لديك. يمكن لأي لاعب أن يتحداك. إذا أثبت المدّعي البطاقة، يخسر المتحدي بطاقة ويستبدل المدّعي بطاقته ببطاقة جديدة من المحكمة. أما إذا كان يخادع، فيخسر بطاقة ويفشل الإجراء (وتُعاد تكلفته).',
  },
  rulesBlocks: { en: 'Blocks', ar: 'الصدّ' },
  rulesBlocksText: {
    en: 'Blocks are claims too and can be challenged. If a block stands, the action fails but coins paid stay spent (an assassin fee is lost even when blocked).',
    ar: 'الصدّ ادعاء أيضاً ويمكن تحدّيه. إذا نجح الصدّ يفشل الإجراء لكن العملات المدفوعة لا تُسترد (رسوم القاتل تضيع حتى لو صُدّ).',
  },
  rulesTen: { en: 'The 10-coin rule', ar: 'قاعدة العشر عملات' },
  rulesTenText: {
    en: 'If you start your turn with 10 or more coins, you must launch a Coup.',
    ar: 'إذا بدأت دورك بعشر عملات أو أكثر، يجب أن تنفذ انقلاباً.',
  },

  // Settings
  settings: { en: 'Settings', ar: 'الإعدادات' },
  language: { en: 'Language', ar: 'اللغة' },
  hapticsSetting: { en: 'Haptic feedback', ar: 'الاهتزاز عند اللمس' },
  hapticsDesc: { en: 'Tactile feedback on taps', ar: 'ردة فعل لمسية عند الضغط' },
  about: { en: 'About', ar: 'حول' },
  aboutText: {
    en: 'A fan-made digital adaptation of the card game Coup for playing with friends — each on their own device.',
    ar: 'نسخة رقمية غير رسمية من لعبة كو الورقية للعب مع الأصدقاء — كلٌّ على جهازه.',
  },
} as const;

export type TKey = keyof typeof dict;

let currentLang: Lang = (() => {
  const sys = getLocales()[0]?.languageCode;
  return sys === 'ar' ? 'ar' : 'en';
})();

export function setLang(l: Lang) {
  currentLang = l;
}
export function getLang(): Lang {
  return currentLang;
}

/** Translate a key with optional {placeholders}. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  let s: string = dict[key][currentLang];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function isRTL(): boolean {
  return currentLang === 'ar';
}
