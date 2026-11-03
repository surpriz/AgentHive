import type { ReactNode } from 'react';

export const metadata = { title: 'QuickNotes', description: 'Notes, nothing else.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <a href="/">QuickNotes</a>
          <nav>
            <a href="/notes">My notes</a> · <a href="/login">Sign in</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
