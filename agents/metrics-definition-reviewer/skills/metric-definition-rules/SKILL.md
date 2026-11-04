---
name: metric-definition-rules
description: What a computable metric definition contains (numerator, denominator, grain, window, filters, source), the usual ambiguities per metric family, the edge cases to decide, conflict patterns between metrics, and the sentence template for a glossary.
---

# Metric definition rules

## Fields

| Field | Question it answers |
|---|---|
| numerator | what is counted or summed, in which table, with which condition |
| denominator | over what population (or none for a count) |
| grain | per what entity: user, account, order, session |
| window | calendar period or rolling; inclusive bounds; time zone; as-of date |
| filters | excluded populations: internal, test, deleted, trials |
| source | the system and table of record; what to do when two sources disagree |

## Usual ambiguities

- Active: which event, which entity, which window, month to date versus complete month.
- Churn: lost when (cancellation date, end of paid period, non-renewal), base at start or
  average, logo versus revenue churn, reactivations.
- Revenue: booked versus recognised versus cash; refunds and credits; currency and FX date;
  annual plans spread or not; taxes.
- Conversion: numerator event and denominator cohort must share a window; attribution of the
  cohort to a period (signup month or conversion month).
- Retention: cohort definition, period n, survival versus activity.
- Average: mean versus median; per user versus per account.

## Edge cases to decide

Trials, free plans, internal and test accounts, several accounts per user, deleted or merged
records, partial periods, backfilled events, time zones, duplicates from retries, pending
payments, disputes.

## Conflicts

Metrics compared or divided must share population, grain and window. Flag any ratio whose
numerator and denominator come from different entities or windows, and any two metrics with
the same name and different bases in the input.

## Glossary sentence

"<Name>: <count or sum> of <entity> where <condition>, from <source table>, over <window with
bounds and time zone>, excluding <filters>; <edge case decisions>." If a decision is open, write
"[decision needed: ...]" rather than choosing.
