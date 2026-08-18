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
