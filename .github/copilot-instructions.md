# Copilot Instructions

Summary

- This repository provides concise rules for Copilot.
- Source of truth: `.github/instructions/`.
- Copilot reads `.github/instructions/*.instructions.md` directly.

Core Guidelines

- Use TypeScript with `strict` mode; prioritize type safety.
- Prefer named parameters and guard clauses.
- Keep imports sorted; let Prettier handle JSX formatting.
- Document significant changes; add date tags in docs.

Rule Files

- General: [.github/instructions/00-general.instructions.md](.github/instructions/00-general.instructions.md)
- File Naming: [.github/instructions/01-file-naming.instructions.md](.github/instructions/01-file-naming.instructions.md)
- TypeScript: [.github/instructions/02-typescript-patterns.instructions.md](.github/instructions/02-typescript-patterns.instructions.md)
- ESLint & Style: [.github/instructions/04-eslint-code-style.instructions.md](.github/instructions/04-eslint-code-style.instructions.md)
- Documentation: [.github/instructions/05-documentation.instructions.md](.github/instructions/05-documentation.instructions.md)
- Modern TS Patterns: [.github/instructions/06-modern-typescript-patterns.instructions.md](.github/instructions/06-modern-typescript-patterns.instructions.md)
- Variable Naming: [.github/instructions/07-variable-naming.instructions.md](.github/instructions/07-variable-naming.instructions.md)
- README Standards: [.github/instructions/08-readme-standards.instructions.md](.github/instructions/08-readme-standards.instructions.md)

Maintenance

- Edit rules in `.github/instructions/` only.
- Keep these Copilot files concise and task-focused.
