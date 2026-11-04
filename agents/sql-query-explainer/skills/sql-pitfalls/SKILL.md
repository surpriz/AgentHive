---
name: sql-pitfalls
description: The SQL mistakes that produce plausible wrong numbers and how to detect each: join fan-out, LEFT JOIN cancelled by WHERE, COUNT semantics, NULL comparisons, date boundaries, GROUP BY grain, window partitions, DISTINCT as a bandage, and dialect differences.
---

# SQL pitfalls

## Join fan-out

A join to a table with several rows per key multiplies the left rows. Symptoms: SUM too high,
COUNT(*) too high. Check: compare `COUNT(*)` before and after the join, or `COUNT(DISTINCT key)`
versus `COUNT(*)`. Fix: aggregate the many side first (a CTE per key), or join on a one-row view.

## LEFT JOIN cancelled

A condition on the right table in WHERE (other than IS NULL) removes the rows the LEFT JOIN
preserved. Check: count of left keys with and without the condition. Fix: move the condition to
ON, or filter the right side in a subquery.

## COUNT semantics

`COUNT(*)` counts rows; `COUNT(col)` counts non-NULL values; `COUNT(DISTINCT col)` counts
distinct non-NULL. After a join, `COUNT(*)` counts the fan-out.

## NULL traps

`col <> 'x'` drops NULLs; `NOT IN (subquery)` returns nothing if the subquery has a NULL;
`SUM` of all NULLs is NULL; `AVG` ignores NULLs (not zero). Check: `COUNT(*) - COUNT(col)`.

## Date boundaries

`BETWEEN a AND b` on timestamps includes `b` at midnight only. Use `>= a AND < b_plus_one`.
Time zones: `DATE(created_at)` in the server's zone. Month ranges: `date_trunc('month', ...)`
rather than string prefixes. `CURRENT_DATE - 30` versus "last month".

## GROUP BY grain

Every non-aggregated column must be in GROUP BY (MySQL may silently pick a value). Grouping on
a display column (city name with case variants) splits groups. The result grain is the GROUP BY
columns; say it in words.

## Window functions

`ROW_NUMBER` without a deterministic ORDER BY; `PARTITION BY` on the wrong key (per order
instead of per customer); window computed before a WHERE that was meant to apply first (windows
run after WHERE, before ORDER BY).

## DISTINCT as a bandage

`SELECT DISTINCT` hides a fan-out instead of fixing it; sums are still wrong. Flag it as risky.

## HAVING versus WHERE

Filter rows before grouping in WHERE; filter groups in HAVING. A `WHERE SUM(...)` is an error; a
`HAVING status = 'paid'` filters after aggregation, usually not intended.

## Dialect notes

Postgres: `::date` casts, `date_trunc`, `string_agg`. MySQL: lax GROUP BY, `DATE_FORMAT`.
BigQuery: `SAFE_DIVIDE`, `DATE_TRUNC(date, MONTH)`, arrays. Snowflake: `DATE_TRUNC('month', d)`,
`QUALIFY`. SQLite: no real date type, `strftime`.

## Check queries

Always runnable and cheap: a count comparison, a duplicate finder (`GROUP BY key HAVING
COUNT(*) > 1`), a boundary probe (`WHERE created_at >= '…31' AND created_at < '…02-01'`).
