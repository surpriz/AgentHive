---
name: doc-page-patterns
description: Patterns for documentation pages: how-to, reference and concept shapes, task-first titles and intros, prerequisites, step rules, the one working example, troubleshooting entries, handling gaps with todos, and markdown layout.
---

# Doc page patterns

## Shapes

| Type | Title | Body |
|---|---|---|
| how-to | verb phrase: "Install an agent into Codex" | intro, prerequisites, numbered steps, example, troubleshooting |
| reference | noun: "agent-cli pull" | synopsis, options table (flag, meaning, default), examples, exit codes or errors |
| concept | question or noun: "How retrieval layouts work" | the problem, the model in one paragraph, a diagram in words, where it applies, limits |

## Intro

One or two sentences: what the reader can do after the page. No history, no "this document
describes".

## Prerequisites

Only things the steps assume and do not explain: installed tools, accounts, permissions,
versions. Each as a short line, with a link placeholder if the page exists.

## Steps

- Numbered, imperative, one action each.
- The exact command, path or click in code formatting.
- What the reader sees when it worked, in the same step or the next line.
- Conditions ("only when trusted") as a note immediately after the step they affect.
- Under eight steps; split the page otherwise.

## Example

One complete run, realistic values, copy-pasteable. Not three partial ones.

## Troubleshooting

Symptom (what the reader sees), cause (one sentence), fix (one action). Only cases the material
supports. Order by likelihood.

## Gaps

When the material lacks a fact the page needs (an error text, a default, a version), write
`[todo: what is missing]` in place and list it in `gaps`. Never guess a flag or a path.

## Style

No "simply", "just", "easily", "please". No marketing adjectives. Present tense. Second person
for the reader. Code formatting for every command, flag, path, file and value.

## Markdown

`#` title, intro paragraph, `## Prerequisites` list, `## <task>` sections with numbered steps,
`## Example` code block, `## Troubleshooting` with `**Symptom**` lines. No emoji.
