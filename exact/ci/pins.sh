# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT_REPO=https://github.com/expo/exact
EXACT_COMMIT=2d0d6c4c3b6005bbf82cdc087a56f9f5df15b4b8
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
