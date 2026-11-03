import { renameSync, existsSync } from 'node:fs';

// The built index.html moves out of the way so `/` reaches the function, which
// serves the same shell with a static snapshot in it. Vercel checks the
// filesystem before rewrites, so a real index.html would shadow the route.
if (existsSync('dist/index.html')) {
  renameSync('dist/index.html', 'dist/_shell.html');
  console.log('dist/index.html → dist/_shell.html');
}
