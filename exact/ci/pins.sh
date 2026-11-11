# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT_REPO=https://github.com/expo/exact
EXACT_COMMIT=ac9acec120fa7aea4fcf2b17af9b12d881c9010f
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
