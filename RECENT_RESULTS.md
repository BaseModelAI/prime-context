# Most Recent Benchmark Results

_Snapshot generated 2026-09-03T22:21:13.969163+00:00._

The Prime Agent pair below is the completed cross-run publication set accepted under the targeted-replacement policy. v19 supplies unaffected task evidence; clean targeted runs replace Tasks 7, 8, 13, 16, and 27–30. Prime Context strictly passes all 30 tasks, wins time and cost on every both-pass Prime Agent pair, and has a correctness win on Task 30 where stock Prime Agent failed both attempts. The separately recorded pure vanilla Codex CLI baseline is reported after the original publication metrics.

- **t7-r2**: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-targeted-task07-replacement2` (completed clean Task 7 replacement)
- **t7-13**: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-targeted-task07-13-replacement` (completed clean Task 13 replacement; superseded Task 7 comparison)
- **gate20**: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-postfix-gate-task08-16-27-30` (completed clean post-fix targeted gate)
- **v19-base**: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v19-invalid-task08-rebook-contract-parent-scope-tool` (completed all-30 base; Task 8 row invalidated and superseded, unaffected rows retained)
- **v18\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v18-invalid-task13-causal-anchor-contract` (invalidated interrupted run)
- **v17-T16-g1\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-task16-gate1` (invalidated targeted Task 16 comparison)
- **v17-T29-g1\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-task29-gate1` (invalidated targeted Task 29 comparison)
- **v17\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v17` (invalidated completed run)
- **v16\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v16-invalid-task28-contract-task23-selected-cost-variance` (invalidated historical run)
- **v13\***: `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v13-invalid-task27-30-stage-contract-task28-edge-fixture` (invalidated historical run)
- Prime Agent-pair metrics are selected-attempt agent wall time and billed API cost. `A2` means the selected result came from the one allowed retry.
- `PASS 5/5 + edge` is the strict correctness requirement.

## Per-task results

| Task | Task name | Source | Current selected result | Vanilla selected result | Latest complete-pair outcome |
|---:|---|:---:|---|---|---|
| 1 | Expense Reconciliation | v19-base | PASS 5/5 + edge; 64.208 s; $0.151272; A1 | PASS 5/5 + edge; 88.628 s; $0.191352; A1 | Current strict win |
| 2 | Calendar Merge | v19-base | PASS 5/5 + edge; 95.797 s; $0.225840; A1 | PASS 5/5 + edge; 130.701 s; $0.282953; A2 | Current strict win |
| 3 | Mailbox Cleanup | v19-base | PASS 5/5 + edge; 161.017 s; $0.317084; A1 | PASS 5/5 + edge; 200.352 s; $0.486379; A1 | Current strict win |
| 4 | Invoice Payment Matching | v19-base | PASS 5/5 + edge; 62.238 s; $0.163002; A1 | PASS 5/5 + edge; 73.125 s; $0.191228; A1 | Current strict win |
| 5 | Inventory Reorder | v19-base | PASS 5/5 + edge; 183.746 s; $0.403290; A1 | PASS 5/5 + edge; 221.428 s; $0.738690; A1 | Current strict win |
| 6 | Volunteer Shift Rescheduling | v19-base | PASS 5/5 + edge; 218.052 s; $0.596706; A2 | PASS 5/5 + edge; 291.461 s; $0.681300; A1 | Current strict win |
| 7 | Utility Anomaly Report | t7-r2 | PASS 5/5 + edge; 72.513 s; $0.147380; A1 | PASS 5/5 + edge; 82.442 s; $0.423413; A1 | Current strict win |
| 8 | Travel Itinerary Repair | gate20 | PASS 5/5 + edge; 134.824 s; $0.279192; A1 | PASS 5/5 + edge; 158.974 s; $0.397872; A1 | Current strict win |
| 9 | Support Sla Event Analysis | v19-base | PASS 5/5 + edge; 99.654 s; $0.220110; A1 | PASS 5/5 + edge; 117.451 s; $0.335390; A1 | Current strict win |
| 10 | Local Supplier Catalog Crawler | v19-base | PASS 5/5 + edge; 90.536 s; $0.230206; A1 | PASS 5/5 + edge; 119.189 s; $0.273957; A1 | Current strict win |
| 11 | Sqlite Crm Migration | v19-base | PASS 5/5 + edge; 137.522 s; $0.289281; A1 | PASS 5/5 + edge; 161.618 s; $0.361366; A1 | Current strict win |
| 12 | Webhook Receiver Replay | v19-base | PASS 5/5 + edge; 156.313 s; $0.387368; A1 | PASS 5/5 + edge; 210.449 s; $0.511644; A1 | Current strict win |
| 13 | Cross Service Incident Timeline | t7-13 | PASS 5/5 + edge; 950.211 s; $1.031715; A1 | PASS 5/5 + edge; 1005.521 s; $1.842924; A1 | Current strict win |
| 14 | Layered Configuration Upgrade | v19-base | PASS 5/5 + edge; 112.863 s; $0.280096; A1 | PASS 5/5 + edge; 160.284 s; $0.378172; A1 | Current strict win |
| 15 | Backup Restore Planner | v19-base | PASS 5/5 + edge; 82.124 s; $0.173623; A1 | PASS 5/5 + edge; 123.074 s; $0.263608; A1 | Current strict win |
| 16 | Markdown Kb Repair | gate20 | PASS 5/5 + edge; 238.252 s; $0.624723; A1 | PASS 5/5 + edge; 317.651 s; $0.788675; A1 | Current strict win |
| 17 | Contract Clause Index | v19-base | PASS 5/5 + edge; 180.152 s; $0.434730; A1 | PASS 5/5 + edge; 258.511 s; $0.618257; A1 | Current strict win |
| 18 | Research Note Search | v19-base | PASS 5/5 + edge; 143.167 s; $0.275255; A1 | PASS 5/5 + edge; 222.598 s; $0.420516; A1 | Current strict win |
| 19 | Sensor Resampling | v19-base | PASS 5/5 + edge; 140.381 s; $0.203036; A1 | PASS 5/5 + edge; 170.955 s; $0.478258; A1 | Current strict win |
| 20 | Time Of Use Energy Billing | v19-base | PASS 5/5 + edge; 132.839 s; $0.284899; A1 | PASS 5/5 + edge; 248.162 s; $0.536652; A1 | Current strict win |
| 21 | Wav Interview Chapters | v19-base | PASS 5/5 + edge; 135.565 s; $0.284030; A1 | PASS 5/5 + edge; 166.400 s; $0.353788; A1 | Current strict win |
| 22 | Timesheet Payroll Correction | v19-base | PASS 5/5 + edge; 217.390 s; $0.476618; A1 | PASS 5/5 + edge; 252.982 s; $0.575728; A1 | Current strict win |
| 23 | Procurement Three Way Match | v19-base | PASS 5/5 + edge; 243.017 s; $0.619487; A1 | PASS 5/5 + edge; 316.910 s; $0.754071; A1 | Current strict win |
| 24 | Multi Warehouse Fulfillment | v19-base | PASS 5/5 + edge; 282.657 s; $0.648099; A1 | PASS 5/5 + edge; 319.894 s; $0.911798; A1 | Current strict win |
| 25 | Library Circulation Reconstruction | v19-base | PASS 5/5 + edge; 230.661 s; $0.555395; A1 | PASS 5/5 + edge; 274.137 s; $0.579766; A1 | Current strict win |
| 26 | School Meal Allergen Stock Plan | v19-base | PASS 5/5 + edge; 108.945 s; $0.229904; A1 | PASS 5/5 + edge; 150.733 s; $0.332304; A1 | Current strict win |
| 27 | Clinic Appointment Rescheduling | gate20 | PASS 5/5 + edge; 430.549 s; $1.008135; A2 | PASS 5/5 + edge; 456.494 s; $1.105473; A1 | Current strict win |
| 28 | Permit Intake Status Pipeline | gate20 | PASS 5/5 + edge; 287.547 s; $0.701376; A1 | PASS 5/5 + edge; 420.704 s; $1.207390; A1 | Current strict win |
| 29 | Legacy Budgeting Cli Repair | gate20 | PASS 5/5 + edge; 272.815 s; $0.656941; A1 | PASS 5/5 + edge; 330.506 s; $0.829247; A1 | Current strict win |
| 30 | Helpdesk Service Upgrade | gate20 | PASS 5/5 + edge; 506.510 s; $1.334545; A1 | FAIL 4/5 + edge; 616.133 s; $1.661436; A2 (A1 also failed) | Current correctness win — vanilla failed |

## Publication metrics

Publication status: **ready under the user-approved targeted-replacement protocol**.

- Configuration: fully isolated `prime-agent` 0.9.1 versus npm-installed `prime-agent-context` 9.1.1 plus its host patch; `openai-codex/gpt-5.6-sol`; medium thinking; maximum concurrency 6.
- Correctness: current **30/30 strict passes**; vanilla **29/30 strict passes**. Task 30 is a decisive current correctness win because vanilla failed both allowed attempts while current passed 5/5 plus edge.
- Both-pass comparisons: **29/29 current time wins** and **29/29 current billed-cost wins**.
- Comparable 29-task selected totals: current **5665.556 s / $11.898793**; vanilla **7051.335 s / $16.852171**. Current saves **1385.779 s (19.65%)** and **$4.953378 (29.39%)**.
- All-30 selected totals, including failed vanilla Task 30: current **6172.066 s / $13.233338**; vanilla **7667.468 s / $18.513607**.
- Retry-inclusive retained totals: current **6841.572 s / $15.053094 across 32 attempts**; vanilla **8485.818 s / $20.892213 across 32 attempts**.
- Billed API cost is authoritative. Provider tokens remain diagnostic.
- Evidence sources: v19-base for 22 unaffected tasks; t7-r2 for Task 7; gate20 for Tasks 8, 16, and 27–30; t7-13 for Task 13.
- Final validation: corpus valid (30 tasks); harness 4/4; product tests 110/110; Python compile, TypeScript typecheck/build, Prime Agent 0.9.1 package smoke with `/usr/bin/bash`, and `git diff --check` all passed.

## Supplemental pure vanilla Codex CLI

_Run completed 2026-09-04T16:31:22.761980+00:00._

- Raw local run: `benchmarks/python-realworld-30/results/20260904-codex0153-gpt56sol-all30-v1`.
- Persisted curated raw evidence: `benchmarks/python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1`.
- Configuration: installed stock `codex-cli 0.153.0`; ChatGPT subscription authentication; `gpt-5.6-sol`; medium effort; maximum concurrency 6; stock `workspace-write` sandbox with exact `127.0.0.1` command-proxy access only.
- Isolation: no Prime Agent or Prime Context; no API-key environment; no custom system/developer prompt; no global or local `AGENTS.md`, `AGENTS.override.md`, or Codex config file loaded; benchmark user messages on stdin; fresh `/tmp` workspaces and empty isolated `HOME`. Stock Codex built-in base, developer, skill, collaboration, recommended-plugin, and environment context remained because this is the vanilla CLI baseline.
- Correctness: **30/30 strict passes**, **150/150 main checks**, and **30/30 edge checks**. Every task passed A1, so no retry ran.
- Selected agent wall time: **10,338.905 s**. Six-worker elapsed run time: **2,293.349 s**.
- Actual billed API cost: **N/A**. The CLI used a ChatGPT subscription and exposes no per-run charge.
- Same-rate API equivalent: **$31.447008**, diagnostic only and not a bill.
- Subscription telemetry: **22,839,654 input**, **21,638,656 cached input**, **0 cache-write input**, **487,423 output**, and **23,327,077 provider tokens**. Reasoning output is a **149,589-token subset** of output.
- Codex staged turns: **69**. Underlying model API-call count is not exposed and is not compared with Prime Agent model calls.
- Prime Context versus Codex: both strictly passed all 30; Prime Context was faster **29/30**, using **6,172.066 s** versus **10,338.905 s**, or **4,166.839 s (40.30%) less**. Codex won Task 13. Prime Context used **81.998% fewer diagnostic provider tokens**.
- Stock Prime Agent versus Codex: Codex won correctness on Task 30, where stock Prime Agent failed both attempts. Across the other 29 strict pairs, stock Prime Agent was faster **28/29**, using **7,051.335 s** versus **9,400.628 s**, or **24.99% less**. Codex won Task 13.
- Timing is supplemental because the Codex run was independent rather than contemporaneously paired. No Codex billed-cost wins or losses are claimed.
- Validation: all 69 public JSONL turns completed; no malformed output, selected error, usage mismatch, external command URL, package installation, or instruction-path leak; corpus valid; harness 6/6; product tests 110/110; Python compile, typecheck, build, and diff checks passed.

See [`BENCHMARKS.md`](BENCHMARKS.md) for all 30 Codex rows, the isolation method, comparison rules, and evidence map.
