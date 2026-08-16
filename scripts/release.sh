#!/usr/bin/env bash
# Coup release builder.
# Produces three versioned artifacts in ./release-out:
#   Coup-vX.Y.Z-arm64.apk      — slim arm64-v8a (recommended, smaller)
#   Coup-vX.Y.Z-universal.apk  — all ABIs (older devices, emulators)
#   Coup-vX.Y.Z.ipa            — unsigned iOS device build (sideload)
#
# Usage:  ./scripts/release.sh
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./app.json').expo.version")
OUT="release-out"
NAME="Coup"
echo "==> Building ${NAME} v${VERSION}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
echo "Using ANDROID_HOME=$ANDROID_HOME"

echo "==> Prebuild (both platforms)"
npx expo prebuild --no-install
# prebuild wipes android/local.properties — always rewrite it
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
(cd ios && pod install)

rm -rf "$OUT" && mkdir -p "$OUT"

echo "==> Android slim APK (arm64-v8a)"
(cd android && ./gradlew assembleRelease -q -PreactNativeArchitectures=arm64-v8a)
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/${NAME}-v${VERSION}-arm64.apk"

echo "==> Android universal APK (all ABIs)"
(cd android && ./gradlew assembleRelease -q \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64)
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/${NAME}-v${VERSION}-universal.apk"

echo "==> iOS unsigned device IPA"
DERIVED="/tmp/coup-release-derived"
(cd ios && xcodebuild -workspace ${NAME}.xcworkspace -scheme ${NAME} \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED" build CODE_SIGNING_ALLOWED=NO)
STAGE=$(mktemp -d)
mkdir -p "$STAGE/Payload"
cp -R "$DERIVED/Build/Products/Release-iphoneos/${NAME}.app" "$STAGE/Payload/"
(cd "$STAGE" && zip -qr ipa.zip Payload)
mv "$STAGE/ipa.zip" "$OUT/${NAME}-v${VERSION}.ipa"
rm -rf "$STAGE"

echo "==> Done:"
ls -lh "$OUT"
