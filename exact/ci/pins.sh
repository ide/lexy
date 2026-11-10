# Pin the build inputs used by exact/ci/ios.sh
# Rust is pinned in exact/lexy/rust-toolchain.toml; Hermes bundles are pinned in Exact.
EXACT2_REPO=https://github.com/expo/exact
EXACT2_COMMIT=5434f4325d31fbd138e17a8021faa5e781aef1dd
BUN_VERSION=1.4.2
# Bump to invalidate the CI cache without changing the bundle pins
HERMES_CACHE_EPOCH=1
