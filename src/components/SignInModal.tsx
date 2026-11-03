import { useState, type FormEvent } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { GithubIcon } from './ui/GithubIcon';
import { authClient } from '../lib/auth-client';
import type { RegistryConfig } from '../lib/api';

type Mode = 'signin' | 'signup' | 'reset';

/** Sign in with a provider, or with an email and a password. Sign-up sends a verification link; nothing is created until it is used. */
export function SignInModal({ open, onClose, config, onSocial }: { open: boolean; onClose: () => void; config: RegistryConfig | null; onSocial: (p: 'github' | 'google') => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const r = await authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0], callbackURL: '/dashboard' });
        if (r.error) throw new Error(r.error.message ?? 'sign-up failed');
        setNotice(`Check ${email}: the account is created once you open the link we just sent.`);
      } else if (mode === 'reset') {
        const r = await authClient.requestPasswordReset({ email, redirectTo: '/' });
        if (r.error) throw new Error(r.error.message ?? 'request failed');
        setNotice(`If ${email} has an account, a reset link is on its way.`);
      } else {
        const r = await authClient.signIn.email({ email, password, callbackURL: '/dashboard' });
        if (r.error) throw new Error(r.error.status === 403 ? 'Email not verified yet: open the link we sent you, then try again.' : (r.error.message ?? 'sign-in failed'));
        onClose();
        window.location.assign('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-md border border-border bg-[#0c0c0e] px-2.5 py-1.5 text-[13px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none';
  const social = 'flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-[13px] text-fg hover:bg-surface-2';

  return (
    <Modal open={open} onClose={onClose} title="Sign in to AgentHive">
      <div className="space-y-4 p-5">
        {(config?.github || config?.google) && (
          <div className="space-y-2">
            {config.github && (
              <button type="button" onClick={() => onSocial('github')} className={social}>
                <GithubIcon size={14} /> Continue with GitHub
              </button>
            )}
            {config.google && (
              <button type="button" onClick={() => onSocial('google')} className={social}>
                Continue with Google
              </button>
            )}
          </div>
        )}
        {config?.email && (
          <form onSubmit={submit} className="space-y-2" aria-label="Email sign-in">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-dim">
              <Mail size={12} /> {mode === 'signup' ? 'create an account' : mode === 'reset' ? 'reset password' : 'email and password'}
            </div>
            <input type="email" required autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            {mode === 'signup' && <input type="text" autoComplete="nickname" placeholder="name shown as author (optional)" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={field} />}
            {mode !== 'reset' && (
              <input type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="password, 8 characters or more" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            )}
            {error && <p role="alert" className="font-mono text-[12px] text-danger">{error}</p>}
            {notice && <p role="status" className="font-mono text-[12px] text-ok">{notice}</p>}
            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-black hover:bg-accent/90 disabled:opacity-60">
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
            </button>
            <p className="flex flex-wrap gap-x-3 font-mono text-[11px] text-dim">
              {mode !== 'signin' && <button type="button" onClick={() => setMode('signin')} className="hover:text-fg">sign in</button>}
              {mode !== 'signup' && <button type="button" onClick={() => setMode('signup')} className="hover:text-fg">create an account</button>}
              {mode !== 'reset' && <button type="button" onClick={() => setMode('reset')} className="hover:text-fg">forgot password</button>}
            </p>
          </form>
        )}
        {!config?.github && !config?.google && !config?.email && <p className="font-mono text-[12px] text-muted">Sign-in is not configured on this deployment.</p>}
      </div>
    </Modal>
  );
}
