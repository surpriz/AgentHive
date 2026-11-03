import type { Agent, Framework, SecurityGrade } from '../../types';

type Variant = 'neutral' | 'accent' | 'cyan' | 'violet' | 'ok' | 'warn' | 'danger';

const variantClass: Record<Variant, string> = {
  neutral: 'border-border bg-surface-2 text-muted',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  cyan: 'border-accent-2/40 bg-accent-2/10 text-accent-2',
  violet: 'border-violet/40 bg-violet/10 text-violet',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  danger: 'border-danger/40 bg-danger/10 text-danger',
};

export function Badge({
  children,
  variant = 'neutral',
  mono = true,
  className = '',
}: {
  children: React.ReactNode;
  variant?: Variant;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 ${mono ? 'font-mono' : ''} ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

const frameworkVariant: Record<Framework, Variant> = {
  Declarative: 'accent',
  'MCP Server': 'cyan',
  LangGraph: 'violet',
  CrewAI: 'warn',
  AutoGen: 'accent',
  'Custom A2A': 'ok',
};

const frameworkLabel: Record<Framework, string> = {
  Declarative: 'Package',
  'MCP Server': 'MCP Native',
  LangGraph: 'LangGraph',
  CrewAI: 'CrewAI',
  AutoGen: 'AutoGen',
  'Custom A2A': 'A2A',
};

export function FrameworkBadge({ framework }: { framework: Framework }) {
  return <Badge variant={frameworkVariant[framework]}>{frameworkLabel[framework]}</Badge>;
}

const gradeVariant: Record<SecurityGrade, Variant> = { AAA: 'ok', AA: 'ok', A: 'warn', B: 'warn', pending: 'neutral' };

export function GradeBadge({ grade, title = 'Security audit grade' }: { grade: SecurityGrade; title?: string }) {
  return (
    <Badge variant={gradeVariant[grade]} className="font-semibold tracking-wide">
      <span title={title} aria-label={`${title}: ${grade}`}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="inline -mt-px mr-0.5" aria-hidden>
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {grade}
      </span>
    </Badge>
  );
}

/** Packages (v2) show their checks, never a grade letter: a static audit cannot vouch for a prompt's intent. */
export function ChecksBadge({ grade, score }: { grade: SecurityGrade; score: number | null }) {
  const state = grade === 'pending' ? 'pending' : score !== null && score >= 90 ? 'ok' : 'issues';
  const variant: Variant = state === 'ok' ? 'ok' : state === 'issues' ? 'warn' : 'neutral';
  const label = state === 'ok' ? 'checks passed' : state === 'issues' ? 'checks: issues' : 'checks pending';
  return (
    <Badge variant={variant} className="font-semibold tracking-wide">
      <span title="Static checks: secrets, pinned bricks, known vulnerabilities, permissions, scripts, completeness. They do not read the prompt for intent." aria-label={label}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="inline -mt-px mr-0.5" aria-hidden>
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </span>
    </Badge>
  );
}

/** Grade letter for hosted agents, checks state for packages. */
export function TrustBadge({ agent, title }: { agent: Pick<Agent, 'apiVersion' | 'grade' | 'score'>; title?: string }) {
  return agent.apiVersion === 'v2' ? <ChecksBadge grade={agent.grade} score={agent.score} /> : <GradeBadge grade={agent.grade} title={title} />;
}
