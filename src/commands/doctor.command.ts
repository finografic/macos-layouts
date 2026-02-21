import { access } from 'node:fs/promises';

import { execa } from 'execa';
import pc from 'picocolors';

import { DUMP_LUA } from '../lib/dump-lua.js';
import * as hs from '../lib/hammerspoon.js';
import { DEFAULT_LAYOUTS_DIR, expandHome, listLayouts } from '../lib/layout-loader.js';
import type { DoctorOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';
import type { RuntimeDump } from '../types/runtime.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DoctorCommandParams {
  readonly options: DoctorOptions;
}

interface CheckResult {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warn' | 'info';
  readonly message: string;
  readonly fix?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: CheckResult['status']): string {
  switch (status) {
    case 'pass':
      return pc.green('✓');
    case 'fail':
      return pc.red('✗');
    case 'warn':
      return pc.yellow('⚠');
    case 'info':
      return pc.blue('ℹ');
  }
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function doctorCommand({ options }: DoctorCommandParams): Promise<number> {
  const checks: CheckResult[] = [];
  let screens: RuntimeDump['screens'] | null = null;

  // 1. Hammerspoon CLI on PATH
  let hsFound = false;
  try {
    await execa('which', ['hs']);
    hsFound = true;
    checks.push({ name: 'hs-binary', status: 'pass', message: 'Hammerspoon CLI (hs) found' });
  } catch {
    checks.push({
      name: 'hs-binary',
      status: 'fail',
      message: 'Hammerspoon CLI (hs) not found',
      fix: 'Install from https://www.hammerspoon.org and ensure `hs` is on your PATH',
    });
  }

  // 2. Hammerspoon running
  let hsRunning = false;
  if (hsFound) {
    hsRunning = await hs.isAvailable();
    checks.push(
      hsRunning
        ? { name: 'hs-running', status: 'pass', message: 'Hammerspoon is running' }
        : {
          name: 'hs-running',
          status: 'fail',
          message: 'Hammerspoon is not running',
          fix: 'Open Hammerspoon.app',
        },
    );
  }

  // 3. IPC module loaded
  if (hsRunning) {
    const ipcResult = await hs.runLua('return "ok"');
    const ipcOk = ipcResult.ok && ipcResult.value.trim() === 'ok';
    checks.push(
      ipcOk
        ? { name: 'hs-ipc', status: 'pass', message: 'IPC module loaded' }
        : {
          name: 'hs-ipc',
          status: 'fail',
          message: 'IPC not available',
          fix: 'Add `require("hs.ipc")` to ~/.hammerspoon/init.lua and reload Hammerspoon',
        },
    );

    // 4. Accessibility permissions
    if (ipcOk) {
      const axResult = await hs.runLua('return tostring(hs.accessibilityState())');
      const axGranted = axResult.ok && axResult.value.trim() === 'true';
      checks.push(
        axGranted
          ? { name: 'accessibility', status: 'pass', message: 'Accessibility permissions granted' }
          : {
            name: 'accessibility',
            status: 'fail',
            message: 'Accessibility not enabled',
            fix: 'Enable in System Settings > Privacy & Security > Accessibility → Hammerspoon',
          },
      );

      // 6. Display detection (requires IPC)
      const dumpResult = await hs.dump({ lua: DUMP_LUA });
      if (dumpResult.ok) {
        screens = dumpResult.value.screens;
        checks.push({
          name: 'screens',
          status: 'info',
          message: `Screens detected: ${screens.length}`,
        });
      }
    }
  }

  // 5. Layouts directory
  const layoutsDir = expandHome(options.layoutsDir ?? DEFAULT_LAYOUTS_DIR);
  let dirExists = false;
  try {
    await access(layoutsDir);
    dirExists = true;
  } catch {
    // doesn't exist
  }

  if (dirExists) {
    const layoutNames = await listLayouts(options.layoutsDir);
    checks.push({
      name: 'layouts-dir',
      status: 'pass',
      message: `Layouts directory exists (${layoutsDir}, ${layoutNames.length} layout${
        layoutNames.length === 1 ? '' : 's'
      })`,
    });
  } else {
    checks.push({
      name: 'layouts-dir',
      status: 'warn',
      message: `Layouts directory not found: ${layoutsDir}`,
      fix: `Run: mkdir -p ${layoutsDir}`,
    });
  }

  // Output
  if (options.json) {
    const output = {
      checks: checks.map(({ name, status, message, fix }) => ({
        name,
        status,
        message,
        ...(fix ? { fix } : {}),
      })),
      screens: screens ?? [],
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('');
    for (const check of checks) {
      console.log(`  ${statusIcon(check.status)} ${check.message}`);
      if (options.fix && check.fix) {
        console.log(`    ${pc.dim('→')} ${pc.dim(check.fix)}`);
      }
    }

    if (screens && screens.length > 0) {
      console.log('');
      for (const s of screens) {
        const tags = [s.isPrimary ? 'primary' : null, s.isBuiltin ? 'built-in' : null]
          .filter(Boolean)
          .join(', ');
        console.log(
          `    ${pc.cyan(s.name)}  ${s.resolution.w}×${s.resolution.h}${
            tags ? pc.dim(` [${tags}]`) : ''
          }`,
        );
      }
    }
    console.log('');
  }

  // Exit: critical failures are checks 1–4 (hs-binary, hs-running, hs-ipc, accessibility)
  const criticalNames = new Set(['hs-binary', 'hs-running', 'hs-ipc', 'accessibility']);
  const hasCriticalFailure = checks.some(
    (c) => criticalNames.has(c.name) && c.status === 'fail',
  );

  return hasCriticalFailure ? EXIT_CODE.Error : EXIT_CODE.Success;
}
