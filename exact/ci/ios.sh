#!/bin/bash
# Build the Exact app (exact/lexy) as an ad hoc .ipa on a Mac with nothing but
# Xcode on it: EAS's macOS workers run it from .eas/build/exact.yml, one phase
# per step, and it runs the same way on a developer Mac.
#
#   exact/ci/ios.sh toolchain          Bun, Rust (+ aarch64-apple-ios), the Metal toolchain
#   exact/ci/ios.sh deps               exact2 at the pinned commit beside this repo, its bun install
#   exact/ci/ios.sh hermes             the Hermes inputs exact2 links (built once, then cached)
#   exact/ci/ios.sh signing <creds>    keychain + profile from EAS's buildCredentials JSON
#   exact/ci/ios.sh archive            app id, version contract, `bun exact.mjs ios --device --archive`
#   exact/ci/ios.sh cleanup            removes the keychain from the search list
#
# Layout: exact/lexy's Cargo paths name ../../../exact2, so exact2 is cloned
# beside the repo root, and exact2 finds Hermes in ../ibex beside itself. The
# phases share state through $WORK/.exact-ci/env.sh (EAS runs each step in a
# fresh shell). Overrides: EXACT_IDENTITY + EXACT_PROFILE (skip `signing`),
# EXACT_CI_VERSION, EXACT_CI_BUILD_NUMBER, EXACT_CI_HERMES_CACHE.
set -euo pipefail

REPO=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(dirname "$REPO")
STATE=$WORK/.exact-ci
APP=$REPO/exact/lexy
EXACT2=$WORK/exact2
HERMES_CACHE=${EXACT_CI_HERMES_CACHE:-$HOME/.cache/exact-ci/hermes}
# shellcheck source=pins.sh
. "$REPO/exact/ci/pins.sh"
mkdir -p "$STATE"
touch "$STATE/env.sh"
# shellcheck disable=SC1091
. "$STATE/env.sh"

log() { printf '\n== exact/ci: %s\n' "$*" >&2; }
die() { printf 'exact/ci: %s\n' "$*" >&2; exit 1; }
remember() { printf '%s\n' "$@" >> "$STATE/env.sh"; }
# A step output when EAS runs us, else just printed.
output() { if command -v set-output >/dev/null 2>&1; then set-output "$1" "$2"; fi; printf '%s=%s\n' "$1" "$2"; }

hermes_pin() { sed -n 's/^const HERMES_PIN: &str = "\([0-9a-f]\{40\}\)";$/\1/p' "$EXACT2/js/build.rs"; }

toolchain() {
  log "Bun $BUN_VERSION"
  if [ "$(bun --version 2>/dev/null || true)" != "$BUN_VERSION" ]; then
    curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION" >&2
    export PATH="$HOME/.bun/bin:$PATH"
    remember "export PATH=\"\$HOME/.bun/bin:\$PATH\""
  fi
  [ "$(bun --version)" = "$BUN_VERSION" ] || die "bun is $(bun --version), want $BUN_VERSION"

  local rust
  rust=$(sed -n 's/^channel = "\(.*\)"$/\1/p' "$APP/rust-toolchain.toml")
  log "Rust $rust"
  if ! command -v rustup >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none --no-modify-path >&2
    export PATH="$HOME/.cargo/bin:$PATH"
    remember "export PATH=\"\$HOME/.cargo/bin:\$PATH\""
  fi
  # Everything both rust-toolchain.toml files list, plus the device target.
  rustup toolchain install "$rust" --profile minimal --component rustfmt,clippy \
    --target aarch64-apple-ios,wasm32-unknown-unknown >&2

  log "Xcode"
  xcodebuild -version >&2
  # The SVG filter kernels need the Metal toolchain, a separate download since Xcode 26.
  if ! xcrun -sdk iphoneos metal -v >/dev/null 2>&1; then
    log "Metal toolchain (download)"
    xcodebuild -downloadComponent MetalToolchain >&2
  fi
  xcrun -sdk iphoneos metal -v >&2
}

