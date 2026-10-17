# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# Bump EXACT2_COMMIT to build against a newer exact2. This integration commit
# includes iOS content owners and initial sheet detent selection: sheets
# present their own content while the tab controller stays put, and Lexy
# opens a resizable map sheet at large height.
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=223fb3b2a464374fbe61a3e3d5b0950f2d0388ac
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
