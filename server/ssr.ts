import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

/**
 * Puts a static snapshot into the SPA shell, right before the app root. The
 * app removes `#ssr` as its first action, so a browser with JavaScript never
 * shows both; everything else reads the snapshot.
 */
export function withSnapshot(template: string, node: ReactNode): string {
  const html = renderToStaticMarkup(node);
  const marker = '<div id="root"></div>';
  if (!template.includes(marker)) throw new Error('index.html has no app root');
  // A replacer function keeps `$` sequences in publisher text literal.
  return template.replace(marker, () => `${html}\n    ${marker}`);
}
