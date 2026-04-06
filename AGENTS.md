# AGENTS.md - AI Assistant Guide

## Rules - General

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.
Follow general TypeScript, ESLint, and naming conventions from prior context.

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)
- [Picocolors CLI styling](/.github/instructions/09-picocolors-cli-styling.instructions.md)
- [Git Policy](/.github/instructions/10-git-policy.instructions.md)

## Rules - Project-Specific

Project-specific rules live in `.github/instructions/project/*.instructions.md`.

<!-- NOTE: CLI projects (genx:type:cli keyword in package.json) only -->

- Generated README sections are managed by `pnpm docs.usage` — never edit content between `<!-- GENERATED:*:START/END -->` markers by hand.

- This is a **standalone installable package** (`@finografic/design-system`), not a monorepo workspace.
- Published to GitHub Packages (`https://npm.pkg.github.com`).
- Do not reference `@workspace/*` — all imports and deps must use published package names.
- The `panda.preset` entry must always build with `platform: 'node'` in tsdown.
- Never add `watch: true` to `panda.config.ts` — it causes `panda codegen` to hang.

## Rules - Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Not ever, not for any reason.
- [Git — Commits](/.github/instructions/10-git-policy.instructions.md#commits)
- [Git — Releases](/.github/instructions/10-git-policy.instructions.md#releases)

## Learned User Preferences

- Follow existing recipe patterns for naming, structure, and variant conventions
- Apply recipes inside design-system components; client uses `<Button variant="..." />` without calling the recipe
- Use cva for single-element components (e.g. Button); use sva for multi-slot components (Checkbox, Card, Dialog)
- Use @stylistic/stylelint-plugin for Stylelint 17; stylelint-stylistic is deprecated and incompatible
- Ignore .cursor/chats and .cursor/hooks; commit .cursor/mcp.json
- Use Panda MCP for design-system questions (breakpoints, tokens, recipes) when relevant without explicit user ask
