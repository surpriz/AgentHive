const tty = () => process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: number) => (s: string) => (tty() ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  yellow: wrap(33),
  green: wrap(32),
  cyan: wrap(36),
  red: wrap(31),
};

export function gradeColor(grade: string): string {
  if (grade === 'pending') return c.dim(grade);
  return grade === 'AAA' || grade === 'AA' ? c.green(grade) : c.yellow(grade);
}

/** Formats a benchmark number, or a dash when the registry has not measured it yet. */
export function num(n: unknown, suffix = '', prefix = ''): string {
  return n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `${prefix}${Number(n)}${suffix}`;
}

/** Minimal column table. Pure so it can be tested. */
export function table(rows: string[][], header?: string[]): string {
  const all = header ? [header, ...rows] : rows;
  const widths = all[0].map((_, i) => Math.max(...all.map((r) => visibleLength(r[i] ?? ''))));
  const line = (r: string[]) => r.map((cell, i) => cell + ' '.repeat(widths[i] - visibleLength(cell))).join('  ').trimEnd();
  const out = all.map(line);
  if (header) out.splice(1, 0, widths.map((w) => '─'.repeat(w)).join('  '));
  return out.join('\n');
}

export function visibleLength(s: string): number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Strip C0/C1 control characters and ESC sequences from registry-supplied text
 * before it reaches a terminal (keeps \t and \n). Raw --json output is not sanitized.
 */
export function sanitize(s: string): string {
  return (
    s
      // OSC: ESC ] ... (BEL | ESC \)
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
      // CSI (7-bit and 8-bit): ESC [ params intermediates final / 0x9b ...
      .replace(/(?:\x1b\[|\x9b)[0-9;?]*[ -/]*[@-~]?/g, '')
      // other 2-byte ESC sequences
      .replace(/\x1b[@-Z\\-_]/g, '')
      // remaining C0 (except \t \n) and C1 controls
      .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
  );
}
