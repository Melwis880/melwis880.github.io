---
title: "Turning 2,047 n8n workflows into a searchable knowledge base"
subtitle: "And why the newest version of the data was the real problem"
description: "A rule-based Python CLI that turns the public Zie619 n8n workflow collection into three clean, NotebookLM-ready files: 1,973 unique workflows, 0 errors, about 7 seconds. Own tool, not client work."
date: 2026-10-09
categories: ["case-study"]
ai_use: draft
tags: ["n8n", "python", "automation", "knowledge-base"]
---

*This is my own tool, not a client project. The workflows belong to the public
[Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) collection, not to me. Full
write-up and code: [github.com/Melwis880/n8n-organizer](https://github.com/Melwis880/n8n-organizer).*

## The problem

When scoping an automation project, the useful question is "what has already been built for
this?" A public library of n8n workflows answers it, but only if you can search it. The
collection has 2,057 JSON files in 187 folders. Raw n8n JSON is long, full of node parameters and
canvas positions, and some files are copies of others. Loaded as-is into a notebook tool like
NotebookLM, it means hundreds of sources and a lot of noise.

The goal: a few large, clean sources, each workflow described the same way, with a category you
can trust and see the reason for.

<!--more-->

## How it works

1. **Scan** the folder and skip what is not a workflow, recording why.
2. **Measure** each workflow: working nodes, real connections, triggers, branches, services.
3. **Score** it into one of three categories (`Data_Integration`, `AI_Content`,
   `Orchestration_Reliability`). Every point is written out as a reason line.
4. **Remove duplicates**, including copies that differ only in ids, positions or node order.
5. **Write** one Markdown file per category, plus a summary and a trace of every decision.

No LLM, no network. Node parameters, credentials and URLs never reach the output, because real
workflows often hold API keys in their parameters.

## The finding: the newest data was broken

Before trusting any numbers, I compared node types across the collection's git history. Two later
commits had damaged it: one added thousands of disconnected error nodes, another turned AI nodes
into empty `noOp` nodes while keeping their names (320 nodes still named "OpenAI Chat Model").
A classifier that reads node types cannot be right on that data, so the tool runs on the last
clean version (`ae8cf6dc`).

## The result

| Measure | Value |
|---|---|
| Workflows analysed | 2,047 |
| Unique workflows written | 1,973 |
| Duplicates removed | 74 |
| Errors | 0 |
| Run time | about 7 seconds |
| Output | 3 files, each under the NotebookLM word limit |

Accuracy, checked by hand on independent samples of 24 workflows: 16 of 24 before tuning, 24 of
24 (with a scoring signal) after. Samples of 24 are small; these are checks, not a benchmark.

Quality work: 123 tests over 57 written scenarios. To test the tests, 167 deliberate bugs were
planted one at a time and 153 were caught. Three security reviews before publishing fixed issues
like crafted file names breaking a run and a hash that could leak values from workflow
parameters.

## Takeaways

- Look at the data before tuning the model. Here the newest data was the problem.
- An honest "no signal" beats a confident default.
- Hand-checked samples, kept separate from the tuning sample, are what make accuracy numbers
  honest.
