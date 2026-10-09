---
title: "Projects"
description: "Public projects by M. Meriç Ordu: AI automation tools with tests, CI and written case studies."
url: "/projects/"
layout: page
---

Every project here is public, tested and documented. They are my own tools, not client work.
Each one answers three questions: what problem does it solve, how does it work, and what is the
measured result.

---

### flx: Freelancer.com job feed + AI bidding agent

**Problem:** AI and automation jobs on Freelancer.com are buried in noise, and finding the few
worth bidding on meant running the same searches by hand again and again.

**How it works:** a read-only Python CLI (standard library only) fetches jobs from the official
API, de-duplicates them and shows only what is new. A Claude Code agent on top screens every job
(bid, ask me, or skip) and drafts proposals. Sending a bid stays manual.

**Result:** first agent run screened 84 jobs: 8 bid, 34 ask me, 42 skip, 5 proposal drafts.
123 tests, CI, MIT licensed.

[Read the case study](/post/flx-case-study/) · [GitHub](https://github.com/Melwis880/freelancer-cli)

---

### n8n-organizer: a 2,000-workflow n8n library as a knowledge base

**Problem:** a public library of n8n workflows is only useful if you can search it, and raw n8n
JSON is long, noisy and full of duplicates.

**How it works:** a rule-based Python CLI scans the collection, scores each workflow into one of
three categories with a written reason, removes duplicates, and writes three clean Markdown files
ready for NotebookLM. No LLM, no network.

**Result:** 2,047 workflows analysed, 1,973 unique written, 0 errors, about 7 seconds per run.
24 of 24 correct on an independent hand-checked sample. 123 tests, CI on Python 3.10-3.13.

[Read the case study](/post/n8n-organizer-case-study/) · [GitHub](https://github.com/Melwis880/n8n-organizer)
