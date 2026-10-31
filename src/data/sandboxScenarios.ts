import type { SandboxStep } from '../types';

const T = (text: string, tokens: number, delayMs = 900): SandboxStep => ({ kind: 'thought', text, tokens, delayMs });
const C = (text: string, tokens: number, delayMs = 1100): SandboxStep => ({ kind: 'tool_call', text, tokens, delayMs });
const A = (text: string, tokens: number, delayMs = 800): SandboxStep => ({ kind: 'action', text, tokens, delayMs });
const O = (text: string, tokens: number, delayMs = 1000): SandboxStep => ({ kind: 'observation', text, tokens, delayMs });
const R = (text: string, tokens: number, delayMs = 700): SandboxStep => ({ kind: 'result', text, tokens, delayMs });

export const PROMPT_TOKEN = '{{prompt}}';

export const sandboxScenarios: Record<string, SandboxStep[]> = {
  'claude-code-reviewer': [
    T(`User asks: "${PROMPT_TOKEN}". I need the diff first, then the call graph of every touched symbol before judging anything.`, 142),
    C('github.get_pull_request_diff({ repo: "acme/billing", pr: 418 })', 38),
    O('Diff: 3 files, +142/−17. src/pricing/apply_discount.ts touched; imported by 23 modules.', 96),
    C('ast.call_graph({ symbol: "applyDiscount", depth: 2 })', 31),
    O('applyDiscount → computeTotal → InvoiceService.finalize. New branch skips `clamp(0, total)` when coupon.stackable === true.', 118),
    C('semgrep.scan({ ruleset: "typescript.correctness", files: ["src/pricing/apply_discount.ts"] })', 34),
    O('0 rule hits. Static rules do not cover the sign inversion.', 44),
    A('Rank finding by blast radius: 23 importers × money path = HIGH.', 71),
    R('1 finding (HIGH): stackable coupons can drive total below 0 → negative invoice. Failure scenario: cart 10€, coupons [8€, 8€] → total −6€. Verdict: request_changes.', 164),
  ],
  'eu-ai-act-auditor': [
    T(`Input system: "${PROMPT_TOKEN}". Walk the decision tree: prohibited → Annex III high-risk → GPAI → transparency.`, 131),
    C('vector_store.search({ query: "employment recruitment CV screening", top_k: 5, corpus: "eu-ai-act-2024-1689" })', 47),
    O('Hit: Annex III §4(a) — AI systems intended to be used for recruitment or selection of natural persons. Score 0.91.', 109),
    T('System matches Annex III §4(a). Not a prohibited practice under Art. 5. Classification: HIGH-RISK.', 88),
    C('pdf_parser.extract({ uri: "model_card.pdf", sections: ["data", "evaluation", "limitations"] })', 36),
    O('Model card has training data description; missing bias evaluation across protected groups (Art. 10(2)(f)).', 97),
    C('citation_checker.verify({ articles: ["Art. 9", "Art. 10(2)(f)", "Art. 13", "Art. 14", "Annex IV §2(d)"] })', 42),
    O('5/5 citations verified against consolidated text.', 29),
    R('Risk tier: HIGH (Annex III §4(a)). Obligations: Art. 9 risk mgmt — gap; Art. 10 data governance — partial; Art. 13 transparency — met; Art. 14 human oversight — gap. Annex IV gaps: §2(d), §2(g). Confidence 0.87.', 211),
  ],
  'pg-query-optimizer': [
    T(`Tuning request: "${PROMPT_TOKEN}". Pull the plan before guessing.`, 74),
    C('postgres.query({ sql: "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.created_at > now() - interval \'7 days\' AND c.country = \'FR\'" })', 92),
    O('Seq Scan on orders (cost=0.00..184213.40 rows=41200) actual time=0.031..1842.117. Filter removed 4,118,800 rows. Buffers: shared read=98211.', 128),
    T('Dominant node is the seq scan on orders.created_at. 4.1M rows filtered to 41k → a btree on created_at is the obvious win. Check whether country is selective enough for a composite.', 117),
    C('pg_stat.column_stats({ table: "customers", column: "country" })', 29),
    O('n_distinct=182, most_common_freq FR=0.21. Not selective enough to lead an index.', 61),
    A('Propose: CREATE INDEX CONCURRENTLY orders_created_at_idx ON orders (created_at DESC);', 48),
    C('postgres.query({ sql: "EXPLAIN (ANALYZE) … /* with hypothetical index via hypopg */" })', 55),
    O('Index Scan using orders_created_at_idx (cost=0.43..2214.08) actual time=0.044..38.902. Buffers: shared read=1203.', 102),
    R('Cost 184,213 → 2,214 (−98.8%). Time 1,842 ms → 39 ms. Migration emitted. Nothing applied.', 118),
  ],
  'sec-filings-analyzer': [
    T(`Task: "${PROMPT_TOKEN}". Retriever fetches latest 10-K + prior, Analyst diffs, Writer briefs.`, 96),
    C('edgar.get_filings({ ticker: "NVDA", form: "10-K", limit: 2 })', 33),
    O('Accession 0001045810-26-000021 (FY2026) and 0001045810-25-000023 (FY2025). XBRL facts: 1,912 / 1,874.', 84),
    C('xbrl.diff({ a: "0001045810-25-000023", b: "0001045810-26-000021", concepts: ["Revenues", "GrossProfit", "LongTermDebt"] })', 58),
    O('Revenues +61% YoY (us-gaap:Revenues fact #f-2211). LongTermDebt unchanged.', 72),
    C('text.diff_sections({ sections: ["Item 1A Risk Factors", "Item 7 MD&A"] })', 41),
    O('Item 1A: 2 new paragraphs on export-control exposure to China (+412 words). Item 7: new segment "Agentic Infrastructure" disclosed.', 121),
    A('Writer composes brief; Charting renders revenue by segment.', 64),
    R('Brief ready: 3 material changes (export controls, new segment, supplier concentration). 4 XBRL-anchored metrics, 1 chart. All quotes anchored to section + page.', 158),
  ],
  'smart-contract-sentinel': [
    T(`Target: "${PROMPT_TOKEN}". Static scan first, then adversarial round.`, 71),
    C('etherscan.get_source({ address: "0x7a25…c3e1", chain: "ethereum" })', 36),
    O('Verified. Solidity 0.8.24, 412 lines, inherits ReentrancyGuard, Ownable.', 58),
    C('slither.analyze({ detectors: "all" })', 24),
    O('3 informational, 1 medium: `withdraw()` reads `balances[msg.sender]` after external call in `_payout`.', 94),
    T('[Attacker] Hypothesis H1: reentrancy via _payout → fallback → withdraw. ReentrancyGuard is on withdraw but _payout is called from claim() which is NOT guarded.', 132),
    T('[Defender] claim() can only be invoked once per epoch via `claimed[epoch][msg.sender]`… but that flag is set AFTER _payout. Cannot refute.', 118),
    C('foundry.test({ file: "test/H1_Reentrancy.t.sol", fork: "mainnet" })', 39),
    O('[PASS] testExploit_H1_drainsVault() — attacker balance 0 → 148.2 ETH. Gas 1,204,311.', 88),
    R('1 CRITICAL finding with passing PoC: unguarded claim() → _payout reentrancy drains vault. 4 hypotheses refuted. Fix: move `claimed[epoch][msg.sender] = true` before _payout, or add nonReentrant.', 176),
  ],
  'linkedin-outreach-agent': [
    T(`Task received over A2A: "${PROMPT_TOKEN}". Research first, delegate enrichment, draft, then pause for approval.`, 104),
    C('a2a.delegate({ agent: "company-enricher", task: { domain: "vercel.com", fields: ["headcount", "stack", "recent_posts"] } })', 52),
    O('Enricher task #a2a-9f21 done: 650 employees, Next.js/Turbopack, hiring 3 DevRel, CEO posted on agent infra 2 days ago.', 103),
    C('linkedin.get_profile({ url: "linkedin.com/in/…" })', 27),
    O('Title: Head of Developer Platform. 2 mutual connections. Posted about MCP adoption last week.', 74),
    A('Drafting 3-touch sequence, tone=direct, hook=their MCP post.', 61),
    O('Touch 1 (LinkedIn, 212 chars). Touch 2 (email, day +3). Touch 3 (breakup, day +9). Compliance check: no scraped data used.', 96),
    C('a2a.create_task({ agent: "crm-sync", task: { op: "upsert_contact", stage: "awaiting_approval" } })', 44),
    O('CRM task #a2a-9f3c created. Contact upserted, stage = awaiting_approval.', 51),
    R('Sequence drafted and parked in approval queue. Nothing sent. Hand-off task #a2a-9f3c ready for CRM agent on reply.', 112),
  ],
};

export const defaultScenario: SandboxStep[] = [
  T(`Received: "${PROMPT_TOKEN}". Planning the run.`, 60),
  C('tools.list()', 12),
  O('3 tools available.', 18),
  A('Executing primary capability.', 40),
  R('Run complete. Output validated against output schema.', 72),
];
