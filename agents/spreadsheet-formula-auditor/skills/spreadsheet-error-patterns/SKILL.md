---
name: spreadsheet-error-patterns
description: The spreadsheet formula errors that fail silently and how to spot them from formula text: range extent and sibling inconsistency, lookup match modes, relative and absolute references, buried constants, wrong denominators, double counting, unit mixes, circularity, and the fixes.
---

# Spreadsheet error patterns

## Range extent

A SUM, AVERAGE or COUNT whose range ends before the data does, or starts on the header. Compare
every range to the stated data extent and to sibling totals in the same row: `SUM(B2:B12)` next
to `SUM(C2:C13)` is a finding even without the layout. Fix: full range, a table reference, or a
named range.

## Lookups

`VLOOKUP(key, range, col)` without `FALSE` (or `TRUE` explicitly) does approximate match and
needs sorted keys; on unsorted data it returns a wrong row silently. `INDEX/MATCH` with match
type omitted (defaults to 1) has the same problem. `XLOOKUP` defaults to exact. Column index
that drifts when a column is inserted.

## References

Relative references copied down or across where an absolute (`$H$1`) was needed: a rate or a
total that moves. Absolute references where relative was needed: every row using row 2. Mixed
references (`$B2`, `B$2`) check against the copy direction.

## Buried constants

Numbers inside formulas (`*1.2`, `/12`, `+500`) that are assumptions: not visible, not
adjustable, repeated. Fix: an inputs block with labelled cells.

## Denominators

Margin divided by cost instead of revenue; growth divided by the new value; share divided by a
subtotal instead of the grand total; division by a cell that can be zero.

## Double counting

Totals that include a subtotal row; `SUM` over a column that also holds the grand total;
cumulative columns summed again.

## Units and types

Percent stored as 20 in one place and 0.2 in another; thousands in one sheet and units in
another; dates as text; numbers as text (left-aligned, apostrophe) excluded from SUM.

## Circularity and order

A formula referencing its own output through a chain; iterative calculation enabled to hide it.

## Fragility

Hard-coded row numbers in `OFFSET` or `INDIRECT`; whole-column references in volatile formulas
on large sheets; merged cells inside ranges; formulas that rely on sheet order.

## Fix style

Give the corrected formula for the cell; when the fix is structural (inputs block, named ranges,
a table), say it in one line and give the first formula to change.
