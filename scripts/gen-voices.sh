#!/usr/bin/env bash
# Regenerate the character voice stingers.
#
# Distinctiveness comes from using five genuinely different (natural)
# macOS voices — NOT from DSP. No pitch shifting, no prosody hacks: those
# make the delivery sound robotic. Processing is limited to trimming
# silence, a touch of room ambience for two characters, and loudness
# normalisation so the lines sit at the same level as the sound effects.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)

# voice choices (all modern, natural macOS voices):
#   Daniel   en_GB male   — the Duke, measured and official
#   Reed     en_US male   — the Captain, plain-spoken and direct
#   Rishi    en_IN male   — the Ambassador, warm and diplomatic
#   Tessa    en_ZA female — the Assassin, quiet and level
#   Samantha en_US female — the Contessa, poised
say -v Daniel   -r 158 -o "$TMP/duke.aiff"       "The Duke takes three coins."
say -v Reed     -r 176 -o "$TMP/captain.aiff"    "The Captain steals two coins."
say -v Rishi    -r 168 -o "$TMP/ambassador.aiff" "The Ambassador exchanges with the Court."
say -v Tessa    -r 152 -o "$TMP/assassin.aiff"   "The Assassin strikes. Lose one influence."
say -v Samantha -r 172 -o "$TMP/contessa.aiff"   "The Contessa blocks the assassination."

mkdir -p assets/sounds/roles
TRIM="silenceremove=start_periods=1:start_threshold=-45dB,\
areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"

process() { # role extra_filters
  local role=$1 extra=${2:-}
  local chain="$TRIM${extra:+,$extra},loudnorm=I=-17:TP=-1.5"
  ffmpeg -y -loglevel error -i "$TMP/$role.aiff" -af "$chain" \
    -ac 1 -ar 44100 -c:a aac -b:a 96k "assets/sounds/roles/$role.m4a"
  echo "  $role -> assets/sounds/roles/$role.m4a"
}

# only a hint of space where it suits the character; everyone else dry
process duke       "aecho=0.35:0.28:48:0.10"
process captain    ""
process ambassador ""
process assassin   "aecho=0.4:0.3:70:0.14"
process contessa   ""

rm -rf "$TMP"
echo "voice stingers regenerated (natural voices, minimal processing)"

# ---------------------------------------------------------------------------
# Reaction barks: how each character behaves when a challenge is resolved or
# their action is blocked. Same natural voices, same light processing.
# ---------------------------------------------------------------------------
TMP2=$(mktemp -d)
mkdir -p assets/sounds/roles

react() { # role voice rate gloat caught blocked
  local role=$1 voice=$2 rate=$3 gloat=$4 caught=$5 blocked=$6
  say -v "$voice" -r "$rate" -o "$TMP2/$role-gloat.aiff"   "$gloat"
  say -v "$voice" -r "$rate" -o "$TMP2/$role-caught.aiff"  "$caught"
  say -v "$voice" -r "$rate" -o "$TMP2/$role-blocked.aiff" "$blocked"
  for kind in gloat caught blocked; do
    ffmpeg -y -loglevel error -i "$TMP2/$role-$kind.aiff" \
      -af "$TRIM,loudnorm=I=-17:TP=-1.5" \
      -ac 1 -ar 44100 -c:a aac -b:a 96k "assets/sounds/roles/$role-$kind.m4a"
  done
  echo "  $role reactions"
}

react duke       Daniel   158 "The Duke does not bluff."            "A regrettable exaggeration."   "The treasury is closed to me."
react captain    Reed     176 "Told you. The Captain."              "Fine. You caught me."          "My hands are empty."
react ambassador Rishi    168 "The Ambassador keeps his word."      "A misunderstanding, truly."    "The Court is closed today."
react assassin   Tessa    152 "The blade was always real."          "No blade. Not this time."      "The Contessa saved you."
react contessa   Samantha 172 "The Contessa is never questioned."   "I had no Contessa."            "So be it."

rm -rf "$TMP2"
echo "reaction barks regenerated"

# ---------------------------------------------------------------------------
# Arabic delivery.
#
# macOS ships exactly one Arabic voice on most installs (Majed), and `say`
# does NOT fail for an unknown name — it quietly renders with the default
# English voice, which produces a near-empty file for Arabic text. So each
# candidate is probed for real output before it is used, and the cast falls
# back to whatever Arabic voice does exist. Install more Arabic voices
# (System Settings › Accessibility › Spoken Content › Manage Voices) and
# re-run: the extra voices are picked up automatically.
# ---------------------------------------------------------------------------
TMP3=$(mktemp -d)
AR_PROBE="الدوق يأخذ ثلاث عملات"

