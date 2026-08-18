#!/usr/bin/env bash
# Regenerate the character voice stingers.
#
# Five distinct macOS system voices, one per character, each processed
# into its own register/room with ffmpeg. Lines state the action plainly
# so the table always knows what was claimed.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)

# [[pbas]] pitch base, [[pmod]] pitch modulation (expressiveness),
# [[volm]] volume, [[rate]] words per minute — this is what makes the
# delivery theatrical instead of flat.
say -v Daniel -o "$TMP/duke.aiff" \
  "[[pbas 34]][[pmod 70]][[volm 1.0]][[rate 150]]The Duke [[emph +]]takes [[rate 140]]three coins."
say -v Ralph -o "$TMP/captain.aiff" \
  "[[pbas 46]][[pmod 85]][[volm 1.0]][[rate 200]]The Captain [[emph +]]steals two coins!"
say -v Rishi -o "$TMP/ambassador.aiff" \
  "[[pbas 44]][[pmod 72]][[volm 1.0]][[rate 178]]The Ambassador [[emph +]]exchanges with the Court."
say -v Tessa -o "$TMP/assassin.aiff" \
  "[[pbas 30]][[pmod 60]][[volm 0.9]][[rate 140]]The Assassin [[emph +]]strikes. [[slnc 120]][[rate 150]]Lose one influence."
say -v Samantha -o "$TMP/contessa.aiff" \
  "[[pbas 54]][[pmod 90]][[volm 1.0]][[rate 180]]The Contessa [[emph +]]blocks the assassination!"

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

PUNCH="acompressor=threshold=-18dB:ratio=4:attack=6:release=140:makeup=3"
process duke       0.95 "$PUNCH,aecho=0.8:0.6:58:0.3,bass=g=3,treble=g=-1"
process captain    0.93 "$PUNCH,aecho=0.62:0.42:20:0.18,treble=g=4"
process ambassador 1.0  "$PUNCH,aecho=0.5:0.3:34:0.12,bass=g=2,treble=g=1"
process assassin   0.96 "$PUNCH,highpass=f=160,aecho=0.72:0.58:115:0.42,treble=g=1"
process contessa   1.04 "$PUNCH,aecho=0.52:0.32:40:0.18,treble=g=3"

rm -rf "$TMP"
echo "voice stingers regenerated"
