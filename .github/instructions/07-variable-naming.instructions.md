# Variable Naming Conventions

## General Rule

**All variables must use at least one full word.** Avoid abbreviations and short-form names unless they are common, well-understood conventions.

## ❌ Avoid Short-Form Variables

### Examples of What NOT to Use

```typescript
// ❌ BAD: Abbreviated names
const pkg: PackageJson = ...;
const finKw = ...;
const r1 = ensureKeyword(...);
const r2 = ensureKeyword(...);
const idx = 0; // Use 'index' instead
const pkgRoot = findPackageRoot(...);
```

### ✅ Use Full Words Instead

```typescript
// ✅ GOOD: Full, descriptive names
const packageJson: PackageJson = ...;
const includeFinograficKeyword = ...;
const finograficKeywordResult = ensureKeyword(...);
const packageNameKeywordResult = ensureKeyword(...);
const index = 0;
const packageRoot = findPackageRoot(...);
```

## ✅ Acceptable Short Names

### Iterator Variables

Single-letter variables are acceptable **only** in trivial iterator callbacks with no logic applied. Use full names in `for...of` loops and in any callback where logic is present.

```typescript
// ✅ GOOD: Single-letter fine in trivial callbacks
const keywords = keywordRaw.filter((k) => typeof k === 'string');
const lengths = items.map((i) => i.value.length);

// ✅ GOOD: Full name in for-of loops
for (const example of examples) lines.push(renderExample(example, width));
for (const command of commands) lines.push(renderCommand(command, width));

// ❌ BAD: Short form in for-of
for (const ex of examples) lines.push(renderExample(ex, width));
for (const cmd of commands) lines.push(renderCommand(cmd, width)); // 'cmd' already means command — use 'command' here
```

### Common Conventions

These are well-understood and acceptable:

```typescript
// ✅ GOOD: Common conventions
const vars: TemplateVars = ...;
const params: CreateParams = ...;
const args: string[] = ...;
const cwd: string = ...;
const props: ComponentProps = ...;

// ✅ GOOD: Error handling — 'err' is idiomatic in catch blocks and error-first callbacks
catch (err) { ... }
fs.readFile(path, (err, data) => { ... });

// ✅ GOOD: 'fn' is semantic — it communicates the binding is callable
function debounce(fn: () => void, delay: number) { ... }
const fn = createHandler(config);

// ✅ GOOD: 'res' is acceptable only in HTTP handler pairs where 'req'/'res' is universal
app.get('/path', (req, res) => { res.json(data); });
// ❌ BAD: 'res' as a standalone result variable — use a descriptive name
const res = computeSomething();  // use 'result', 'output', or a domain-specific name
```

### Acceptable Domain Short Forms

A small set of domain-specific abbreviations are permitted because they are universally understood or because spelling them out is unwieldy:

```typescript
// ✅ GOOD: Permitted domain short forms
cmd; // command — used widely in CLI tooling
desc; // description — long enough to warrant shortening
maxXxx; // e.g. maxLength, maxRetries — 'max' prefix is clear
numXxx; // e.g. numRetries — 'num' prefix is clear
```

Do **not** extend this list freely. When in doubt, spell it out.

### Event Handler Parameters

`event` is not a reserved word in JavaScript/TypeScript — it is a browser global (`window.event`) but shadowing it in modern ESM code is harmless. Use:

```typescript
// ✅ GOOD
onChange={(e) => setValue(e.target.value)}  // 'e' in inline callbacks
function handleClick(event: MouseEvent) {}  // 'event' in named handlers

// ❌ BAD
onChange={(ev) => ...}   // 'ev' — uncommon, saves nothing
onChange={(evt) => ...}  // 'evt' — dated
```

### Path Variables (When Clear)

Function parameters for source/destination paths are acceptable when the context is unambiguous:

```typescript
// ✅ GOOD: Clear function parameters
export async function copyTemplate(
  src: string,
  dest: string,
  vars: TemplateVars,
): Promise<void> { ... }
```

However, **avoid** `src`/`dest` in regular code where they might be confused with folder names:

```typescript
// ❌ BAD: Could be confused with src/ or dist/ folders
const src = resolve(templateDir, item.templatePath);
const dest = resolve(targetDir, item.targetPath);

// ✅ GOOD: Clear they are paths, not folders
const sourcePath = resolve(templateDir, item.templatePath);
const destinationPath = resolve(targetDir, item.targetPath);
```

## Reserved Words

**Never use reserved JavaScript/TypeScript words as variable names:**

```typescript
// ❌ BAD: 'package' is a reserved word
const package: PackageJson = ...;

// ✅ GOOD: Use alternative
const packageJson: PackageJson = ...;
```

## Result Variables

When storing results from function calls, use descriptive names:

```typescript
// ❌ BAD: Unclear what r1/r2 represent
const r1 = ensureKeyword(keywords, finograficKw);
const r2 = ensureKeyword(updated, packageName);

// ✅ GOOD: Descriptive names
const finograficKeywordResult = ensureKeyword(keywords, includeFinograficKeyword);
const packageNameKeywordResult = ensureKeyword(updated, packageNameWithoutScope);
```

## Import Aliases

**Always use `clack` for `@clack/prompts` imports:**

```typescript
// ✅ GOOD: Consistent naming
import * as clack from '@clack/prompts';

// ❌ BAD: Inconsistent aliases
import * as p from '@clack/prompts';
import * as prompts from '@clack/prompts';
```

## Summary

- ✅ Use full words: `packageJson`, `packageRoot`, `sourcePath`, `destinationPath`
- ✅ Single-letter iterator vars (`k`, `e`, `i`) only in trivial callbacks — not in `for...of` loops
- ✅ Common conventions: `vars`, `params`, `args`, `cwd`, `props`
- ✅ Domain short forms: `cmd`, `desc`, `max`/`num` prefixes
- ✅ Event params: `e` in callbacks, `event` in named handlers — never `ev` or `evt`
- ✅ `err` in catch blocks and error-first callbacks; `fn` for callable bindings; `res` only in `(req, res)` HTTP pairs
- ❌ Avoid abbreviations: `pkg`, `ex`, `idx`, `val`, `cb`, `opts`, `cfg`, `buf`, `tmp`
- ❌ Avoid `src`/`dest` in regular code (use `sourcePath`/`destinationPath`)
- ❌ Never use reserved words: `package`, `class`, `function`, etc.
- ✅ Always use `clack` for `@clack/prompts` imports
