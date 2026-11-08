# What the CI build of the Exact app is made from. Sourced by exact/ci/ios.sh.
# The pinned runtime includes native navigation, UIKit header material, Observe and @exact/oauth.
# Rust comes from exact/lexy/rust-toolchain.toml; Hermes bundles come from
# Exact's vendored hermes-lean-sys pins.
EXACT2_REPO=https://github.com/ccheever/exact2
EXACT2_COMMIT=ead04512f1e6b5656521ab9c725188435ad27377
BUN_VERSION=1.4.2
# Bump to download the cached Hermes bundles again without changing the pin.
HERMES_CACHE_EPOCH=1
