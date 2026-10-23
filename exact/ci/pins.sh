# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# The patch set lives on ide/exact2 integration/lexy-2026-10-22: upstream
# main at a648f88474 with authored button padding, sheet words, release
# fades, root scrolling and the Observe integration.
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=88538bcaf504fc3f8cd9a19008901e2349ce09dd
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
