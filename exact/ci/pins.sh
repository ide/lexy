# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT2_REPO=https://github.com/ccheever/exact2
EXACT2_COMMIT=ead04512f1e6b5656521ab9c725188435ad27377
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
