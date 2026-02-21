import pc from 'picocolors';

export interface HelpCommand {
  cmd: string;
  desc: string;
}

export interface HelpExample {
  cmd: string;
  comment: string;
}

/** Returns spaces to align `value` within `colWidth`, with a 4-space gap. */
function colPad(colWidth: number, value: string): string {
  return ' '.repeat(colWidth - value.length + 4);
}

/** Returns the maximum string length produced by `getValue` across all rows. */
export function columnMax<T>(rows: T[], getValue: (row: T) => string): number {
  return Math.max(0, ...rows.map((row) => getValue(row).length));
}

/** Renders a usage synopsis: `bin <command> [options]` */
export function renderUsage(bin: string, command = '<command>', options?: string): string {
  const opts = options ? ` ${pc.white(options)}` : '';
  return `${pc.cyanBright(bin)} ${pc.dim(pc.cyan(command))}${opts}`;
}

/** Renders a COMMANDS row: `  cmd    description` */
export function renderCommand({ cmd, desc }: HelpCommand, colWidth: number): string {
  return `  ${pc.cyan(cmd)}${colPad(colWidth, cmd)}${desc}`;
}

/** Renders an EXAMPLES row: `  cmd    # comment` */
export function renderExample({ cmd, comment }: HelpExample, colWidth: number): string {
  return `  ${cmd}${colPad(colWidth, cmd)}${pc.dim('# ' + comment)}`;
}
