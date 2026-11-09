# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT2_REPO=https://github.com/ccheever/exact2
EXACT2_COMMIT=1f097608dd109b35d491016aaa78ad365b08b7a6
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
