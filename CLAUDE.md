# Claude Code Instructions

Rules are canonical in `.github/instructions/` and shared across Claude Code, Cursor, and GitHub Copilot.

## Rule Files

- [General](/.github/instructions/00-general.instructions.md)
- [File Naming](/.github/instructions/01-file-naming.instructions.md)
- [TypeScript Patterns](/.github/instructions/02-typescript-patterns.instructions.md)
- [Provider & Context Patterns](/.github/instructions/03-provider-context-patterns.instructions.md)
- [ESLint & Code Style](/.github/instructions/04-eslint-code-style.instructions.md)
- [Documentation](/.github/instructions/05-documentation.instructions.md)
- [Modern TypeScript Patterns](/.github/instructions/06-modern-typescript-patterns.instructions.md)
- [Variable Naming](/.github/instructions/07-variable-naming.instructions.md)
- [README Standards](/.github/instructions/08-readme-standards.instructions.md)

## Project-Specific

- Do not include `Co-Authored-By` lines in commit messages.

<!-- NOTE: CLI projects (genx:type:cli keyword in package.json) only -->

- When adding a command, update the `commands` array in `src/[binary].help.ts` and add a matching entry to the `EXAMPLES` section.

## Session Memory

Claude Code maintains a lightweight session log at `.claude/memory.md` (gitignored).

**On session start:** Read `.claude/memory.md` if it exists. Use it to understand recent context. If a `## Current Session` block exists, a previous session ended abruptly — resume or finish that work first.

**On task start:** Write a `## Current Session` block at the top of the file with:

- Date
- Brief description of the task
- A checklist of planned steps (`- [ ]` / `- [x]`)

Update the checklist as work progresses (check off items, add new ones if scope changes).

**On session end (or after significant work):** Collapse the `## Current Session` block into a normal `## <date>` entry (a 2-4 line summary), and move it below the previous sessions. Keep only the **last 5 session entries** (delete older ones when appending).

Keep only the **last 5 sessions** in the file (delete older entries when appending). Each entry should be 2-4 lines max — this is a breadcrumb trail, not a journal.

## Handoff Document

Claude Code maintains a handoff document at `.claude/handoff.md` (gitignored).

This file bridges context between local development (Claude Code CLI) and external conversations (Claude.ai chat), which have no shared visibility. The developer manually uploads this file to Claude.ai for continuity, and may bring back updates from those conversations.

**Purpose:** Provide a concise, current snapshot of project state — enough for a separate Claude instance (with no repo access) to understand what exists, what was decided, and what's next.

**When to update:** After any session that changes architecture, adds/removes features, resolves open questions, or shifts priorities. Not every session — only when the project state meaningfully changed.

**What to write:** Update only the sections that changed. Keep the entire file under 150 lines. Write for an audience that is familiar with the project's goals but cannot see the codebase.

**Structure (maintain these sections in order):**

1. `## Project` — One-liner: package name, purpose, current version/phase.
2. `## Architecture` — Brief description of the system layers and how they connect. Update when structural decisions change.
3. `## Stack` — Runtime dependencies and build tools. Update when deps are added/removed.
4. `## Schema / Types` — List of core types and what they represent. Update when the type surface changes.
5. `## CLI Commands` — Current command surface. Update when commands are added/changed.
6. `## Decisions` — Numbered log of significant architectural or design decisions, most recent first. Append-only — never delete entries, but keep to ~10 most recent. Format: `N. <decision> (date)`
7. `## Open Questions` — Active unresolved questions. Remove entries when resolved (and optionally move to Decisions). Keep to ~5 max.
8. `## Status` — Current implementation state: what's done, what's in progress, what's next. Plain prose, 3-5 lines max.

**Rules:**
- Do not duplicate content from `memory.md` — that file tracks session work, this file tracks project state.
- Do not include code snippets or file contents — describe what exists, not how it's implemented.
- Write in present tense ("The CLI uses X to do Y") not past tense.
- Keep entries factual and terse. This is a reference document, not a narrative.
