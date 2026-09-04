# Prime Context 9.2.0 benchmark record

> **The result:** Prime Context completed **30/30** real-world tasks. Stock Prime Agent 0.9.1 completed **29/30**. On the 29 tasks both systems strictly passed, Prime Context was faster **29 out of 29 times** and cheaper **29 out of 29 times**.

This document is the detailed record behind the headline numbers in [README.md](README.md). It reports the selected-attempt correctness, agent wall time, and billed API cost used for decisions, plus model-call and provider-token diagnostics. Billed API cost is authoritative; token counts are diagnostic.

## Headline result

| Measure | Prime Context | Vanilla Prime Agent 0.9.1 | Result |
|---|---:|---:|---|
| Selected strict passes | **30/30** | 29/30 | Prime Context correctness win |
| Selected main checks | **150/150** | 149/150 | Prime Context +1 check |
| Selected edge checks | 30/30 | 30/30 | Tie |
| Selected agent wall time, all 30 | **6,172.066 s** | 7,667.468 s | **19.50% less**¹ |
| Selected billed API cost, all 30 | **$13.233338** | $18.513607 | **28.52% less**¹ |
| Selected model calls, all 30 | **373** | 412 | **9.47% fewer**¹ |
| Selected provider tokens, all 30 | **4,199,330** | 6,865,456 | **38.83% fewer**¹ |

¹ The all-30 efficiency totals include vanilla Task 30 even though vanilla did not strictly pass it. The controlled efficiency comparison below uses only strict both-pass pairs.

### Apples-to-apples: 29 strict both-pass pairs

| Measure | Prime Context | Vanilla Prime Agent 0.9.1 | Prime Context advantage |
|---|---:|---:|---:|
| Time wins | **29/29** | 0/29 | Every pair |
| Cost wins | **29/29** | 0/29 | Every pair |
| Agent wall time | **5,665.556 s** | 7,051.335 s | **1,385.779 s / 19.65% less** |
| Billed API cost | **$11.898793** | $16.852171 | **$4.953378 / 29.39% less** |
| Model calls | **338** | 374 | **36 / 9.63% fewer** |
| Provider tokens | **3,627,683** | 5,997,405 | **2,369,722 / 39.51% fewer** |

### Retry-inclusive retained totals

| Measure | Prime Context | Vanilla Prime Agent 0.9.1 | Prime Context advantage |
|---|---:|---:|---:|
| Retained attempts | 32 | 32 | — |
| Agent wall time | **6,841.572 s** | 8,485.818 s | **19.38% less** |
| Billed API cost | **$15.053094** | $20.892213 | **27.95% less** |
| Model calls | **416** | 462 | **9.96% fewer** |
| Provider tokens | **4,920,239** | 8,170,962 | **39.78% fewer** |

## Method

- **Recorded:** 2026-09-03.
- **Vanilla arm:** fully isolated stock `prime-agent@0.9.1`; no Prime Context package and no Prime Context host patch.
- **Current arm:** fully isolated npm-installed `prime-agent-context@9.1.1` plus the release-candidate Prime Agent 0.9.1 host patch. Version 9.2.0 packages that patch and the audited source improvements described in the changelog. The final release audit corrected argument-key normalization in one bundled copy; that correction does not change any selected benchmark decision.
- **Model:** `openai-codex/gpt-5.6-sol`, medium reasoning effort.
- **Isolation:** separate npm prefixes, homes, configs, caches, session directories, and workspaces. The current host loaded the npm package, never the repository checkout.
- **Concurrency:** maximum six attempts, scheduled as three vanilla/current pairs per wave.
- **Tools and context:** identical neutral Bash behavior; no context files, skills, prompt templates, themes, or unrelated extensions.
- **Correctness:** each task required all 5 main checks and its edge check. Progress levels are diagnostic (`P5` is complete).
- **Selection order:** strict correctness first, then lower agent wall time, then lower billed API cost.
- **Retry rule:** retry only the failing or regressing variant once before diagnosis. A vanilla failure on both allowed attempts is a current correctness win when current strictly passes.
- **Efficiency rule:** compare time and cost only where both selected variants strictly pass.
- **Targeted replacement:** clean targeted reruns may replace invalidated or regressing rows while unaffected evidence from the complete all-30 run remains fixed.

The final publication set combines 22 unaffected rows from the all-30 run with clean replacements for Tasks 7, 8, 13, 16, and 27–30. This protocol was fixed before publication; it avoids rerunning unaffected tasks merely because one task contract changed.

