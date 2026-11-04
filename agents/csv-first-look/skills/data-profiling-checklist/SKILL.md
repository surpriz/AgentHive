---
name: data-profiling-checklist
description: Checklist for a first look at tabular data: parsing, column types and roles, the common defects (blanks, duplicates, format mixes, case variants, unit errors, one-value columns), severity rules, and how to state what the data can and cannot answer.
---

# Data profiling checklist

## Parsing

Delimiter (comma, semicolon, tab), quoted fields with delimiters inside, header present, blank
lines, BOM at the start, row count seen.

## Column roles

| Role | Signs |
|---|---|
| identifier | unique or nearly, no arithmetic meaning, often named id or code |
| dimension | few distinct values, used to group: city, status, category |
| measure | numeric, summed or averaged: amount, quantity, duration |
| date | parseable dates or timestamps; note the formats seen |
| text | free text, high cardinality |
| flag | two values: yes/no, true/false, 0/1 |

## Defects to look for

- Blanks: count per column; blanks in identifiers, dates or measures are serious.
- Duplicates: identifier appearing twice; decide events versus duplicates.
- Format mixes: ISO and DD/MM/YYYY dates; decimal comma and point; thousands separators;
  currency symbols; percent signs.
- Category variants: case (Paris, paris, PARIS), spelling, trailing spaces, accents.
- Unit errors: a value 100x or 1000x the neighbours (cents vs euros, grams vs kilos).
- Impossible values: negative quantities, dates in the future, ages over 120.
- One-value columns: carry no information in the sample.
- Overloaded columns: "Paris, 75001" in one field; name and email together.
- Hidden types: numbers stored with a leading apostrophe or as text; booleans as "Y"/"N".
- Sample too small: fewer than twenty values seen for a column.

## Severity

Blocking: the stated goal cannot be computed correctly (duplicate keys, missing measure, wrong
grain). Important: some rows would be wrong (format mixes, variants, unit errors). Minor: cosmetic
or does not touch the goal.

## Can and cannot answer

List questions the table answers as is, questions that need a listed fix first, and questions
that need data not present (a column, a join). Tie them to the goal when one is given.

## Fixes

State the transformation: a parsing rule, a normalisation map, a deduplication rule, a question
to the owner. Prefer confirming the meaning with the owner over guessing the grain.
