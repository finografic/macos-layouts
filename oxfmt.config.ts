import {
  AGENT_DOC_MARKDOWN_PATHS,
  agentMarkdown,
  base,
  css,
  ignorePatterns,
  json,
  markdown,
  sorting,
  typescript,
} from '@finografic/oxfmt-config';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  $schema: './node_modules/oxfmt/configuration_schema.json',
  ignorePatterns: [...ignorePatterns],
  ...base,
  ...typescript,
  ...sorting,
  overrides: [
    { files: ['*.ts', '*.tsx'], excludeFiles: [], options: { ...typescript } },
    { files: ['*.json', '*.jsonc'], excludeFiles: [], options: { ...json } },
    {
      files: ['*.md', '*.mdx'],
      excludeFiles: [...AGENT_DOC_MARKDOWN_PATHS],
      options: { ...markdown },
    },
    {
      files: [...AGENT_DOC_MARKDOWN_PATHS],
      excludeFiles: [],
      options: { ...agentMarkdown },
    },
    { files: ['*.css', '*.scss'], excludeFiles: [], options: { ...css } },
  ],
} satisfies ReturnType<typeof defineConfig>);
