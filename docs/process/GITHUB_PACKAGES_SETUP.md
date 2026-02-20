# GitHub Packages Setup Guide (Canonical)

This repository follows the **@finografic “locked” GitHub Packages flow** (PAT-based `NPM_TOKEN`, workflow permissions, `.npmrc` scope config).

To avoid duplicating and drifting instructions, the canonical, fully detailed guide lives in `@finografic/genx`:

- `@finografic/genx/docs/GITHUB_PACKAGES_SETUP.md`

If you’re setting up a new machine or a new repo, open that doc and follow it exactly.

## Quick reminders

- **Secret name**: `NPM_TOKEN` (PAT with `repo`, `read:packages`, `write:packages`, `workflow`)
- **Workflow permissions**: `contents: write`, `packages: write`, `actions: write`
- **Registry**: `@finografic:registry=https://npm.pkg.github.com`
- **Do not** commit auth tokens; use `NODE_AUTH_TOKEN` in workflows
