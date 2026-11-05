// Run against an iOS development build, with EXACT_SIM naming a test simulator
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';

async function main(): Promise<void> {
  const simulator = process.env.EXACT_SIM;
  assert(simulator, 'EXACT_SIM must name the simulator this test owns');
  const root = import.meta.dirname;
  const exact = resolve(root, '../../../exact2');
  const directory = mkdtempSync(resolve(tmpdir(), 'lexy-screen-tests-'));
  try {
    prepareSimulator(exact, directory, simulator);
    for (const file of readdirSync(root).filter((file): boolean => file.endsWith('.contract'))) {
      copyFileSync(resolve(root, file), resolve(directory, file));
    }
    for (const file of ['app.json', 'app.tamber']) {
      copyFileSync(resolve(root, file), resolve(directory, file));
    }
    cpSync(resolve(root, 'assets'), resolve(directory, 'assets'), { recursive: true });
    copyFileSync(resolve(root, '../test-support/screens.contract'), resolve(directory, 'app.contract'));
    const plan = resolve(directory, 'app.plan');
    const compiled = Bun.spawnSync([resolve(exact, 'target/debug/contract'), 'build', resolve(directory, 'app.contract'), '-o', plan, '--map'], { cwd: directory });
    assert.equal(compiled.exitCode, 0, compiled.stderr.toString());
    const run = Bun.spawn([process.execPath, resolve(exact, 'scripts/agent.mjs'), 'ios', '--plan', plan, '--test', resolve(root, '../test-support/screens.test.contract')], {
      cwd: root,
      env: { ...process.env, EXACT_APP_DIR: root, EXACT_SHOW_SIMULATOR: '0' },
      stdout: 'inherit',
      stderr: 'inherit',
    });
    assert.equal(await run.exited, 0, 'The iOS screen tests failed; the driver output identifies the assertion');
    await checkRepeatedMarks(exact, root, plan);
  } finally {
    rmSync(directory, { recursive: true });
  }
}

async function checkRepeatedMarks(exact: string, root: string, plan: string): Promise<void> {
  const { open } = await import(resolve(exact, 'scripts/agent.mjs'));
  const session = await open({ host: 'ios', app: root, plan, size: '390x844', storage: 'lexy-repeated-marks' });
  try {
    await session.tap('performance');
    await session.tap('fill');
    await session.clock('settle');
    const before = await session.tree();
    const original = before.nodes.find((node: { props: { testId?: string } }): boolean => node.props.testId === 'perf-launch-timeToInteractive');
    assert(original, 'The first launch mark is visible before inserting an earlier mark');
    await session.tap('fill');
    await session.clock('settle');
    const tree = await session.tree();
    const marks = tree.nodes.filter((node: { props: { testId?: string } }): boolean => node.props.testId === 'perf-launch-timeToInteractive');
    assert.equal(marks.length, 2, 'Repeated launch marks need separate rows even when their names match');
    assert.equal(marks[0].props.text, '42000 ms');
    assert.equal(marks[1].id, original.id, 'Inserting an earlier mark preserves the existing row identity');
  } finally {
    await session.close();
  }
}

// Open the Duo’s hinge so UIKit arranges panes using the physical window scene
function prepareSimulator(exact: string, directory: string, simulator: string): void {
  function checked(arguments_: string[]): string {
    const result = Bun.spawnSync(arguments_);
    assert.equal(result.exitCode, 0, `${arguments_.join(' ')} failed: ${result.stderr.toString()}`);
    return result.stdout.toString();
  }
  const catalog = JSON.parse(checked(['xcrun', 'simctl', 'list', 'devices', '--json'])) as {
    devices: Record<string, { udid: string; state: string; deviceTypeIdentifier: string }[]>;
  };
  const device = Object.values(catalog.devices).flat().find((device): boolean => device.udid === simulator);
  assert(device, `The test simulator ${simulator} is missing; create it before running these checks`);
  if (device.state !== 'Booted') {
    checked(['xcrun', 'simctl', 'boot', simulator]);
    checked(['xcrun', 'simctl', 'bootstatus', simulator, '-b']);
  }
  if (!device.deviceTypeIdentifier.endsWith('.iPhone-Duo')) {
    return;
  }
  const helper = resolve(directory, 'hinge_helper');
  checked(['xcrun', '-sdk', 'iphonesimulator', 'clang', '-arch', process.arch, '-mios-simulator-version-min=17.0', '-O2', '-framework', 'IOKit', '-framework', 'CoreFoundation', '-o', helper, resolve(exact, 'scripts/duo/hinge_helper.c')]);
  checked(['codesign', '-s', '-', helper]);
  checked(['xcrun', 'simctl', 'spawn', simulator, helper, 'orient', 'portrait']);
  checked(['xcrun', 'simctl', 'spawn', simulator, helper, 'set', '180']);
}

await main();