speaks_arabic() { # voice -> 0 when it renders real Arabic audio
  local v=$1 out="$TMP3/probe-$v.aiff"
  say -v "$v" -o "$out" "$AR_PROBE" >/dev/null 2>&1 || return 1
  # an English voice handed Arabic text emits a few KB of nothing
  [ "$(stat -f%z "$out")" -gt 40000 ]
}

# preference order per character; the first that really speaks Arabic wins
pick_ar_voice() {
  for v in "$@"; do
    if speaks_arabic "$v"; then echo "$v"; return; fi
  done
  echo ""
}

AR_DUKE=$(pick_ar_voice Maged Majed)
AR_CAPTAIN=$(pick_ar_voice Tarik Salim Majed Maged)
AR_AMBASSADOR=$(pick_ar_voice Amira Majed Maged)
AR_ASSASSIN=$(pick_ar_voice Laila Nada Majed Maged)
AR_CONTESSA=$(pick_ar_voice Hala Majed Maged)

if [ -z "$AR_DUKE" ]; then
  echo "  !! no Arabic voice installed — skipping the Arabic lines"
else
  echo "  Arabic cast: duke=$AR_DUKE captain=$AR_CAPTAIN ambassador=$AR_AMBASSADOR assassin=$AR_ASSASSIN contessa=$AR_CONTESSA"
  ar_line() { # role voice rate text
    local role=$1 voice=$2 rate=$3 text=$4
    say -v "$voice" -r "$rate" -o "$TMP3/$role.aiff" "$text"
    ffmpeg -y -loglevel error -i "$TMP3/$role.aiff" \
      -af "$TRIM,loudnorm=I=-17:TP=-1.5" \
      -ac 1 -ar 44100 -c:a aac -b:a 96k "assets/sounds/roles/$role-ar.m4a"
  }

  # Rate is the only differentiation applied when one voice plays every part:
  # it is how a person speaks, not a filter on their voice.
  ar_line duke       "$AR_DUKE"       165 "الدوق يأخذ ثلاث عملات"
  ar_line captain    "$AR_CAPTAIN"    185 "القبطان يسرق عملتين"
  ar_line ambassador "$AR_AMBASSADOR" 175 "السفير يبادل مع البلاط"
  ar_line assassin   "$AR_ASSASSIN"   158 "القاتل يضرب، اخسر نفوذًا"
  ar_line contessa   "$AR_CONTESSA"   180 "الكونتيسة تمنع الاغتيال"

  ar_react() { # role voice rate gloat caught blocked
    local role=$1 voice=$2 rate=$3 gloat=$4 caught=$5 blocked=$6
    local kind text
    for kind in gloat caught blocked; do
      case $kind in
        gloat) text=$gloat ;;
        caught) text=$caught ;;
        blocked) text=$blocked ;;
      esac
      say -v "$voice" -r "$rate" -o "$TMP3/$role-$kind.aiff" "$text"
      ffmpeg -y -loglevel error -i "$TMP3/$role-$kind.aiff" \
        -af "$TRIM,loudnorm=I=-17:TP=-1.5" \
        -ac 1 -ar 44100 -c:a aac -b:a 96k "assets/sounds/roles/$role-$kind-ar.m4a"
    done
    echo "    $role reactions (ar)"
  }

  ar_react duke       "$AR_DUKE"       165 "الدوق لا يخادع" "مبالغة يُؤسف لها" "الخزينة مغلقة أمامي"
  ar_react captain    "$AR_CAPTAIN"    185 "قلت لك، القبطان" "حسنًا، أمسكت بي" "يداي فارغتان"
  ar_react ambassador "$AR_AMBASSADOR" 175 "السفير يحفظ كلمته" "سوء فهم، حقًا" "البلاط مغلق اليوم"
  ar_react assassin   "$AR_ASSASSIN"   158 "كان النصل حقيقيًا" "لا نصل، ليس هذه المرة" "الكونتيسة أنقذتك"
  ar_react contessa   "$AR_CONTESSA"   180 "الكونتيسة لا تُسأل" "لم تكن لديّ كونتيسة" "فليكن"
fi

rm -rf "$TMP3"
echo "Arabic lines regenerated"
