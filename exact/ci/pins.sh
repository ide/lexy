# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# Bump EXACT2_COMMIT to build against a newer exact2 (the Lexy patch set lives
# on ide/exact2 integration/lexy-2026-10-17: ccheever/main plus our changes).
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=14c99fcff23da4231c7e7488a5c76a720cba844f
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
