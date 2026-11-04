---
name: release-notes-rules
description: Rules for turning commits and PR titles into release notes: parsing conventional commits, what each audience wants, breaking-change format, grouping and ordering, outcome phrasing, merging duplicates, what to drop, and the markdown layout.
---

# Release notes rules

## Parsing

Conventional commits: `type(scope)!: description`. Types that reach users: feat, fix, perf,
revert. Types that are internal: chore, refactor, test, ci, build, style, docs (docs reach
developers when they document the API). `!` or a `BREAKING CHANGE:` footer marks breaking.
PR titles and tickets without a type: classify by the verb (add, allow, support = new; fix,
correct, resolve = fixed; remove, drop = removed; faster, reduce = improved).

## Audiences

| Audience | Include | Vocabulary |
|---|---|---|
| users | features, fixes, behaviour changes, removals | the product's own words; no code terms |
| developers | plus API, config, deprecations, SDK versions | endpoint, flag, option are fine |
| internal | everything, by area | commit scopes are fine |

## Breaking changes

Format: what changed, who is affected, what to do, deadline. First section, never merged with
others, never softened ("small change" is banned). If the migration step is unknown, mark
`[todo]` and ask.

## Grouping and order

Breaking, New, Improved, Fixed, Removed, Deprecated, Internal (optional). Inside a group: by
reach (all users first), then by scope name.

## Phrasing

Outcome for the reader, present tense, no "we": "Exports keep quotes intact" not "We fixed a
bug where exports...". Under 20 words per item. Keep ids in parentheses at the end. Do not
explain the cause of a bug unless it tells users what was affected.

## Merging and dropping

Merge lines about the same feature (three commits for one sign-in flow is one item). Drop
dependency bumps, refactors, CI, tests, formatting, unless `include_internal`. A dependency bump
that fixes a security issue for users is a Fixed item, not internal.

## Headline

One line, the one or two changes most readers care about, no version number in it (the heading
has it).

## Markdown layout

`## <version or date>`, headline paragraph, `### <group>` with `- item (refs)`. Blank line
between sections. No emoji.
