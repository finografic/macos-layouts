# Developer Workflow

Complete guide to the development, testing, and release workflow for this package.

---

## 🔄 Daily Development

### Development Mode

```bash
pnpm dev           # Watch mode for building
pnpm test          # Watch mode for testing
```

### Code Quality

```bash
pnpm lint          # Check code style
pnpm lint.fix      # Auto-fix issues
pnpm typecheck     # Type check without building
```

---

## 🎯 Git Workflow

### What Happens When You Commit

```bash
git add .
git commit -m "feat: add new feature"
```

**Automatic hooks run:**

1. ✅ **pre-commit hook** triggers
   - Runs `npx lint-staged`
   - Lints and fixes **only staged files**
   - Fast (5-10 seconds)

2. ✅ **Commit proceeds** if lint passes

**No pre-push hook** - tests run before releases only

---

## 📦 Release Workflow

### The Complete Flow

```bash
pnpm release.github.patch  # or .minor or .major
```

**What happens automatically:**

```
1. release.check runs:
   ├─ pnpm lint.fix      # Lint entire codebase
   ├─ pnpm typecheck     # Type check entire codebase
   └─ pnpm test.run      # Run ALL tests (non-watch mode)

2. If checks pass:
   ├─ Version bumps in package.json
   ├─ Git commit created
   └─ pre-commit: lint-staged (on package.json only)

3. Push to GitHub:
   ├─ Commit pushed
   ├─ Tag pushed (e.g., v0.5.21)
   └─ No pre-push hook (already validated)

4. GitHub Actions triggers:
   ├─ Workflow detects tag
   ├─ Builds package
   ├─ Publishes to GitHub Packages
   └─ Creates GitHub Release
```

---

## ⚙️ Configuration Details

### package.json Scripts

```json
{
  "scripts": {
    // Development
    "dev": "tsdown --watch",
    "test": "vitest", // Watch mode
    "test.run": "vitest run", // Run once (CI/releases)

    // Quality checks
    "lint": "eslint .",
    "lint.fix": "eslint . --fix",
    "typecheck": "tsc --project tsconfig.json --noEmit",

    // Releases
    "release.github.patch": "pnpm run release.check && pnpm version patch && git push --follow-tags",
    "release.check": "pnpm lint.fix && pnpm typecheck && pnpm test.run"
  }
}
```

### .simple-git-hooks.mjs

```javascript
export default {
  'pre-commit': 'npx lint-staged',
  // No pre-push - tests run in release.check
};
```

**Why no pre-push?**

- Tests already run in `release.check` before version bump
- Avoids redundancy (tests run twice)
- Faster pushes
- Developers can push WIP branches

### lint-staged Configuration

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,mjs,cjs}": [
      "eslint --fix"
    ]
  }
}
```

**Key points:**

- ✅ Uses `eslint` directly (not `pnpm exec eslint`)
- ✅ Runs on staged files only
- ✅ Auto-fixes issues
- ✅ Blocks commit if errors remain

---

## 🧪 Testing Strategy

### Test Scripts Explained

```bash
pnpm test          # vitest (watch mode for dev)
pnpm test.run      # vitest run (run once and exit)
pnpm test.coverage # vitest run --coverage
```

**Why the distinction?**

| Context     | Command         | Behavior                               |
| ----------- | --------------- | -------------------------------------- |
| Development | `pnpm test`     | ⏱️ Watch mode - re-runs on file changes |
| Releases    | `pnpm test.run` | ✅ Runs once and exits - doesn't block |
| CI/CD       | `pnpm test.run` | ✅ Runs once and exits                 |

**Important:** `vitest` alone enters watch mode when run from terminal, but `vitest run` always runs once and exits. Use `test.run` in scripts that need to continue after tests complete.

---

## Git Hooks Generated

**Automatic Setup:** Git hooks are automatically generated when you run `pnpm install` (which triggers the `prepare` script that runs `simple-git-hooks`).

The following hooks are created in `.git/hooks/`:

### pre-commit

```bash
#!/bin/sh
npx lint-staged
```

**Purpose:** Lint and fix staged files before commit
**Speed:** Fast (only processes changed files)
**Blocking:** Yes (commit fails if lint fails)

### No pre-push Hook

**Deliberately omitted** to avoid redundancy. All checks run in `release.check` before version bump.

---

## 🚨 Troubleshooting

### Tests Hang in Watch Mode

**Problem:** `pnpm release.github.patch` hangs after tests

**Cause:** Using `pnpm test` instead of `pnpm test.run`

**Solution:** Ensure `release.check` uses `test.run`:

```json
"release.check": "pnpm lint.fix && pnpm typecheck && pnpm test.run"
```

### Commits Blocked by Lint

**Problem:** Can't commit because lint fails

**Solution:**

```bash
pnpm lint.fix       # Auto-fix issues
git add .           # Re-stage fixed files
git commit -m "..."
```

### Release Fails

**Problem:** `release.check` fails

**Solution:** Fix issues before trying again:

```bash
pnpm lint.fix       # Fix lint issues
pnpm typecheck      # Check types
pnpm test.run       # Verify tests pass
```

---

## 📋 Checklist: Before Release

- [ ] All changes committed
- [ ] On `master` branch
- [ ] `pnpm lint.fix` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test.run` passes
- [ ] Ready to publish

Then run:

```bash
pnpm release.github.patch
```

---

## 🎯 Philosophy

This workflow is designed for:

1. **Fast commits** - Only lint changed files
2. **Thorough releases** - Full validation before publishing
3. **No redundancy** - Each check runs once, not multiple times
4. **Developer friendly** - Can commit WIP, validation happens before release
5. **CI/CD ready** - Same commands work locally and in GitHub Actions

---

## Related Documentation

- [Release Process](./RELEASES.md) - Release commands and verification
- [GitHub Packages Setup](./GITHUB_PACKAGES_SETUP.md) - Initial configuration (if applicable)
