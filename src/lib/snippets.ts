import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CodeRef, Snippet } from './catalog';

/**
 * Reads the code a step runs straight from the source, between
 * `// #region <name>` and `// #endregion`, so what the page shows is what
 * the run executed. Several regions of one file are joined with `// …`.
 */
export function readSnippet({ file, regions, caption }: CodeRef): Snippet {
  const lines = readFileSync(join(process.cwd(), file), 'utf8').split('\n');
  const parts = regions.map((name) => {
    const start = lines.findIndex((line) => line.trim() === `// #region ${name}`);
    const end = lines.findIndex((line, index) => index > start && line.trim() === '// #endregion');
    if (start === -1 || end === -1) throw new Error(`No region "${name}" in ${file}.`);
    return dedent(lines.slice(start + 1, end));
  });
  return { file, caption, code: parts.join('\n\n// …\n\n') };
}

function dedent(lines: string[]): string {
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent)).join('\n');
}
