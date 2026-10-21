# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# Bump EXACT2_COMMIT to build against a newer exact2 (the Lexy patch set lives
# on ide/exact2 integration/lexy-2026-10-21: exact2 main at 4832552293, which
# has the sheet change (ccheever/exact2#867), plus the web branches of
# ccheever/exact2#895, #896, #897 and #898, and the Observe work).
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=5b976197ab059a8705e08181155fa60aefb9ce6c
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
