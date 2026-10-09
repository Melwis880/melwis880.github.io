---
title: "Case study: flx, a clean job feed and an AI bidding agent"
subtitle: "From noisy Freelancer.com searches to 84 jobs screened in one run"
description: "How I built a read-only Python CLI for the Freelancer.com API and a Claude Code agent on top that screens jobs and drafts proposals. Own tool, not client work."
date: 2026-10-08
categories: ["case-study"]
tags: ["python", "ai-agents", "claude-code", "automation"]
---

*This is my own tool, not a client project. Full write-up and code:
[github.com/Melwis880/freelancer-cli](https://github.com/Melwis880/freelancer-cli).*

## The problem

AI and automation jobs on Freelancer.com are buried in noise. A search for n8n or LangChain also
returns logo design, translation and data-entry jobs. Finding the few worth bidding on meant
running the same searches by hand and re-reading jobs I had already seen.

The next step, an agent that drafts proposals, needed more than a browser tab: clean, structured,
de-duplicated data it can trust.

<!--more-->

## How it works

**Part 1: `flx`, the data layer.** A small command-line tool, Python standard library only, that
reads job data from the official Freelancer REST API and does nothing else.

- **Read-only by construction.** The HTTP client refuses every method but GET, so it cannot bid
  or message.
- **Polite to the API.** Requests at least 1 second apart, backoff and a retry limit on rate
  limits.
- **One command for the whole routine.** `flx scan --only-new` runs every keyword and skill
  search, merges and de-duplicates the results, and shows only jobs no earlier scan has shown.
- **Strict JSON for machines.** A versioned schema with a fixed set of fields, so an agent can
  rely on it.

**Part 2: the agent on top.** A Claude Code agent defined in plain Markdown, with two skills:
"screen listings" and "write a proposal".

1. It saves the raw scan to a file before reading a single job, so every decision is traceable.
2. It treats job text as untrusted: hidden Unicode or lines addressed to an AI stop the run.
3. It gives every job one decision (bid, ask me, or skip) with a one-line reason.
4. It drafts proposals only for jobs that pass, citing only proof that exists publicly.
5. It never sends anything. Bidding stays with me.

## The result

- **84 jobs** screened in the first agent run, from 11 searches, no failed search.
- **8 bid, 34 ask me, 42 skip.** The 34 "ask me" jobs came back grouped into 9 questions, so I
  could decide them by group.
- **5 proposal drafts** the same day.
- Search tuning, measured: replacing loose multi-word keywords with exact skill searches turned
  a feed that was about half unrelated into one where about 56 of 83 jobs were clearly on target.
- **123 tests**, CI, MIT licensed.

What it does not prove yet: no time comparison (I never screened this volume by hand) and no bid
outcomes so far. Both will be added only when they are measured.

## Takeaway

Give the agent clean, trustworthy data and a narrow job, and keep the risky action (sending)
with a human. That split is what makes the agent safe to run.
