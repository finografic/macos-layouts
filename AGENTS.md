# AGENTS.md — AI Assistant Guide

## Project Memory Model

- `docs/todo/ROADMAP.md` = curated milestone plan + completed milestone history.
- `docs/todo/NEXT_STEPS.md` = near-term working list, manual testing, and small follow-ups.
- `.agents/handoff.md` = current project state snapshot.
- `.agents/memory.md` = chronological working memory / session log.

Promotion rule:

- session detail, partial work, and temporary context belong in `.agents/memory.md`
- stable current truth belongs in `.agents/handoff.md`
- project priorities and completed milestone-scale work belong in `ROADMAP.md`
- small actionable follow-ups and manual verification belong in `NEXT_STEPS.md`

Do not duplicate the same item across all four files unless it truly belongs in each role.

Reference: [`docs/process/PROJECT_MEMORY_MODEL.md`](./docs/process/PROJECT_MEMORY_MODEL.md)

---

## Roadmap and Planning Docs

- Before proposing or generating new features, check `ROADMAP.md` for existing priorities.
- When conceiving a new feature or initiative, add it to the appropriate roadmap tier.
- Use `NEXT_STEPS.md` for concrete follow-ups, manual validation, and small tasks that do not need full roadmap treatment.
- Detailed feature planning docs live in `docs/todo/` as `TODO_*.md` (active) or `DONE_*.md` (complete).
- **TODO/DONE doc conventions:** `.github/instructions/documentation/todo-done-docs.instructions.md`
  — rules for naming, status headers, checkboxes, and graduating `TODO_` → `DONE_`.

---

## Rules — Project-Specific

- Project-specific rules live in `.github/instructions/project/**/*.instructions.md`.
- Do not reference `@workspace/*` — all imports and deps must use published package names.

## Rules — Global

Rules are canonical in `.github/instructions/` — see `README.md` there for folder structure.
Shared across Claude Code, Cursor, and GitHub Copilot.

**General**

- General baseline: `.github/instructions/general.instructions.md`

**Code**

- TypeScript patterns: `.github/instructions/code/typescript-patterns.instructions.md`
- Modern TS patterns: `.github/instructions/code/modern-typescript-patterns.instructions.md`
- Oxlint & style: `.github/instructions/code/linting-code-style.instructions.md`
- Provider/context patterns: `.github/instructions/code/provider-context-patterns.instructions.md`
- Picocolors CLI styling: `.github/instructions/code/picocolors-cli-styling.instructions.md`

**Naming**

- File naming: `.github/instructions/naming/file-naming.instructions.md`
- Variable naming: `.github/instructions/naming/variable-naming.instructions.md`

**Documentation**

- Documentation: `.github/instructions/documentation/documentation.instructions.md`
- README standards: `.github/instructions/documentation/readme-standards.instructions.md`
- Agent-facing markdown: `.github/instructions/documentation/agent-facing-markdown.instructions.md`
- Feature design specs: `.github/instructions/documentation/feature-design-specs.instructions.md`
- TODO/DONE docs: `.github/instructions/documentation/todo-done-docs.instructions.md`

**Git**

- Git policy: `.github/instructions/git/git-policy.instructions.md`

---

## Rules — Markdown Tables

- Padded pipes: one space on each side of every `|`, including the separator row.
- Align column widths so all cells in the same column are equal width.

---

## Git Policy

- IMPORTANT: NEVER include `Co-Authored-By` lines in commit messages. Non-negotiable.
- `.github/instructions/git/git-policy.instructions.md` (see Commits and Releases sections)

---

## Learned User Preferences

- Follow existing recipe patterns for naming, structure, and variant conventions
- Apply recipes inside design-system components; client uses `<Button variant="..." />` without calling the recipe
- Use cva for single-element components (e.g. Button); use sva for multi-slot components (Checkbox, Card, Dialog)
- Use @stylistic/stylelint-plugin for Stylelint 17; stylelint-stylistic is deprecated and incompatible
- Ignore .cursor/chats and .cursor/hooks; commit .cursor/mcp.json
- Use Panda MCP for design-system questions (breakpoints, tokens, recipes) when relevant without explicit user ask
- When updating handoff or other agent state docs, merge and reconcile sections when the user indicates the result should not be a simple append

## Learned Workspace Facts

- `flow.utils.ts` lives only under each Finografic CLI repo (`src/utils/`); it is not sourced from a single out-of-repo canonical tree—cross-repo work is copy alignment, and docs should not claim an external-only path
- `eslint.config.ts` and `oxlint.config.ts`: on `consistent-type-imports`, set `disallowTypeAnnotations: false` so Vitest mocks can use `importOriginal<typeof import('…')>()` while keeping `prefer: 'type-imports'` for real imports
- In unit tests, mock `../lib/finder-bridge.js` (or avoid real AppleScript) where the code path would run `osascript`; a real subprocess can hit Vitest’s default timeout
- `layouts compile` / `lua-codegen` use `-- 🖥️ macos-layouts: {layoutName}` in init.lua and generated layout headers for a consistent on-disk marker
- `release:check` uses `lint:strict` (oxlint `--deny-warnings`) to fail on any lint warnings, not just errors; never use `lint:fix` as a release gate since it exits 0 on warnings
- `vitest.config.ts` mirrors `tsconfig.json` `compilerOptions.paths` via Vite `resolve.alias` (`__mocks__`, `commands`, `config`, `lib`, `types`, `utils` → `src/<dir>`); Vitest does not read tsconfig paths by default
- Finder AppleScript uses `window N` (1-indexed) syntax for both bounds capture and placement; `item N of (every window)` does not work reliably for Finder
