# Project Memory Model

> Reference and setup guide for the file-role system used in this repo.
> This document is intentionally portable: it can be dropped into another repo and used by an
> agent to install or repair the same structure there.
>
> Scope:
> This doc explains how `ROADMAP.md`, `NEXT_STEPS.md`, `.agents/handoff.md`, and
> `.agents/memory.md` relate to each other.
> It does **not** replace the project's TODO/DONE documentation conventions, which should remain in
> the existing instructions file.

---

## Exact AGENTS.md Block

Paste this block into `AGENTS.md` as a prominent top-level section:

```md
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
```

---

## Roles of the Files

For TODO/DONE naming, lifecycle, and formatting rules, use:

- `.github/instructions/documentation/todo-done-docs.instructions.md`

### `docs/todo/ROADMAP.md`

Use for:

- priority tiers such as `P0`, `P1`, `P2`, `P3`
- feature and architecture initiatives
- completed milestone-scale work in the Done table

Do not use for:

- session notes
- half-finished investigation details
- tiny one-off fixes

### `docs/todo/NEXT_STEPS.md`

Use for:

- near-term implementation tasks
- manual testing checklists
- small polish items
- follow-ups that are too small for roadmap treatment

Do not use for:

- architecture snapshots
- long session narratives

### `.agents/handoff.md`

Use for:

- what exists right now
- architecture, package roles, boundaries, and conventions
- current roadmap state in one short section
- open questions that matter to the next agent

Rules:

- write in present tense
- describe current truth, not historical play-by-play
- keep it concise and durable

### `.agents/memory.md`

Use for:

- current session checklist
- recent discoveries
- temporary context needed to resume work
- short chronological session summaries

Rules:

- this is working memory, not a second roadmap
- keep only the recent tail unless there is a strong reason to preserve more
- if something becomes stable project truth, move it to `handoff.md`
- if something becomes a milestone completion, record it in `ROADMAP.md`

---

## Promotion Rules

When information changes category, move it upward:

1. Session note or partial finding starts in `.agents/memory.md`.
2. If it becomes stable current truth, summarize it in `.agents/handoff.md`.
3. If it changes project priority or completes a milestone, reflect that in `ROADMAP.md`.
4. If it creates concrete next actions or manual checks, add those to `NEXT_STEPS.md`.

This prevents the same content from being copied everywhere.

---

## Setup in a New Repo

If another repo does not yet use this system, install it like this:

1. Ensure `AGENTS.md` exists at repo root and add the exact block above.
2. Create `docs/todo/ROADMAP.md` if missing.
3. Create `docs/todo/NEXT_STEPS.md` if the repo uses a separate near-term working list.
4. Create `.agents/handoff.md` for the current-state snapshot.
5. Create `.agents/memory.md` for session logging.
6. If the repo already has `.claude/memory.md`, move the real content into `.agents/memory.md`.
7. Leave a short pointer at `.claude/memory.md` if older tooling or habits may still read it.
8. Ensure ignore rules allow `.agents/handoff.md` to be tracked while keeping `.agents/memory.md`
   gitignored unless the repo intentionally wants it tracked.
9. If the repo already has TODO/DONE docs, keep using the existing TODO/DONE instruction file for
   naming and lifecycle rules rather than redefining those rules here.

Suggested transitional `.claude/memory.md` pointer:

```md
# Moved

The canonical session log for this repo now lives at:

- `.agents/memory.md`

Use that file for current-session checklists and recent working memory.
`.agents/handoff.md` remains the current project-state snapshot.

This compatibility pointer is deprecated and should be removed after:

- `2026-07-31`
```

Suggested ignore pattern:

```gitignore
.agents/*
!.agents/
!.agents/handoff.md
```

---

## Repair in an Older Repo

If the repo already has some version of these files but they are stale or mixed together:

1. Read the existing roadmap, handoff, memory, and next-steps documents.
2. Move milestone completions into the `ROADMAP.md` Done table.
3. Move current architecture truth into `.agents/handoff.md`.
4. Move session-like notes and partial context into `.agents/memory.md`.
5. Remove duplicated text that appears in all files.
6. Add or update `NEXT_STEPS.md` so near-term tasks are actionable.
7. Add the exact block to `AGENTS.md`.
8. Leave TODO/DONE structure rules in the existing project instruction file instead of copying them
   into this document.

Heuristic:

- if the note answers “what happened recently?”, it belongs in memory
- if it answers “what is true now?”, it belongs in handoff
- if it answers “what matters next?” or “what got completed at milestone scale?”, it belongs in roadmap

---

## Recommended Maintenance Cadence

- update `.agents/memory.md` during or at the end of a session
- update `.agents/handoff.md` after changes that affect architecture, conventions, priorities, or open questions
- update `NEXT_STEPS.md` when near-term tasks change
- update the `ROADMAP.md` Done table only when milestone-scale work is actually complete

---

## Anti-Patterns

Avoid these:

- using `.agents/memory.md` as a second Done table
- writing long session history into `handoff.md`
- filling `ROADMAP.md` with tiny fixes
- duplicating the same paragraph in all files
- leaving roadmap items marked active after the work has already moved into Done
