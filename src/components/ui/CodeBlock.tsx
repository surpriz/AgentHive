import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ text, className = '', label = 'Copy' }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* clipboard unavailable: ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted transition hover:border-border-strong hover:text-fg ${className}`}
      aria-live="polite"
    >
      {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function CodeBlock({
  code,
  label,
  lang,
  maxHeight = '22rem',
}: {
  code: string;
  label?: string;
  lang?: string;
  maxHeight?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0c0c0e]">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[11px] text-dim">
          {label}
          {lang && <span className="ml-2 text-dim/70">{lang}</span>}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-auto p-3 font-mono text-[12px] leading-relaxed text-fg/90" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
