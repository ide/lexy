// Run against an iOS development build, with EXACT_SIM naming a test simulator
import assert from 'node:assert/strict';
import { copyFileSync, cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';

async function main(): Promise<void> {
  const simulator = process.env.EXACT_SIM;
  assert(simulator, 'EXACT_SIM must name the simulator this test owns');
  const root = import.meta.dirname;
  const exact = resolve(root, '../../../exact');
  const directory = mkdtempSync(resolve(tmpdir(), 'lexy-screen-tests-'));
  try {
    const unfolded = prepareSimulator(exact, directory, simulator);
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
    await checkDeveloperPaneLayout(exact, root, directory, unfolded);
    await checkWarningQuiescence(exact, root);
    await checkScrollMeasurement(exact, root);
  } finally {
    rmSync(directory, { recursive: true });
  }
}

async function checkDeveloperPaneLayout(exact: string, root: string, directory: string, unfolded: boolean = true): Promise<void> {
  const { open } = await import(resolve(exact, 'scripts/agent.mjs'));
  const fixture = resolve(directory, 'app.contract');
  const source = readFileSync(fixture, 'utf8');
  writeFileSync(fixture, source.replace('state screen = "controls"', 'state screen = "native-performance"').replace('state full = false', 'state full = true').replace('state available = false', 'state available = true'));
  const plan = resolve(directory, 'native-panes.plan');
  const compiled = Bun.spawnSync([resolve(exact, 'target/debug/contract'), 'build', fixture, '-o', plan, '--map'], { cwd: directory });
  assert.equal(compiled.exitCode, 0, compiled.stderr.toString());
  type Node = { id: number; parent: number | null; props: { testId?: string; text?: string } };
  type Box = { id: number; x: number; y: number; w: number; h: number; sy?: number; port?: number[] };
  for (const size of (unfolded ? ['390x844', '951x669'] : ['390x844'])) {
    const session = await open({ host: 'ios', app: root, chrome: 'platform', plan, size, storage: `lexy-pane-layout-${size}` });
    try {
      await session.clock('settle');
      async function snapshot(): Promise<{ nodes: Node[]; boxes: Box[]; navigation: { barHeight: number; collapseScroller: number | null; arrangedScrollers: number[] } }> {
        return { nodes: (await session.tree()).nodes, boxes: (await session.layout()).nodes, navigation: (await session.state()).navigation };
      }
      function node(snap: Awaited<ReturnType<typeof snapshot>>, id: string): Node {
        const result = snap.nodes.find((candidate): boolean => candidate.props.testId === id);
        assert(result, `${id} is mounted`);
        return result;
      }
      function box(snap: Awaited<ReturnType<typeof snapshot>>, id: string): Box {
        const result = snap.boxes.find((candidate): boolean => candidate.id === node(snap, id).id);
        assert(result, `${id} has native bounds`);
        return result;
      }
      function inside(snap: Awaited<ReturnType<typeof snapshot>>, child: string, parent: string): void {
        let current: Node | undefined = node(snap, child);
        const ancestor = node(snap, parent).id;
        while (current && current.id !== ancestor) {
          current = snap.nodes.find((candidate): boolean => candidate.id === current?.parent);
        }
        assert(current, `${child} belongs to ${parent}`);
      }
      const initial = await snapshot();
      const wide = size.startsWith('951');
      inside(initial, 'scroll-measurement-row', 'performance-recent-list');
      const list = box(initial, 'performance-recent-list');
      const measurement = box(initial, 'scroll-measurement-row');
      assert(list.port, 'The leading list exposes its inset scrollport');
      assert(measurement.y >= list.port[1] + 15, 'The switch clears the top safe area');
      assert(measurement.x >= list.port[0] + 15, 'The switch clears the leading safe area');
      assert(measurement.x + measurement.w <= list.port[0] + list.port[2] - 15, 'The switch clears the trailing safe area');
      const launch = initial.nodes.find((candidate): boolean => candidate.props.text === 'This Launch');
      assert(launch, 'This Launch is visible');
      const launchBox = initial.boxes.find((candidate): boolean => candidate.id === launch.id);
      assert(launchBox && launchBox.y >= measurement.y + measurement.h, 'The switch precedes This Launch');
      if (wide) {
        inside(initial, 'perf-median-timeToInteractive', 'performance-medians-list');
        inside(initial, 'perf-nav-0', 'performance-medians-list');
        assert(box(initial, 'perf-median-timeToInteractive').y < box(initial, 'perf-nav-0').y, 'Median precedes Screens');
        assert.equal(initial.navigation.arrangedScrollers.length, 2, 'Both panes own their native insets');
      }
      assert.equal(initial.navigation.collapseScroller, list.id, 'The leading list owns header collapse');
      await session.tap('performance-recent-list', { wheel: [0, 250] });
      await session.clock('settle');
      const scrolled = await snapshot();
      assert(scrolled.navigation.barHeight < initial.navigation.barHeight - 30, 'Performance collapses its native large title');
      assert(box(scrolled, 'scroll-measurement-row').y < measurement.y - 100, 'The switch scrolls away with the launch rows');
      if (wide) {
        assert(Math.abs(box(scrolled, 'perf-median-timeToInteractive').y - box(initial, 'perf-median-timeToInteractive').y) < 1, 'The opposite pane stays still during header collapse');
      }
      await session.tap('performance-recent-list', { wheel: [0, -1000] });
      await session.clock('settle');
      const reopened = await snapshot();
      assert(Math.abs(reopened.navigation.barHeight - initial.navigation.barHeight) < 1, 'Returning to the top reopens Performance’s header');
      await session.tap('fixed-header');
      await session.clock('settle');
      assert.equal((await snapshot()).navigation.collapseScroller, null, 'Fixed content above a nested scroller keeps the header still');
      await session.tap('fixed-header');
      await session.clock('settle');
      assert.equal((await snapshot()).navigation.collapseScroller, list.id, 'Removing fixed content restores header collapse');
      await session.tap('native-updates');
      await session.clock('settle');
      const updates = await snapshot();
      const updatesList = wide ? 'updates-details' : 'updates-panes-scroll';
      assert.equal(updates.navigation.collapseScroller, box(updates, updatesList).id, 'Updates binds the shared header to its leading scroller');
      if (wide) {
        assert.equal(updates.navigation.arrangedScrollers.length, 2, 'Updates gives both panes native inset ownership');
      }
      await session.tap(updatesList, { wheel: [0, 200] });
      await session.clock('settle');
      const updatesScrolled = await snapshot();
      assert(updatesScrolled.navigation.barHeight < updates.navigation.barHeight - 30, 'Updates collapses its native large title');
      if (wide) {
        assert(Math.abs(box(updatesScrolled, 'updates-check').y - box(updates, 'updates-check').y) < 1, 'Updates’ opposite pane stays still while its header collapses');
      }
      console.log(`PASS: ${size} safe-area placement, pane grouping, native header collapse, and stable peer insets`);
    } finally {
      await session.close();
    }
  }
}

async function checkScrollMeasurement(exact: string, root: string): Promise<void> {
  const { open } = await import(resolve(exact, 'scripts/agent.mjs'));
  const session = await open({ host: 'ios', app: root, url: '/settings?developer=on', storage: 'lexy-scroll-measurement', env: { EXACT_AGENT_STORAGE_FRESH: '1' } });
  try {
    await session.clock('settle');
    await session.tap('try-demo');
    await session.clock('settle');
    await session.tap('tab-settings');
    await session.tap('dev-performance');
    await session.clock('settle');
    const hasStopwatch = async (): Promise<boolean> => (await session.tree()).nodes.some((node: { props: { testId?: string } }): boolean => node.props.testId === 'trace');
    assert.equal(await hasStopwatch(), false, 'Scroll measurement starts disabled');
    await session.tap('scroll-measurement');
    assert.equal(await hasStopwatch(), true, 'Enabling measurement shows the stopwatch');
    await session.tap('trace');
    assert.equal((await session.state()).slots.recordingTrace, true, 'The stopwatch starts recording');
    await session.tap('tab-status');
    assert.equal(await hasStopwatch(), true, 'The stopwatch remains available on the screen being measured');
    await session.tap('tab-settings');
    await session.tap('scroll-measurement');
    assert.equal(await hasStopwatch(), false, 'Disabling measurement hides the stopwatch');
    assert.equal((await session.state()).slots.recordingTrace, false, 'Disabling measurement ends the active recording');
    const stopped = await session.logs({ all: true });
    assert(JSON.stringify(stopped).includes('trace copied:'), 'The native host ends and saves the recording');
    await session.tap('scroll-measurement');
    assert.equal((await session.state()).slots.recordingTrace, false, 'Re-enabling measurement does not resume recording');
    await session.tap('trace');
    const restarted = JSON.stringify(await session.logs());
    assert(restarted.includes('trace recording started'), 'The native sampler accepts a new recording after being stopped');
    assert(!restarted.includes('startTrace_EXPERIMENTAL refused'), 'The old recording no longer occupies the sampler');
    await session.tap('trace');
  } finally {
    await session.close();
  }
}

async function checkWarningQuiescence(exact: string, root: string): Promise<void> {
  const { open } = await import(resolve(exact, 'scripts/agent.mjs'));
  const session = await open({ host: 'ios', app: root, url: '/settings?developer=on', storage: 'lexy-warning-quiescence', env: { EXACT_AGENT_STORAGE_FRESH: '1' } });
  try {
    await session.clock('settle');
    await session.tap('try-demo');
    await session.clock('settle');
    await session.tap('tab-status');
    await session.clock('settle');

    async function expectWarnings(expected: string[], reason: string): Promise<void> {
      const tree = await session.tree();
      const warnings = tree.nodes.filter((node: { props: { testId?: string } }): boolean => ['offline', 'garage-error', 'specs-offline', 'specs-garage-error'].includes(node.props.testId ?? '')).map((node: { props: { testId: string } }): string => node.props.testId);
      assert.deepEqual(warnings, expected, reason);
    }

    async function expectAfterQuietPeriod(id: string): Promise<void> {
      await expectWarnings([], 'The warning waits before it occupies space');
      await session.clock('+999');
      await expectWarnings([], 'The settling period has not reached its boundary');
      await session.clock('+1');
      await expectWarnings([id], 'A sustained warning appears at the quiet-period boundary');
    }

    async function chooseState(kind: string): Promise<void> {
      await session.tap('tab-settings');
      const tree = await session.tree();
      if (!tree.nodes.some((node: { props: { testId?: string } }): boolean => node.props.testId === `data-state-${kind}`)) {
        await session.tap('dev-data-state');
      }
      await session.tap(`data-state-${kind}`);
      await session.clock('settle');
    }

    for (let repeat = 0; repeat < 2; repeat++) {
      await session.prefer({ online: 'false' });
      await expectWarnings(['offline'], 'Going offline during active use is immediate');
      await session.clock('+500');
      await expectWarnings(['offline'], 'A short active-use outage is still shown');
      await session.prefer({ online: 'true' });
      await expectWarnings([], 'Recovery remains immediate');
    }

    await session.prefer({ 'visibility-state': 'hidden', online: 'false' });
    await session.clock('+10000');
    await session.prefer({ 'visibility-state': 'visible' });
    await session.clock('+500');
    await expectWarnings([], 'A half-second offline report on foregrounding stays hidden');
    await session.prefer({ online: 'true' });
    await session.clock('+500');
    await expectWarnings([], 'Recovery during foreground grace never shows an offline banner');

    await session.prefer({ 'visibility-state': 'hidden' });
    await session.prefer({ 'visibility-state': 'visible' });
    await session.clock('+500');
    await session.prefer({ online: 'false' });
    await session.clock('+499');
    await expectWarnings([], 'A late offline report still waits for the foreground window to end');
    await session.clock('+1');
    await expectWarnings(['offline'], 'Foreground grace ends one second after return');

    await session.prefer({ 'visibility-state': 'hidden' });
    await session.prefer({ 'visibility-state': 'visible' });
    await session.clock('+500');
    await session.prefer({ 'visibility-state': 'hidden' });
    await session.prefer({ 'visibility-state': 'visible' });
    await expectAfterQuietPeriod('offline');

    await session.prefer({ 'visibility-state': 'hidden' });
    await session.prefer({ 'visibility-state': 'visible' });
    await session.clock('+500');
    await session.tap('tab-specs');
    await session.clock('+499');
    await expectWarnings([], 'Tab changes share the current foreground window');
    await session.clock('+1');
    await expectWarnings(['specs-offline'], 'Switching tabs does not restart foreground grace');
    await session.tap('tab-status');
    await expectWarnings(['offline'], 'An existing offline state is immediate on another tab');
    await session.prefer({ online: 'true' });
    await session.prefer({ online: 'false' });
    await expectWarnings(['offline'], 'Later outages in the same foreground are immediate');
    await session.prefer({ online: 'true' });

    await chooseState('error-cached');
    await session.tap('tab-status');
    await expectAfterQuietPeriod('garage-error');
    await session.tap('tab-specs');
    await expectAfterQuietPeriod('specs-garage-error');

    await chooseState('error-empty');
    await session.tap('tab-status');
    const tree = await session.tree();
    assert(tree.nodes.some((node: { props: { testId?: string } }): boolean => node.props.testId === 'vehicle-error'), 'A failed load without cached data keeps its immediate full-screen error');
    console.log('PASS: only foregrounding delays offline presentation; active-use outages and recovery are immediate; refresh failures keep their settling period');
  } finally {
    await session.close();
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
function prepareSimulator(exact: string, directory: string, simulator: string): boolean {
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
    return false;
  }
  const helper = resolve(directory, 'hinge_helper');
  checked(['xcrun', '-sdk', 'iphonesimulator', 'clang', '-arch', process.arch, '-mios-simulator-version-min=17.0', '-O2', '-framework', 'IOKit', '-framework', 'CoreFoundation', '-o', helper, resolve(exact, 'scripts/duo/hinge_helper.c')]);
  checked(['codesign', '-s', '-', helper]);
  checked(['xcrun', 'simctl', 'spawn', simulator, helper, 'orient', 'portrait']);
  checked(['xcrun', 'simctl', 'spawn', simulator, helper, 'set', '180']);
  return true;
}

await main();
