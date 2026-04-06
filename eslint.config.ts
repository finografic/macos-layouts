import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import markdownlintPlugin from 'eslint-plugin-markdownlint';
import markdownlintParser from 'eslint-plugin-markdownlint/parser.js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';

const config: Linter.Config[] = [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.cursor/**', '**/*.min.*', '**/*.map'],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylistic,
    },
    rules: {
      // Disable base rules in favor of TS-aware ones
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-console': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-redeclare': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      '@stylistic/operator-linebreak': [
        'warn',
        'after',
        { overrides: { '?': 'ignore', ':': 'ignore', '|': 'ignore' } },
      ],
      '@stylistic/multiline-ternary': ['warn', 'always-multiline'],
    },
  },

  {
    files: ['**/*.md'],
    ignores: ['node_modules/**', 'dist/**', '.cursor/**', '.github/instructions/**'],
    languageOptions: {
      parser: markdownlintParser,
    },
    plugins: {
      markdownlint: markdownlintPlugin as Linter.Processor,
      '@stylistic': stylistic,
    },
    rules: {
      ...markdownlintPlugin.configs.recommended.rules,
      'markdownlint/md012': 'off', // Multiple consecutive blank lines
      'markdownlint/md013': 'off', // Line length
      'markdownlint/md024': 'off', // Duplicate headings
      'markdownlint/md025': 'off', // Single h1
      'markdownlint/md026': 'off', // Trailing punctuation in heading
      'markdownlint/md029': 'off', // List style
      'markdownlint/md036': 'off', // No emphasis as heading
      'markdownlint/md040': 'off', // Fenced code language
      'markdownlint/md041': 'off', // First line heading
      'markdownlint/md043': 'off', // Required heading structure

      // Formatting consistency
      '@stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
    },
  },
];

export default config;
