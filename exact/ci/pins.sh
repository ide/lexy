# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# Bump EXACT2_COMMIT to build against a newer exact2 (the Lexy patch set lives
# on ide/exact2 integration/lexy-2026-10-22: exact2 main at 67c8eeed8f plus
# tuft/web-bar-word-press and the Observe work).
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=31e93f521022b50429bf451fd7dec126ea93cda2
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
