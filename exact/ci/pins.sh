# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT_REPO=https://github.com/expo/exact
EXACT_COMMIT=b5ad88a1e346a3de4f16274b8b76fb4146df380c
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
