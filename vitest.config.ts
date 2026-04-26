import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Match `tsconfig.json` `compilerOptions.paths` (Vitest does not read `paths` by default). Resolve each
 * prefix to a directory under `src/` (Vite's prefix `alias` matching).
 */
const srcDir = (name: string) => resolve(__dirname, 'src', name);

export default defineConfig({
  resolve: {
    alias: {
      __mocks__: srcDir('__mocks__'),
      commands: srcDir('commands'),
      config: srcDir('config'),
      lib: srcDir('lib'),
      types: srcDir('types'),
      utils: srcDir('utils'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