deps() {
  log "exact2 $EXACT2_COMMIT"
  if [ "$(git -C "$EXACT2" rev-parse HEAD 2>/dev/null || true)" != "$EXACT2_COMMIT" ]; then
    rm -rf "$EXACT2"
    git init -q "$EXACT2"
    git -C "$EXACT2" fetch -q --depth 1 "$EXACT2_REPO" "$EXACT2_COMMIT"
    git -C "$EXACT2" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
  fi
  (cd "$EXACT2" && bun install --frozen-lockfile >&2)
  # exact2's scripts run Cargo --locked --offline: fetch both workspaces' crates first.
  log "crates"
  (cd "$EXACT2" && cargo fetch --locked >&2)
  (cd "$APP" && cargo fetch --locked >&2)
  # The bake's Rolldown resolves the repo root's tsconfig.json, which extends
  # expo/tsconfig.base: the Expo app's node_modules must be there.
  if [ ! -f "$REPO/node_modules/expo/tsconfig.base.json" ]; then
    log "the Expo app's node_modules (pnpm)"
    (cd "$REPO" && pnpm install --frozen-lockfile >&2)
  fi
  local pin xcode
  pin=$(hermes_pin)
  [ -n "$pin" ] || die "no HERMES_PIN in $EXACT2/js/build.rs"
  xcode=$(xcodebuild -version | sed -n 's/^Build version //p')
  output hermes_key "exact-hermes-$HERMES_CACHE_EPOCH-$pin-xcode-$xcode-$(uname -m)"
  output hermes_cache "$HERMES_CACHE"
}

# What exact2 links from Hermes, and nothing else (ibex's full
# build-hermes.sh --vanilla also builds frameworks for three platforms):
#   ibex/ios/Frameworks-vanilla/hermes-headers          js/build.rs, every target
#   ibex/ios/Frameworks-vanilla/macos-static/*.a        the bake's host build links the VM
#   ibex/tools/hermes-vanilla/hermesc-macos-arm64       the bake compiles app.ts to bytecode
#   lean-ios/ios/{lib,jsi,external}/…a                  the device VM (EXACT_HERMES_IOS_DIR)
MACOS_ARCHIVES="lib/libhermesvmlean_a.a jsi/libjsi.a external/boost/boost_1_86_0/libs/context/libboost_context.a"
hermes_complete() {
  local ibex=$HERMES_CACHE/ibex a
  [ -f "$ibex/ios/Frameworks-vanilla/hermes-headers/hermes/hermes.h" ] || return 1
  [ -x "$ibex/tools/hermes-vanilla/hermesc-macos-arm64" ] || return 1
  for a in $MACOS_ARCHIVES; do [ -f "$ibex/ios/Frameworks-vanilla/macos-static/$(basename "$a")" ] || return 1; done
  for a in $MACOS_ARCHIVES; do [ -f "$HERMES_CACHE/lean-ios/ios/$a" ] || return 1; done
}

