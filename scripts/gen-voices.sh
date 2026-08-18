#!/usr/bin/env bash
# Regenerate the character voice stingers.
#
# Five distinct macOS system voices, one per character, each processed
# into its own register/room with ffmpeg. Lines state the action plainly
# so the table always knows what was claimed.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)

say -v Daniel   -r 165 -o "$TMP/duke.aiff"       "The Duke takes three coins."
say -v Ralph    -r 175 -o "$TMP/captain.aiff"    "The Captain steals two coins!"
say -v Rishi    -r 170 -o "$TMP/ambassador.aiff" "The Ambassador exchanges with the Court."
say -v Tessa    -r 155 -o "$TMP/assassin.aiff"   "The Assassin strikes. Lose one influence."
say -v Samantha -r 165 -o "$TMP/contessa.aiff"   "The Contessa blocks the assassination."

mkdir -p assets/sounds/roles
process() { # role pitch extra_filters
  local role=$1 pitch=$2 extra=$3
  local tempo
  tempo=$(python3 -c "print(f'{1/$pitch:.3f}')")
  ffmpeg -y -loglevel error -i "$TMP/$role.aiff" \
    -af "asetrate=22050*$pitch,aresample=44100,atempo=$tempo,$extra,\
silenceremove=start_periods=1:start_threshold=-45dB,\
areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,\
loudnorm=I=-17:TP=-1.5" \
    -ac 1 -c:a aac -b:a 96k "assets/sounds/roles/$role.m4a"
  echo "  $role -> assets/sounds/roles/$role.m4a"
}

process duke       0.94 "aecho=0.75:0.55:55:0.28,treble=g=-2"
process captain    0.92 "aecho=0.6:0.4:22:0.16,treble=g=3"
process ambassador 1.0  "aecho=0.5:0.3:34:0.12,bass=g=2"
process assassin   0.95 "volume=0.9,highpass=f=170,aecho=0.7:0.55:110:0.4"
process contessa   1.03 "aecho=0.5:0.3:40:0.16,treble=g=2"

rm -rf "$TMP"
echo "voice stingers regenerated"
