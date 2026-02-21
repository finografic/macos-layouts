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

  if (names.length === 0) {
    console.log(pc.dim('No layouts found.'));
    return EXIT_CODE.Success;
  }

  // Load each layout to get its description
  const rows = await Promise.all(
    names.map(async (name) => {
      const result = await loadLayout(name, options.layoutsDir);
      const description = result.ok ? (result.layout.description ?? '') : '';
      return { name, description };
    }),
  );

  const maxNameLength = Math.max(...rows.map((r) => r.name.length));
  for (const { name, description } of rows) {
    const padding = ' '.repeat(maxNameLength - name.length + 4);
    const desc = description ? pc.dim(description) : '';
    console.log(`  ${pc.cyan(name)}${padding}${desc}`);
  }

  return EXIT_CODE.Success;
}
