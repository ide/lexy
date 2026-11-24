# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT_REPO=https://github.com/expo/exact
EXACT_COMMIT=dcaaef323accfe0db259c4f1586474473eb1bf25
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