hermes_build() {
  local pin src jobs ibex mac a
  pin=$(hermes_pin)
  src=$HOME/.cache/exact/hermes/hermes-src # where exact2's provisionHermesIos looks
  jobs=$(sysctl -n hw.ncpu)
  ibex=$HERMES_CACHE/ibex
  command -v cmake >/dev/null 2>&1 || { log "cmake (brew)"; brew install cmake >&2; }
  log "Hermes source facebook/hermes $pin"
  if [ "$(git -C "$src" rev-parse HEAD 2>/dev/null || true)" != "$pin" ]; then
    rm -rf "$src"
    git init -q "$src"
    git -C "$src" fetch -q --depth 1 https://github.com/facebook/hermes.git "$pin"
    git -C "$src" -c advice.detachedHead=false checkout -q --detach FETCH_HEAD
  fi
  if [ ! -x "$src/build_host_hermesc/bin/hermesc" ] || [ ! -f "$src/build_host_hermesc/ImportHostCompilers.cmake" ]; then
    log "Hermes host compiler (ibex build-hermes.sh's flags)"
    cmake -S "$src" -B "$src/build_host_hermesc" -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_OSX_SYSROOT=macosx -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
      -DHERMES_ENABLE_TEST_SUITE=OFF -DHAVE_CXX_ATOMICS_WITHOUT_LIB=ON -DHAVE_CXX_ATOMICS64_WITHOUT_LIB=ON >&2
    cmake --build "$src/build_host_hermesc" --target hermesc -j "$jobs" >&2
  fi

  log "Hermes lean VM for macOS (the bake's host build)"
  mac=$(mktemp -d "${TMPDIR:-/tmp}/hermes-macos.XXXXXX")
  cmake -S "$src" -B "$mac" -DHERMES_APPLE_TARGET_PLATFORM=macosx -DCMAKE_OSX_ARCHITECTURES=arm64 \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 -DHERMES_ENABLE_DEBUGGER=OFF -DHERMES_ENABLE_INTL=ON \
    -DHERMES_ENABLE_TEST_SUITE=OFF -DHERMES_ENABLE_BITCODE=OFF -DHERMES_BUILD_APPLE_FRAMEWORK=OFF \
    -DHERMES_BUILD_SHARED_JSI=OFF -DIMPORT_HOST_COMPILERS="$src/build_host_hermesc/ImportHostCompilers.cmake" \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_C_FLAGS="-Wno-unguarded-availability -Wno-unguarded-availability-new -Wno-availability" \
    -DCMAKE_CXX_FLAGS="-Wno-unguarded-availability -Wno-unguarded-availability-new -Wno-availability" >&2
  cmake --build "$mac" --target hermesvmlean_a jsi boost_context -j "$jobs" >&2

  rm -rf "$ibex"
  mkdir -p "$ibex/ios/Frameworks-vanilla/macos-static" "$ibex/tools/hermes-vanilla"
  for a in $MACOS_ARCHIVES; do cp "$mac/$a" "$ibex/ios/Frameworks-vanilla/macos-static/"; done
  rm -rf "$mac"
  cp "$src/build_host_hermesc/bin/hermesc" "$ibex/tools/hermes-vanilla/hermesc-macos-arm64"
  # The headers, as ibex's build-hermes.sh installs them.
  local h=$ibex/ios/Frameworks-vanilla/hermes-headers
  mkdir -p "$h/hermes/Public" "$h/hermes/cdp" "$h/jsi"
  cp "$src"/public/hermes/Public/*.h "$h/hermes/Public/"
  cp "$src"/API/hermes/*.h "$h/hermes/"
  cp "$src"/API/hermes/cdp/*.h "$h/hermes/cdp/"
  cp "$src"/API/jsi/jsi/*.h "$h/jsi/"

  log "Hermes lean VM for iOS devices (exact2's provisionHermesIos)"
  (cd "$EXACT2" && env -u EXACT_HERMES_IOS_DIR bun -e \
    "const m = await import('./host/apple/build.mjs'); m.provisionHermesIos('ios');" >&2)
  rm -rf "$HERMES_CACHE/lean-ios"
  mkdir -p "$HERMES_CACHE/lean-ios"
  cp -R "$HOME/.cache/exact/hermes/${pin:0:12}-lean-ios/ios" "$HERMES_CACHE/lean-ios/ios"
}

hermes() {
  local built=false
  if hermes_complete; then
    log "Hermes inputs: cached at $HERMES_CACHE"
  else
    hermes_build
    built=true
    hermes_complete || die "Hermes inputs incomplete after the build in $HERMES_CACHE"
  fi
  if [ -e "$WORK/ibex" ] && [ ! -L "$WORK/ibex" ]; then
    log "using the existing $WORK/ibex checkout's Hermes"
  else
    ln -sfn "$HERMES_CACHE/ibex" "$WORK/ibex"
  fi
  remember "export EXACT_HERMES_IOS_DIR='$HERMES_CACHE/lean-ios'"
  output built "$built"
}

signing() {
  local creds=${1:-}
  [ -f "$creds" ] || die "signing needs the credentials JSON (eas.job.secrets.buildCredentials)"
  log "signing"
  bun "$REPO/exact/ci/signing.mjs" "$creds" "$STATE" >> "$STATE/env.sh"
  rm -f "$creds"
}

archive() {
  : "${EXACT_IDENTITY:?no EXACT_IDENTITY: run the signing phase or set it}"
  : "${EXACT_PROFILE:?no EXACT_PROFILE: run the signing phase or set it}"
  local id=${EXACT_CI_APP_ID:-app.ide.lexy}
  # Device builds install over the Expo app; the simulator keeps app.ide.lexy.exact.
  # Changed here, in the build's checkout, never committed.
  log "app id $id"
  cd "$STATE" # bun -e reads the nearest tsconfig.json; the Expo app's warns
  ID="$id" bun -e '
    const f = "'"$APP"'/app.json", m = JSON.parse(await Bun.file(f).text());
    m.id = process.env.ID; m.app.id = process.env.ID;
    await Bun.write(f, JSON.stringify(m, null, 2) + "\n");'
  sed -i '' -E "s/^export const appId = '[^']*';/export const appId = '$id';/" "$APP/app.ts"
  grep -q "^export const appId = '$id';" "$APP/app.ts" || die "could not set appId in app.ts"

  # A version above the installed Expo app's (iOS otherwise reports the
  # install as already present): app.json's, one patch up.
  local version build exact2_version
  version=${EXACT_CI_VERSION:-$(bun -e '
    const v = JSON.parse(await Bun.file("'"$REPO"'/app.json").text()).expo.version.split(".").map(Number);
    while (v.length < 3) v.push(0); v[2] += 1; console.log(v.join("."));')}
  build=${EXACT_CI_BUILD_NUMBER:-}
  if [ -z "$build" ] || [ "$build" = undefined ]; then build=$(date -u +%Y%m%d%H%M); fi
  exact2_version=$(sed -n 's/^version = "\(.*\)"$/\1/p' "$EXACT2/Cargo.toml" | head -1)
  log "version $version ($build), Exact $exact2_version (${EXACT2_COMMIT:0:8})"
  cat > "$APP/exact-version.contract" <<EOF
// Generated at build: this build's version and the Exact framework it was made with.
fn appVersion(): string = "$version ($build)"
fn exactVersion(): string = "$exact2_version (${EXACT2_COMMIT:0:8})"
EOF

  local ipa=$APP/dist/Lexy.ipa
  mkdir -p "$APP/dist"
  rm -f "$ipa"
  log "bun exact.mjs ios --device --archive"
  (cd "$APP" && EXACT_VERSION=$version EXACT_BUILD_NUMBER=$build bun exact.mjs ios --device --archive "$ipa")
  [ -f "$ipa" ] || die "no $ipa"

  local check
  check=$(mktemp -d "${TMPDIR:-/tmp}/exact-ipa.XXXXXX")
  unzip -q "$ipa" -d "$check"
  local plist
  plist=$(ls -d "$check"/Payload/*.app)/Info.plist
  log "$(basename "$ipa"): $(du -h "$ipa" | cut -f1), $(plutil -extract CFBundleIdentifier raw "$plist") $(plutil -extract CFBundleShortVersionString raw "$plist") ($(plutil -extract CFBundleVersion raw "$plist"))"
  codesign --verify --deep --strict "$(dirname "$plist")" >&2
  codesign -dv "$(dirname "$plist")" 2>&1 | grep -E '^(Identifier|Authority|TeamIdentifier)=' | head -3 >&2 || true
  rm -rf "$check"
  output ipa "$ipa"
  output version "$version"
  output build_number "$build"
}

cleanup() {
  [ -n "${EXACT_CI_KEYCHAIN:-}" ] || return 0
  security delete-keychain "$EXACT_CI_KEYCHAIN" 2>/dev/null || true
}

phase=${1:-}
shift || true
case "$phase" in
  toolchain|deps|hermes|signing|archive|cleanup) "$phase" "$@" ;;
  *) die "usage: exact/ci/ios.sh <toolchain|deps|hermes|signing <creds.json>|archive|cleanup>" ;;
esac
