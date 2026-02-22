import pc from 'picocolors';

import { listLayouts, loadLayout } from '../lib/layout-loader.js';
import type { ListOptions } from '../types/cli.types.js';
import { EXIT_CODE } from '../types/cli.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListCommandParams {
  readonly options: ListOptions;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export async function listCommand({ options }: ListCommandParams): Promise<number> {
  const names = await listLayouts(options.layoutsDir);

  if (options.json) {
    console.log(JSON.stringify(names));
    return EXIT_CODE.Success;
  }

  console.log();
  console.log(`  ${pc.bold(pc.gray('🖥️  LAYOUTS'))}`);
  console.log();

  if (names.length === 0) {
    console.log(pc.gray('  No layouts found. To create one, run:'));
    console.log(pc.gray(`  $ ${pc.cyanBright('layouts save')} ${pc.white('<name>')}`));
    console.log();
    return EXIT_CODE.Success;
  }

  const rows = await Promise.all(
    names.map(async (name) => {
      const result = await loadLayout(name, options.layoutsDir);
      return { name, description: result.ok ? (result.layout.description ?? '') : '' };
    }),
  );

  const pad = Math.max(...rows.map((r) => r.name.length));
  for (const { name, description } of rows) {
    const gap = ' '.repeat(pad - name.length + 4);
    console.log(`  ${pc.bold(pc.cyan(name))}${gap}${pc.white(description)}`);
  }

  console.log();
  return EXIT_CODE.Success;
}
