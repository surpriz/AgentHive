---
name: experiment-reading-rules
description: How to read A/B test results: the arithmetic for rates, lift and the two-proportion interval, validity checks (sample ratio, duration, whole weeks, planned sample, peeking, primary metric), segment discipline, verdict rules, and the risks that outlive significance.
---

# Experiment reading rules

## Arithmetic

Rate per arm r = conversions / users. Absolute difference d = r_v - r_c. Relative lift = d / r_c.
Pooled p = (c_c + c_v) / (n_c + n_v). SE = sqrt(p(1-p)(1/n_c + 1/n_v)). z = d / SE. Two-sided
p-value from z (z 1.96 ≈ 0.05, 2.58 ≈ 0.01, 3.29 ≈ 0.001). Interval on d: d ± z_conf × SE
(z 1.645 for 90 %, 1.96 for 95 %, 2.58 for 99 %). Relative interval: divide bounds by r_c.
Show every step.

## Validity checks

| Check | Pass when |
|---|---|
| sample ratio | arm sizes match allocation; chi-square on counts with p > 0.01 |
| planned duration | days run ≥ planned |
| whole weeks | duration is a multiple of 7 days, or covers every weekday at least once with matched counts |
| planned sample | users per arm ≥ planned |
| primary metric | the reported metric is the pre-stated primary |
| peeking | a stopping rule was set, or the test ran to plan without early reads driving the decision |
| segments | breakdowns were pre-registered; otherwise exploratory |
| unit | randomisation unit equals analysis unit (users, not sessions, if assigned per user) |

A failed sample ratio check invalidates the read until explained.

## Segments

Unplanned segment effects are hypotheses. With k segments, expect false positives; a segment
that flips the sign needs its own test. Never upgrade a verdict on a segment.

## Verdicts

- invalid: a biasing check failed (sample ratio, unit mismatch, broken instrumentation).
- extend: valid, but duration or sample below plan, or the interval straddles the minimum effect.
- ship: valid, plan reached, interval entirely above the minimum effect.
- stop: valid, plan reached, interval entirely below the minimum effect or showing a loss.

## Risks after significance

Novelty and learning effects, seasonality, metric misalignment (completion up, activation
down), interaction with other running tests, instrumentation differences between arms, survivor
bias in downstream metrics.