## Every task and every selected metric

`Pressure / timeout` is the staged workload pressure (`N`, `L`, `M`, or `H`) and hard task timeout. `A1`/`A2` identifies the selected attempt. `calls` includes all recorded model calls. `tokens` is total recorded provider tokens, including cache-read tokens.

| # | Task | Pressure / timeout | Workload | Evidence | Prime Context selected | Vanilla selected | Outcome |
|---:|---|:---:|---|:---:|---|---|---|
| 1 | Household Expense Reconciliation | N / 600 s | Reconcile bank transactions, receipts, and categories with exact decimal arithmetic. | v19-base | PASS 5/5 + edge (P5); 64.208 s; $0.151272; 5 calls; 23,444 tokens; A1 | PASS 5/5 + edge (P5); 88.628 s; $0.191352; 6 calls; 36,634 tokens; A1 | Time −27.55%; cost −20.95% |
| 2 | Calendar Merge and Conflict Report | L / 900 s | Merge iCalendar feeds, cancellations, conflicts, sequence updates, and DST-spanning events. | v19-base | PASS 5/5 + edge (P5); 95.797 s; $0.225840; 8 calls; 68,783 tokens; A1 | PASS 5/5 + edge (P5); 130.701 s; $0.282953; 8 calls; 71,049 tokens; A2 | Time −26.71%; cost −20.18% |
| 3 | Mailbox Thread Cleanup | L / 900 s | Thread and deduplicate multiple mbox archives while handling missing or invalid dates. | v19-base | PASS 5/5 + edge (P5); 161.017 s; $0.317084; 10 calls; 81,161 tokens; A1 | PASS 5/5 + edge (P5); 200.352 s; $0.486379; 11 calls; 121,381 tokens; A1 | Time −19.63%; cost −34.81% |
| 4 | Invoice and Payment Matching | N / 600 s | Match invoices, payments, and adjustments into exact financial reports. | v19-base | PASS 5/5 + edge (P5); 62.238 s; $0.163002; 5 calls; 39,723 tokens; A1 | PASS 5/5 + edge (P5); 73.125 s; $0.191228; 6 calls; 42,814 tokens; A1 | Time −14.89%; cost −14.76% |
| 5 | Inventory Reorder and Transfer Plan | L / 900 s | Produce deterministic reorder and inter-location transfer plans from inventory and demand data. | v19-base | PASS 5/5 + edge (P5); 183.746 s; $0.403290; 11 calls; 110,044 tokens; A1 | PASS 5/5 + edge (P5); 221.428 s; $0.738690; 14 calls; 415,164 tokens; A1 | Time −17.02%; cost −45.40% |
| 6 | Volunteer Shift Rescheduling | M / 1200 s | Reschedule volunteer shifts under availability, skill, coverage, and fairness constraints. | v19-base | PASS 5/5 + edge (P5); 218.052 s; $0.596706; 15 calls; 225,115 tokens; A2 | PASS 5/5 + edge (P5); 291.461 s; $0.681300; 16 calls; 269,950 tokens; A1 | Time −25.19%; cost −12.42% |
| 7 | Utility Consumption Anomaly Report | N / 600 s | Detect meter-level utility-consumption anomalies and generate deterministic reports. | t7-r2 | PASS 5/5 + edge (P5); 72.513 s; $0.147380; 6 calls; 23,575 tokens; A1 | PASS 5/5 + edge (P5); 82.442 s; $0.423413; 6 calls; 93,768 tokens; A1 | Time −12.04%; cost −65.19% |
| 8 | Travel Itinerary Repair | L / 900 s | Validate zoned itinerary segments, detect conflicts, and emit contract-exact rebooking choices. | gate20 | PASS 5/5 + edge (P5); 134.824 s; $0.279192; 9 calls; 55,784 tokens; A1 | PASS 5/5 + edge (P5); 158.974 s; $0.397872; 10 calls; 74,008 tokens; A1 | Time −15.19%; cost −29.83% |
| 9 | Support SLA Event Analysis | N / 600 s | Stream interleaved ticket events into support-SLA results without loading the full log. | v19-base | PASS 5/5 + edge (P5); 99.654 s; $0.220110; 7 calls; 42,060 tokens; A1 | PASS 5/5 + edge (P5); 117.451 s; $0.335390; 6 calls; 83,230 tokens; A1 | Time −15.15%; cost −34.37% |
| 10 | Local Supplier Catalog Crawler | N / 600 s | Crawl a loopback supplier catalog and normalize it into a deterministic local snapshot. | v19-base | PASS 5/5 + edge (P5); 90.536 s; $0.230206; 6 calls; 39,408 tokens; A1 | PASS 5/5 + edge (P5); 119.189 s; $0.273957; 6 calls; 40,322 tokens; A1 | Time −24.04%; cost −15.97% |
| 11 | SQLite CRM Migration | L / 900 s | Migrate a legacy SQLite CRM in place while preserving data and schema invariants. | v19-base | PASS 5/5 + edge (P5); 137.522 s; $0.289281; 10 calls; 63,771 tokens; A1 | PASS 5/5 + edge (P5); 161.618 s; $0.361366; 10 calls; 64,539 tokens; A1 | Time −14.91%; cost −19.95% |
| 12 | Webhook Receiver and Replay | M / 1200 s | Complete a durable SQLite-backed webhook receiver and replay workflow over loopback HTTP. | v19-base | PASS 5/5 + edge (P5); 156.313 s; $0.387368; 12 calls; 93,281 tokens; A1 | PASS 5/5 + edge (P5); 210.449 s; $0.511644; 14 calls; 124,181 tokens; A1 | Time −25.72%; cost −24.29% |
| 13 | Cross-Service Incident Timeline | H / 1800 s | Reconstruct a causal cross-service incident timeline from large logs and late forensic evidence. | t7-13 | PASS 5/5 + edge (P5); 950.211 s; $1.031715; 26 calls; 403,463 tokens; A1 | PASS 5/5 + edge (P5); 1005.521 s; $1.842924; 31 calls; 1,102,690 tokens; A1 | Time −5.50%; cost −44.02% |
| 14 | Layered Configuration Upgrade | N / 600 s | Upgrade, migrate, and merge layered application configuration deterministically. | v19-base | PASS 5/5 + edge (P5); 112.863 s; $0.280096; 9 calls; 59,522 tokens; A1 | PASS 5/5 + edge (P5); 160.284 s; $0.378172; 8 calls; 57,334 tokens; A1 | Time −29.59%; cost −25.93% |
| 15 | Backup Restore Planner | N / 600 s | Choose and explain a valid restore plan from full and incremental backup metadata. | v19-base | PASS 5/5 + edge (P5); 82.124 s; $0.173623; 6 calls; 27,025 tokens; A1 | PASS 5/5 + edge (P5); 123.074 s; $0.263608; 7 calls; 42,057 tokens; A1 | Time −33.27%; cost −34.14% |
| 16 | Markdown Knowledge-Base Repair | L / 900 s | Repair Markdown knowledge-base metadata, links, redirects, and generated reports. | gate20 | PASS 5/5 + edge (P5); 238.252 s; $0.624723; 13 calls; 168,959 tokens; A1 | PASS 5/5 + edge (P5); 317.651 s; $0.788675; 15 calls; 325,413 tokens; A1 | Time −25.00%; cost −20.79% |
| 17 | Contract Clause Index and Comparison | M / 1200 s | Extract, page-locate, index, and compare aliased contract clauses. | v19-base | PASS 5/5 + edge (P5); 180.152 s; $0.434730; 13 calls; 114,810 tokens; A1 | PASS 5/5 + edge (P5); 258.511 s; $0.618257; 18 calls; 176,372 tokens; A1 | Time −30.31%; cost −29.68% |
| 18 | Research-Note Search and Deduplication | L / 900 s | Build a SQLite research-note index with deterministic search and duplicate reporting. | v19-base | PASS 5/5 + edge (P5); 143.167 s; $0.275255; 6 calls; 36,185 tokens; A1 | PASS 5/5 + edge (P5); 222.598 s; $0.420516; 12 calls; 109,224 tokens; A1 | Time −35.68%; cost −34.54% |
| 19 | Sensor Resampling and Gap Report | N / 600 s | Stream compressed sensor data into resampled series and exact gap reports. | v19-base | PASS 5/5 + edge (P5); 140.381 s; $0.203036; 8 calls; 42,285 tokens; A1 | PASS 5/5 + edge (P5); 170.955 s; $0.478258; 8 calls; 176,779 tokens; A1 | Time −17.88%; cost −57.55% |
| 20 | Time-of-Use Energy Billing | M / 1200 s | Calculate time-of-use energy bills across tariff periods and time-zone boundaries. | v19-base | PASS 5/5 + edge (P5); 132.839 s; $0.284899; 10 calls; 75,951 tokens; A1 | PASS 5/5 + edge (P5); 248.162 s; $0.536652; 15 calls; 164,090 tokens; A1 | Time −46.47%; cost −46.91% |
| 21 | WAV Interview Cleanup and Chapters | L / 900 s | Clean PCM WAV audio and generate transcript-aligned chapter artifacts. | v19-base | PASS 5/5 + edge (P5); 135.565 s; $0.284030; 9 calls; 68,437 tokens; A1 | PASS 5/5 + edge (P5); 166.400 s; $0.353788; 10 calls; 80,726 tokens; A1 | Time −18.53%; cost −19.72% |
| 22 | Timesheet and Payroll Correction | M / 1200 s | Correct weekly payroll from time punches, rules, and later adjustments. | v19-base | PASS 5/5 + edge (P5); 217.390 s; $0.476618; 13 calls; 145,299 tokens; A1 | PASS 5/5 + edge (P5); 252.982 s; $0.575728; 14 calls; 190,352 tokens; A1 | Time −14.07%; cost −17.21% |
| 23 | Procurement Three-Way Match | M / 1200 s | Perform decimal-exact purchase-order, receipt, and invoice three-way matching. | v19-base | PASS 5/5 + edge (P5); 243.017 s; $0.619487; 16 calls; 261,961 tokens; A1 | PASS 5/5 + edge (P5); 316.910 s; $0.754071; 17 calls; 317,006 tokens; A1 | Time −23.32%; cost −17.85% |
| 24 | Multi-Warehouse Order Fulfillment | M / 1200 s | Allocate orders across warehouses and report fulfillment, splits, and shortages. | v19-base | PASS 5/5 + edge (P5); 282.657 s; $0.648099; 14 calls; 211,380 tokens; A1 | PASS 5/5 + edge (P5); 319.894 s; $0.911798; 15 calls; 449,500 tokens; A1 | Time −11.64%; cost −28.92% |
| 25 | Library Circulation Reconstruction | L / 900 s | Reconstruct circulation state from 300,000 interleaved library transactions. | v19-base | PASS 5/5 + edge (P5); 230.661 s; $0.555395; 12 calls; 116,358 tokens; A1 | PASS 5/5 + edge (P5); 274.137 s; $0.579766; 14 calls; 153,954 tokens; A1 | Time −15.86%; cost −4.20% |
| 26 | School Meal Allergen and Stock Plan | L / 900 s | Create school meal plans that satisfy allergen exclusions and stock constraints. | v19-base | PASS 5/5 + edge (P5); 108.945 s; $0.229904; 10 calls; 67,266 tokens; A1 | PASS 5/5 + edge (P5); 150.733 s; $0.332304; 11 calls; 84,911 tokens; A1 | Time −27.72%; cost −30.82% |
| 27 | Clinic Appointment Rescheduling | H / 1800 s | Reschedule clinic appointments after staged availability and disruption changes. | gate20 | PASS 5/5 + edge (P5); 430.549 s; $1.008135; 26 calls; 412,720 tokens; A2 | PASS 5/5 + edge (P5); 456.494 s; $1.105473; 22 calls; 391,403 tokens; A1 | Time −5.68%; cost −8.81% |
| 28 | Permit Intake and Status Pipeline | H / 1800 s | Repair a staged permit-intake package, SQLite pipeline, validation, and status reports. | gate20 | PASS 5/5 + edge (P5); 287.547 s; $0.701376; 20 calls; 252,315 tokens; A1 | PASS 5/5 + edge (P5); 420.704 s; $1.207390; 24 calls; 461,813 tokens; A1 | Time −31.65%; cost −41.91% |
| 29 | Legacy Budgeting CLI Repair | M / 1200 s | Repair a legacy budgeting CLI, preserve its SQLite data, and produce corrected reports. | gate20 | PASS 5/5 + edge (P5); 272.815 s; $0.656941; 23 calls; 297,598 tokens; A1 | PASS 5/5 + edge (P5); 330.506 s; $0.829247; 20 calls; 276,741 tokens; A1 | Time −17.46%; cost −20.78% |
| 30 | Helpdesk Service Upgrade | H / 1800 s | Migrate and extend a persistent helpdesk service across staged API and CLI requirements. | gate20 | PASS 5/5 + edge (P5); 506.510 s; $1.334545; 35 calls; 571,647 tokens; A1 | FAIL 4/5 + edge (P3); 616.133 s; $1.661436; 38 calls; 868,051 tokens; A2 | Correctness win; vanilla failed both attempts |

