---
name: claim-checking-rules
description: Rules for checking claims against provided sources: what counts as a checkable claim, verdict definitions, scope shifts to watch, how source kind limits verdicts, minimal honest rewrites, and what never to do.
---

# Claim checking rules

## Checkable claims

Numbers and percentages, dates, counts ("three studies"), causal statements ("cuts", "leads
to", "because"), attributions ("a trial confirmed", "experts say"), comparisons ("faster than"),
superlatives ("most", "first", "largest"), states of the world ("is now standard"). Opinions and
predictions are not checked; note them as such if asked.

## Verdicts

| Verdict | Condition |
|---|---|
| supported | a source states it with the same measure, population and direction |
| contradicted | a source states the opposite, or a figure incompatible with the claim |
| partly-supported | a source supports a weaker, narrower or differently measured version |
| not-covered | no source speaks to the subject |

A claim can be supported by one source and contradicted by another: report both and set the
verdict to `contradicted` with the note, because the draft stated it without the conflict.

## Scope shifts

Measure (defects vs incidents vs bugs), population (customers of one vendor vs all teams), time
(2024 vs 2025), direction (reduced vs no significant change), certainty (confirmed vs suggests),
reporting (measured vs self-reported). Any shift downgrades the verdict.

## Source kind

Trial or audit with method: can support any claim in its scope. Survey: supports "report",
"say", adoption claims. Case study: supports claims about that case. Vendor material: at most
`partly-supported` for quantitative claims; supported only for claims about the vendor's own
product features. Opinion: supports "X argues", nothing more.

## Minimal rewrite

Keep the author's sentence shape; change the measure, scope or verb to match the source; add
the source scope in a few words ("among its customers", "in a 120-developer trial"). Remove a
claim only when nothing supports it and the author needs it to be true.

## Never

- Confirm from memory.
- Round a source figure to match the claim.
- Merge two sources into one that says what neither says.
- Treat absence of contradiction as support.
