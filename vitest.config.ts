import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `expo-sqlite/kv-store` cannot load under Node: it re-exports
      // `build/Storage.js`, whose extensionless `import … from './index'` is
      // unresolvable by Node's ESM resolver (vitest externalizes node_modules),
      // so importing it throws before any native module is reached. Expo's
      // server-runtime entry is a no-op stub, so web support would only trade
      // the crash for silently dropped writes. Swap in an in-memory store with
      // the same API instead — modules that touch persistence are then testable
      // without a `vi.mock` in every file. See the fake for the full rationale.
      "expo-sqlite/kv-store": fileURLToPath(
        new URL("./src/test-support/expo-sqlite-kv-store.ts", import.meta.url),
      ),
      // Mirror the tsconfig `@/*` path alias so unit tests can import source
      // modules by their `@/…` specifier (vitest does not read tsconfig paths).
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