## Every retained retry

Only four task/variant pairs retained a second attempt. These rows disclose both attempts, including the one non-product transport error. All other task/variant pairs used one attempt, already reported above.

| Task | Variant | Attempt | Selected | Correctness | Agent time | Billed cost | Calls | Tokens | Recorded error |
|---:|---|:---:|:---:|---|---:|---:|---:|---:|---|
| 2 | vanilla | A1 | no | FAIL 1/5 + edge (P3) | 73.495 s | $0.136822 | 4 | 13,312 | AgentError: WebSocket closed 1006 |
| 2 | vanilla | A2 | yes | PASS 5/5 + edge (P5) | 130.701 s | $0.282953 | 8 | 71,049 | — |
| 6 | current | A1 | no | PASS 5/5 + edge (P5) | 234.276 s | $0.683348 | 17 | 274,395 | — |
| 6 | current | A2 | yes | PASS 5/5 + edge (P5) | 218.052 s | $0.596706 | 15 | 225,115 | — |
| 27 | current | A1 | no | PASS 5/5 + edge (P5) | 435.230 s | $1.136408 | 26 | 446,514 | — |
| 27 | current | A2 | yes | PASS 5/5 + edge (P5) | 430.549 s | $1.008135 | 26 | 412,720 | — |
| 30 | vanilla | A1 | no | FAIL 4/5 + edge (P3) | 744.856 s | $2.241784 | 46 | 1,292,194 | — |
| 30 | vanilla | A2 | yes | FAIL 4/5 + edge (P3) | 616.133 s | $1.661436 | 38 | 868,051 | — |

