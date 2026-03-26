import * as clack from '@clack/prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlagDef {
  alias?: string;
  type: 'boolean' | 'string' | 'number';
  description?: string;
}

type FlagDefs = Record<string, FlagDef>;

export interface FlowContext<F extends FlagDefs = FlagDefs> {
  flags:
    & {
      [K in keyof F]: F[K]['type'] extends 'boolean' ? boolean
        : F[K]['type'] extends 'number' ? number
        : string;
    }
    & { y?: boolean; yes?: boolean };
  yesMode: boolean;
  args: string[];
}

export interface PromptSelectOpts<T> {
  /** Flag key whose value auto-resolves this prompt (skips showing the prompt) */
  flagKey?: string;
  message: string;
  options: { value: T; label: string; hint?: string }[];
  default?: T;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

export interface PromptTextOpts {
  /** Flag key whose value auto-resolves this prompt (skips showing the prompt) */
  flagKey?: string;
  message: string;
  default?: string | (() => string);
  placeholder?: string;
  validate?: (value: string | undefined) => string | Error | undefined;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

export interface PromptConfirmOpts {
  message: string;
  default?: boolean;
  /** Message to log when the prompt is auto-skipped via -y */
  skipMessage?: string;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

export interface PromptMultiSelectOpts<T> {
  /** Flag key whose value auto-resolves this prompt (comma-separated, skips showing the prompt) */
  flagKey?: string;
  message: string;
  options: { value: T; label: string; hint?: string }[];
  initialValues?: T[];
  /** When true, at least one option must be selected (passed to clack) */
  minOne?: boolean;
  /** When true, always prompt even in yes-mode */
  required?: boolean;
}

// ─── Flag Parsing ─────────────────────────────────────────────────────────────

export function createFlowContext<F extends FlagDefs>(
  argv: string[],
  flagDefs: F,
): FlowContext<F> {
  const flags: Record<string, unknown> = {};
  const args: string[] = [];

  // Build alias map: alias → canonical name
  const aliasMap: Record<string, string> = {};
  for (const [name, def] of Object.entries(flagDefs)) {
    if (def.alias) aliasMap[def.alias] = name;
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    if (arg === '--') {
      args.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const resolvedKey = aliasMap[key] ?? key;
      const def = flagDefs[resolvedKey] ?? (aliasMap[key] ? flagDefs[aliasMap[key]!] : undefined);

      if (def?.type === 'boolean') {
        flags[resolvedKey] = true;
      } else if (def && i + 1 < argv.length) {
        i++;
        flags[resolvedKey] = def.type === 'number' ? Number(argv[i]) : argv[i];
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const alias = arg.slice(1);
      const resolvedKey = aliasMap[alias] ?? alias;
      const def = flagDefs[resolvedKey]
        ?? Object.values(flagDefs).find((d) => d.alias === alias);

      if (def?.type === 'boolean' || alias === 'y') {
        flags[resolvedKey] = true;
      } else if (def && i + 1 < argv.length) {
        i++;
        flags[resolvedKey] = def.type === 'number' ? Number(argv[i]) : argv[i];
      }
    } else {
      args.push(arg);
    }

    i++;
  }

  return {
    flags: flags as FlowContext<F>['flags'],
    yesMode: Boolean(flags['y'] || flags['yes']),
    args,
  };
}

// ─── Prompt Helpers ───────────────────────────────────────────────────────────

export async function promptSelect<T>(
  flow: FlowContext,
  opts: PromptSelectOpts<T>,
): Promise<T> {
  // Resolution chain: 1. explicit flag  2. yes-mode default  3. prompt
  if (opts.flagKey && flow.flags[opts.flagKey as keyof typeof flow.flags] !== undefined) {
    return flow.flags[opts.flagKey as keyof typeof flow.flags] as T;
  }

  if (!opts.required && flow.yesMode && opts.default !== undefined) {
    return opts.default;
  }

  const result = await clack.select({
    message: opts.message,
    options: opts.options as clack.Option<T>[],
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as T;
}

export async function promptText(
  flow: FlowContext,
  opts: PromptTextOpts,
): Promise<string> {
  // Resolution chain: 1. explicit flag  2. yes-mode default  3. prompt
  if (opts.flagKey && flow.flags[opts.flagKey as keyof typeof flow.flags] !== undefined) {
    const value = String(flow.flags[opts.flagKey as keyof typeof flow.flags]);
    if (opts.validate) {
      const error = opts.validate(value);
      if (error) {
        throw error instanceof Error
          ? error
          : new Error(`Invalid --${opts.flagKey}: ${error}`);
      }
    }
    return value;
  }

  if (!opts.required && flow.yesMode && opts.default !== undefined) {
    return typeof opts.default === 'function' ? opts.default() : opts.default;
  }

  const result = await clack.text({
    message: opts.message,
    defaultValue: typeof opts.default === 'function' ? opts.default() : opts.default,
    placeholder: opts.placeholder,
    validate: opts.validate,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as string;
}

export async function promptConfirm(
  flow: FlowContext,
  opts: PromptConfirmOpts,
): Promise<boolean> {
  // Resolution chain: 1. yes-mode default  2. prompt
  if (!opts.required && flow.yesMode) {
    if (opts.skipMessage) console.log(opts.skipMessage);
    return opts.default ?? true;
  }

  const result = await clack.confirm({ message: opts.message });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as boolean;
}

export async function promptMultiSelect<T>(
  flow: FlowContext,
  opts: PromptMultiSelectOpts<T>,
): Promise<T[]> {
  // Resolution chain: 1. explicit flag  2. yes-mode defaults  3. prompt
  if (opts.flagKey && flow.flags[opts.flagKey as keyof typeof flow.flags] !== undefined) {
    const raw = String(flow.flags[opts.flagKey as keyof typeof flow.flags]);
    return raw.split(',').map((s) => s.trim()) as T[];
  }

  if (!opts.required && flow.yesMode && opts.initialValues !== undefined) {
    return opts.initialValues;
  }

  const result = await clack.multiselect({
    message: opts.message,
    options: opts.options as clack.Option<T>[],
    initialValues: opts.initialValues,
    required: opts.minOne,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Cancelled.');
    process.exit(0);
  }

  return result as T[];
}
