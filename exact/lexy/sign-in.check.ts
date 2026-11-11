// Run from the repository root after building the macOS development app (`bun exact.mjs mac` in exact/lexy)
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import process from 'node:process';

async function main(): Promise<void> {
  const root = import.meta.dirname;
  const exact = resolve(root, '../../../exact');
  const run = Bun.spawn([process.execPath, resolve(exact, 'scripts/agent.mjs'), 'macos', '--test', resolve(root, '../test-support/sign-in.test.contract')], {
    cwd: root,
    env: { ...process.env, EXACT_APP_DIR: root },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  assert.equal(await run.exited, 0, 'The macOS sign-in tests failed; the driver output names the failing step. Rebuild the macOS app first if the driver says the build is stale.');
}

await main();
