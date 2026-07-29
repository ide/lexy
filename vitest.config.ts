import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Mirror the tsconfig `@/*` path alias so unit tests can import source modules
// by their `@/…` specifier (vitest does not read tsconfig paths on its own).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
