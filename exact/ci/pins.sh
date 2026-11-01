# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# The pinned runtime includes native navigation, UIKit header material, Observe and @exact/oauth.
# Rust comes from exact/lexy/rust-toolchain.toml; the Hermes commit from
# exact2's js/build.rs (HERMES_PIN).
EXACT2_REPO=https://github.com/ide/exact2
EXACT2_COMMIT=1abc758db3154630e343071aebe4c0df9fd11892
BUN_VERSION=1.4.2
# Bump to rebuild the cached Hermes inputs without changing the pin.
HERMES_CACHE_EPOCH=1
