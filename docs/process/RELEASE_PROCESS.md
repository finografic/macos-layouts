# Release Process

This repository uses automated releases via GitHub Actions.

## Prerequisites

Before releasing, ensure:

- ✅ All changes committed and pushed
- ✅ On `master` branch
- ✅ Tests passing (`pnpm test.run`)
- ✅ Linting passing (`pnpm lint`)
- ✅ Type-checking passing (`pnpm typecheck`)

## Quick Release Commands

### Patch Release

Bug fixes and minor changes.

```bash
pnpm release.github.patch
```

### Minor Release

New features, backward compatible.

```bash
pnpm release.github.minor
```

### Major Release

Breaking changes.

```bash
pnpm release.github.major
```

## What Happens Automatically

When you run a release command:

1. **Local checks run** (`release.check`)
   - Linting
   - Type checking
   - Tests

2. **Version bump** in `package.json`
   - Creates a commit
   - Creates a git tag (e.g., `v0.1.0`)

3. **Push to GitHub**
   - Commits and tag pushed with `--follow-tags`

4. **GitHub Actions workflow triggers**
   - Workflow detects the tag push
   - Installs dependencies
   - Builds the package
   - Publishes to GitHub Packages
   - Creates GitHub Release with auto-generated notes

5. **GitHub Release appears**
   - View at: `https://github.com/finografic/macos-layouts/releases`

## Verification

After releasing, verify:

1. **GitHub Release created**
   - `https://github.com/finografic/macos-layouts/releases`

2. **Package published**
   - `https://github.com/finografic/macos-layouts/packages`

3. **Workflow succeeded**
   - `https://github.com/finografic/macos-layouts/actions`

## Manual Steps

**⚠️ Important:** The `release.publish` command is only for manual recovery if the automated GitHub Actions workflow fails. It will check if the current version is already published and prevent duplicate publishes.

If the automated release fails, you can manually publish:

```bash
pnpm release.publish
```

**Note:** This command will fail if the version is already published. Use `release.github.patch/minor/major` to bump the version first.

## Troubleshooting

### Version already published

If you see `npm error You cannot publish over the previously published versions: X.Y.Z`:

**This means the version is already published.** You have two options:

1. **Use the release scripts (recommended):** These automatically bump the version before publishing:
   ```bash
   pnpm release.github.patch  # Bumps to next patch version
   ```

2. **Manual publish (only if GitHub Actions failed):** If you need to republish the same version (e.g., after fixing a build issue), you'll need to:
   - Delete the existing tag (if it exists)
   - Manually publish (but this is rare and not recommended)

**The release scripts (`release.github.patch/minor/major`) will never have this problem** because they bump the version before pushing.

### Tag already exists

```bash
# Delete local tag
git tag -d v0.1.0

# Delete remote tag (if pushed)
git push origin :refs/tags/v0.1.0

# Try again
pnpm release.github.patch
```

### release.check fails

Run the checks manually to see what failed:

```bash
pnpm lint.fix
pnpm typecheck
pnpm test.run
```

### Workflow fails

- Check Actions tab for error details
- Ensure `NPM_TOKEN` secret is configured (see `GITHUB_PACKAGES_SETUP.md`)
- Verify workflow permissions are correct

## Related Documentation

- [Developer Workflow](./DEVELOPER_WORKFLOW.md) - Daily development and git workflow
- [GitHub Packages Setup Guide](./GITHUB_PACKAGES_SETUP.md) - Initial configuration