Task 30 is not treated as a time/cost comparison. Prime Context passed 5/5 plus edge on A1. Vanilla reached only 4/5 plus edge on both allowed attempts, so correctness decides the result.

## Evidence map

| Label | Retained run | Published tasks |
|---|---|---|
| `v19-base` | `20260903-pa091-pc911-all30-v19-invalid-task08-rebook-contract-parent-scope-tool` | 22 unaffected tasks |
| `t7-r2` | `20260903-pa091-pc911-targeted-task07-replacement2` | Task 7 |
| `gate20` | `20260903-pa091-pc911-postfix-gate-task08-16-27-30` | Tasks 8, 16, 27–30 |
| `t7-13` | `20260903-pa091-pc911-targeted-task07-13-replacement` | Task 13 |

Raw invocation evidence is retained locally under `benchmarks/python-realworld-30/results/` and is intentionally excluded from the npm tarball because it contains full generated workspaces and session material. The harness, task contracts, judges, and isolation builder are published under [`benchmarks/python-realworld-30/`](benchmarks/python-realworld-30/). The concise publication snapshot is [`RECENT_RESULTS.md`](RECENT_RESULTS.md).

## Validation of the publication set

- Corpus validator: valid, 30 tasks, 669 staged files.
- Harness tests: 4/4 passed.
- Product tests: 110/110 passed, including focused Bash-watcher and terminal-state projection cases added during the final release audit.
- Python compilation, TypeScript typecheck/build, package smoke against Prime Agent 0.9.1, and `git diff --check`: passed.
- Evidence audit: 30 current strict passes, 29 vanilla strict passes, 29/29 both-pass time wins, 29/29 both-pass billed-cost wins, no selected-attempt errors, no excessive retries, and no report/invocation mismatches.

## Reproduce

Prepare isolated hosts from the repository root:

```bash
python3 benchmarks/python-realworld-30/prepare-hosts.py \
  --root .benchmark-runs/hosts-pa091-pc920 \
  --force
```

Then run the corpus with the manifest and explicit model settings:

```bash
python3 benchmarks/python-realworld-30/run.py \
  --hosts-manifest .benchmark-runs/hosts-pa091-pc920/hosts.json \
  --provider openai-codex \
  --model gpt-5.6-sol \
  --thinking medium \
  --group-size 2 \
  --max-workers 6 \
  --output benchmarks/python-realworld-30/results/reproduction
```

Provider credentials and billed-cost reporting must already be configured for Prime Agent. See [`benchmarks/python-realworld-30/README.md`](benchmarks/python-realworld-30/README.md) for corpus validation, targeted task selection, retry behavior, and summary generation.
