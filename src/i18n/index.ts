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
  appName: { en: 'Coup', ar: 'كوب' },
  tabPlay: { en: 'Play', ar: 'اللعب' },
  tabRules: { en: 'Rules', ar: 'القواعد' },
  tabChat: { en: 'Chat', ar: 'الدردشة' },
  tabSettings: { en: 'More', ar: 'المزيد' },

  // Home
  homeTitle: { en: 'COUP', ar: 'COUP' },
  homeTag: { en: 'Bluff. Challenge. Survive.', ar: 'خادِع. تحدَّ. انجُ.' },
  tip1: {
    en: 'Claim any character — even one you don’t hold.',
    ar: 'ادّعِ أي شخصية — حتى لو لم تكن بيدك.',
  },
  tip2: {
    en: 'Anyone at the table may challenge a claim.',
    ar: 'أي لاعب على الطاولة يمكنه تحدّي الادعاء.',
  },
  tip3: {
    en: 'Only the target can block a steal or an assassination.',
    ar: 'الهدف وحده يمكنه صدّ السرقة أو الاغتيال.',
  },
  tip4: { en: 'Ten coins and you must launch a Coup.', ar: 'عشر عملات ويجب أن تنفّذ انقلاباً.' },
  tip5: {
    en: 'Two influence cards. Lose both and you’re out.',
    ar: 'بطاقتا نفوذ. اخسرهما وتخرج من اللعبة.',
  },
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

  // Offline vs bots
  offlineMode: { en: 'Play offline', ar: 'اللعب دون اتصال' },
  botCount: { en: 'Opponents', ar: 'عدد الخصوم' },
  playVsBots: { en: 'Play vs bots', ar: 'العب ضد الروبوتات' },
  botName: { en: 'Bot {n}', ar: 'روبوت {n}' },

  // Offline cast — names and dossiers (Arabic gets regional names)
  personaHoarderName: { en: 'Rami', ar: 'رامي' },
  personaHoarderLine: {
    en: 'Sits on his coins, then coups the leader without warning.',
    ar: 'يكنز عملاته، ثم ينفّذ انقلاباً على المتصدّر بلا سابق إنذار.',
  },
  personaRecklessName: { en: 'Layla', ar: 'ليلى' },
  personaRecklessLine: {
    en: 'Claims whatever suits her — bluffs on a coin flip.',
    ar: 'تدّعي ما يناسبها — تخادع بحساب الحظ.',
  },
  personaSuspiciousName: { en: 'Nabil', ar: 'نبيل' },
  personaSuspiciousLine: {
    en: 'Trusts nobody; challenges far more than is wise.',
    ar: 'لا يثق بأحد؛ يتحدّى أكثر مما ينبغي.',
  },
  personaGrudgeName: { en: 'Hind', ar: 'هند' },
  personaGrudgeLine: {
    en: 'Forgets nothing — whoever hits her gets it back twice.',
    ar: 'لا تنسى شيئاً — من يضربها يردّ له الضربة مضاعفة.',
  },
  personaQuietName: { en: 'Sami', ar: 'سامي' },
  personaQuietLine: {
    en: 'Plays quietly, counts every card, strikes when it is safe.',
    ar: 'يلعب بهدوء، يعدّ كل بطاقة، ويضرب حين يأمن.',
  },
  meetTheTable: { en: 'Your opponents', ar: 'خصومك' },

  // Lobby
  lobby: { en: 'Lobby', ar: 'صالة الانتظار' },
  shareCode: { en: 'Share this code with your friends', ar: 'شارك هذا الرمز مع أصدقائك' },
  shareMessage: {
    en: 'Join my Coup game — room {code}:\n{link}',
    ar: 'انضم إلى لعبة كوب — الغرفة {code}:\n{link}',
  },
  players: { en: 'Players', ar: 'اللاعبون' },
  host: { en: 'Host', ar: 'المضيف' },
  you: { en: 'You', ar: 'أنت' },
  startGame: { en: 'Start game', ar: 'ابدأ اللعبة' },
  timerTitle: { en: 'Turn timer', ar: 'مؤقّت الدور' },
  timerOff: { en: 'Off', ar: 'بدون' },
  timerSecs: { en: '{n}s', ar: '{n} ث' },
  timerHint: {
    en: 'Time to decide before the move is made for you.',
    ar: 'الوقت المتاح للقرار قبل أن يُتخذ عنك.',
  },
  timerHintGuest: {
    en: 'The host sets the turn timer.',
    ar: 'المضيف يحدّد مؤقّت الدور.',
  },
  logTimeout: { en: 'Time ran out', ar: 'انتهى الوقت' },
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
  chooseAction: { en: 'Choose your action', ar: 'اختر إجراءك' },
  bluff: { en: 'Bluff', ar: 'خدعة' },
  bluffHint: {
    en: "You don't hold this card — anyone may challenge you",
    ar: 'لا تملك هذه البطاقة — قد يتحداك أي لاعب',
  },
  confirmAction: { en: 'Confirm: {action}', ar: 'تأكيد: {action}' },
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
  several: { en: '{n} players', ar: '{n} لاعبين' },
  respondedTally: { en: '{done} of {total} answered', ar: 'أجاب {done} من {total}' },
  waitChallenge: {
    en: '{who} deciding whether to challenge {name}’s {role}…',
    ar: '{who} يقرر إن كان سيتحدى {role} لـ{name}…',
  },
  waitBlock: { en: '{who} deciding whether to block {action}…', ar: '{who} يقرر إن كان سيصدّ {action}…' },
  waitBlockChallenge: {
    en: '{who} deciding whether to challenge {name}’s {role} block…',
    ar: '{who} يقرر إن كان سيتحدى صدّ {name} بـ{role}…',
  },
  waitLose: { en: '{name} is choosing a card to lose…', ar: '{name} يختار بطاقة ليخسرها…' },
  waitExchange: { en: '{name} is exchanging with the Court…', ar: '{name} يبادل مع المحكمة…' },
  loseCardTitle: { en: 'Choose a card to lose', ar: 'اختر بطاقة لتخسرها' },
  exchangeTitle: { en: 'Choose {n} cards to keep', ar: 'اختر {n} بطاقات لتحتفظ بها' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  eliminated: { en: 'Eliminated', ar: 'خرج من اللعبة' },
  youWin: { en: 'You win!', ar: 'أنت الفائز!' },
  winnerIs: { en: '{name} wins!', ar: '{name} هو الفائز!' },
  playAgain: { en: 'Play again', ar: 'العب مجدداً' },
  backHome: { en: 'Back to home', ar: 'العودة للرئيسية' },
  ok: { en: 'OK', ar: 'حسناً' },
  tapToClose: { en: 'Tap anywhere to close', ar: 'اضغط في أي مكان للإغلاق' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },

  // Chat, emotes & taunts
  chatTitle: { en: 'Table chat', ar: 'دردشة الطاولة' },
  chatPlaceholder: { en: 'Say something…', ar: 'اكتب شيئاً…' },
  chatEmpty: {
    en: 'No messages yet — talk some trash.',
    ar: 'لا رسائل بعد — ابدأ المناوشة.',
  },
  chatJoinFirst: {
    en: 'Join a game first — the table chat lives here.',
    ar: 'انضم إلى لعبة أولاً — دردشة الطاولة هنا.',
  },
  tauntBluff: { en: "You're bluffing!", ar: 'أنت تخادع!' },
  tauntComeAtMe: { en: 'Come at me', ar: 'تحداني إن جرؤت' },
  tauntNice: { en: 'Nice move', ar: 'حركة ذكية' },
  tauntScared: { en: 'Scared?', ar: 'خفت؟' },

  // Avatar
  avatarLabel: { en: 'Your avatar', ar: 'صورتك الرمزية' },

  // Deck tracker
  deckTrackerTitle: { en: 'The 15 court cards', ar: 'بطاقات المحكمة الـ15' },
  deckTrackerSummary: {
    en: '{court} in the Court deck · {hands} hidden in hands',
    ar: '{court} في كومة المحكمة · {hands} مخفية بأيدي اللاعبين',
  },
  deckTrackerHint: {
    en: '✗ = revealed, out of play · ? = still hidden in a hand or the Court deck',
    ar: '✗ = مكشوفة وخارج اللعب · ? = ما زالت مخفية في يدٍ ما أو في كومة المحكمة',
  },

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
  rulesSetup: { en: 'Setup', ar: 'التحضير' },
  rulesSetupText: {
    en: 'The Court deck holds 15 cards — 3 copies of each of the 5 characters. Every player starts with 2 face-down cards (their influence, kept secret) and 2 coins. The rest of the deck stays in the middle as the Court.',
    ar: 'تحوي كومة المحكمة 15 بطاقة — 3 نسخ من كل شخصية من الشخصيات الخمس. يبدأ كل لاعب ببطاقتين مقلوبتين (نفوذه، ويبقيهما سراً) وعملتين. يبقى باقي البطاقات في الوسط ككومة المحكمة.',
  },
  rulesActions: { en: 'All actions', ar: 'جميع الإجراءات' },
  claimsRole: { en: 'Claims the {role}', ar: 'يدّعي {role}' },
  blockedBy: { en: 'Blocked by: {roles}', ar: 'يصدّه: {roles}' },
  noBlock: { en: 'Cannot be blocked', ar: 'لا يُصد' },
  challengeableYes: { en: 'Can be challenged', ar: 'يمكن تحدّيه' },
  challengeableNo: { en: 'Cannot be challenged', ar: 'لا يُتحدى' },
  rolesTitle: { en: 'The characters', ar: 'الشخصيات' },
  rolesCopies: { en: '3 copies of each character are in play.', ar: 'في اللعبة 3 نسخ من كل شخصية.' },
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
  rulesInfluence: { en: 'Influence & elimination', ar: 'النفوذ والإقصاء' },
  rulesInfluenceText: {
    en: 'Each face-down card is one influence. Whenever you lose influence, you choose one of your cards and turn it face-up — it is dead and public for the rest of the game. Lose both cards and you are out; the game then continues until one player remains, and the final standings rank everyone by how long they survived.',
    ar: 'كل بطاقة مقلوبة هي نفوذ واحد. عندما تخسر نفوذاً، تختار إحدى بطاقاتك وتكشفها — تصبح ميتة ومعروفة للجميع لبقية اللعبة. اخسر البطاقتين وتخرج من اللعبة؛ ثم تستمر اللعبة حتى يبقى لاعب واحد، ويُرتَّب الجميع في النتيجة النهائية حسب صمودهم.',
  },
  rulesTurn: { en: 'On your turn', ar: 'في دورك' },
  rulesTurnText: {
    en: 'Pick exactly one action. Character actions (Tax, Assassinate, Steal, Exchange) are claims — you may claim a character you do not hold, but any player may challenge you. After the claim stands, targeted actions give the target (and Foreign Aid gives everyone) a chance to block.',
    ar: 'اختر إجراءً واحداً بالضبط. إجراءات الشخصيات (الضريبة، الاغتيال، السرقة، التبادل) ادعاءات — يمكنك ادعاء شخصية لا تملكها، لكن يحق لأي لاعب أن يتحداك. إذا صمد الادعاء، يحصل الهدف (وفي المعونة الخارجية أي لاعب) على فرصة للصدّ.',
  },

  // Settings
  settings: { en: 'Settings', ar: 'الإعدادات' },
  language: { en: 'Language', ar: 'اللغة' },
  hapticsSetting: { en: 'Haptic feedback', ar: 'الاهتزاز عند اللمس' },
  hapticsDesc: { en: 'Tactile feedback on taps', ar: 'ردة فعل لمسية عند الضغط' },
  audioSection: { en: 'Audio', ar: 'الصوت' },
  playSection: { en: 'Play', ar: 'اللعب' },
  tellsSetting: { en: 'Bot tells', ar: 'أمارات الروبوتات' },
  // Response windows: what each choice actually commits you to
  hintChallengeWindow: {
    en: 'Anyone may challenge the claim. Blocking comes after.',
    ar: 'يمكن لأي لاعب تحدّي الادعاء. أما الصدّ فيأتي بعده.',
  },
  hintBlockWindow: {
    en: 'To stop this you must claim a character yourself.',
    ar: 'لإيقاف هذا عليك أن تدّعي شخصية بنفسك.',
  },
  hintBlockChallengeWindow: {
    en: 'The block is a claim too — challenge it or accept it.',
    ar: 'الصدّ ادعاء أيضًا — تحدّه أو اقبله.',
  },
  optChallengeTitle: { en: 'Challenge the claim', ar: 'تحدَّ الادعاء' },
  optChallengeDesc: {
    en: 'You say {name} has no {role}. If they do, you lose a card.',
    ar: 'تقول إن {name} لا يملك {role}. فإن كان يملكها تفقد بطاقة.',
  },
  optClaimTitle: { en: 'Claim {role} to block', ar: 'ادّعِ {role} للصدّ' },
  optClaimDesc: {
    en: 'Stops the {action} — {name} may challenge your claim.',
    ar: 'يوقف {action} — ويمكن لـ {name} تحدّي ادعائك.',
  },
  optNoChallengeTitle: { en: 'Believe them', ar: 'صدّقهم' },
  optNoChallengeDesc: { en: 'The {action} goes through.', ar: 'يمضي {action}.' },
  optNoChallengeDescBlock: {
    en: 'You will still get the chance to block.',
    ar: 'ستبقى لديك فرصة الصدّ بعد ذلك.',
  },
  optLetItTitle: { en: "Don't block", ar: 'لا تصدّ' },
  optLetItDesc: { en: 'The {action} goes through.', ar: 'يمضي {action}.' },
  optAcceptBlockTitle: { en: 'Accept the block', ar: 'اقبل الصدّ' },
  optAcceptBlockDesc: { en: 'The {action} is stopped.', ar: 'يتوقف {action}.' },
  turnTimerSetting: { en: 'Turn clock', ar: 'مؤقت الدور' },
  turnTimerDesc: {
    en: 'Time limit per decision in offline games — online, the host sets it',
    ar: 'حدّ الوقت لكل قرار في اللعب دون اتصال — أما عبر الإنترنت فيحدّده المضيف',
  },
  tellsDesc: {
    en: 'A bluffing bot gives a subtle sign (offline games only)',
    ar: 'الروبوت المخادع يُبدي إشارة خفيفة (في اللعب دون اتصال فقط)',
  },
  soundsSetting: { en: 'Sound effects', ar: 'المؤثرات الصوتية' },
  soundsDesc: { en: 'Cards, coins and table sounds', ar: 'أصوات البطاقات والعملات والطاولة' },
  soundsDesc2: {
    en: 'Cards, coins, voices — separate from music',
    ar: 'البطاقات والعملات والأصوات — منفصلة عن الموسيقى',
  },
  musicSetting: { en: 'Table music', ar: 'موسيقى الطاولة' },
  musicDesc: { en: 'Quiet inn tune while in a game', ar: 'لحن هادئ أثناء اللعب' },
  about: { en: 'About', ar: 'حول' },
  aboutText: {
    en: 'A fan-made digital adaptation of the card game Coup for playing with friends — each on their own device.',
    ar: 'نسخة رقمية غير رسمية من لعبة كوب الورقية للعب مع الأصدقاء — كلٌّ على جهازه.',
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
