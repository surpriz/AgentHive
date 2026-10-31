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
  return grade === 'AAA' || grade === 'AA' ? c.green(grade) : c.yellow(grade);
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
