import { defineConfig } from 'oxlint';
import native from 'oxlint-config-universe/native';

export default defineConfig({
  extends: [native],
  // oxlint does not inherit ignorePatterns through extends
  // (https://github.com/oxc-project/oxc/issues/10223).
  ignorePatterns: ['**/node_modules/**', '**/.expo/**'],
});
