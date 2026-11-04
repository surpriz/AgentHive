import { marked } from 'marked';

/** Markdown to HTML for post bodies. Authors are trusted, so raw HTML in posts is kept as is. */
export function render(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}
