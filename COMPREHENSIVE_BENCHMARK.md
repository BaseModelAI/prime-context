# Comprehensive Prime Context 8.1.0 Benchmark

> Full-corpus isolated Docker comparison of `prime-context 8.1.0` and `vanilla prime-agent` across all 30 realistic staged coding tasks.

## Aggregate summary

`prime-context 8.1.0` met every acceptance criterion on **27/30 tasks**; `vanilla prime-agent` did so on **19/30 tasks**. There were **8 strict correctness gains** and **0 strict correctness losses** for `prime-context 8.1.0`.

The **19 matched-correct pairs** form the formal efficiency cohort. Raw metrics remain reported for every other pair, but resource use does not override failed acceptance.

| Correctness measure | vanilla prime-agent | prime-context 8.1.0 | Paired interpretation |
|---|---:|---:|---|
| Tasks meeting every acceptance criterion | 19 / 30 | 27 / 30 | +8 tasks |
| Strict completion rate | 63.33% | 90.00% | +26.67 pp |
| Correctness gains | — | 8 | 5, 7, 12, 17, 18, 19, 25, 29 |
| Correctness losses | — | 0 | none |
| Matched-correct pairs | 19 | 19 | formal efficiency cohort |

### Whole-corpus workload totals

These totals include all 30 jobs per variant, including any timeout or failed-acceptance work. They measure the resources spent attempting the complete corpus.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 13,830.06 s | 9,232.31 s | -4,597.75 s | -33.24% |
| Lifecycle wall time | 13,841.77 s | 9,243.13 s | -4,598.64 s | -33.22% |
| Model calls | 1,029 | 498 | -531 | -51.60% |
| Tool calls | 589 | 490 | -99 | -16.81% |
| Tool results | 589 | 489 | -100 | -16.98% |
| Visible tool bytes | 4,441,740 | 6,242,019 | +1,800,279 | +40.53% |
| Compactions | 240 | 150 | -90 | -37.50% |
| Input tokens | 3,472,478 | 2,179,204 | -1,293,274 | -37.24% |
| Output tokens | 240,667 | 161,935 | -78,732 | -32.71% |
| Cache-read tokens | 6,304,256 | 2,761,216 | -3,543,040 | -56.20% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 10,017,401 | 5,102,355 | -4,915,046 | -49.07% |
| Prompt-cache reuse | 64.48% | 55.89% | -8.59 pp | — |
| Total API cost | $27.734528 | $17.134678 | -10.599850 | -38.22% |

- **All-task wall time:** 9,232.31 s vs 13,830.06 s; Δ -4,597.75 s (-33.24%).
- **All-task model calls:** 498 vs 1,029; Δ -531 (-51.60%).
- **All-task tool calls:** 490 vs 589; Δ -99 (-16.81%).
- **All-task compactions:** 150 vs 240; Δ -90 (-37.50%).
- **All-task total tokens:** 5,102,355 vs 10,017,401; Δ -4,915,046 (-49.07%).
- **All-task reported API cost:** $17.134678 vs $27.734528; Δ -10.599850 (-38.22%).

### Matched-correct efficiency totals

Only task pairs where both variants meet all acceptance criteria appear in this formal efficiency cohort.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 7,230.05 s | 5,626.09 s | -1,603.96 s | -22.18% |
| Lifecycle wall time | 7,236.59 s | 5,632.85 s | -1,603.75 s | -22.16% |
| Model calls | 419 | 333 | -86 | -20.53% |
| Tool calls | 365 | 321 | -44 | -12.05% |
| Tool results | 365 | 321 | -44 | -12.05% |
| Visible tool bytes | 2,627,773 | 3,996,760 | +1,368,987 | +52.10% |
| Compactions | 120 | 100 | -20 | -16.67% |
| Input tokens | 1,691,530 | 1,432,628 | -258,902 | -15.31% |
| Output tokens | 150,236 | 109,483 | -40,753 | -27.13% |
| Cache-read tokens | 2,214,912 | 1,911,808 | -303,104 | -13.68% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 4,056,678 | 3,453,919 | -602,759 | -14.86% |
| Prompt-cache reuse | 56.70% | 57.16% | +0.46 pp | — |
| Total API cost | $14.072186 | $11.403534 | -2.668652 | -18.96% |

### Success-adjusted workload

This view divides total whole-corpus consumption by the number of strict completions. It does not replace the paired comparison; it describes the cost of obtaining a successful corpus outcome.

| Success-adjusted measure | vanilla prime-agent | prime-context 8.1.0 | Relative change |
|---|---:|---:|---:|
| Task-seconds per strict completion | 727.90 s | 341.94 s | -53.02% |
| Model calls per strict completion | 54.16 | 18.44 | -65.94% |
| Tokens per strict completion | 527,231.63 | 188,976.11 | -64.16% |
| API cost per strict completion | $1.459712 | $0.634618 | -56.52% |

### Direction across individual tasks

All 30 task pairs:

| Metric | prime-context 8.1.0 lower | equal | prime-context 8.1.0 higher |
|---|---:|---:|---:|
| Wall time | 23 | 0 | 7 |
| Model calls | 27 | 0 | 3 |
| Tool calls | 21 | 4 | 5 |
| Tool results | 21 | 4 | 5 |
| Visible tool bytes | 10 | 0 | 20 |
| Compactions | 22 | 0 | 8 |
| Total tokens | 25 | 0 | 5 |
| API cost | 29 | 0 | 1 |

Matched-correct pairs only:

| Metric | prime-context 8.1.0 lower | equal | prime-context 8.1.0 higher |
|---|---:|---:|---:|
| Wall time | 15 | 0 | 4 |
| Model calls | 17 | 0 | 2 |
| Tool calls | 16 | 1 | 2 |
| Tool results | 16 | 1 | 2 |
| Visible tool bytes | 6 | 0 | 13 |
| Compactions | 12 | 0 | 7 |
| Total tokens | 15 | 0 | 4 |
| API cost | 18 | 0 | 1 |

### Aggregate acceptance gates

| Acceptance aggregate | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|
| Meets all acceptance criteria | 19 / 30 | 27 / 30 |
| Runner task-completed gate | 19 / 30 | 27 / 30 |
| External verifier tests passed | 261/261 | 255/255 |
| External-tests gate | 27 / 30 | 28 / 30 |
| Protected files unchanged | 27 / 30 | 29 / 30 |
| Goal status complete | 19 / 30 | 27 / 30 |
| Goal completed after lock | 19 / 30 | 27 / 30 |
| Interventions accepted | 30 / 30 | 30 / 30 |
| Intervention order correct | 20 / 30 | 29 / 30 |
| Exact final response | 19 / 30 | 27 / 30 |
| No early completion | 30 / 30 | 30 / 30 |
| Goal-complete event observed | 19 / 30 | 27 / 30 |
| No run error | 19 / 30 | 27 / 30 |
| Docker evidence retained | 30 / 30 | 30 / 30 |

### Complete whole-corpus scalar totals

This table includes every common numeric field used in the repeated per-task schema. Additive counters are summed. Prompt-cache reuse is recomputed as a weighted ratio. The two cumulative goal-budget maxima are aggregated with `max`, not summed. Instruction wall time is shown explicitly even though it normally aliases wall time.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 13,830.06 s | 9,232.31 s | -4,597.75 s | -33.24% |
| Lifecycle wall time | 13,841.77 s | 9,243.13 s | -4,598.64 s | -33.22% |
| Instruction wall time | 13,830.06 s | 9,232.31 s | -4,597.75 s | -33.24% |
| Sessions | 30 | 30 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 1,029 | 498 | -531 | -51.60% |
| Tool calls | 589 | 490 | -99 | -16.81% |
| Tool results | 589 | 489 | -100 | -16.98% |
| Visible tool bytes | 4,441,740 | 6,242,019 | +1,800,279 | +40.53% |
| Compactions | 240 | 150 | -90 | -37.50% |
| Goal-context injections | 558 | 114 | -444 | -79.57% |
| Assistant output events | 1,026 | 497 | -529 | -51.56% |
| Interventions delivered | 137 | 147 | +10 | +7.30% |
| Stage responses recorded | 287 | 212 | -75 | -26.13% |
| Test-run observations | 131 | 146 | +15 | +11.45% |
| Goal updates | 1,584 | 607 | -977 | -61.68% |
| RPC compaction completions | 242 | 150 | -92 | -38.02% |
| Compaction requests | 100 | 62 | -38 | -38.00% |
| Compaction waits | 50 | 3 | -47 | -94.00% |
| Accepted stage/command responses | 226 | 190 | -36 | -15.93% |
| Rejected stage/command responses | 61 | 22 | -39 | -63.93% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 100 | 108 | +8 | +8.00% |
| Failing observed test runs | 31 | 38 | +7 | +22.58% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 1,565 | 580 | -985 | -62.94% |
| Complete goal updates | 19 | 27 | +8 | +42.11% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 76 | 13 | -63 | -82.89% |
| Maximum goal tokens used | 226,380 | 149,508 | -76,872 | -33.96% |
| Completed RPC compactions | 242 | 150 | -92 | -38.02% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 39 | 40 | +1 | +2.56% |
| Failed compaction requests | 61 | 22 | -39 | -63.93% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 50 | 3 | -47 | -94.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 3,472,478 | 2,179,204 | -1,293,274 | -37.24% |
| Output tokens | 240,667 | 161,935 | -78,732 | -32.71% |
| Cache-read tokens | 6,304,256 | 2,761,216 | -3,543,040 | -56.20% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 10,017,401 | 5,102,355 | -4,915,046 | -49.07% |
| Prompt-cache reuse | 64.48% | 55.89% | -8.59 pp | — |
| Input cost | $17.362390 | $10.896020 | -6.466370 | -37.24% |
| Output cost | $7.220010 | $4.858050 | -2.361960 | -32.71% |
| Cache-read cost | $3.152128 | $1.380608 | -1.771520 | -56.20% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $27.734528 | $17.134678 | -10.599850 | -38.22% |

### Complete archive and projection aggregate

Archive counters are summed except largest chunk and end-state projected-view bytes, which use the maximum task value. Compression is a source-byte-weighted ratio. `vanilla prime-agent` does not load Prime Context, so its archive fields are zero/not applicable.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 462 | +462 | n/a (zero baseline) |
| Archive source bytes | 0 | 5,607,561 | +5,607,561 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 547,722 | +547,722 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 9.77% | +9.77 pp | — |
| Archive chunks | 0 | 657 | +657 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,949 | +65,949 | n/a (zero baseline) |
| Source bytes admitted | 0 | 12,036,673 | +12,036,673 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 46,715 | +46,715 | n/a (zero baseline) |
| Result bytes projected out | 0 | 5,549,984 | +5,549,984 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 45,956 | +45,956 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 11,226,415 | +11,226,415 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 179 | +179 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 2,761,216 | +2,761,216 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 2,179,204 | +2,179,204 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 333 | +333 | n/a (zero baseline) |

## Task-level headline index

| Task | vanilla prime-agent | prime-context 8.1.0 | vanilla prime-agent wall | prime-context 8.1.0 wall | vanilla prime-agent tokens | prime-context 8.1.0 tokens | vanilla prime-agent cost | prime-context 8.1.0 cost |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| [01. Parcel Rate Optimizer](#task-01) | meets all acceptance criteria | meets all acceptance criteria | 157.15 s | 166.03 s | 175,365 | 135,664 | $0.484047 | $0.352514 |
| [02. Three-Way JSON Merge Service](#task-02) | meets all acceptance criteria | meets all acceptance criteria | 525.24 s | 336.37 s | 347,893 | 178,876 | $1.140728 | $0.654646 |
| [03. Incremental Spreadsheet Engine](#task-03) | meets all acceptance criteria | meets all acceptance criteria | 419.97 s | 297.55 s | 180,062 | 163,114 | $0.756154 | $0.534903 |
| [04. Heat Diffusion Plate](#task-04) | does not meet all acceptance criteria | does not meet all acceptance criteria | 600.00 s | 600.00 s | 518,401 | 116,687 | $1.193809 | $0.438709 |
| [05. Binary Telemetry Frame Codec](#task-05) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 285.44 s | 681,005 | 176,066 | $1.400606 | $0.580986 |
| [06. Decimal Cash-Flow Mathematics](#task-06) | meets all acceptance criteria | meets all acceptance criteria | 422.14 s | 278.74 s | 178,731 | 187,893 | $0.724973 | $0.622397 |
| [07. PGM Region Analyzer](#task-07) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 289.06 s | 471,827 | 178,699 | $1.135424 | $0.583840 |
| [08. Exact Gear-Train Constraint Solver](#task-08) | meets all acceptance criteria | meets all acceptance criteria | 502.60 s | 254.27 s | 238,931 | 174,703 | $0.875409 | $0.499273 |
| [09. Streaming Signal Analysis](#task-09) | meets all acceptance criteria | meets all acceptance criteria | 281.53 s | 188.15 s | 212,777 | 139,483 | $0.641974 | $0.435337 |
| [10. Polyphonic Rhythm Quantizer](#task-10) | meets all acceptance criteria | meets all acceptance criteria | 348.83 s | 537.30 s | 195,624 | 280,478 | $0.715811 | $0.996553 |
| [11. Versioned Record Migration Engine](#task-11) | meets all acceptance criteria | meets all acceptance criteria | 451.38 s | 515.91 s | 205,187 | 231,685 | $0.876317 | $0.834085 |
| [12. Transit Fare Settlement Engine](#task-12) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 213.00 s | 668,426 | 134,819 | $1.408157 | $0.445102 |
| [13. Correctable League Standings](#task-13) | meets all acceptance criteria | meets all acceptance criteria | 489.13 s | 312.97 s | 215,589 | 212,567 | $0.749853 | $0.729285 |
| [14. Bank Deposit Reconciler](#task-14) | meets all acceptance criteria | meets all acceptance criteria | 535.12 s | 350.12 s | 258,947 | 213,069 | $0.949759 | $0.667483 |
| [15. Hierarchical Authorization Engine](#task-15) | does not meet all acceptance criteria | does not meet all acceptance criteria | 600.00 s | 600.00 s | 232,315 | 280,056 | $1.012801 | $0.982738 |
| [16. Subscription Invoice Generator](#task-16) | meets all acceptance criteria | meets all acceptance criteria | 521.66 s | 304.05 s | 228,307 | 178,984 | $0.896637 | $0.650167 |
| [17. Authoritative DNS Zone Compiler](#task-17) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 244.28 s | 414,218 | 152,290 | $1.224414 | $0.568291 |
| [18. Deterministic DNA Alignment](#task-18) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 230.88 s | 650,984 | 132,626 | $1.351497 | $0.476718 |
| [19. Union Payroll Calculator](#task-19) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 214.10 s | 559,371 | 110,822 | $1.240744 | $0.510930 |
| [20. Constraint-Aware Dependency Lock Resolver](#task-20) | meets all acceptance criteria | meets all acceptance criteria | 439.47 s | 408.47 s | 232,625 | 217,647 | $0.853665 | $0.845457 |
| [21. Dependency-Aware Build Planner](#task-21) | meets all acceptance criteria | meets all acceptance criteria | 268.59 s | 254.44 s | 164,858 | 170,633 | $0.535327 | $0.521197 |
| [22. Committee Seat Apportionment](#task-22) | meets all acceptance criteria | meets all acceptance criteria | 217.30 s | 199.18 s | 195,757 | 148,060 | $0.576938 | $0.443049 |
| [23. Content Routing Engine](#task-23) | does not meet all acceptance criteria | does not meet all acceptance criteria | 600.00 s | 600.00 s | 268,083 | 46,586 | $0.854767 | $0.177921 |
| [24. Event-Time Window Counter](#task-24) | meets all acceptance criteria | meets all acceptance criteria | 225.93 s | 272.11 s | 218,084 | 174,021 | $0.581138 | $0.513844 |
| [25. Feature Flag Evaluator](#task-25) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 189.30 s | 652,241 | 171,187 | $1.254112 | $0.491212 |
| [26. Layered Configuration Merger](#task-26) | meets all acceptance criteria | meets all acceptance criteria | 471.62 s | 300.70 s | 235,089 | 178,753 | $0.872520 | $0.655136 |
| [27. Ranked-Choice Election Tabulator](#task-27) | meets all acceptance criteria | meets all acceptance criteria | 194.75 s | 174.87 s | 175,220 | 148,002 | $0.462174 | $0.392328 |
| [28. Stock Reservation Engine](#task-28) | meets all acceptance criteria | meets all acceptance criteria | 405.73 s | 185.49 s | 194,460 | 130,366 | $0.666952 | $0.420102 |
| [29. Trip Expense Settlement](#task-29) | does not meet all acceptance criteria | meets all acceptance criteria | 600.00 s | 140.15 s | 843,852 | 148,598 | $1.586011 | $0.474697 |
| [30. Webhook Delivery Scheduler](#task-30) | meets all acceptance criteria | meets all acceptance criteria | 351.92 s | 289.36 s | 203,172 | 189,921 | $0.711810 | $0.635778 |

Task shortcuts: [01](#task-01) · [02](#task-02) · [03](#task-03) · [04](#task-04) · [05](#task-05) · [06](#task-06) · [07](#task-07) · [08](#task-08) · [09](#task-09) · [10](#task-10) · [11](#task-11) · [12](#task-12) · [13](#task-13) · [14](#task-14) · [15](#task-15) · [16](#task-16) · [17](#task-17) · [18](#task-18) · [19](#task-19) · [20](#task-20) · [21](#task-21) · [22](#task-22) · [23](#task-23) · [24](#task-24) · [25](#task-25) · [26](#task-26) · [27](#task-27) · [28](#task-28) · [29](#task-29) · [30](#task-30)

## Methodology

### Compared variants

- **`vanilla prime-agent`:** Prime Agent 0.8.1 with the benchmark host compatibility patch, no Prime Context package, no external custom prompt overlay, and no `AGENTS.md` mounted into the run configuration.
- **`prime-context 8.1.0`:** the same patched Prime Agent host plus Prime Context 8.1.0. No external benchmark `AGENTS.md` or prompt overlay was mounted. Prime Context's bundled global system policy remained enabled because it is shipped product behavior in 8.1.0.
- Both variants used the same host patch, model, task fixtures, staged interventions, verifier, timeout, network controls, and runner lifecycle.
- Package configuration audits showed an empty package list for `vanilla prime-agent` and `/opt/prime-context` only for `prime-context 8.1.0`.

### Execution protocol

- **Corpus:** all 30 deterministic realistic tasks; no sampling and no exclusions.
- **Jobs:** 60 total, one adjacent pair per task.
- **Maximum concurrency:** 4 Docker jobs; observed active benchmark-agent count never exceeded four.
- **Provider/model:** `openai-codex/gpt-5.6-sol`.
- **Reasoning effort:** `medium`.
- **Per-job timeout:** 600 seconds, starting immediately before the initial task instruction.
- **Prime Context source commit:** `e7920159eb7883cbbb24528f386e11fdf92f3937`; the packaged version was 8.1.0.
- **Campaign elapsed time:** 5,898.70 seconds (1.64 hours) with four-wide execution.
- **Execution date (UTC):** 2026-08-30.
- **Execution host:** Linux 7.0.0-30-generic on x86_64; Intel(R) Core(TM) Ultra 9 275HX; 24 logical CPUs; 188.1 GiB RAM; Docker 29.1.3.
- **Queue:** task order 1 through 30, with `vanilla prime-agent` then `prime-context 8.1.0` for each task in the submitted queue.
- **Isolation:** per-arm work tree, home, config, session tree, daemon socket, and Prime Context storage; internal Docker networks with the runner's controlled provider relay.
- **Dependencies:** task implementations were restricted to the Python standard library.
- **Evidence:** completed containers, networks, RPC events, stderr, sessions, verifier output, metadata, and result files were retained through pair analysis. The local raw run directory is intentionally not published.
- **Code changes during benchmark:** none. The run was observation-only with respect to product and runner code.

### Strict acceptance rule

A variant **meets all acceptance criteria** only when all of the following hold:

1. the external cumulative suite produces the exact expected pass count;
2. protected task and test files remain unchanged;
3. every staged intervention is accepted in order;
4. the active goal remains open until `REQUIREMENTS LOCKED` and completes afterward;
5. there is no early completion or run error;
6. the model emits the exact required final response.

The runner's `task_completed` gate covers items 1–5. Strict correctness adds item 6. A timeout or any missing condition means the variant **does not meet all acceptance criteria**, regardless of partial test success or lower resource use.

### Repeated metric schema

Every task uses the same schema without cherry-picking:

- all acceptance and lifecycle gates;
- **49 common scalar metrics** covering timing, recursive sessions/calls/tools, visible output, compaction, command responses, observed test runs, goal lifecycle, tokens, cache use, and itemized cost;
- **20 archive/projection metrics**, including the one derived weighted compression ratio.

Signed deltas are always `prime-context 8.1.0 − vanilla prime-agent`. A negative resource delta means less resource use, but resource deltas are formal efficiency evidence only for matched-correct pairs. `visible_tool_bytes` counts visible text in tool-result messages. Prompt-cache reuse is `cacheRead / (input + cacheRead + cacheWrite)`. Provider-reported costs are not independently repriced.

### Metric glossary

- **Wall time:** model/tool instruction interval from initial prompt delivery until terminal instruction handling or the 600-second deadline.
- **Lifecycle wall time:** wall time plus daemon/container shutdown, excluding the external verifier.
- **Instruction wall time:** the interaction recorder's independent copy of wall time; retained to expose every captured scalar timing field.
- **Sessions and child sessions:** unique recursive Prime Agent sessions and the subset below the root session.
- **Model calls:** recursive provider calls across all collected sessions.
- **Tool calls / tool results:** recursive tool request and result message counts.
- **Visible tool bytes:** UTF-8 bytes of visible textual tool-result content. It is not archive size and is not a correctness measure.
- **Compactions:** recursive successful compaction events. **Goal-context injections** count persisted active-goal context messages.
- **Assistant output, intervention, response, test-run, goal-update, and compaction lifecycle counts:** root-session protocol events retained by the staged runner. Accepted/rejected/unanswered and pass/fail/error rows are derived without discarding the raw records.
- **Maximum goal continuations/tokens:** maxima across cumulative goal snapshots within one task; global tables use the maximum task value rather than summing snapshots.
- **Input/output/cache-read/cache-write/total tokens:** recursive provider usage reported by Prime Agent. Total tokens use the provider/runtime total rather than an independently reconstructed approximation.
- **Prompt-cache reuse:** cache-read tokens divided by input + cache-read + cache-write tokens; global values are weighted from summed token counts.
- **Itemized and total API cost:** provider/runtime-reported recursive cost. No external repricing is applied.
- **Archive source/compressed bytes and chunks:** exact Prime Context local observation-store measurements. Compression ratio is compressed/source bytes, weighted by source bytes globally.
- **Source bytes admitted:** source volume admitted through archive accounting; it is a distinct collector field from archive source bytes.
- **Projected-out bytes:** call arguments, results, or typed/media data omitted from provider-visible history while retained locally.
- **Recovery bytes and inspect/recall hits:** exact archived evidence exposed through bounded recovery and successful inspection/recall operations.
- **End-state projected model-view bytes:** the task's final projected-view gauge; the global value is the maximum task gauge, not a sum.
- **Streaming bytes, fold generations, branch-runtime reloads, and stable-projection extension turns:** internal projection/runtime work and reuse counters.
- **Prime Context cache-read/cache-write/uncached input tokens:** extension status telemetry, reported separately from the runner's recursive usage totals.

### Interpretation limits

- This is one complete corpus run with one model, one reasoning level, one host version, and one execution date. It is project evidence, not a universal statistical claim.
- Four-wide execution introduces shared-machine and provider timing variance; summed task-seconds are workload totals, not campaign wall-clock time.
- The tasks are deterministic and realistic but synthetic. They emphasize long staged coding workflows, compaction boundaries, exact tests, protected files, and exact terminal responses.
- `lifecycle_wall_seconds` extends through daemon/container shutdown but excludes the post-run external verifier; `wall_seconds` measures the instruction interval.
- Intermediate observed test runs are workflow diagnostics and are not summed into the final external verifier pass ratio.
- Archive telemetry is applicable to `prime-context 8.1.0`; zero archive fields for `vanilla prime-agent` mean the extension is absent, not a zero-byte Prime Context archive operation.
- Source requirement prose contains a small number of underspecified edges. The staged files and supplied tests jointly define the visible benchmark contract; notes appear below.

## Fixture interpretation notes

- **Editorial domain labels:** `scenario.json` has no formal domain field. Domain labels in this report are inferred from each task title and staged specification.

### Tasks 01–08

These are underspecified edges, not extra acceptance requirements:

- **01:** It is not explicit whether `max_weight_g` continues to limit actual weight or instead limits dimensional/billable weight after the pivot; malformed-input validation is mostly unspecified.
- **02:** Rules for duplicate/missing entity IDs, nested entity configurations, invalid resolution entries, and root-path conflicts/patches are not stated.
- **03:** Exact cell-address grammar and several parser/goal-seek termination edge cases are unstated; formula-cell scenario overrides are not explicitly discussed.
- **04:** `alpha <= 1/4` is retained even though no additional stability bound is stated for conductivities above 1; some constructor/coercion details are unstated.
- **05:** The boundary between terminal garbage and an incomplete magic/header prefix at `finish()` is not fully defined; accepted payload bytes-like types are unstated.
- **06:** Decimal context/precision, non-finite Decimal handling, and whether booleans count as integers are unspecified.
- **07:** The exact P5 raster boundary with CRLF or extra post-`maxval` whitespace is potentially ambiguous; threshold validation and trailing P2 token handling are unstated.
- **08:** The namespace for planetary names, whether planetary tooth arguments must match declared gear teeth, and boolean-as-integer validation are unstated.

### Tasks 09–16

- Task 11 requires a stable lenient error `code`, but neither the prose nor visible tests defines the exact code vocabulary; the visible failure assertion fixes only `path` as `/age`.
- Task 12 defines peak windows as half-open. Its boundary test checks the inclusive lower endpoint (07:00), not the exclusive upper endpoint.
- Task 14 requires a lexical sorted bundle signature but does not specify a separate serialization format; the tests demonstrate sorted IDs and output examples.
- Task 16's steering phrase “stable invoice lines” is not independently defined; segment and line ordering comes from the pivot prose and tests.
- Each complete suite contains nine example tests (three per stage). Some additional validation rules in the requirement prose are acceptance requirements even when no visible example test isolates them.

### Tasks 17–23

1. **Task 19 staged schema leakage:** the initial prose only names regular hours, overtime hours, and gross in each employee row, while `initial/tests/test_base.py` already requires `doubletime_hours: "0.00"` and `differential: "0.00"`. Those fields are otherwise introduced by the pivot. A comprehensive benchmark description should treat the base-test row shape as locked behavior.
2. **Task 20 wildcard constraint:** the initial syntax list names only comparison operators, but `followup/tests/test_followup.py` uses `"*"` as an unconstrained dependency/requirement and expects it to work. This behavior is test-required but not explicitly documented in `TASK.md` or `FOLLOWUP.md`.
3. **Task 20 unknown-feature exception:** `FOLLOWUP.md` says to reject features absent from a selected version without naming the exception class; the follow-up test specifically expects `ResolutionError`.

## Detailed results for all 30 tasks

Each section contains the task definition, steering constraint, pivot, follow-up, locked acceptance scope, expected result, actual acceptance comparison, all 49 common scalar metrics, and all 20 archive/projection metrics.

<a id="task-01"></a>

## Task 01: Parcel Rate Optimizer (`parcel-rate`)

- **Domain/package:** shipping and parcel pricing; `parcelrate`.
- **Initial task and baseline:** Implement `rate(parcels, services) -> dict`. Parcels have `id`, positive integer `weight_g`, and `zone`; services have `name`, supported `zones`, positive integer `max_weight_g`, `base_cents`, and `per_kg_cents`. A service is eligible for a supported zone within its weight limit. Billable weight is `ceil(weight_g / 1000)` kg and cost is `base_cents + kg * per_kg_cents`. Select the cheapest eligible service, breaking cost ties by service name. Return ordered `quotes` records (`id`, `service`, `cost_cents`) and ordered unrated parcel IDs without mutating inputs. Baseline tests cover cheapest selection, lexical tie-breaking, unrated parcels, order, and purity.
- **Live steering constraint:** Preserve deterministic cheapest-service selection, parcel input order, integer-cent calculations, and input immutability. Continue working without completing the goal.
- **Pivot:** Support positive `dimensions_cm`. For each service, dimensional kg is `ceil(length*width*height / dim_divisor)`, where `dim_divisor` defaults to 5000, and billable kg is the maximum of actual and dimensional kg. Reject a service for that parcel if any dimension exceeds its optional `max_length_cm`. Add `ceil(linehaul * fuel_percent / 100)` for nonnegative integer fuel percentages, then add `remote_surcharge_cents` when the zone is in `remote_zones`. Old inputs must keep old results. Tests include a 60,000 cm³ box billed at 12 kg, service-specific divisors/length limits, and fuel plus remote surcharge.
- **Follow-up:** Add `python -m parcelrate.cli`. Normal mode reads one JSON request from stdin. `--ndjson` treats each nonblank line as an independent request and preserves request order. Each request contains `parcels` and `services`. Emit exactly one compact, key-sorted JSON result line per request and no other output; the CLI must expose pivot behavior too.
- **Locked acceptance and edit boundary:** Process stages in order, keep the goal active through steering/pivot/follow-up, and only after `REQUIREMENTS LOCKED` run and fix the complete suite, then call `await goal.complete()`. Only `parcelrate/` may be edited. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock. Exact final response: `PARCEL RATE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 166.03 s vs 157.15 s; Δ +8.87 s (+5.65%).
- **Model calls:** 14 vs 20; Δ -6 (-30.00%).
- **Tool calls:** 13 vs 14; Δ -1 (-7.14%).
- **Compactions:** 4 vs 3; Δ +1 (+33.33%).
- **Total tokens:** 135,664 vs 175,365; Δ -39,701 (-22.64%).
- **Reported API cost:** $0.352514 vs $0.484047; Δ -0.131533 (-27.17%).
- **Visible tool bytes:** 146,195 vs 21,394; Δ +124,801 (+583.35%).
- **Prompt-cache reuse:** 62.86% vs 61.62%; Δ +1.24 pp.

- **Expected exact final response:** `PARCEL RATE GOAL COMPLETE`
- **vanilla prime-agent final response:** `PARCEL RATE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `PARCEL RATE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 157.15 s | 166.03 s | +8.87 s | +5.65% |
| Lifecycle wall time | 157.57 s | 166.33 s | +8.75 s | +5.56% |
| Instruction wall time | 157.15 s | 166.03 s | +8.87 s | +5.65% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 20 | 14 | -6 | -30.00% |
| Tool calls | 14 | 13 | -1 | -7.14% |
| Tool results | 14 | 13 | -1 | -7.14% |
| Visible tool bytes | 21,394 | 146,195 | +124,801 | +583.35% |
| Compactions | 3 | 4 | +1 | +33.33% |
| Goal-context injections | 6 | 3 | -3 | -50.00% |
| Assistant output events | 20 | 14 | -6 | -30.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 15 | 7 | -8 | -53.33% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 25 | 16 | -9 | -36.00% |
| RPC compaction completions | 3 | 4 | +1 | +33.33% |
| Compaction requests | 6 | 2 | -4 | -66.67% |
| Compaction waits | 4 | 0 | -4 | -100.00% |
| Accepted stage/command responses | 11 | 7 | -4 | -36.36% |
| Rejected stage/command responses | 4 | 0 | -4 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 24 | 15 | -9 | -37.50% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 5 | 2 | -3 | -60.00% |
| Maximum goal tokens used | 68,850 | 51,189 | -17,661 | -25.65% |
| Completed RPC compactions | 3 | 4 | +1 | +33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 4 | 0 | -4 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 4 | 0 | -4 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 66,015 | 49,614 | -16,401 | -24.84% |
| Output tokens | 3,366 | 2,082 | -1,284 | -38.15% |
| Cache-read tokens | 105,984 | 83,968 | -22,016 | -20.77% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 175,365 | 135,664 | -39,701 | -22.64% |
| Prompt-cache reuse | 61.62% | 62.86% | +1.24 pp | — |
| Input cost | $0.330075 | $0.248070 | -0.082005 | -24.84% |
| Output cost | $0.100980 | $0.062460 | -0.038520 | -38.15% |
| Cache-read cost | $0.052992 | $0.041984 | -0.011008 | -20.77% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.484047 | $0.352514 | -0.131533 | -27.17% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 12 | +12 | n/a (zero baseline) |
| Archive source bytes | 0 | 132,234 | +132,234 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 12,507 | +12,507 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 9.46% | +9.46 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 281,393 | +281,393 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 130,913 | +130,913 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 35,429 | +35,429 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 264,468 | +264,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 83,968 | +83,968 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 49,614 | +49,614 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 10 | +10 | n/a (zero baseline) |


---

<a id="task-02"></a>

## Task 02: Three-Way JSON Merge Service (`json-merge`)

- **Domain/package:** structured-data version merging and conflict resolution; `jsonmerge3`.
- **Initial task and baseline:** Implement `merge(base, ours, theirs, *, entities=None, resolutions=None) -> dict` for immutable JSON-compatible inputs. Equal edits coalesce; a one-sided change wins; objects merge recursively with lexical key traversal; lists are atomic by default. Concurrent differing scalar/list edits produce `value` conflicts and deletion-versus-edit produces `delete-edit`. Unresolved conflicts provisionally retain `ours`, including an ours-side deletion. Return `document` and path-sorted `conflicts`; paths are JSON Pointers with `~0`/`~1` escaping. Baseline tests cover independent nested edits, equal atomic-list edits, deletion/edit conflicts, lexical structure, and purity.
- **Live steering constraint:** Preserve pure inputs, lexical JSON Pointer ordering, ours-as-provisional conflict behavior, and atomic lists; do not complete the goal yet.
- **Pivot:** `entities` maps list JSON Pointer paths to entity-key fields. At configured paths, merge list entries by ID. Preserve surviving base order, then append ours-only IDs in ours order and theirs-only IDs in theirs order. Changes to different entities merge independently; additions of the same ID use normal recursive rules. Conflict paths address IDs (for example `/items/a`) rather than indexes. Unconfigured lists remain atomic.
- **Follow-up:** `resolutions` maps conflict paths to `ours`, `theirs`, `delete`, or `{"strategy":"value","value":...}`. Apply resolutions during merge and omit resolved conflicts. Whenever `resolutions is not None`, also return a deterministic JSON-style `patch` that transforms `ours` into the result. Diff objects recursively by sorted pointer path; use `remove`, `add`, or `replace`; all lists, including entity lists, are atomic in the patch; patch records are lexical by path.
- **Locked acceptance and edit boundary:** Incorporate all staged requirements, wait for `REQUIREMENTS LOCKED`, run/fix the full suite, and then call `await goal.complete()`. Only `jsonmerge3/` is editable. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete only after lock. Exact final response: `JSON MERGE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 336.37 s vs 525.24 s; Δ -188.87 s (-35.96%).
- **Model calls:** 17 vs 33; Δ -16 (-48.48%).
- **Tool calls:** 21 vs 29; Δ -8 (-27.59%).
- **Compactions:** 6 vs 8; Δ -2 (-25.00%).
- **Total tokens:** 178,876 vs 347,893; Δ -169,017 (-48.58%).
- **Reported API cost:** $0.654646 vs $1.140728; Δ -0.486082 (-42.61%).
- **Visible tool bytes:** 217,029 vs 231,635; Δ -14,606 (-6.31%).
- **Prompt-cache reuse:** 50.69% vs 57.43%; Δ -6.73 pp.

- **Expected exact final response:** `JSON MERGE GOAL COMPLETE`
- **vanilla prime-agent final response:** `JSON MERGE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `JSON MERGE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 525.24 s | 336.37 s | -188.87 s | -35.96% |
| Lifecycle wall time | 525.44 s | 336.52 s | -188.92 s | -35.95% |
| Instruction wall time | 525.24 s | 336.37 s | -188.87 s | -35.96% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 33 | 17 | -16 | -48.48% |
| Tool calls | 29 | 21 | -8 | -27.59% |
| Tool results | 29 | 21 | -8 | -27.59% |
| Visible tool bytes | 231,635 | 217,029 | -14,606 | -6.31% |
| Compactions | 8 | 6 | -2 | -25.00% |
| Goal-context injections | 10 | 5 | -5 | -50.00% |
| Assistant output events | 33 | 17 | -16 | -48.48% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 15 | 7 | -8 | -53.33% |
| Test-run observations | 6 | 5 | -1 | -16.67% |
| Goal updates | 44 | 21 | -23 | -52.27% |
| RPC compaction completions | 8 | 6 | -2 | -25.00% |
| Compaction requests | 6 | 2 | -4 | -66.67% |
| Compaction waits | 4 | 0 | -4 | -100.00% |
| Accepted stage/command responses | 10 | 7 | -3 | -30.00% |
| Rejected stage/command responses | 5 | 0 | -5 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 5 | 3 | -2 | -40.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 43 | 20 | -23 | -53.49% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 9 | 4 | -5 | -55.56% |
| Maximum goal tokens used | 149,856 | 90,846 | -59,010 | -39.38% |
| Completed RPC compactions | 8 | 6 | -2 | -25.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 5 | 0 | -5 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 4 | 0 | -4 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 143,470 | 85,154 | -58,316 | -40.65% |
| Output tokens | 10,887 | 6,170 | -4,717 | -43.33% |
| Cache-read tokens | 193,536 | 87,552 | -105,984 | -54.76% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 347,893 | 178,876 | -169,017 | -48.58% |
| Prompt-cache reuse | 57.43% | 50.69% | -6.73 pp | — |
| Input cost | $0.717350 | $0.425770 | -0.291580 | -40.65% |
| Output cost | $0.326610 | $0.185100 | -0.141510 | -43.33% |
| Cache-read cost | $0.096768 | $0.043776 | -0.052992 | -54.76% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.140728 | $0.654646 | -0.486082 | -42.61% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 20 | +20 | n/a (zero baseline) |
| Archive source bytes | 0 | 196,734 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 19,204 | +19,204 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 9.76% | +9.76 pp | — |
| Archive chunks | 0 | 26 | +26 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 422,817 | +422,817 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 194,936 | +194,936 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 31,310 | +31,310 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 393,468 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 7 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 87,552 | +87,552 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 85,154 | +85,154 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-03"></a>

## Task 03: Incremental Spreadsheet Engine (`spreadsheet`)

- **Domain/package:** spreadsheet formula evaluation, incremental recalculation, and sensitivity analysis; `miniworkbook`.
- **Initial task and baseline:** Implement `Workbook.set(cell, value_or_formula)` and `Workbook.get(cell) -> Decimal`. Values may be `Decimal`, integer, decimal string, or a formula beginning with `=`. Parse formulas without `eval`; support normalized uppercase cell references, parentheses, unary minus, `+ - * /`, and `SUM(A1:B3)`. Unset cells evaluate to zero. Use exact `Decimal` arithmetic and raise `CycleError` for dependency cycles. Tests cover precedence, ranges, unset cells, dependent updates, address behavior, and clean cycle rejection.
- **Live steering constraint:** Keep Decimal arithmetic exact, reject cycles cleanly, normalize addresses, never use `eval`, and leave the active goal open.
- **Pivot:** Cache formula results. A change invalidates only that cell and its transitive dependents, leaving unrelated warmed formulas cached. `set_many(mapping)` must parse and cycle-check the whole update before an atomic commit; on failure, cells, formulas, dependencies, and caches are unchanged. Add `evaluation_counts()` and `reset_evaluation_counts()` (resetting counters must not flush caches). Within one `get`, evaluate each formula at most once. Tests check transitive-only invalidation, a diamond dependency evaluating each formula once, and atomic rollback of a cyclic batch.
- **Follow-up:** `evaluate_scenarios(overrides_sequence, outputs)` returns one output mapping per scenario, temporarily overriding listed inputs while using stored values elsewhere. It must not alter cells, the normal cache, or normal evaluation counters. `goal_seek(input_cell, output_cell, target, low, high, tolerance)` performs deterministic Decimal bisection, requires endpoint outputs to bracket the target, and returns the first midpoint whose absolute output error is within tolerance. It also must leave workbook state and normal cache unchanged; an unbracketed target raises `ValueError`.
- **Locked acceptance and edit boundary:** Wait for the lock, run/fix all stages, and call `await goal.complete()` only afterward. Edit only `miniworkbook/`. Preserve `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, and `tests/test_base.py`, `tests/test_pivot.py`, `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `WORKBOOK GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 297.55 s vs 419.97 s; Δ -122.42 s (-29.15%).
- **Model calls:** 16 vs 18; Δ -2 (-11.11%).
- **Tool calls:** 16 vs 17; Δ -1 (-5.88%).
- **Compactions:** 5 vs 7; Δ -2 (-28.57%).
- **Total tokens:** 163,114 vs 180,062; Δ -16,948 (-9.41%).
- **Reported API cost:** $0.534903 vs $0.756154; Δ -0.221251 (-29.26%).
- **Visible tool bytes:** 281,682 vs 218,816; Δ +62,866 (+28.73%).
- **Prompt-cache reuse:** 64.95% vs 49.19%; Δ +15.76 pp.

- **Expected exact final response:** `WORKBOOK GOAL COMPLETE`
- **vanilla prime-agent final response:** `WORKBOOK GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `WORKBOOK GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 419.97 s | 297.55 s | -122.42 s | -29.15% |
| Lifecycle wall time | 420.24 s | 298.15 s | -122.09 s | -29.05% |
| Instruction wall time | 419.97 s | 297.55 s | -122.42 s | -29.15% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 16 | -2 | -11.11% |
| Tool calls | 17 | 16 | -1 | -5.88% |
| Tool results | 17 | 16 | -1 | -5.88% |
| Visible tool bytes | 218,816 | 281,682 | +62,866 | +28.73% |
| Compactions | 7 | 5 | -2 | -28.57% |
| Goal-context injections | 5 | 4 | -1 | -20.00% |
| Assistant output events | 18 | 16 | -2 | -11.11% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | +2 | +28.57% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 24 | 19 | -5 | -20.83% |
| RPC compaction completions | 7 | 5 | -2 | -28.57% |
| Compaction requests | 2 | 3 | +1 | +50.00% |
| Compaction waits | 0 | 1 | +1 | n/a (zero baseline) |
| Accepted stage/command responses | 6 | 7 | +1 | +16.67% |
| Rejected stage/command responses | 1 | 2 | +1 | +100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 23 | 18 | -5 | -21.74% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 3 | -1 | -25.00% |
| Maximum goal tokens used | 94,872 | 61,263 | -33,609 | -35.43% |
| Completed RPC compactions | 7 | 5 | -2 | -28.57% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | +1 | +100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | +1 | n/a (zero baseline) |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 86,746 | 54,717 | -32,029 | -36.92% |
| Output tokens | 9,348 | 7,021 | -2,327 | -24.89% |
| Cache-read tokens | 83,968 | 101,376 | +17,408 | +20.73% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 180,062 | 163,114 | -16,948 | -9.41% |
| Prompt-cache reuse | 49.19% | 64.95% | +15.76 pp | — |
| Input cost | $0.433730 | $0.273585 | -0.160145 | -36.92% |
| Output cost | $0.280440 | $0.210630 | -0.069810 | -24.89% |
| Cache-read cost | $0.041984 | $0.050688 | +0.008704 | +20.73% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.756154 | $0.534903 | -0.221251 | -29.26% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 15 | +15 | n/a (zero baseline) |
| Archive source bytes | 0 | 263,410 | +263,410 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 21,937 | +21,937 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.33% | +8.33 pp | — |
| Archive chunks | 0 | 22 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 555,795 | +555,795 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 8,684 | +8,684 | n/a (zero baseline) |
| Result bytes projected out | 0 | 260,717 | +260,717 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 42,136 | +42,136 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 526,820 | +526,820 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 101,376 | +101,376 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 54,717 | +54,717 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-04"></a>

## Task 04: Heat Diffusion Plate (`heat-plate`)

- **Domain/package:** numerical heat diffusion in mixed materials; `heatplate`.
- **Initial task and baseline:** Implement immutable `HeatPlate(temperatures, alpha, fixed=None)` with a nonempty rectangular `Decimal` grid and valid fixed `(x, y)` boundaries. `step()` makes one simultaneous Jacobi update: each real neighbor contributes `alpha * (neighbor - cell)`; missing outside neighbors are insulated; fixed cells are reset after flux calculation. Require `0 <= alpha <= 1/4`, valid geometry/coordinates, and no mutation of the original plate or caller grids. Tests check center diffusion, heat conservation at insulated edges, fixed boundaries, validation, and immutability.
- **Live steering constraint:** Every calculation remains in `Decimal`; use simultaneous Jacobi updates; preserve caller inputs; treat outside edges as insulated; keep the goal active.
- **Pivot:** Add an optional conductivity grid. Each real cell has positive Decimal conductivity. A cutout has `None` in both temperature and conductivity grids; without conductivity, all cells have conductivity 1 and cutouts are not allowed. Neighbor-face conductance is `g = 2*k1*k2/(k1+k2)`, so each contribution becomes `alpha*g*(neighbor-cell)`. Outside/cutout edges are insulated, and fixed values still override after the simultaneous step. Reject mismatched cutouts, nonpositive conductivity, and fixed coordinates on cutouts. Tests check equivalence at uniform conductivity, symmetric mixed-material flux/conservation, and insulated cutouts.
- **Follow-up:** `solve_steady(tolerance, max_steps) -> (plate, iterations)` repeatedly applies deterministic Jacobi steps until the maximum absolute change over real cells is at most nonnegative Decimal `tolerance`. Require positive integer `max_steps` and at least one fixed real cell; count every step, including a first already-steady step. Raise `ConvergenceError` after exhaustion without changing the original. `fixed_fluxes()` returns a coordinate-sorted mapping; each boundary value is `sum(g * (T_fixed - T_neighbor))` over real neighbors, with positive meaning supplied heat. Tests include a one-step steady profile, a five-cell 0/25/50/75/100 profile, balancing boundary fluxes, and error/purity cases.
- **Locked acceptance and edit boundary:** Only after `REQUIREMENTS LOCKED`, run/fix the full suite and call `await goal.complete()`. Edit only `heatplate/`. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `HEAT PLATE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Neither variant meets all acceptance criteria; resource use is reported descriptively, not as a formal efficiency result.

- **Wall time:** 600.00 s vs 600.00 s; Δ +0.00 s (+0.00%).
- **Model calls:** 13 vs 51; Δ -38 (-74.51%).
- **Tool calls:** 13 vs 30; Δ -17 (-56.67%).
- **Compactions:** 4 vs 11; Δ -7 (-63.64%).
- **Total tokens:** 116,687 vs 518,401; Δ -401,714 (-77.49%).
- **Reported API cost:** $0.438709 vs $1.193809; Δ -0.755100 (-63.25%).
- **Visible tool bytes:** 214,199 vs 193,926; Δ +20,273 (+10.45%).
- **Prompt-cache reuse:** 54.64% vs 70.19%; Δ -15.55 pp.

- **Expected exact final response:** `HEAT PLATE GOAL COMPLETE`
- **vanilla prime-agent final response:** `The follow-up APIs now pass all staged tests, and the integration runner exits successfully. I am keeping the goal active because `REQUIREMENTS LOCKED` has not been sent. I will use this checkpoint to audit edge cases without changing supplied tests.`
- **prime-context 8.1.0 final response:** `Mixed conductivities and cutouts are implemented, including symmetric face conductance and insulated cutout edges. The expanded suite passes 6/6. I’ll now add the steady-state and flux APIs from the follow-up while keeping the goal active.`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | no |
| Runner task-completed gate | yes | no | no |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | active |
| Goal completed after lock | yes | no | no |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | no |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | no |
| Run error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Lifecycle wall time | 600.41 s | 600.21 s | -0.20 s | -0.03% |
| Instruction wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 51 | 13 | -38 | -74.51% |
| Tool calls | 30 | 13 | -17 | -56.67% |
| Tool results | 30 | 12 | -18 | -60.00% |
| Visible tool bytes | 193,926 | 214,199 | +20,273 | +10.45% |
| Compactions | 11 | 4 | -7 | -63.64% |
| Goal-context injections | 31 | 3 | -28 | -90.32% |
| Assistant output events | 51 | 12 | -39 | -76.47% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 3 | 4 | +1 | +33.33% |
| Goal updates | 81 | 16 | -65 | -80.25% |
| RPC compaction completions | 11 | 4 | -7 | -63.64% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 3 | +1 | +50.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 81 | 16 | -65 | -80.25% |
| Complete goal updates | 0 | 0 | +0 | 0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 31 | 3 | -28 | -90.32% |
| Maximum goal tokens used | 160,513 | 55,759 | -104,754 | -65.26% |
| Completed RPC compactions | 11 | 4 | -7 | -63.64% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 152,021 | 50,581 | -101,440 | -66.73% |
| Output tokens | 8,492 | 5,178 | -3,314 | -39.02% |
| Cache-read tokens | 357,888 | 60,928 | -296,960 | -82.98% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 518,401 | 116,687 | -401,714 | -77.49% |
| Prompt-cache reuse | 70.19% | 54.64% | -15.55 pp | — |
| Input cost | $0.760105 | $0.252905 | -0.507200 | -66.73% |
| Output cost | $0.254760 | $0.155340 | -0.099420 | -39.02% |
| Cache-read cost | $0.178944 | $0.030464 | -0.148480 | -82.98% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.193809 | $0.438709 | -0.755100 | -63.25% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 12 | +12 | n/a (zero baseline) |
| Archive source bytes | 0 | 196,734 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 17,279 | +17,279 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.78% | +8.78 pp | — |
| Archive chunks | 0 | 17 | +17 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 419,268 | +419,268 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 195,228 | +195,228 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 35,330 | +35,330 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,999 | +395,999 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 4 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 60,928 | +60,928 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 50,581 | +50,581 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 8 | +8 | n/a (zero baseline) |


---

<a id="task-05"></a>

## Task 05: Binary Telemetry Frame Codec (`telemetry-codec`)

- **Domain/package:** binary telemetry framing, streaming decode, and typed serialization; `telemetry_codec`.
- **Initial task and baseline:** Implement immutable `Frame(type, payload)`, `encode_frame(frame) -> bytes`, and `decode_frames(data) -> list[Frame]` for exact complete input. Wire format is magic `A5 5A`, one unsigned type byte, two-byte big-endian payload length, then payload. Types are 0–255 and payload length is at most 65535. Reject wrong magic, malformed values, trailing partial frames, and declared lengths beyond available data. Tests lock the exact example `Frame(7,b"abc") -> a5 5a 07 00 03 61 62 63`, concatenated/empty frames, and malformed cases.
- **Live steering constraint:** Preserve exact wire bytes and frame order, reject partial data deterministically, avoid input mutation, and do not complete the goal.
- **Pivot:** Add `FrameDecoder(max_payload=65535)`. `feed(bytes_like)` must be independent of chunk boundaries, emit all newly completed frames, skip garbage, resynchronize at the next magic, and maintain cumulative `dropped_bytes`. Retain only a possible incomplete valid frame. Treat a length above `max_payload` as false magic by dropping its first byte and continuing without allocating the payload. `finish()` emits any remaining complete frames, discards terminal garbage, but raises `ValueError` for a plausible incomplete frame. Any later `feed()` raises `RuntimeError`. Tests feed one byte at a time, count noise, resynchronize after oversized candidates, and detect partial finish.
- **Follow-up:** Add canonical `encode_value`/`decode_value` for null, booleans, signed 64-bit integers, UTF-8 strings, bytes, lists, and string-keyed dictionaries. Tags are exactly `00` null, `01` false, `02` true, `03` integer plus 8 signed big-endian bytes, `04` string, `05` bytes, `06` list, `07` dictionary. Strings/bytes carry 4-byte byte lengths; lists carry 4-byte counts; dictionary entries carry a 4-byte UTF-8 key length and value. Encode dict keys in UTF-8 bytewise order; reject duplicate decoded keys, malformed encodings, invalid integer bounds, and trailing bytes. `encode_message(type, value)` wraps the encoding in a `Frame`; `decode_message(frame)` decodes its payload.
- **Locked acceptance and edit boundary:** After the exact lock, run/fix the full suite, call `await goal.complete()`, and edit only `telemetry_codec/`. Protected: `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `TELEMETRY CODEC GOAL COMPLETE`.

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 285.44 s vs 600.00 s; Δ -314.56 s (-52.43%).
- **Model calls:** 17 vs 69; Δ -52 (-75.36%).
- **Tool calls:** 16 vs 16; Δ +0 (+0.00%).
- **Compactions:** 5 vs 10; Δ -5 (-50.00%).
- **Total tokens:** 176,066 vs 681,005; Δ -504,939 (-74.15%).
- **Reported API cost:** $0.580986 vs $1.400606; Δ -0.819620 (-58.52%).
- **Visible tool bytes:** 153,171 vs 79,727; Δ +73,444 (+92.12%).
- **Prompt-cache reuse:** 55.72% vs 73.15%; Δ -17.43 pp.

- **Expected exact final response:** `TELEMETRY CODEC GOAL COMPLETE`
- **vanilla prime-agent final response:** `Awaiting `REQUIREMENTS LOCKED`; the goal remains active.`
- **prime-context 8.1.0 final response:** `TELEMETRY CODEC GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 285.44 s | -314.56 s | -52.43% |
| Lifecycle wall time | 600.63 s | 285.97 s | -314.67 s | -52.39% |
| Instruction wall time | 600.00 s | 285.44 s | -314.56 s | -52.43% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 69 | 17 | -52 | -75.36% |
| Tool calls | 16 | 16 | +0 | +0.00% |
| Tool results | 16 | 16 | +0 | +0.00% |
| Visible tool bytes | 79,727 | 153,171 | +73,444 | +92.12% |
| Compactions | 10 | 5 | -5 | -50.00% |
| Goal-context injections | 54 | 3 | -51 | -94.44% |
| Assistant output events | 69 | 17 | -52 | -75.36% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 3 | 5 | +2 | +66.67% |
| Goal updates | 122 | 21 | -101 | -82.79% |
| RPC compaction completions | 10 | 5 | -5 | -50.00% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 7 | 6 | -1 | -14.29% |
| Rejected stage/command responses | 2 | 1 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 4 | +2 | +100.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 122 | 20 | -102 | -83.61% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 54 | 2 | -52 | -96.30% |
| Maximum goal tokens used | 188,973 | 79,727 | -109,246 | -57.81% |
| Completed RPC compactions | 10 | 5 | -5 | -50.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 2 | 1 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 180,584 | 75,666 | -104,918 | -58.10% |
| Output tokens | 8,389 | 5,168 | -3,221 | -38.40% |
| Cache-read tokens | 492,032 | 95,232 | -396,800 | -80.65% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 681,005 | 176,066 | -504,939 | -74.15% |
| Prompt-cache reuse | 73.15% | 55.72% | -17.43 pp | — |
| Input cost | $0.902920 | $0.378330 | -0.524590 | -58.10% |
| Output cost | $0.251670 | $0.155040 | -0.096630 | -38.40% |
| Cache-read cost | $0.246016 | $0.047616 | -0.198400 | -80.65% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.400606 | $0.580986 | -0.819620 | -58.52% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 15 | +15 | n/a (zero baseline) |
| Archive source bytes | 0 | 131,156 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 16,892 | +16,892 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 12.88% | +12.88 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 291,648 | +291,648 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 130,242 | +130,242 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 25,171 | +25,171 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 262,312 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 95,232 | +95,232 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 75,666 | +75,666 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-06"></a>

## Task 06: Decimal Cash-Flow Mathematics (`cash-flow`)

- **Domain/package:** loan amortization and investment-yield mathematics; `cashflow_math`.
- **Initial task and baseline:** Implement `amortize(principal, annual_rate, periods, payments_per_year=12) -> tuple[PaymentRow,...]` and immutable rows containing period, opening, payment, interest, principal paid, and closing. Monetary/rate inputs must be `Decimal`; counts must be positive integers. Use a fixed level payment at `annual_rate / payments_per_year`; round every monetary row field to cents with `ROUND_HALF_EVEN`; adjust only the final payment to reach exactly zero and never make closing negative. Reject negative principal/rates, floats, and invalid counts. Tests cover zero-rate schedules, one-period interest, half-even/final adjustment behavior, and validation.
- **Live steering constraint:** Keep all money/rates in `Decimal`, use half-even cent rounding, adjust only the final payment, reject floats, and keep the goal open.
- **Pivot:** Add optional 1-based-period mappings `extra_payments` and `rate_changes`. Extras are nonnegative Decimal amounts. Rate changes are nonnegative annual Decimal rates effective for that period's interest; the original contractual level payment does not change. Apply extra after contractual payment, cap total at opening plus rounded interest, prevent negative balances, and stop at payoff. Preserve cent rounding. Validate invalid periods, floats, and negative mapped values atomically. Tests cover early payoff by extra, oversized-extra capping, and a reset that changes interest but not the original contract payment.
- **Follow-up:** `npv(rate, cashflows)` computes `sum(cashflow[t] / (1+rate)**t)` using Decimal only. `irr(cashflows, low=Decimal("-0.9999"), high=Decimal("10"), tolerance=Decimal("1e-12"))` uses deterministic inclusive-bracket bisection. Ignore zeros when counting signs and require exactly one ordered sign change. Require `low < high`, both rates greater than -1, positive tolerance, and endpoint NPVs bracketing zero. Return an endpoint within tolerance or the first qualifying midpoint. Reject floats, malformed flows, invalid sign patterns, and unbracketed input.
- **Locked acceptance and edit boundary:** Wait for `REQUIREMENTS LOCKED`, then run/fix everything and call `await goal.complete()`. Edit only `cashflow_math/`. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `CASH FLOW GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 278.74 s vs 422.14 s; Δ -143.40 s (-33.97%).
- **Model calls:** 18 vs 20; Δ -2 (-10.00%).
- **Tool calls:** 17 vs 19; Δ -2 (-10.53%).
- **Compactions:** 5 vs 6; Δ -1 (-16.67%).
- **Total tokens:** 187,893 vs 178,731; Δ +9,162 (+5.13%).
- **Reported API cost:** $0.622397 vs $0.724973; Δ -0.102576 (-14.15%).
- **Visible tool bytes:** 212,783 vs 172,927; Δ +39,856 (+23.05%).
- **Prompt-cache reuse:** 53.75% vs 55.57%; Δ -1.82 pp.

- **Expected exact final response:** `CASH FLOW GOAL COMPLETE`
- **vanilla prime-agent final response:** `CASH FLOW GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `CASH FLOW GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 422.14 s | 278.74 s | -143.40 s | -33.97% |
| Lifecycle wall time | 422.43 s | 279.04 s | -143.39 s | -33.94% |
| Instruction wall time | 422.14 s | 278.74 s | -143.40 s | -33.97% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 20 | 18 | -2 | -10.00% |
| Tool calls | 19 | 17 | -2 | -10.53% |
| Tool results | 19 | 17 | -2 | -10.53% |
| Visible tool bytes | 172,927 | 212,783 | +39,856 | +23.05% |
| Compactions | 6 | 5 | -1 | -16.67% |
| Goal-context injections | 5 | 4 | -1 | -20.00% |
| Assistant output events | 20 | 18 | -2 | -10.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 6 | 5 | -1 | -16.67% |
| Goal updates | 28 | 21 | -7 | -25.00% |
| RPC compaction completions | 7 | 5 | -2 | -28.57% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 7 | 6 | -1 | -14.29% |
| Rejected stage/command responses | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 4 | +1 | +33.33% |
| Failing observed test runs | 3 | 1 | -2 | -66.67% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 27 | 20 | -7 | -25.93% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 3 | -1 | -25.00% |
| Maximum goal tokens used | 84,506 | 88,240 | +3,734 | +4.42% |
| Completed RPC compactions | 7 | 5 | -2 | -28.57% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | -1 | -50.00% |
| Failed compaction requests | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 74,917 | 84,577 | +9,660 | +12.89% |
| Output tokens | 10,118 | 5,012 | -5,106 | -50.46% |
| Cache-read tokens | 93,696 | 98,304 | +4,608 | +4.92% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 178,731 | 187,893 | +9,162 | +5.13% |
| Prompt-cache reuse | 55.57% | 53.75% | -1.82 pp | — |
| Input cost | $0.374585 | $0.422885 | +0.048300 | +12.89% |
| Output cost | $0.303540 | $0.150360 | -0.153180 | -50.46% |
| Cache-read cost | $0.046848 | $0.049152 | +0.002304 | +4.92% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.724973 | $0.622397 | -0.102576 | -14.15% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 16 | +16 | n/a (zero baseline) |
| Archive source bytes | 0 | 201,519 | +201,519 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 17,194 | +17,194 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.53% | +8.53 pp | — |
| Archive chunks | 0 | 25 | +25 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 422,391 | +422,391 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 198,728 | +198,728 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 32,800 | +32,800 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 403,897 | +403,897 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 98,304 | +98,304 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 84,577 | +84,577 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 13 | +13 | n/a (zero baseline) |


---

<a id="task-07"></a>

## Task 07: PGM Region Analyzer (`pgm-regions`)

- **Domain/package:** image parsing, connected-component geometry, and topology; `pgm_regions`.
- **Initial task and baseline:** Implement immutable validated `Image(width, height, maxval, rows)`, `read_pgm(data)` for P2 ASCII PGM with comments/arbitrary header and raster whitespace, and `label_components(image, threshold, connectivity=4)`. Foreground pixels are `>= threshold`. Return immutable `Region(id, area, bbox, centroid, perimeter=None, holes=None)` records. IDs start at 1 by each component's first raster-order foreground pixel; bounding boxes are inclusive; centroids are exact `Fraction` pairs. Initially accept only 4-connectivity and reject invalid/ragged/out-of-range images. Tests lock raster-stable IDs and exact geometry, empty results, comment parsing, and validation.
- **Live steering constraint:** Preserve raster-stable IDs, exact Fraction centroids, immutable records, strict image validation, and the still-active goal.
- **Pivot:** Extend `read_pgm` to P5. Samples are one byte when `maxval < 256`, otherwise unsigned two-byte big-endian. Allow comments/arbitrary whitespace between header tokens; raster begins after the required separator following `maxval`. Reject truncated or trailing raster bytes and values above `maxval`. Add `connectivity=8` with diagonal neighbors while keeping IDs based on first raster pixel. Tests cover diagonal merging under 8-connectivity and both 8-bit and 16-bit P5, including comments/truncation.
- **Follow-up:** `analyze_regions(image, threshold, connectivity=4)` returns the same region order/IDs and fills integer `perimeter` and `holes`. Perimeter counts unit edges from the region to outside, background, or a different region. Hole search always uses 4-connected background, even for 8-connected foreground. A hole is an enclosed background component whose foreground boundary belongs only to that region. Other foreground regions must not alter a region's metrics. Tests cover a filled 2×2 block `(perimeter=8, holes=0)`, a 3×3 ring `(16,1)`, and separate L/single-pixel regions.
- **Locked acceptance and edit boundary:** After lock, run/fix the complete suite and call `await goal.complete()`. Only `pgm_regions/` may change. Preserve `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `PGM REGIONS GOAL COMPLETE`.

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 289.06 s vs 600.00 s; Δ -310.94 s (-51.82%).
- **Model calls:** 17 vs 47; Δ -30 (-63.83%).
- **Tool calls:** 17 vs 17; Δ +0 (+0.00%).
- **Compactions:** 5 vs 10; Δ -5 (-50.00%).
- **Total tokens:** 178,699 vs 471,827; Δ -293,128 (-62.13%).
- **Reported API cost:** $0.583840 vs $1.135424; Δ -0.551584 (-48.58%).
- **Visible tool bytes:** 154,611 vs 150,896; Δ +3,715 (+2.46%).
- **Prompt-cache reuse:** 57.67% vs 70.21%; Δ -12.54 pp.

- **Expected exact final response:** `PGM REGIONS GOAL COMPLETE`
- **vanilla prime-agent final response:** `Awaiting `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `PGM REGIONS GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 289.06 s | -310.94 s | -51.82% |
| Lifecycle wall time | 600.44 s | 289.64 s | -310.79 s | -51.76% |
| Instruction wall time | 600.00 s | 289.06 s | -310.94 s | -51.82% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 47 | 17 | -30 | -63.83% |
| Tool calls | 17 | 17 | +0 | +0.00% |
| Tool results | 17 | 17 | +0 | +0.00% |
| Visible tool bytes | 150,896 | 154,611 | +3,715 | +2.46% |
| Compactions | 10 | 5 | -5 | -50.00% |
| Goal-context injections | 34 | 3 | -31 | -91.18% |
| Assistant output events | 47 | 17 | -30 | -63.83% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 3 | 5 | +2 | +66.67% |
| Goal updates | 79 | 21 | -58 | -73.42% |
| RPC compaction completions | 10 | 5 | -5 | -50.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 3 | +1 | +50.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 79 | 20 | -59 | -74.68% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 34 | 3 | -31 | -91.18% |
| Maximum goal tokens used | 147,219 | 77,950 | -69,269 | -47.05% |
| Completed RPC compactions | 10 | 5 | -5 | -50.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 137,738 | 73,274 | -64,464 | -46.80% |
| Output tokens | 9,481 | 5,585 | -3,896 | -41.09% |
| Cache-read tokens | 324,608 | 99,840 | -224,768 | -69.24% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 471,827 | 178,699 | -293,128 | -62.13% |
| Prompt-cache reuse | 70.21% | 57.67% | -12.54 pp | — |
| Input cost | $0.688690 | $0.366370 | -0.322320 | -46.80% |
| Output cost | $0.284430 | $0.167550 | -0.116880 | -41.09% |
| Cache-read cost | $0.162304 | $0.049920 | -0.112384 | -69.24% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.135424 | $0.583840 | -0.551584 | -48.58% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 16 | +16 | n/a (zero baseline) |
| Archive source bytes | 0 | 136,225 | +136,225 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 17,846 | +17,846 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 13.10% | +13.10 pp | — |
| Archive chunks | 0 | 27 | +27 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 303,500 | +303,500 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 133,902 | +133,902 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 34,653 | +34,653 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 273,285 | +273,285 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 99,840 | +99,840 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 73,274 | +73,274 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-08"></a>

## Task 08: Exact Gear-Train Constraint Solver (`gear-train`)

- **Domain/package:** exact mechanical gear-train and planetary constraint solving; `geartrain`.
- **Initial task and baseline:** Implement `GearTrain.add_gear(name, teeth)` for unique names and positive integer teeth, external `mesh(a,b)` enforcing `wa*Na + wb*Nb = 0`, `coaxial(a,b)` enforcing equal speeds, and `solve_speed(driver, rpm)`. Return every declared gear's speed as an exact `Fraction`, using `None` for gears disconnected from the drive. Validate names/connections and raise `InconsistentTrain` for contradictory cycles or constraints. Declaration/connection order must not change the mapping. Tests cover exact ratios, mesh/coaxial chains, and an inconsistent three-gear cycle.
- **Live steering constraint:** Use `Fraction` throughout, reject contradictory cycles, keep output deterministic, explicitly retain disconnected shafts as `None`, and leave the goal active.
- **Pivot:** Add `solve(drives)` for simultaneous integer/Fraction drive constraints. Accept compatible redundant drives and reject conflicts. Solve all connected components in one exact rational system. An undriven component is `None` unless constraints uniquely force zero. Return keys in lexical name order; declaration, edge, and drive-map order must not affect results. Make `solve_speed(driver, rpm)` delegate to `solve({driver: rpm})`. Tests include compatible/conflicting dual drives and a disconnected declared gear.
- **Follow-up:** `add_planetary(name, sun, ring, carrier, sun_teeth, ring_teeth)` adds a uniquely named constraint over existing, pairwise-distinct shafts with positive integer tooth counts. Enforce Willis' equation exactly: `Ns*ws + Nr*wr - (Ns+Nr)*wc = 0`. Planetaries, ordinary meshes, coaxial links, and drives share one exact linear system. Report a speed only when uniquely determined; unresolved degrees of freedom remain `None`; inconsistent overconstraints raise `InconsistentTrain`. Tests lock fixed-ring reduction (120 sun, 0 ring -> 30 carrier), fixed-carrier reversal (120 sun -> -40 ring), and interaction with an ordinary mesh.
- **Locked acceptance and edit boundary:** Only on `REQUIREMENTS LOCKED`, run/fix the whole suite and call `await goal.complete()`. Edit only `geartrain/`. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9`; goal complete after lock. Exact final response: `GEAR TRAIN GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 254.27 s vs 502.60 s; Δ -248.32 s (-49.41%).
- **Model calls:** 17 vs 24; Δ -7 (-29.17%).
- **Tool calls:** 15 vs 24; Δ -9 (-37.50%).
- **Compactions:** 4 vs 9; Δ -5 (-55.56%).
- **Total tokens:** 174,703 vs 238,931; Δ -64,228 (-26.88%).
- **Reported API cost:** $0.499273 vs $0.875409; Δ -0.376136 (-42.97%).
- **Visible tool bytes:** 213,450 vs 252,999; Δ -39,549 (-15.63%).
- **Prompt-cache reuse:** 67.51% vs 49.64%; Δ +17.88 pp.

- **Expected exact final response:** `GEAR TRAIN GOAL COMPLETE`
- **vanilla prime-agent final response:** `GEAR TRAIN GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `GEAR TRAIN GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 502.60 s | 254.27 s | -248.32 s | -49.41% |
| Lifecycle wall time | 502.81 s | 254.89 s | -247.92 s | -49.31% |
| Instruction wall time | 502.60 s | 254.27 s | -248.32 s | -49.41% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 24 | 17 | -7 | -29.17% |
| Tool calls | 24 | 15 | -9 | -37.50% |
| Tool results | 24 | 15 | -9 | -37.50% |
| Visible tool bytes | 252,999 | 213,450 | -39,549 | -15.63% |
| Compactions | 9 | 4 | -5 | -55.56% |
| Goal-context injections | 8 | 3 | -5 | -62.50% |
| Assistant output events | 24 | 17 | -7 | -29.17% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 7 | 5 | -2 | -28.57% |
| Goal updates | 33 | 21 | -12 | -36.36% |
| RPC compaction completions | 9 | 4 | -5 | -55.56% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 6 | -1 | -14.29% |
| Rejected stage/command responses | 2 | 1 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 6 | 4 | -2 | -33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 32 | 20 | -12 | -37.50% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 7 | 3 | -4 | -57.14% |
| Maximum goal tokens used | 123,206 | 59,182 | -64,024 | -51.97% |
| Completed RPC compactions | 9 | 4 | -5 | -55.56% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 2 | 1 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 116,369 | 54,945 | -61,424 | -52.78% |
| Output tokens | 7,874 | 5,582 | -2,292 | -29.11% |
| Cache-read tokens | 114,688 | 114,176 | -512 | -0.45% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 238,931 | 174,703 | -64,228 | -26.88% |
| Prompt-cache reuse | 49.64% | 67.51% | +17.88 pp | — |
| Input cost | $0.581845 | $0.274725 | -0.307120 | -52.78% |
| Output cost | $0.236220 | $0.167460 | -0.068760 | -29.11% |
| Cache-read cost | $0.057344 | $0.057088 | -0.000256 | -0.45% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.875409 | $0.499273 | -0.376136 | -42.97% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 14 | +14 | n/a (zero baseline) |
| Archive source bytes | 0 | 197,827 | +197,827 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 15,790 | +15,790 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 7.98% | +7.98 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 415,191 | +415,191 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 196,033 | +196,033 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,993 | +39,993 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,654 | +395,654 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 114,176 | +114,176 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 54,945 | +54,945 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


---

<a id="task-09"></a>

## Task 09: Streaming Signal Analysis (`signal-lab`)

- **Domain:** Digital signal processing; streaming audio statistics and stereo synchronization.
- **Initial task and baseline:** Implement `signal_lab`. Provide immutable `SignalStats(count, peak_abs, mean, rms, zero_crossings, clipped_runs=())` and `analyze(samples, sample_rate)`. Consume a finite integer-sample iterable without mutation. Require a positive numeric sample rate and integer samples. Compute floating-point mean/RMS, peak magnitude, and crossings only where adjacent samples have a negative product (zero never crosses); all numeric fields are zero for empty input.
- **Live steering constraint:** Preserve those exact crossing semantics, strict integer-sample validation, input purity, and explicit empty results. Do not complete the goal yet.
- **Pivot:** Add `SignalAnalyzer(sample_rate, clip_limit=None, min_clip_run=1)`. Each `feed()` chunk is consumed once; repeated feeds must give the same result regardless of chunk boundaries, including crossings and clip runs spanning chunks. `finish()` returns `SignalStats`; feeding after finish or finishing twice raises `RuntimeError`. `analyze` must use this streaming path. With a positive integer clip limit, record maximal half-open index ranges where `abs(sample) >= clip_limit`, filtered by positive integer `min_clip_run`. Apart from the returned run list, accumulator state must remain constant-size.
- **Follow-up:** Add immutable `DelayEstimate(lag, score, overlap)` and `estimate_delay(left, right, max_lag)`. Score every integer lag in `[-max_lag, max_lag]` with the specified integer cross-correlation over valid overlapping indices. Pick greatest score, then smallest absolute lag, then smallest signed lag; report its overlap. Accept one-shot unequal-length integer iterables and reject invalid samples or negative/noninteger `max_lag`.
- **Locked acceptance and scope:** After the staged order `initial → steer-baseline → steer-pivot → steer-followup → steer-final-lock`, run and fix the complete suite, edit only `signal_lab/`, and call `await goal.complete()` only after the lock. Protected artifacts: `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `SIGNAL LAB GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 188.15 s vs 281.53 s; Δ -93.38 s (-33.17%).
- **Model calls:** 15 vs 23; Δ -8 (-34.78%).
- **Tool calls:** 15 vs 17; Δ -2 (-11.76%).
- **Compactions:** 3 vs 4; Δ -1 (-25.00%).
- **Total tokens:** 139,483 vs 212,777; Δ -73,294 (-34.45%).
- **Reported API cost:** $0.435337 vs $0.641974; Δ -0.206637 (-32.19%).
- **Visible tool bytes:** 142,747 vs 24,394; Δ +118,353 (+485.17%).
- **Prompt-cache reuse:** 59.33% vs 64.44%; Δ -5.12 pp.

- **Expected exact final response:** `SIGNAL LAB GOAL COMPLETE`
- **vanilla prime-agent final response:** `SIGNAL LAB GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `SIGNAL LAB GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 281.53 s | 188.15 s | -93.38 s | -33.17% |
| Lifecycle wall time | 281.99 s | 188.61 s | -93.38 s | -33.11% |
| Instruction wall time | 281.53 s | 188.15 s | -93.38 s | -33.17% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 23 | 15 | -8 | -34.78% |
| Tool calls | 17 | 15 | -2 | -11.76% |
| Tool results | 17 | 15 | -2 | -11.76% |
| Visible tool bytes | 24,394 | 142,747 | +118,353 | +485.17% |
| Compactions | 4 | 3 | -1 | -25.00% |
| Goal-context injections | 7 | 1 | -6 | -85.71% |
| Assistant output events | 23 | 15 | -8 | -34.78% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 15 | 7 | -8 | -53.33% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 29 | 16 | -13 | -44.83% |
| RPC compaction completions | 4 | 3 | -1 | -25.00% |
| Compaction requests | 6 | 2 | -4 | -66.67% |
| Compaction waits | 4 | 0 | -4 | -100.00% |
| Accepted stage/command responses | 11 | 6 | -5 | -45.45% |
| Rejected stage/command responses | 4 | 1 | -3 | -75.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 28 | 15 | -13 | -46.43% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 1 | -5 | -83.33% |
| Maximum goal tokens used | 79,807 | 58,641 | -21,166 | -26.52% |
| Completed RPC compactions | 4 | 3 | -1 | -25.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | -1 | -50.00% |
| Failed compaction requests | 4 | 1 | -3 | -75.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 4 | 0 | -4 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 73,176 | 55,113 | -18,063 | -24.68% |
| Output tokens | 6,993 | 3,986 | -3,007 | -43.00% |
| Cache-read tokens | 132,608 | 80,384 | -52,224 | -39.38% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 212,777 | 139,483 | -73,294 | -34.45% |
| Prompt-cache reuse | 64.44% | 59.33% | -5.12 pp | — |
| Input cost | $0.365880 | $0.275565 | -0.090315 | -24.68% |
| Output cost | $0.209790 | $0.119580 | -0.090210 | -43.00% |
| Cache-read cost | $0.066304 | $0.040192 | -0.026112 | -39.38% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.641974 | $0.435337 | -0.206637 | -32.19% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 14 | +14 | n/a (zero baseline) |
| Archive source bytes | 0 | 132,192 | +132,192 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 10,554 | +10,554 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 7.98% | +7.98 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 275,023 | +275,023 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 130,919 | +130,919 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,221 | +39,221 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 264,384 | +264,384 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 4 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 80,384 | +80,384 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 55,113 | +55,113 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 10 | +10 | n/a (zero baseline) |


---

<a id="task-10"></a>

## Task 10: Polyphonic Rhythm Quantizer (`rhythm`)

- **Domain:** Music processing; exact rhythm quantization and score engraving.
- **Initial task and baseline:** Implement immutable `Note(pitch, start, duration, velocity=64)` with `Fraction` times and `quantize(notes, step)`. For a positive `Fraction` step, snap each start and end independently to the nearest step multiple; ties go earlier. If snapping would produce zero/negative duration, move the end to the next grid point. Validate MIDI pitch/velocity in `0..127` and positive duration, keep caller inputs unchanged, and sort results by `(start, pitch, original_input_index)`.
- **Live steering constraint:** Keep all times as `Fraction`, preserve deterministic tie-breaking and original-order behavior, and never collapse a note to zero duration. Keep the goal active.
- **Pivot:** Preserve uniform-step behavior and add immutable `SwingGrid(split=Fraction(2, 3))`, whose points are each integer beat and `beat + split`; `quantize(..., grid=...)` uses it while `step` remains backward-compatible. A nonnegative `chord_tolerance` forms transitive onset clusters from consecutive sorted gaps. Give a cluster the grid point minimizing total absolute onset error, with earlier-point ties; quantize ends independently and advance any nonpositive duration to the next grid point. Zero tolerance changes only genuinely identical onsets.
- **Follow-up:** Add immutable `NoteFragment(...)` and `engrave(notes, bar_length)`. In stable note order, greedily use the lowest voice whose last end is no later than the new start; identical start/end notes may share a voice as a chord. Create a voice only when needed. Split at every bar line and set `tie_in`/`tie_out` on nonfirst/nonlast fragments. Return fragments by `(start, voice, pitch, fragment_order)`.
- **Locked acceptance and scope:** Follow all five interventions in order; after lock, run the full suite, edit only `rhythm/`, then call `await goal.complete()`. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `RHYTHM GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 537.30 s vs 348.83 s; Δ +188.46 s (+54.03%).
- **Model calls:** 26 vs 20; Δ +6 (+30.00%).
- **Tool calls:** 24 vs 16; Δ +8 (+50.00%).
- **Compactions:** 10 vs 6; Δ +4 (+66.67%).
- **Total tokens:** 280,478 vs 195,624; Δ +84,854 (+43.38%).
- **Reported API cost:** $0.996553 vs $0.715811; Δ +0.280742 (+39.22%).
- **Visible tool bytes:** 236,239 vs 92,964; Δ +143,275 (+154.12%).
- **Prompt-cache reuse:** 47.38% vs 53.36%; Δ -5.98 pp.

- **Expected exact final response:** `RHYTHM GOAL COMPLETE`
- **vanilla prime-agent final response:** `RHYTHM GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `RHYTHM GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 348.83 s | 537.30 s | +188.46 s | +54.03% |
| Lifecycle wall time | 349.14 s | 537.71 s | +188.57 s | +54.01% |
| Instruction wall time | 348.83 s | 537.30 s | +188.46 s | +54.03% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 20 | 26 | +6 | +30.00% |
| Tool calls | 16 | 24 | +8 | +50.00% |
| Tool results | 16 | 24 | +8 | +50.00% |
| Visible tool bytes | 92,964 | 236,239 | +143,275 | +154.12% |
| Compactions | 6 | 10 | +4 | +66.67% |
| Goal-context injections | 7 | 9 | +2 | +28.57% |
| Assistant output events | 20 | 26 | +6 | +30.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 13 | 9 | -4 | -30.77% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 28 | 36 | +8 | +28.57% |
| RPC compaction completions | 6 | 10 | +4 | +66.67% |
| Compaction requests | 5 | 3 | -2 | -40.00% |
| Compaction waits | 3 | 1 | -2 | -66.67% |
| Accepted stage/command responses | 10 | 8 | -2 | -20.00% |
| Rejected stage/command responses | 3 | 1 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 3 | -1 | -25.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 27 | 35 | +8 | +29.63% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 8 | +2 | +33.33% |
| Maximum goal tokens used | 94,154 | 149,508 | +55,354 | +58.79% |
| Completed RPC compactions | 6 | 10 | +4 | +66.67% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 3 | 1 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 3 | 1 | -2 | -66.67% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 87,701 | 143,859 | +56,158 | +64.03% |
| Output tokens | 7,571 | 7,083 | -488 | -6.45% |
| Cache-read tokens | 100,352 | 129,536 | +29,184 | +29.08% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 195,624 | 280,478 | +84,854 | +43.38% |
| Prompt-cache reuse | 53.36% | 47.38% | -5.98 pp | — |
| Input cost | $0.438505 | $0.719295 | +0.280790 | +64.03% |
| Output cost | $0.227130 | $0.212490 | -0.014640 | -6.45% |
| Cache-read cost | $0.050176 | $0.064768 | +0.014592 | +29.08% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.715811 | $0.996553 | +0.280742 | +39.22% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 23 | +23 | n/a (zero baseline) |
| Archive source bytes | 0 | 199,510 | +199,510 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 24,209 | +24,209 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 12.13% | +12.13 pp | — |
| Archive chunks | 0 | 32 | +32 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 436,587 | +436,587 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 196,301 | +196,301 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,214 | +39,214 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 399,020 | +399,020 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 11 | +11 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 129,536 | +129,536 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 143,859 | +143,859 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 15 | +15 | n/a (zero baseline) |


---

<a id="task-11"></a>

## Task 11: Versioned Record Migration Engine (`record-migration`)

- **Domain:** Data engineering; JSON record migration, schema evolution, and batch validation.
- **Initial task and baseline:** Implement pure `apply_operations(record, operations)` in `record_migrate`, returning a deep copy. Navigate nested objects with RFC 6901 pointers and `~0`/`~1` escaping. Operations have unique string IDs and support: required-source/absent-target `rename`, absent-only deep-copied `add_default`, present-only `drop`, and strict `coerce` to integer, string, boolean, or normalized finite decimal string. The accepted primitive forms are deliberately narrow (for example, booleans are not integers and only exact `true`/`false` strings coerce to boolean). Failures raise `MigrationError` carrying operation ID and path without changing input.
- **Live steering constraint:** Preserve deep input purity, strict coercions, escaped-pointer semantics, and operation-specific stable errors. Keep the goal open.
- **Pivot:** Add `migrate(record, graph, source, target)` for directed version edges with unique IDs, nonnegative integer costs, and operations. Validate deterministically, tolerate graph cycles without looping, and select the lowest-total-cost route; equal cost is resolved by the lexicographically smallest complete edge-ID sequence. Apply operations in route order to a pure copy and return the migrated record plus chosen edge IDs. Raise stable `VersionError(source, target)` if unreachable.
- **Follow-up:** Add `migrate_batch(..., schema, mode="atomic", dry_run=False)`. Validate required pointers and strict primitive types after migration. Atomic mode raises `BatchError(index, error)` at the first bad item and returns no partial result. Lenient mode keeps input order and returns success entries (`index`, `record`, `edge_ids`) or stable error entries (`index`, `error.code`, `error.path`). Dry-run still selects, transforms, and validates but omits successful records. Consume a one-shot records iterable once and remain pure.
- **Locked acceptance and scope:** Preserve the intervention order and complete only after lock. Edits are restricted to `record_migrate/`; protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Run the complete suite before `await goal.complete()`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `RECORD MIGRATION GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 515.91 s vs 451.38 s; Δ +64.53 s (+14.30%).
- **Model calls:** 21 vs 19; Δ +2 (+10.53%).
- **Tool calls:** 22 vs 17; Δ +5 (+29.41%).
- **Compactions:** 9 vs 8; Δ +1 (+12.50%).
- **Total tokens:** 231,685 vs 205,187; Δ +26,498 (+12.91%).
- **Reported API cost:** $0.834085 vs $0.876317; Δ -0.042232 (-4.82%).
- **Visible tool bytes:** 306,483 vs 119,028; Δ +187,455 (+157.49%).
- **Prompt-cache reuse:** 53.95% vs 43.67%; Δ +10.28 pp.

- **Expected exact final response:** `RECORD MIGRATION GOAL COMPLETE`
- **vanilla prime-agent final response:** `RECORD MIGRATION GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `RECORD MIGRATION GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 451.38 s | 515.91 s | +64.53 s | +14.30% |
| Lifecycle wall time | 451.63 s | 516.40 s | +64.77 s | +14.34% |
| Instruction wall time | 451.38 s | 515.91 s | +64.53 s | +14.30% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 19 | 21 | +2 | +10.53% |
| Tool calls | 17 | 22 | +5 | +29.41% |
| Tool results | 17 | 22 | +5 | +29.41% |
| Visible tool bytes | 119,028 | 306,483 | +187,455 | +157.49% |
| Compactions | 8 | 9 | +1 | +12.50% |
| Goal-context injections | 6 | 8 | +2 | +33.33% |
| Assistant output events | 19 | 21 | +2 | +10.53% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 24 | 28 | +4 | +16.67% |
| RPC compaction completions | 8 | 9 | +1 | +12.50% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 7 | 6 | -1 | -14.29% |
| Rejected stage/command responses | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 23 | 27 | +4 | +17.39% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 5 | 7 | +2 | +40.00% |
| Maximum goal tokens used | 116,085 | 110,478 | -5,607 | -4.83% |
| Completed RPC compactions | 8 | 9 | +1 | +12.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | -1 | -50.00% |
| Failed compaction requests | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 110,277 | 102,681 | -7,596 | -6.89% |
| Output tokens | 9,406 | 8,684 | -722 | -7.68% |
| Cache-read tokens | 85,504 | 120,320 | +34,816 | +40.72% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 205,187 | 231,685 | +26,498 | +12.91% |
| Prompt-cache reuse | 43.67% | 53.95% | +10.28 pp | — |
| Input cost | $0.551385 | $0.513405 | -0.037980 | -6.89% |
| Output cost | $0.282180 | $0.260520 | -0.021660 | -7.68% |
| Cache-read cost | $0.042752 | $0.060160 | +0.017408 | +40.72% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.876317 | $0.834085 | -0.042232 | -4.82% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 21 | +21 | n/a (zero baseline) |
| Archive source bytes | 0 | 262,682 | +262,682 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 29,635 | +29,635 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 11.28% | +11.28 pp | — |
| Archive chunks | 0 | 29 | +29 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,948 | +65,948 | n/a (zero baseline) |
| Source bytes admitted | 0 | 577,500 | +577,500 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 260,306 | +260,306 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 25,683 | +25,683 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 525,926 | +525,926 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 10 | +10 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 120,320 | +120,320 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 102,681 | +102,681 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


---

<a id="task-12"></a>

## Task 12: Transit Fare Settlement Engine (`transit-fares`)

- **Domain:** Public transport billing; tap pairing, fare products, and capped settlement.
- **Initial task and baseline:** Implement pure `settle(taps, rules, riders=None)` in `transit_fares`. Sort taps by `(at, id)` and pair each `out` with that rider's open `in`; ignore unmatched outs and charge a configured missing-tap penalty for remaining ins. Price trips from zone span and half-open peak/off-peak time windows, using the trip start. Emit two-decimal `trip`/`missing` rows with rider, start, and service day. A service day changes exactly at 04:00, so earlier starts belong to the prior date; return rows by `(service_day, rider, started_at, kind)`.
- **Live steering constraint:** Preserve `Decimal` cent arithmetic, the exact 04:00 boundary, deterministic pairing, and caller-input purity. Keep the goal active.
- **Pivot:** Support optional `daily_cap`. After pairing/pricing, group by rider and service day. If positive charges exceed the cap, append one negative `daily_cap` row that makes the group total exact. Give it the group's lexically latest start time and sort it after ordinary charges at that time. Cap riders separately and retain service-day/rider group order.
- **Follow-up:** Rider products have inclusive effective start/end service days, integer discount percent, and optional weekly cap. Discount each positive raw charge first, rounding cents with `ROUND_HALF_EVEN`; then apply daily caps, then ISO-week (Monday-starting) caps per rider. Put one `weekly_cap` adjustment in the last service-day group of the affected week, after a daily adjustment, so the week total equals the cap.
- **Locked acceptance and scope:** Accept all staged requirements before completion. After lock, edits may touch only `transit_fares/`; protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Then run the full suite and complete the goal.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `TRANSIT FARES GOAL COMPLETE`.

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 213.00 s vs 600.00 s; Δ -387.00 s (-64.50%).
- **Model calls:** 13 vs 68; Δ -55 (-80.88%).
- **Tool calls:** 18 vs 15; Δ +3 (+20.00%).
- **Compactions:** 4 vs 11; Δ -7 (-63.64%).
- **Total tokens:** 134,819 vs 668,426; Δ -533,607 (-79.83%).
- **Reported API cost:** $0.445102 vs $1.408157; Δ -0.963055 (-68.39%).
- **Visible tool bytes:** 210,825 vs 83,724; Δ +127,101 (+151.81%).
- **Prompt-cache reuse:** 55.55% vs 70.56%; Δ -15.02 pp.

- **Expected exact final response:** `TRANSIT FARES GOAL COMPLETE`
- **vanilla prime-agent final response:** `Awaiting `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `TRANSIT FARES GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 213.00 s | -387.00 s | -64.50% |
| Lifecycle wall time | 600.42 s | 213.13 s | -387.29 s | -64.50% |
| Instruction wall time | 600.00 s | 213.00 s | -387.00 s | -64.50% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 68 | 13 | -55 | -80.88% |
| Tool calls | 15 | 18 | +3 | +20.00% |
| Tool results | 15 | 18 | +3 | +20.00% |
| Visible tool bytes | 83,724 | 210,825 | +127,101 | +151.81% |
| Compactions | 11 | 4 | -7 | -63.64% |
| Goal-context injections | 55 | 3 | -52 | -94.55% |
| Assistant output events | 68 | 13 | -55 | -80.88% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 11 | 7 | -4 | -36.36% |
| Test-run observations | 3 | 5 | +2 | +66.67% |
| Goal updates | 122 | 15 | -107 | -87.70% |
| RPC compaction completions | 11 | 4 | -7 | -63.64% |
| Compaction requests | 4 | 2 | -2 | -50.00% |
| Compaction waits | 3 | 0 | -3 | -100.00% |
| Accepted stage/command responses | 8 | 6 | -2 | -25.00% |
| Rejected stage/command responses | 3 | 1 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 3 | +1 | +50.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 122 | 14 | -108 | -88.52% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 55 | 2 | -53 | -96.36% |
| Maximum goal tokens used | 201,482 | 60,705 | -140,777 | -69.87% |
| Completed RPC compactions | 11 | 4 | -7 | -63.64% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 3 | 1 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 3 | 0 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 194,791 | 58,188 | -136,603 | -70.13% |
| Output tokens | 6,691 | 3,927 | -2,764 | -41.31% |
| Cache-read tokens | 466,944 | 72,704 | -394,240 | -84.43% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 668,426 | 134,819 | -533,607 | -79.83% |
| Prompt-cache reuse | 70.56% | 55.55% | -15.02 pp | — |
| Input cost | $0.973955 | $0.290940 | -0.683015 | -70.13% |
| Output cost | $0.200730 | $0.117810 | -0.082920 | -41.31% |
| Cache-read cost | $0.233472 | $0.036352 | -0.197120 | -84.43% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.408157 | $0.445102 | -0.963055 | -68.39% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 17 | +17 | n/a (zero baseline) |
| Archive source bytes | 0 | 197,820 | +197,820 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 16,343 | +16,343 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.26% | +8.26 pp | — |
| Archive chunks | 0 | 23 | +23 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 414,828 | +414,828 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 195,572 | +195,572 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,084 | +39,084 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,640 | +395,640 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 72,704 | +72,704 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 58,188 | +58,188 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 9 | +9 | n/a (zero baseline) |


---

<a id="task-13"></a>

## Task 13: Correctable League Standings (`league-standings`)

- **Domain:** Sports competition management; standings, configurable tie-breaks, and historical corrections.
- **Initial task and baseline:** Implement `League`, immutable `TeamStanding`, `record(...)`, and `table()`. Derive played/won/drawn/lost, goals, goal difference, and standard 3/1/0 points from immutable match records. Sort by descending points, goal difference, and goals for, then lexical team name; assign sequential ranks. Reject duplicate match IDs, same-team fixtures, empty names, and negative/noninteger scores atomically.
- **Live steering constraint:** Validation must remain atomic, rankings deterministic, and every statistic derived from immutable match records rather than incrementally corrupted state. Do not complete yet.
- **Pivot:** Constructor options configure nonnegative integer win/draw/loss points and optional head-to-head. When enabled, first group teams tied on overall points, then order each multi-team group by a one-level mini-table using only their mutual matches: mini points, goal difference, goals for, then overall goal difference, overall goals for, and lexical name. Do not recursively split/recompute smaller tie groups; use configured scoring everywhere.
- **Follow-up:** Add event-based `apply(event)` with unique, strictly increasing positive integer `seq`. `record` creates a match; `correct` supplies a full same-ID replacement for an active earlier match; `void` targets an active earlier match. Invalid events are atomic. `table(as_of=None)` replays through an inclusive sequence without changing current state, and legacy `record(...)` delegates to an automatically sequenced record event.
- **Locked acceptance and scope:** Preserve the complete staged order. Once locked, run all tests, edit only `league_table/`, and then complete the goal. Protected files are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `LEAGUE TABLE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 312.97 s vs 489.13 s; Δ -176.16 s (-36.01%).
- **Model calls:** 20 vs 24; Δ -4 (-16.67%).
- **Tool calls:** 19 vs 24; Δ -5 (-20.83%).
- **Compactions:** 5 vs 9; Δ -4 (-44.44%).
- **Total tokens:** 212,567 vs 215,589; Δ -3,022 (-1.40%).
- **Reported API cost:** $0.729285 vs $0.749853; Δ -0.020568 (-2.74%).
- **Visible tool bytes:** 347,421 vs 128,645; Δ +218,776 (+170.06%).
- **Prompt-cache reuse:** 56.15% vs 61.68%; Δ -5.53 pp.

- **Expected exact final response:** `LEAGUE TABLE GOAL COMPLETE`
- **vanilla prime-agent final response:** `LEAGUE TABLE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `LEAGUE TABLE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 489.13 s | 312.97 s | -176.16 s | -36.01% |
| Lifecycle wall time | 489.27 s | 313.40 s | -175.87 s | -35.95% |
| Instruction wall time | 489.13 s | 312.97 s | -176.16 s | -36.01% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 24 | 20 | -4 | -16.67% |
| Tool calls | 24 | 19 | -5 | -20.83% |
| Tool results | 24 | 19 | -5 | -20.83% |
| Visible tool bytes | 128,645 | 347,421 | +218,776 | +170.06% |
| Compactions | 9 | 5 | -4 | -44.44% |
| Goal-context injections | 7 | 4 | -3 | -42.86% |
| Assistant output events | 24 | 20 | -4 | -16.67% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 6 | 5 | -1 | -16.67% |
| Goal updates | 32 | 23 | -9 | -28.12% |
| RPC compaction completions | 10 | 5 | -5 | -50.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 5 | 4 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 31 | 22 | -9 | -29.03% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 3 | -3 | -50.00% |
| Maximum goal tokens used | 87,958 | 96,580 | +8,622 | +9.80% |
| Completed RPC compactions | 10 | 5 | -5 | -50.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 78,881 | 89,973 | +11,092 | +14.06% |
| Output tokens | 9,732 | 7,394 | -2,338 | -24.02% |
| Cache-read tokens | 126,976 | 115,200 | -11,776 | -9.27% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 215,589 | 212,567 | -3,022 | -1.40% |
| Prompt-cache reuse | 61.68% | 56.15% | -5.53 pp | — |
| Input cost | $0.394405 | $0.449865 | +0.055460 | +14.06% |
| Output cost | $0.291960 | $0.221820 | -0.070140 | -24.02% |
| Cache-read cost | $0.063488 | $0.057600 | -0.005888 | -9.27% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.749853 | $0.729285 | -0.020568 | -2.74% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 18 | +18 | n/a (zero baseline) |
| Archive source bytes | 0 | 327,890 | +327,890 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 26,439 | +26,439 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.06% | +8.06 pp | — |
| Archive chunks | 0 | 25 | +25 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 692,941 | +692,941 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 9,346 | +9,346 | n/a (zero baseline) |
| Result bytes projected out | 0 | 325,139 | +325,139 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 37,946 | +37,946 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 655,780 | +655,780 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 115,200 | +115,200 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 89,973 | +89,973 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 15 | +15 | n/a (zero baseline) |


---

<a id="task-14"></a>

## Task 14: Bank Deposit Reconciler (`bank-reconciliation`)

- **Domain:** Financial operations; deterministic bank-to-ledger reconciliation and split-deposit matching.
- **Initial task and baseline:** Implement pure `reconcile(...)` in `bank_reconcile`. Validate unique string IDs, ISO dates, finite decimal-string amounts, and references. Normalize references to uppercase ASCII alphanumerics. With exact default matching, pair one bank row to one ledger row only when amount/reference match and dates are within `max_days`. Select globally, not greedily: maximize pair count, minimize total day distance, then choose the lexically smallest sorted pair sequence. Return lexical match groups and unmatched IDs.
- **Live steering constraint:** Keep `Decimal` arithmetic, input purity, global optimization, and lexical output deterministic. Keep the goal open.
- **Pivot:** Add normalized/canonical `reference_aliases` (keys and values normalized; unspecified references self-map) and nonnegative finite `amount_tolerance`. Candidate pairs may differ by at most the tolerance. Global priority becomes maximum count, minimum total amount discrepancy, minimum total date distance, then lexical pair signature. Reordering either entries or alias mappings must not alter output.
- **Follow-up:** Let integer `max_bundle` range from 1 to 3. Larger values permit one bank entry against 2–3 ledgers or one ledger against 2–3 bank entries, never many-to-many. All members share a canonical reference, each bundled date is close enough to the singleton, and summed amounts honor tolerance. Select disjoint groups globally by: most reconciled entries, most groups, least total discrepancy, least total member-to-singleton day distance, then lexical sorted group signature. `max_bundle=1` must preserve prior one-to-one results.
- **Locked acceptance and scope:** After all steering and the final lock, edit only `bank_reconcile/`, preserve `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`, run the full suite, then call `await goal.complete()`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `BANK RECONCILE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 350.12 s vs 535.12 s; Δ -185.00 s (-34.57%).
- **Model calls:** 20 vs 24; Δ -4 (-16.67%).
- **Tool calls:** 19 vs 22; Δ -3 (-13.64%).
- **Compactions:** 6 vs 9; Δ -3 (-33.33%).
- **Total tokens:** 213,069 vs 258,947; Δ -45,878 (-17.72%).
- **Reported API cost:** $0.667483 vs $0.949759; Δ -0.282276 (-29.72%).
- **Visible tool bytes:** 148,322 vs 236,620; Δ -88,298 (-37.32%).
- **Prompt-cache reuse:** 62.98% vs 55.55%; Δ +7.44 pp.

- **Expected exact final response:** `BANK RECONCILE GOAL COMPLETE`
- **vanilla prime-agent final response:** `BANK RECONCILE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `BANK RECONCILE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 535.12 s | 350.12 s | -185.00 s | -34.57% |
| Lifecycle wall time | 535.41 s | 350.57 s | -184.85 s | -34.52% |
| Instruction wall time | 535.12 s | 350.12 s | -185.00 s | -34.57% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 24 | 20 | -4 | -16.67% |
| Tool calls | 22 | 19 | -3 | -13.64% |
| Tool results | 22 | 19 | -3 | -13.64% |
| Visible tool bytes | 236,620 | 148,322 | -88,298 | -37.32% |
| Compactions | 9 | 6 | -3 | -33.33% |
| Goal-context injections | 7 | 5 | -2 | -28.57% |
| Assistant output events | 24 | 20 | -4 | -16.67% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 31 | 24 | -7 | -22.58% |
| RPC compaction completions | 9 | 6 | -3 | -33.33% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 30 | 23 | -7 | -23.33% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 4 | -2 | -33.33% |
| Maximum goal tokens used | 116,754 | 82,457 | -34,297 | -29.38% |
| Completed RPC compactions | 9 | 6 | -3 | -33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 110,227 | 76,131 | -34,096 | -30.93% |
| Output tokens | 10,992 | 7,402 | -3,590 | -32.66% |
| Cache-read tokens | 137,728 | 129,536 | -8,192 | -5.95% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 258,947 | 213,069 | -45,878 | -17.72% |
| Prompt-cache reuse | 55.55% | 62.98% | +7.44 pp | — |
| Input cost | $0.551135 | $0.380655 | -0.170480 | -30.93% |
| Output cost | $0.329760 | $0.222060 | -0.107700 | -32.66% |
| Cache-read cost | $0.068864 | $0.064768 | -0.004096 | -5.95% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.949759 | $0.667483 | -0.282276 | -29.72% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 18 | +18 | n/a (zero baseline) |
| Archive source bytes | 0 | 131,156 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 14,684 | +14,684 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 11.20% | +11.20 pp | — |
| Archive chunks | 0 | 23 | +23 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 287,721 | +287,721 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 130,188 | +130,188 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 38,449 | +38,449 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 262,312 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 7 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 129,536 | +129,536 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 76,131 | +76,131 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 15 | +15 | n/a (zero baseline) |


---

<a id="task-15"></a>

## Task 15: Hierarchical Authorization Engine (`authorization`)

- **Domain:** Security and identity; hierarchical RBAC/ABAC-style policy evaluation with delegation.
- **Initial task and baseline:** Implement `PolicyEngine(resources, grants)`, immutable `Decision(allowed, reason_ids)`, and `authorize(subject, resource, action)`. Validate a finite acyclic resource forest and all grant references/IDs/subjects/actions. Grants apply at their resource and descendants; initial actions match exactly or `*`. Consider only matching grants on the nearest resource ancestor and return their IDs lexically; otherwise deny with no reasons.
- **Live steering constraint:** Validate policy graphs, preserve caller inputs, apply nearest-resource specificity, and produce deterministic reason IDs. Keep the goal active.
- **Pivot:** Add nested `memberships` with user or `group:<name>` members and reject group cycles. Grant subjects may be users/groups; effects are `allow` (default) or `deny`; action patterns also support family suffix `:*`. Select nearest-resource matches first; at that level, any deny defeats every allow and the decision reports all winning-effect IDs in lexical order. Results must not depend on membership/grant ordering.
- **Follow-up:** Add unique-ID direct delegations with source, target, resource, action patterns, inclusive `not_before`, and exclusive `expires`. `authorize(..., at=ISO_TIMESTAMP)` considers active delegations; omitting `at` ignores them. A source can transfer only an effective allow it gets directly or through groups for the requested resource/action. Delegation is one-hop, cannot transfer/bypass denies, competes at its resource specificity, and loses to same-specificity direct/group denies. Winning reasons use `delegation_id:source_grant_id`, lexically sorted. Validate timestamps, resource/action references, and a nonempty interval.
- **Locked acceptance and scope:** Process all five interventions, wait for lock, and edit only `authz/`. Protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Run the complete suite before completing the goal.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `AUTHORIZATION GOAL COMPLETE`.

### Measured outcome

**Verdict:** Neither variant meets all acceptance criteria; resource use is reported descriptively, not as a formal efficiency result.

- **Wall time:** 600.00 s vs 600.00 s; Δ +0.00 s (+0.00%).
- **Model calls:** 28 vs 24; Δ +4 (+16.67%).
- **Tool calls:** 28 vs 22; Δ +6 (+27.27%).
- **Compactions:** 14 vs 9; Δ +5 (+55.56%).
- **Total tokens:** 280,056 vs 232,315; Δ +47,741 (+20.55%).
- **Reported API cost:** $0.982738 vs $1.012801; Δ -0.030063 (-2.97%).
- **Visible tool bytes:** 194,384 vs 201,814; Δ -7,430 (-3.68%).
- **Prompt-cache reuse:** 51.46% vs 41.82%; Δ +9.64 pp.

- **Expected exact final response:** `AUTHORIZATION GOAL COMPLETE`
- **vanilla prime-agent final response:** `The pivot suite passes 6/6. I will now add the nontransitive, time-bounded delegation rules from `FOLLOWUP.md`, preserve the current grant semantics, and rerun the full suite. Completion will remain gated on the final lock.`
- **prime-context 8.1.0 final response:** `The r3 changes pass all 6 tests. I am now adding delegation records as a separate, snapshotted input. Evaluation will keep delegation one-hop only and merge delegated allows into the existing nearest-resource decision step.`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | no |
| Runner task-completed gate | yes | no | no |
| External cumulative tests | 9/9 | 9/9 | 0/0 |
| External-tests gate | yes | yes | no |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | active |
| Goal completed after lock | yes | no | no |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | no | no |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | no |
| Run error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Lifecycle wall time | 600.48 s | 600.43 s | -0.06 s | -0.01% |
| Instruction wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 24 | 28 | +4 | +16.67% |
| Tool calls | 22 | 28 | +6 | +27.27% |
| Tool results | 22 | 28 | +6 | +27.27% |
| Visible tool bytes | 201,814 | 194,384 | -7,430 | -3.68% |
| Compactions | 9 | 14 | +5 | +55.56% |
| Goal-context injections | 9 | 13 | +4 | +44.44% |
| Assistant output events | 24 | 28 | +4 | +16.67% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 11 | 7 | -4 | -36.36% |
| Test-run observations | 4 | 4 | +0 | +0.00% |
| Goal updates | 35 | 43 | +8 | +22.86% |
| RPC compaction completions | 9 | 14 | +5 | +55.56% |
| Compaction requests | 4 | 2 | -2 | -50.00% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 8 | 6 | -2 | -25.00% |
| Rejected stage/command responses | 3 | 1 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 2 | -1 | -33.33% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 35 | 43 | +8 | +22.86% |
| Complete goal updates | 0 | 0 | +0 | 0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 9 | 13 | +4 | +44.44% |
| Maximum goal tokens used | 139,643 | 140,280 | +637 | +0.46% |
| Completed RPC compactions | 9 | 14 | +5 | +55.56% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 3 | 1 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 128,913 | 131,822 | +2,909 | +2.26% |
| Output tokens | 10,730 | 8,458 | -2,272 | -21.17% |
| Cache-read tokens | 92,672 | 139,776 | +47,104 | +50.83% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 232,315 | 280,056 | +47,741 | +20.55% |
| Prompt-cache reuse | 41.82% | 51.46% | +9.64 pp | — |
| Input cost | $0.644565 | $0.659110 | +0.014545 | +2.26% |
| Output cost | $0.321900 | $0.253740 | -0.068160 | -21.17% |
| Cache-read cost | $0.046336 | $0.069888 | +0.023552 | +50.83% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.012801 | $0.982738 | -0.030063 | -2.97% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 28 | +28 | n/a (zero baseline) |
| Archive source bytes | 0 | 67,645 | +67,645 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 39,899 | +39,899 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 58.98% | +58.98 pp | — |
| Archive chunks | 0 | 39 | +39 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,949 | +65,949 | n/a (zero baseline) |
| Source bytes admitted | 0 | 281,261 | +281,261 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 8,591 | +8,591 | n/a (zero baseline) |
| Result bytes projected out | 0 | 66,211 | +66,211 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 13,179 | +13,179 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 135,853 | +135,853 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 15 | +15 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 139,776 | +139,776 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 131,822 | +131,822 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 13 | +13 | n/a (zero baseline) |


---

<a id="task-16"></a>

## Task 16: Subscription Invoice Generator (`subscription-invoice`)

- **Domain:** SaaS billing; prorated subscriptions, metered usage, tax, discounts, and credit.
- **Initial task and baseline:** Implement pure `generate_invoice(period, subscription, events=())` in `subscription_invoice`. Validate `YYYY-MM`, subscription dates, plan ID, and finite nonnegative monthly Decimal price. Intersect the subscription's inclusive start/exclusive end interval with the month. If nonempty, emit a stable recurring line with plan, inclusive start, exclusive end, and monthly price prorated by active calendar days/month days using `ROUND_HALF_EVEN` cents. Return lines plus two-decimal subtotal/total; inactive periods have no lines.
- **Live steering constraint:** Preserve half-even Decimal cents, exclusive end dates, caller-input purity, and stable line ordering. Keep the goal active.
- **Pivot:** Add unique-ID `plan_change` events with effective dates and complete replacement plans, splitting active service at in-month changes and rounding each recurring segment separately. Add positive-integer `usage` events assigned to the active segment containing their date. Plans may have graduated cumulative tiers ending optionally in an unbounded `null` tier. Aggregate usage per segment, reset tier accounting at each plan change, and place each usage line after that segment's recurring line. Ignore usage outside service, reject duplicate plan-change dates, and make event order irrelevant.
- **Follow-up:** Add subscription-level integer discount percent, nonnegative tax percent, and nonnegative credit balance, all defaulting to zero. Per recurring/usage line, round discount from gross, then round tax independently from post-discount net; add `discount`, `net`, and `tax`. Return gross `subtotal`, `discount_total`, `tax_total`, and `pre_credit_total`. Apply at most the available credit and nonnegative pre-credit total, then return `credit_applied`, `ending_credit`, and final `total`, all with two decimals.
- **Locked acceptance and scope:** After the required intervention order and final lock, edit only `subscription_invoice/`; protect `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Run the entire suite, fix failures, and only then call `await goal.complete()`.
- **Expected completion:** `TEST_RESULT PASS 9/9` (3 baseline + 3 pivot + 3 follow-up tests); goal status `complete`, completed after lock; final response exactly `SUBSCRIPTION INVOICE GOAL COMPLETE`.

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 304.05 s vs 521.66 s; Δ -217.61 s (-41.71%).
- **Model calls:** 17 vs 22; Δ -5 (-22.73%).
- **Tool calls:** 16 vs 21; Δ -5 (-23.81%).
- **Compactions:** 5 vs 9; Δ -4 (-44.44%).
- **Total tokens:** 178,984 vs 228,307; Δ -49,323 (-21.60%).
- **Reported API cost:** $0.650167 vs $0.896637; Δ -0.246470 (-27.49%).
- **Visible tool bytes:** 221,236 vs 251,673; Δ -30,437 (-12.09%).
- **Prompt-cache reuse:** 54.18% vs 49.66%; Δ +4.51 pp.

- **Expected exact final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`
- **vanilla prime-agent final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 521.66 s | 304.05 s | -217.61 s | -41.71% |
| Lifecycle wall time | 522.16 s | 304.41 s | -217.75 s | -41.70% |
| Instruction wall time | 521.66 s | 304.05 s | -217.61 s | -41.71% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 22 | 17 | -5 | -22.73% |
| Tool calls | 21 | 16 | -5 | -23.81% |
| Tool results | 21 | 16 | -5 | -23.81% |
| Visible tool bytes | 251,673 | 221,236 | -30,437 | -12.09% |
| Compactions | 9 | 5 | -4 | -44.44% |
| Goal-context injections | 7 | 4 | -3 | -42.86% |
| Assistant output events | 22 | 17 | -5 | -22.73% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 30 | 20 | -10 | -33.33% |
| RPC compaction completions | 9 | 5 | -4 | -44.44% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 2 | 0 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 29 | 19 | -10 | -34.48% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 3 | -3 | -50.00% |
| Maximum goal tokens used | 107,468 | 85,309 | -22,159 | -20.62% |
| Completed RPC compactions | 9 | 5 | -4 | -44.44% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 2 | 0 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 110,021 | 78,817 | -31,204 | -28.36% |
| Output tokens | 9,742 | 6,983 | -2,759 | -28.32% |
| Cache-read tokens | 108,544 | 93,184 | -15,360 | -14.15% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 228,307 | 178,984 | -49,323 | -21.60% |
| Prompt-cache reuse | 49.66% | 54.18% | +4.51 pp | — |
| Input cost | $0.550105 | $0.394085 | -0.156020 | -28.36% |
| Output cost | $0.292260 | $0.209490 | -0.082770 | -28.32% |
| Cache-read cost | $0.054272 | $0.046592 | -0.007680 | -14.15% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.896637 | $0.650167 | -0.246470 | -27.49% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 15 | +15 | n/a (zero baseline) |
| Archive source bytes | 0 | 197,819 | +197,819 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 20,660 | +20,660 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 10.44% | +10.44 pp | — |
| Archive chunks | 0 | 22 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 430,881 | +430,881 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 8,707 | +8,707 | n/a (zero baseline) |
| Result bytes projected out | 0 | 196,013 | +196,013 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 33,947 | +33,947 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,638 | +395,638 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 93,184 | +93,184 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 78,817 | +78,817 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


---

<a id="task-17"></a>

## Task 17: Authoritative DNS Zone Compiler (`dns-zone`)

- **Domain:** DNS/network services; authoritative zone compilation and resolution.
- **Package:** `dnszone`.

### Initial task and baseline requirements

Implement immutable `Answer(name, type, value, ttl)`, `compile_zone(records, origin, default_ttl=300) -> Zone`, and `Zone.resolve(qname, qtype) -> tuple[Answer, ...]`. Support `A`, `AAAA`, `CNAME`, and `TXT`. Expand relative owner names beneath the origin, interpret `@` as the origin, preserve already-absolute names, and canonicalize DNS names to lowercase with a trailing dot. Direct lookup is case-insensitive, sorts matching records by value, and returns `()` for an absent owner/type. Validate owner names and record types, IP syntax, positive integer TTLs, and CNAME targets. Do not mutate inputs.

The base tests make the contract concrete: relative/case-insensitive `A` lookup must return a canonical absolute owner, default TTLs apply, multiple TXT values sort lexically, and malformed addresses fail.

### Live steering constraint

Preserve canonical absolute names, strict IP/TTL validation, deterministic record ordering, and input purity. Continue working, but keep the goal active.

### Pivot requirements

Add alias and wildcard resolution without breaking direct lookup:

- For a non-`CNAME` query lacking a direct record of the requested type, follow exactly one CNAME per owner until the terminal type is found.
- Reject multiple CNAMEs at one owner and any CNAME/non-CNAME coexistence at that owner.
- Raise `ResolutionError` for a CNAME cycle or a chain longer than 16.
- Rewrite terminal answer names to the original query name; each answer TTL is the minimum of the alias-chain TTLs and its terminal-record TTL.
- If no exact owner exists, choose the longest matching wildcard owner. Wildcards may yield either a terminal record or a CNAME, and synthesized answers use the query name.
- Exact-owner existence suppresses wildcard fallback even if that exact owner has no record of the requested type.

Pivot tests cover a two-hop CNAME with minimum TTL 40, longest-wildcard selection, exact-owner suppression, and cycle failure.

### Follow-up requirements

Add `parse_zone(text, origin, default_ttl=300) -> Zone` for a deterministic, line-oriented master-file subset. Support `$ORIGIN name` and `$TTL positive_integer`; records use `owner [ttl] TYPE value`. A line that starts with whitespace reuses the previous explicit owner. Semicolons begin comments only outside quoted strings, and shell-like quoting supports TXT text containing spaces. Directives affect subsequent records; in particular, `$ORIGIN` changes expansion of later relative owners and CNAME targets. Reject owner omission before any explicit owner, malformed lines, unsupported directives, and unterminated quotes. Parsed data must flow through the same compiler/resolver rules. Tests exercise owner reuse, directive TTLs, quoted TXT/comment parsing, and an origin change affecting both a CNAME owner and target.

### Locked acceptance and scope

- **Allowed edits:** only `dnszone/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `DNS ZONE GOAL COMPLETE`

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 244.28 s vs 600.00 s; Δ -355.72 s (-59.29%).
- **Model calls:** 15 vs 40; Δ -25 (-62.50%).
- **Tool calls:** 14 vs 21; Δ -7 (-33.33%).
- **Compactions:** 4 vs 10; Δ -6 (-60.00%).
- **Total tokens:** 152,290 vs 414,218; Δ -261,928 (-63.23%).
- **Reported API cost:** $0.568291 vs $1.224414; Δ -0.656123 (-53.59%).
- **Visible tool bytes:** 342,392 vs 222,065; Δ +120,327 (+54.19%).
- **Prompt-cache reuse:** 51.00% vs 62.83%; Δ -11.83 pp.

- **Expected exact final response:** `DNS ZONE GOAL COMPLETE`
- **vanilla prime-agent final response:** `Awaiting `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `DNS ZONE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 244.28 s | -355.72 s | -59.29% |
| Lifecycle wall time | 600.46 s | 244.60 s | -355.86 s | -59.27% |
| Instruction wall time | 600.00 s | 244.28 s | -355.72 s | -59.29% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 40 | 15 | -25 | -62.50% |
| Tool calls | 21 | 14 | -7 | -33.33% |
| Tool results | 21 | 14 | -7 | -33.33% |
| Visible tool bytes | 222,065 | 342,392 | +120,327 | +54.19% |
| Compactions | 10 | 4 | -6 | -60.00% |
| Goal-context injections | 26 | 2 | -24 | -92.31% |
| Assistant output events | 39 | 15 | -24 | -61.54% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 3 | 5 | +2 | +66.67% |
| Goal updates | 62 | 18 | -44 | -70.97% |
| RPC compaction completions | 10 | 4 | -6 | -60.00% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 2 | 0 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 3 | +1 | +50.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 62 | 17 | -45 | -72.58% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 25 | 1 | -24 | -96.00% |
| Maximum goal tokens used | 161,290 | 76,699 | -84,591 | -52.45% |
| Completed RPC compactions | 10 | 4 | -6 | -60.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 2 | 0 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 149,630 | 71,809 | -77,821 | -52.01% |
| Output tokens | 11,660 | 5,729 | -5,931 | -50.87% |
| Cache-read tokens | 252,928 | 74,752 | -178,176 | -70.45% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 414,218 | 152,290 | -261,928 | -63.23% |
| Prompt-cache reuse | 62.83% | 51.00% | -11.83 pp | — |
| Input cost | $0.748150 | $0.359045 | -0.389105 | -52.01% |
| Output cost | $0.349800 | $0.171870 | -0.177930 | -50.87% |
| Cache-read cost | $0.126464 | $0.037376 | -0.089088 | -70.45% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.224414 | $0.568291 | -0.656123 | -53.59% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 13 | +13 | n/a (zero baseline) |
| Archive source bytes | 0 | 327,890 | +327,890 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 24,179 | +24,179 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 7.37% | +7.37 pp | — |
| Archive chunks | 0 | 20 | +20 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 670,687 | +670,687 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 324,631 | +324,631 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 30,925 | +30,925 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 655,780 | +655,780 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 74,752 | +74,752 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 71,809 | +71,809 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 10 | +10 | n/a (zero baseline) |


---

<a id="task-18"></a>

## Task 18: Deterministic DNA Alignment (`dna-alignment`)

- **Domain:** Bioinformatics; deterministic dynamic-programming sequence alignment.
- **Package:** `dna_align`.

### Initial task and baseline requirements

Implement immutable `Alignment(score, aligned_a, aligned_b, start_a, end_a, start_b, end_b)` and `align_global(a, b, match=2, mismatch=-1, gap=-2)`. Use global Needleman–Wunsch alignment over uppercase `A/C/G/T`; every gap column has the linear `gap` score. Return zero-based, half-open coordinates spanning both complete inputs. For equal scores, choose the lexicographically smallest `(aligned_a, aligned_b)` pair. Reject Boolean or noninteger scores, invalid sequence symbols, and gap characters in inputs.

Base tests pin exact-match scoring, the chosen gap placement for `AC` versus `A`, and the lexical tie result `("-A", "G-")` when mismatch and gap scores tie.

### Live steering constraint

Preserve exact integer scoring, source coordinates, lexical traceback tie-breaking, strict sequence validation, and the active goal.

### Pivot requirements

Add affine-gap and ambiguous-base support to global alignment:

- `gap_open` and `gap_extend` are integer keyword options and must be provided together.
- The first column of a contiguous gap run costs `gap_open`; later columns cost `gap_extend`.
- Omitting them is exactly equivalent to `gap_open == gap_extend == gap`, preserving linear behavior.
- Accept uppercase `N`; any substitution involving `N`, including `N/N`, scores zero.
- Apply the same lexical aligned-string tie-break across match, insertion, and deletion states.

Tests require a single contiguous two-base gap for `AAAA` versus `AA`, zero contribution from `N`, and equality between linear mode and equal affine penalties.

### Follow-up requirements

Add `align_local` with the same score arguments and affine options. It performs Smith–Waterman-style local alignment and reports source substring coordinates. The all-zero empty result is allowed and uses empty aligned strings and all coordinates zero; only a positive, nonempty candidate can beat it. For equal positive scores, prefer the earliest `(start_a, start_b, end_a, end_b)`, then the lexicographically smallest aligned-string pair. Do not retain terminal gap columns that reduce the local score. Reuse exact integer arithmetic, validation, affine behavior, and `N` semantics. Tests require extraction of an internal `ACGT` motif at coordinates `2:6` in both inputs, the canonical empty result when no positive match exists, and earliest selection among repeated equal motifs.

### Locked acceptance and scope

- **Allowed edits:** only `dna_align/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `DNA ALIGNMENT GOAL COMPLETE`

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 230.88 s vs 600.00 s; Δ -369.12 s (-61.52%).
- **Model calls:** 13 vs 68; Δ -55 (-80.88%).
- **Tool calls:** 15 vs 23; Δ -8 (-34.78%).
- **Compactions:** 3 vs 11; Δ -8 (-72.73%).
- **Total tokens:** 132,626 vs 650,984; Δ -518,358 (-79.63%).
- **Reported API cost:** $0.476718 vs $1.351497; Δ -0.874779 (-64.73%).
- **Visible tool bytes:** 402,781 vs 143,395; Δ +259,386 (+180.89%).
- **Prompt-cache reuse:** 62.18% vs 72.61%; Δ -10.43 pp.

- **Expected exact final response:** `DNA ALIGNMENT GOAL COMPLETE`
- **vanilla prime-agent final response:** `No new staged files are present. The goal remains active pending further requirements and `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `DNA ALIGNMENT GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 6/6 | 9/9 |
| External-tests gate | yes | no | yes |
| Protected files unchanged | yes | no | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 230.88 s | -369.12 s | -61.52% |
| Lifecycle wall time | 600.59 s | 231.02 s | -369.58 s | -61.54% |
| Instruction wall time | 600.00 s | 230.88 s | -369.12 s | -61.52% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 68 | 13 | -55 | -80.88% |
| Tool calls | 23 | 15 | -8 | -34.78% |
| Tool results | 23 | 15 | -8 | -34.78% |
| Visible tool bytes | 143,395 | 402,781 | +259,386 | +180.89% |
| Compactions | 11 | 3 | -8 | -72.73% |
| Goal-context injections | 49 | 1 | -48 | -97.96% |
| Assistant output events | 68 | 13 | -55 | -80.88% |
| Interventions delivered | 3 | 5 | +2 | +66.67% |
| Stage responses recorded | 10 | 7 | -3 | -30.00% |
| Test-run observations | 2 | 6 | +4 | +200.00% |
| Goal updates | 116 | 15 | -101 | -87.07% |
| RPC compaction completions | 11 | 3 | -8 | -72.73% |
| Compaction requests | 4 | 2 | -2 | -50.00% |
| Compaction waits | 3 | 0 | -3 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 3 | 0 | -3 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 1 | 4 | +3 | +300.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 116 | 14 | -102 | -87.93% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 49 | 1 | -48 | -97.96% |
| Maximum goal tokens used | 184,040 | 53,675 | -130,365 | -70.84% |
| Completed RPC compactions | 11 | 3 | -8 | -72.73% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 3 | 0 | -3 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 3 | 0 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 176,127 | 47,646 | -128,481 | -72.95% |
| Output tokens | 7,913 | 6,644 | -1,269 | -16.04% |
| Cache-read tokens | 466,944 | 78,336 | -388,608 | -83.22% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 650,984 | 132,626 | -518,358 | -79.63% |
| Prompt-cache reuse | 72.61% | 62.18% | -10.43 pp | — |
| Input cost | $0.880635 | $0.238230 | -0.642405 | -72.95% |
| Output cost | $0.237390 | $0.199320 | -0.038070 | -16.04% |
| Cache-read cost | $0.233472 | $0.039168 | -0.194304 | -83.22% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.351497 | $0.476718 | -0.874779 | -64.73% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 14 | +14 | n/a (zero baseline) |
| Archive source bytes | 0 | 393,468 | +393,468 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 23,658 | +23,658 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 6.01% | +6.01 pp | — |
| Archive chunks | 0 | 22 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 800,570 | +800,570 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 390,228 | +390,228 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 45,956 | +45,956 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 792,008 | +792,008 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 4 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 78,336 | +78,336 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 47,646 | +47,646 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 9 | +9 | n/a (zero baseline) |


---

<a id="task-19"></a>

## Task 19: Union Payroll Calculator (`union-payroll`)

- **Domain:** Payroll/timekeeping; union overtime, differential, and retroactive-pay calculation.
- **Package:** `union_payroll`.

### Initial task and baseline requirements

Implement `calculate_pay(shifts, contracts, prior_pay=None)` without mutating inputs. Shifts have unique IDs, employees, and naive ISO start/end timestamps on 15-minute boundaries. Each employee contract supplies a nonnegative Decimal-string hourly rate. Split work into exact quarter-hours, grouping by employee and ISO week beginning Monday. The first 40 weekly hours are regular and later quarters are overtime at 1.5× base. Reject overlaps for the same employee, missing contracts, nonpositive shifts, invalid timestamps, and non-quarter-aligned times. Return lexically ordered employee rows with two-decimal hour/pay fields plus total gross. Use `Decimal` throughout and `ROUND_HALF_EVEN` for final cents.

Base tests require an eight-hour `$20` shift to yield `$160.00`, a 45-hour `$10` week to yield 40 regular/5 overtime hours and `$475.00`, lexical employee ordering, input purity, and overlap rejection. The base expected employee-row shape already contains zero-valued `doubletime_hours` and `differential` fields, even though their behavior is introduced by the pivot.

### Live steering constraint

Preserve Decimal arithmetic, Monday week boundaries, overlap validation, global threshold ordering across shifts, input purity, and the active goal.

### Pivot requirements

Add optional contract fields `daily_overtime_after` (default 24 hours), `daily_doubletime_after` (default 24 and not below the overtime threshold), and nonnegative Decimal `night_differential` dollars/hour (default zero). A quarter beginning at/after 22:00 or before 06:00 is a night quarter. Classify each quarter using only the maximum applicable multiplier: regular 1.0, weekly or daily overtime 1.5, or daily double time 2.0; rules do not stack. Add the night differential after multiplying base pay. Return double-time hours and differential totals, rounding only final employee/payroll money totals to cents. Tests pin 8 regular + 4 overtime + 2 double-time hours in a 14-hour day, two hours of night differential in a 20:00–00:00 shift, and nonstacking daily/weekly overtime.

### Follow-up requirements

Treat `prior_pay` as an optional mapping from known shift IDs to nonnegative Decimal-string amounts. Compute current gross per shift while still applying employee/day/week thresholds globally across all shifts. Add `shift_lines`, sorted by shift ID, with exactly the shift ID, employee, two-decimal current amount, prior amount, and signed adjustment. Missing prior values are zero. Return `total_prior` and signed `total_adjustment`, where adjustment equals total gross minus total prior. Prior amounts never affect hour classification or current gross. Reject unknown prior IDs and invalid prior values atomically. Tests cover per-shift allocation, a negative adjustment for overpayment, totals, and unknown-ID rejection.

### Locked acceptance and scope

- **Allowed edits:** only `union_payroll/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `UNION PAYROLL GOAL COMPLETE`

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 214.10 s vs 600.00 s; Δ -385.90 s (-64.32%).
- **Model calls:** 11 vs 58; Δ -47 (-81.03%).
- **Tool calls:** 10 vs 24; Δ -14 (-58.33%).
- **Compactions:** 4 vs 12; Δ -8 (-66.67%).
- **Total tokens:** 110,822 vs 559,371; Δ -448,549 (-80.19%).
- **Reported API cost:** $0.510930 vs $1.240744; Δ -0.729814 (-58.82%).
- **Visible tool bytes:** 339,708 vs 288,245; Δ +51,463 (+17.85%).
- **Prompt-cache reuse:** 33.78% vs 70.44%; Δ -36.66 pp.

- **Expected exact final response:** `UNION PAYROLL GOAL COMPLETE`
- **vanilla prime-agent final response:** `Goal remains active pending retroactive requirements and `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `UNION PAYROLL GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 6/6 | 9/9 |
| External-tests gate | yes | no | yes |
| Protected files unchanged | yes | no | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 214.10 s | -385.90 s | -64.32% |
| Lifecycle wall time | 600.50 s | 214.31 s | -386.20 s | -64.31% |
| Instruction wall time | 600.00 s | 214.10 s | -385.90 s | -64.32% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 58 | 11 | -47 | -81.03% |
| Tool calls | 24 | 10 | -14 | -58.33% |
| Tool results | 24 | 10 | -14 | -58.33% |
| Visible tool bytes | 288,245 | 339,708 | +51,463 | +17.85% |
| Compactions | 12 | 4 | -8 | -66.67% |
| Goal-context injections | 39 | 3 | -36 | -92.31% |
| Assistant output events | 58 | 11 | -47 | -81.03% |
| Interventions delivered | 3 | 5 | +2 | +66.67% |
| Stage responses recorded | 6 | 7 | +1 | +16.67% |
| Test-run observations | 2 | 5 | +3 | +150.00% |
| Goal updates | 95 | 15 | -80 | -84.21% |
| RPC compaction completions | 12 | 4 | -8 | -66.67% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 5 | 6 | +1 | +20.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 1 | 3 | +2 | +200.00% |
| Failing observed test runs | 1 | 2 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 95 | 14 | -81 | -85.26% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 39 | 2 | -37 | -94.87% |
| Maximum goal tokens used | 170,763 | 67,455 | -103,308 | -60.50% |
| Completed RPC compactions | 12 | 4 | -8 | -66.67% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 163,058 | 70,258 | -92,800 | -56.91% |
| Output tokens | 7,705 | 4,724 | -2,981 | -38.69% |
| Cache-read tokens | 388,608 | 35,840 | -352,768 | -90.78% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 559,371 | 110,822 | -448,549 | -80.19% |
| Prompt-cache reuse | 70.44% | 33.78% | -36.66 pp | — |
| Input cost | $0.815290 | $0.351290 | -0.464000 | -56.91% |
| Output cost | $0.231150 | $0.141720 | -0.089430 | -38.69% |
| Cache-read cost | $0.194304 | $0.017920 | -0.176384 | -90.78% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.240744 | $0.510930 | -0.729814 | -58.82% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 9 | +9 | n/a (zero baseline) |
| Archive source bytes | 0 | 327,890 | +327,890 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 21,205 | +21,205 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 6.47% | +6.47 pp | — |
| Archive chunks | 0 | 14 | +14 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 666,834 | +666,834 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 324,629 | +324,629 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 37,769 | +37,769 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 655,780 | +655,780 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 35,840 | +35,840 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 70,258 | +70,258 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 6 | +6 | n/a (zero baseline) |


---

<a id="task-20"></a>

## Task 20: Constraint-Aware Dependency Lock Resolver (`lock-resolver`)

- **Domain:** Package/dependency management; constraint solving and lockfile minimization.
- **Package:** `lockresolve`.

### Initial task and baseline requirements

Implement `resolve(repository, requirements, *, locked=None, pins=None) -> dict[str, str]`. The repository maps package names to strict `MAJOR.MINOR.PATCH` versions and each version to dependency-name/constraint pairs. Requirements and dependencies use comma-separated `==`, `>=`, `>`, `<=`, and `<` comparisons. Select one version of each required transitive package, accumulate all incoming constraints, and backtrack when an initially preferred version prevents a solution. Among valid solutions, maximize versions in lexical package-name order, and return a lexically ordered package-to-version mapping. Raise `ResolutionError` when unsatisfiable. Validate names, versions, constraints, and referenced packages without mutating inputs.

Base tests cover selecting the highest transitive version, backtracking from an incompatible high root version, and an unsatisfiable root requirement.

### Live steering constraint

Preserve strict semantic versions, accumulated constraints, lexical optimization, input purity, and the active goal.

### Pivot requirements

Add minimal-change lock resolution and exact pins:

- `locked` contains previously selected versions. First minimize the number of required packages that differ from a valid locked repository version; only after that apply the existing lexical highest-version objective.
- New packages do not count as changes, and unrelated locked entries do not become requirements.
- `pins` constrains a package to an exact version if that package enters the dependency graph; a conflicting pin makes the whole resolution unsatisfiable.
- Input mapping order must not affect the result.

Tests require keeping valid versions of both root and transitive locked packages, changing only an invalidated root lock, and honoring a transitive exact pin while still maximizing the root.

### Follow-up requirements

Support richer repository version objects containing `dependencies` and `extras`; keep legacy dependency mappings as shorthand with no extras. Requirement names may use `package[feature]`, with comma-separated features unioned across every incoming edge. Activating a feature adds that selected version's feature dependency mapping; dependencies can request features themselves. If a newly accumulated edge adds a feature to an already-required package, incorporate that feature's dependencies in the same solve. Reject any requested feature absent from the selected version (the tests expect `ResolutionError`). Features do not change lock-change counting or the returned package/version mapping. Tests cover root extras, transitive extras, feature union, and unknown-feature rejection.

### Locked acceptance and scope

- **Allowed edits:** only `lockresolve/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `LOCK RESOLVER GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 408.47 s vs 439.47 s; Δ -31.00 s (-7.05%).
- **Model calls:** 20 vs 25; Δ -5 (-20.00%).
- **Tool calls:** 19 vs 21; Δ -2 (-9.52%).
- **Compactions:** 6 vs 7; Δ -1 (-14.29%).
- **Total tokens:** 217,647 vs 232,625; Δ -14,978 (-6.44%).
- **Reported API cost:** $0.845457 vs $0.853665; Δ -0.008208 (-0.96%).
- **Visible tool bytes:** 284,850 vs 107,600; Δ +177,250 (+164.73%).
- **Prompt-cache reuse:** 50.89% vs 55.13%; Δ -4.25 pp.

- **Expected exact final response:** `LOCK RESOLVER GOAL COMPLETE`
- **vanilla prime-agent final response:** `LOCK RESOLVER GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `LOCK RESOLVER GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 439.47 s | 408.47 s | -31.00 s | -7.05% |
| Lifecycle wall time | 440.05 s | 408.68 s | -31.37 s | -7.13% |
| Instruction wall time | 439.47 s | 408.47 s | -31.00 s | -7.05% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 25 | 20 | -5 | -20.00% |
| Tool calls | 21 | 19 | -2 | -9.52% |
| Tool results | 21 | 19 | -2 | -9.52% |
| Visible tool bytes | 107,600 | 284,850 | +177,250 | +164.73% |
| Compactions | 7 | 6 | -1 | -14.29% |
| Goal-context injections | 7 | 5 | -2 | -28.57% |
| Assistant output events | 25 | 20 | -5 | -20.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 11 | 7 | -4 | -36.36% |
| Test-run observations | 4 | 5 | +1 | +25.00% |
| Goal updates | 33 | 24 | -9 | -27.27% |
| RPC compaction completions | 7 | 6 | -1 | -14.29% |
| Compaction requests | 4 | 2 | -2 | -50.00% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 8 | 6 | -2 | -25.00% |
| Rejected stage/command responses | 3 | 1 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 4 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 32 | 23 | -9 | -28.12% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 4 | -2 | -33.33% |
| Maximum goal tokens used | 108,421 | 110,105 | +1,684 | +1.55% |
| Completed RPC compactions | 7 | 6 | -1 | -14.29% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 3 | 1 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 100,005 | 102,297 | +2,292 | +2.29% |
| Output tokens | 9,740 | 9,366 | -374 | -3.84% |
| Cache-read tokens | 122,880 | 105,984 | -16,896 | -13.75% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 232,625 | 217,647 | -14,978 | -6.44% |
| Prompt-cache reuse | 55.13% | 50.89% | -4.25 pp | — |
| Input cost | $0.500025 | $0.511485 | +0.011460 | +2.29% |
| Output cost | $0.292200 | $0.280980 | -0.011220 | -3.84% |
| Cache-read cost | $0.061440 | $0.052992 | -0.008448 | -13.75% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.853665 | $0.845457 | -0.008208 | -0.96% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 18 | +18 | n/a (zero baseline) |
| Archive source bytes | 0 | 263,398 | +263,398 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 25,356 | +25,356 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 9.63% | +9.63 pp | — |
| Archive chunks | 0 | 27 | +27 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 565,567 | +565,567 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 11,387 | +11,387 | n/a (zero baseline) |
| Result bytes projected out | 0 | 260,407 | +260,407 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 43,743 | +43,743 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 526,796 | +526,796 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 7 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 105,984 | +105,984 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 102,297 | +102,297 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 14 | +14 | n/a (zero baseline) |


---

<a id="task-21"></a>

## Task 21: Dependency-Aware Build Planner (`build-planner`)

- **Domain:** Build systems; dependency-graph planning and incremental rebuilds.
- **Package:** `buildplan`.

### Initial task and baseline requirements

Implement `BuildPlanner.from_dict(config)` for `{"modules": {name: {"deps": [...], "sources": [...]}}}`, plus `BuildPlanner.load(path)` for the same JSON format. `plan(targets=None)` returns dependency-first topological order for all modules or for named targets plus their transitive dependencies. Whenever multiple modules are ready, choose lexically. Unknown dependencies or targets raise `ValueError` containing the missing name. Cycles raise `ValueError` containing participating module names. Do not mutate the configuration supplied by the caller.

Base tests pin the complete stable order `core, tool, ui, app`, a target-only order, JSON loading, purity, missing-dependency diagnostics, and cycle diagnostics.

### Live steering constraint

Keep ordering deterministic, preserve caller data, make missing-module and cycle diagnostics useful, and keep the goal active for later product input.

### Pivot requirements

Add `affected(changed_paths)`: normalize separators to `/` and strip a leading `./`; map source paths to all owning modules; then rebuild each directly changed module and all transitive reverse dependents. Return those modules in the same dependency-first stable order as `plan`. A source may be owned by multiple modules, and wholly unknown paths produce `[]`. Tests cover rebuilding from a base module, a shared path with mixed slash styles, and an unknown path.

### Follow-up requirements

Add `explain(changed_paths)` returning:

- `changed`: normalized paths;
- `direct`: sorted directly changed modules;
- `rebuild`: the affected dependency-first plan;
- `reasons`: for every rebuilt module, the sorted directly changed modules that can reach it through dependency edges, including itself when it is direct.

Also add `python -m buildplan.cli MANIFEST COMMAND ARGS...` with `plan [TARGET ...]`, `affected PATH ...`, and `explain PATH ...`. Successful commands print exactly one JSON value with deterministic key ordering and exit zero. Tests pin propagation of one and two direct reasons and run all three CLI commands against a JSON manifest.

### Locked acceptance and scope

- **Allowed edits:** only `buildplan/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `BUILD PLAN GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 254.44 s vs 268.59 s; Δ -14.15 s (-5.27%).
- **Model calls:** 17 vs 18; Δ -1 (-5.56%).
- **Tool calls:** 15 vs 16; Δ -1 (-6.25%).
- **Compactions:** 5 vs 4; Δ +1 (+25.00%).
- **Total tokens:** 170,633 vs 164,858; Δ +5,775 (+3.50%).
- **Reported API cost:** $0.521197 vs $0.535327; Δ -0.014130 (-2.64%).
- **Visible tool bytes:** 218,541 vs 27,227; Δ +191,314 (+702.66%).
- **Prompt-cache reuse:** 59.14% vs 63.73%; Δ -4.59 pp.

- **Expected exact final response:** `BUILD PLAN GOAL COMPLETE`
- **vanilla prime-agent final response:** `BUILD PLAN GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `BUILD PLAN GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 268.59 s | 254.44 s | -14.15 s | -5.27% |
| Lifecycle wall time | 268.79 s | 254.61 s | -14.17 s | -5.27% |
| Instruction wall time | 268.59 s | 254.44 s | -14.15 s | -5.27% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 17 | -1 | -5.56% |
| Tool calls | 16 | 15 | -1 | -6.25% |
| Tool results | 16 | 15 | -1 | -6.25% |
| Visible tool bytes | 27,227 | 218,541 | +191,314 | +702.66% |
| Compactions | 4 | 5 | +1 | +25.00% |
| Goal-context injections | 3 | 3 | +0 | +0.00% |
| Assistant output events | 18 | 17 | -1 | -5.56% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 20 | 21 | +1 | +5.00% |
| RPC compaction completions | 4 | 5 | +1 | +25.00% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 8 | 6 | -2 | -25.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 19 | 20 | +1 | +5.26% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 3 | +1 | +50.00% |
| Maximum goal tokens used | 62,819 | 67,286 | +4,467 | +7.11% |
| Completed RPC compactions | 4 | 5 | +1 | +25.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | -1 | -50.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 57,397 | 67,913 | +10,516 | +18.32% |
| Output tokens | 6,597 | 4,416 | -2,181 | -33.06% |
| Cache-read tokens | 100,864 | 98,304 | -2,560 | -2.54% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 164,858 | 170,633 | +5,775 | +3.50% |
| Prompt-cache reuse | 63.73% | 59.14% | -4.59 pp | — |
| Input cost | $0.286985 | $0.339565 | +0.052580 | +18.32% |
| Output cost | $0.197910 | $0.132480 | -0.065430 | -33.06% |
| Cache-read cost | $0.050432 | $0.049152 | -0.001280 | -2.54% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.535327 | $0.521197 | -0.014130 | -2.64% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 14 | +14 | n/a (zero baseline) |
| Archive source bytes | 0 | 197,820 | +197,820 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 17,196 | +17,196 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.69% | +8.69 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 419,204 | +419,204 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 195,934 | +195,934 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 24,926 | +24,926 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,640 | +395,640 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 98,304 | +98,304 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 67,913 | +67,913 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-22"></a>

## Task 22: Committee Seat Apportionment (`committee-apportionment`)

- **Domain:** Electoral/governance mathematics; constrained Hamilton apportionment.
- **Package:** `committee`.

### Initial task and baseline requirements

Implement `allocate(seats, votes) -> dict[str, int]` using Hamilton's largest-remainder method and exact integer arithmetic. Return every input party, including zero-vote and zero-seat parties. Award leftover seats by descending fractional remainder and then ascending party name. Zero total seats returns all zeros; positive seats with no positive votes raises `ValueError`. Base tests cover a 60/40 split, a three-way remainder tie resolved by party name, and retention of a zero-vote party.

### Live steering constraint

Preserve exact integer arithmetic, deterministic party ordering, phase-one API compatibility, and the active goal.

### Pivot requirements

Add keyword-only `min_basis_points=0` and `caps=None`:

- A positive-vote party is eligible exactly when `votes[p] * 10000 >= sum(all votes) * min_basis_points`; the boundary is inclusive and the denominator includes all votes.
- Excluded parties remain in the output with zero seats.
- An omitted party cap defaults to the full seat count; caps are nonnegative.
- Use constrained Hamilton: repeatedly fix every active party whose exact quota reaches or exceeds its remaining cap, remove it, and recompute quotas for the remaining parties/seats. Once no cap binds, Hamilton-allocate the rest.
- If eligible caps cannot cover all seats, raise exactly `ValueError("eligible caps cannot cover seats")`.
- Validate nonnegative integer seats, votes, and caps and require `0 <= min_basis_points <= 10000`, raising `ValueError` on invalid input.

Tests pin inclusive 10% eligibility, quota redistribution after a dominant party reaches its cap, and the exact cap-capacity error text.

### Follow-up requirements

Add `process_request(request)`, returning `{"allocation": allocate(...)}` from required `seats`/`votes` and optional threshold/caps fields. Add `python -m committee.cli`: by default it reads one JSON request from stdin; `--ndjson` reads every nonblank input line as an independent request and emits responses in order. Each response must be compact, key-sorted JSON with one trailing newline and no other output. Tests assert the request adapter, exact single-response output, blank-line skipping, ordered NDJSON output, and caps through the CLI.

### Locked acceptance and scope

- **Allowed edits:** only `committee/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `COMMITTEE GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 199.18 s vs 217.30 s; Δ -18.12 s (-8.34%).
- **Model calls:** 15 vs 21; Δ -6 (-28.57%).
- **Tool calls:** 14 vs 19; Δ -5 (-26.32%).
- **Compactions:** 4 vs 3; Δ +1 (+33.33%).
- **Total tokens:** 148,060 vs 195,757; Δ -47,697 (-24.37%).
- **Reported API cost:** $0.443049 vs $0.576938; Δ -0.133889 (-23.21%).
- **Visible tool bytes:** 147,178 vs 20,764; Δ +126,414 (+608.81%).
- **Prompt-cache reuse:** 59.93% vs 65.68%; Δ -5.74 pp.

- **Expected exact final response:** `COMMITTEE GOAL COMPLETE`
- **vanilla prime-agent final response:** `COMMITTEE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `COMMITTEE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 217.30 s | 199.18 s | -18.12 s | -8.34% |
| Lifecycle wall time | 217.78 s | 199.50 s | -18.28 s | -8.39% |
| Instruction wall time | 217.30 s | 199.18 s | -18.12 s | -8.34% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 21 | 15 | -6 | -28.57% |
| Tool calls | 19 | 14 | -5 | -26.32% |
| Tool results | 19 | 14 | -5 | -26.32% |
| Visible tool bytes | 20,764 | 147,178 | +126,414 | +608.81% |
| Compactions | 3 | 4 | +1 | +33.33% |
| Goal-context injections | 2 | 3 | +1 | +50.00% |
| Assistant output events | 21 | 15 | -6 | -28.57% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 9 | 7 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 23 | 17 | -6 | -26.09% |
| RPC compaction completions | 3 | 4 | +1 | +33.33% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 1 | 0 | -1 | -100.00% |
| Accepted stage/command responses | 8 | 7 | -1 | -12.50% |
| Rejected stage/command responses | 1 | 0 | -1 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 22 | 16 | -6 | -27.27% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 2 | +0 | +0.00% |
| Maximum goal tokens used | 70,400 | 60,521 | -9,879 | -14.03% |
| Completed RPC compactions | 3 | 4 | +1 | +33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 1 | 0 | -1 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 0 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 65,020 | 57,847 | -7,173 | -11.03% |
| Output tokens | 6,321 | 3,685 | -2,636 | -41.70% |
| Cache-read tokens | 124,416 | 86,528 | -37,888 | -30.45% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 195,757 | 148,060 | -47,697 | -24.37% |
| Prompt-cache reuse | 65.68% | 59.93% | -5.74 pp | — |
| Input cost | $0.325100 | $0.289235 | -0.035865 | -11.03% |
| Output cost | $0.189630 | $0.110550 | -0.079080 | -41.70% |
| Cache-read cost | $0.062208 | $0.043264 | -0.018944 | -30.45% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.576938 | $0.443049 | -0.133889 | -23.21% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 13 | +13 | n/a (zero baseline) |
| Archive source bytes | 0 | 136,250 | +136,250 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 12,048 | +12,048 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.84% | +8.84 pp | — |
| Archive chunks | 0 | 19 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 283,564 | +283,564 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 133,914 | +133,914 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 38,656 | +38,656 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 273,371 | +273,371 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 86,528 | +86,528 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 57,847 | +57,847 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-23"></a>

## Task 23: Content Routing Engine (`content-routing`)

- **Domain:** Web/content delivery; path routing, localization, templating, and route introspection.
- **Package:** `contentrouter`.

### Initial task and baseline requirements

Implement `NoRoute(LookupError)`, immutable `Resolution(route_id, text, params, locale="*")`, `ContentRouter.from_dict(config)`, and `resolve(path, values=None)`. Initial configs contain routes with an ID, path, and text. Path patterns consist of literal segments or whole-segment captures such as `{slug}`, where a capture matches one nonempty segment. Render through `string.Template.substitute`: path captures are available and caller values override them. Declaration order breaks otherwise equal route matches. Reject duplicate route IDs and malformed patterns with `ValueError`; a miss raises `NoRoute`. Base tests cover root-literal routing, capture/render output and params, and a miss.

### Live steering constraint

Preserve deterministic declaration ordering, immutable result records, the public resolve API, and the active goal.

### Pivot requirements

Add locale fallback and named templates:

- Config may provide `default_locale` and `templates`.
- A route may provide `locale` and must have exactly one of `text` or `template`; a template route can also provide `content` values.
- Normalize locales to lowercase with `_` changed to `-`; omitted route locale is `*`.
- `resolve(..., locale=None)` builds a de-duplicated chain of requested locale, less-specific parents, default locale, then `*`. If locale is omitted, start at the default locale.
- Choose the first path match in the best locale-chain entry. Named templates must exist.
- Rendering precedence is route content, then captures, then caller values (later sources win). Report the normalized selected route locale in `Resolution`.

Tests cover exact case-insensitive locale selection, parent and default fallback, and named-template rendering.

### Follow-up requirements

Add integer route `priority` (default 0). Rank all path matches by lowest locale-chain index, then highest priority, then most literal path segments, then earliest declaration. Add `explain(path, locale=None, values=None)`, returning `locale_chain`, the selected route ID, and best-first `candidates`. Include only path matches whose locale is in the chain; each candidate has exactly `id`, `locale_rank`, `priority`, `literal_segments`, `order`, and `selected`. Raise `NoRoute` if none qualify.

Add `python -m contentrouter.cli CONFIG.json PATH [--locale LOCALE] [--values JSON_OBJECT] [--explain]`. Successful normal mode prints one compact sorted JSON line with exactly `route_id`, `text`, `params`, and `locale`; explain mode prints the explanation. Success exits 0. Invalid input or no route prints a short stderr error and exits 2. Tests show that higher priority beats a more literal route, specificity beats declaration order when priority ties, explanations are best-first with one selected candidate, and the normal CLI output is exact compact sorted JSON.

### Locked acceptance and scope

- **Allowed edits:** only `contentrouter/`.
- **Protected artifacts:** `FOLLOWUP.md`, `PIVOT.md`, `TASK.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_followup.py`, `tests/test_pivot.py`.
- **Goal rule:** complete only after the lock, then call `await goal.complete()`.
- **Expected complete result:** `TEST_RESULT PASS 9/9`; goal status `complete`, completed after lock.
- **Exact final response:** `CONTENT ROUTER GOAL COMPLETE`

### Measured outcome

**Verdict:** Neither variant meets all acceptance criteria; resource use is reported descriptively, not as a formal efficiency result.

- **Wall time:** 600.00 s vs 600.00 s; Δ +0.00 s (+0.00%).
- **Model calls:** 6 vs 27; Δ -21 (-77.78%).
- **Tool calls:** 6 vs 27; Δ -21 (-77.78%).
- **Compactions:** 0 vs 10; Δ -10 (-100.00%).
- **Total tokens:** 46,586 vs 268,083; Δ -221,497 (-82.62%).
- **Reported API cost:** $0.177921 vs $0.854767; Δ -0.676846 (-79.18%).
- **Visible tool bytes:** 7,605 vs 88,606; Δ -81,001 (-91.42%).
- **Prompt-cache reuse:** 52.87% vs 61.74%; Δ -8.87 pp.

- **Expected exact final response:** `CONTENT ROUTER GOAL COMPLETE`
- **vanilla prime-agent final response:** `The follow-up implementation is in place. All 9 supplied tests now pass, including priority ordering, candidate explanations, and compact JSON CLI output. I’m doing a hidden-edge audit now; the goal will remain active until the final lock.`
- **prime-context 8.1.0 final response:** `The baseline fails because `contentrouter.router` is missing. I’m implementing that module now. Route selection will rank more-specific literal patterns first and use declaration order as the stable tie-breaker. `Resolution` remains a frozen record and `resolve(path, *, values=None)` remains unchanged.`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | no |
| Runner task-completed gate | yes | no | no |
| External cumulative tests | 9/9 | 9/9 | 3/3 |
| External-tests gate | yes | yes | no |
| Protected files unchanged | yes | yes | no |
| Goal status | complete | active | active |
| Goal completed after lock | yes | no | no |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | no |
| Exact final response | yes | no | no |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | no |
| Run error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | TimeoutError: condition timed out after 600 seconds |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Lifecycle wall time | 600.39 s | 600.61 s | +0.22 s | +0.04% |
| Instruction wall time | 600.00 s | 600.00 s | +0.00 s | +0.00% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 27 | 6 | -21 | -77.78% |
| Tool calls | 27 | 6 | -21 | -77.78% |
| Tool results | 27 | 6 | -21 | -77.78% |
| Visible tool bytes | 88,606 | 7,605 | -81,001 | -91.42% |
| Compactions | 10 | 0 | -10 | -100.00% |
| Goal-context injections | 10 | 1 | -9 | -90.00% |
| Assistant output events | 27 | 6 | -21 | -77.78% |
| Interventions delivered | 4 | 2 | -2 | -50.00% |
| Stage responses recorded | 5 | 3 | -2 | -40.00% |
| Test-run observations | 3 | 2 | -1 | -33.33% |
| Goal updates | 37 | 6 | -31 | -83.78% |
| RPC compaction completions | 10 | 0 | -10 | -100.00% |
| Compaction requests | 1 | 1 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 5 | 2 | -3 | -60.00% |
| Rejected stage/command responses | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 2 | 1 | -1 | -50.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 37 | 6 | -31 | -83.78% |
| Complete goal updates | 0 | 0 | +0 | 0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 10 | 0 | -10 | -100.00% |
| Maximum goal tokens used | 108,339 | 23,034 | -85,305 | -78.74% |
| Completed RPC compactions | 10 | 0 | -10 | -100.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 0 | -1 | -100.00% |
| Failed compaction requests | 0 | 1 | +1 | n/a (zero baseline) |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 99,011 | 20,995 | -78,016 | -78.80% |
| Output tokens | 9,328 | 2,039 | -7,289 | -78.14% |
| Cache-read tokens | 159,744 | 23,552 | -136,192 | -85.26% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 268,083 | 46,586 | -221,497 | -82.62% |
| Prompt-cache reuse | 61.74% | 52.87% | -8.87 pp | — |
| Input cost | $0.495055 | $0.104975 | -0.390080 | -78.80% |
| Output cost | $0.279840 | $0.061170 | -0.218670 | -78.14% |
| Cache-read cost | $0.079872 | $0.011776 | -0.068096 | -85.26% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.854767 | $0.177921 | -0.676846 | -79.18% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 6 | +6 | n/a (zero baseline) |
| Archive source bytes | 0 | 1,078 | +1,078 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 3,884 | +3,884 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 360.30% | +360.30 pp | — |
| Archive chunks | 0 | 10 | +10 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 2,363 | +2,363 | n/a (zero baseline) |
| Source bytes admitted | 0 | 11,089 | +11,089 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 673 | +673 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 36,578 | +36,578 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 2,156 | +2,156 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 1 | +1 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 23,552 | +23,552 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 20,995 | +20,995 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 4 | +4 | n/a (zero baseline) |


---

<a id="task-24"></a>

## Task 24: Event-Time Window Counter (`event-window`)

- **Package / domain:** `eventwindow`; streaming analytics and event-time aggregation.
- **Initial task and baseline:** Implement immutable `Event(id, ts, key, value)` and `Window(start, end, key, count, total)`, plus `EventWindow(size, allowed_lateness=0)`, `add()`, and `current()`. `size` is positive and timestamps are nonnegative integers. An event belongs to the half-open window `[(ts // size) * size, start + size)`. Aggregate `count` and `total` independently for each `(window, key)`, and return windows in `(start, key)` order. The first accepted use of an event ID wins; later uses return `"duplicate"`. Baseline tests also confirm boundary placement and that totals may include negative event values.
- **Live steering constraint:** Preserve deterministic ordering, immutable public records, and first-accepted event-ID semantics. Continue working, but leave the goal active.
- **Pivot — watermarks and lateness:** The watermark starts at `None`, may remain equal, and cannot decrease. `advance_watermark(value)` finalizes a window when `watermark >= end + allowed_lateness`, emits each newly final window once in `(start, key)` order, and removes it from `current()`. A new ID aimed at an already final window returns `"late"` and is not added to `seen_ids`; an ID accepted earlier remains `"duplicate"` even after its window is final. Tests lock the exact threshold (for a `[0,10)` window with lateness 2, watermark 11 does not emit and 12 does) and reject decreasing watermarks.
- **Follow-up — snapshots, explanations, CLI:** `snapshot()` has exactly the keys `size`, `allowed_lateness`, `watermark`, sorted `seen_ids`, and sorted `open_windows` dictionaries; `from_snapshot()` must restore equivalent state. `explain(event)` must not mutate state and returns exactly `event_id`, `status`, `reason`, `window_start`, `window_end`, `watermark`, and `final_at`. Its decision order and reason codes are: seen ID → `duplicate` / `event_id_seen`; final window → `late` / `window_finalized`; otherwise `accepted` / `window_open`. `python -m eventwindow.cli --size N --allowed-lateness N` consumes NDJSON and emits compact, key-sorted JSON for `add`, `watermark`, `snapshot`, and `explain`; add responses contain `op/status`, and watermark responses contain `op/emitted`.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, fix failures only under `eventwindow/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must occur after the lock and after the staged intervention order `initial → steer-baseline → steer-pivot → steer-followup → steer-final-lock`.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `EVENT WINDOW GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 272.11 s vs 225.93 s; Δ +46.18 s (+20.44%).
- **Model calls:** 17 vs 23; Δ -6 (-26.09%).
- **Tool calls:** 16 vs 18; Δ -2 (-11.11%).
- **Compactions:** 5 vs 3; Δ +2 (+66.67%).
- **Total tokens:** 174,021 vs 218,084; Δ -44,063 (-20.20%).
- **Reported API cost:** $0.513844 vs $0.581138; Δ -0.067294 (-11.58%).
- **Visible tool bytes:** 216,670 vs 25,796; Δ +190,874 (+739.94%).
- **Prompt-cache reuse:** 63.31% vs 68.23%; Δ -4.91 pp.

- **Expected exact final response:** `EVENT WINDOW GOAL COMPLETE`
- **vanilla prime-agent final response:** `EVENT WINDOW GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `EVENT WINDOW GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 225.93 s | 272.11 s | +46.18 s | +20.44% |
| Lifecycle wall time | 226.21 s | 272.25 s | +46.04 s | +20.35% |
| Instruction wall time | 225.93 s | 272.11 s | +46.18 s | +20.44% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 23 | 17 | -6 | -26.09% |
| Tool calls | 18 | 16 | -2 | -11.11% |
| Tool results | 18 | 16 | -2 | -11.11% |
| Visible tool bytes | 25,796 | 216,670 | +190,874 | +739.94% |
| Compactions | 3 | 5 | +2 | +66.67% |
| Goal-context injections | 5 | 4 | -1 | -20.00% |
| Assistant output events | 23 | 17 | -6 | -26.09% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 15 | 7 | -8 | -53.33% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 29 | 20 | -9 | -31.03% |
| RPC compaction completions | 3 | 5 | +2 | +66.67% |
| Compaction requests | 6 | 2 | -4 | -66.67% |
| Compaction waits | 4 | 0 | -4 | -100.00% |
| Accepted stage/command responses | 11 | 6 | -5 | -45.45% |
| Rejected stage/command responses | 4 | 1 | -3 | -75.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 28 | 19 | -9 | -32.14% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 5 | 3 | -2 | -40.00% |
| Maximum goal tokens used | 72,659 | 65,858 | -6,801 | -9.36% |
| Completed RPC compactions | 3 | 5 | +2 | +66.67% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | -1 | -50.00% |
| Failed compaction requests | 4 | 1 | -3 | -75.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 4 | 0 | -4 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 67,478 | 62,002 | -5,476 | -8.12% |
| Output tokens | 5,710 | 5,011 | -699 | -12.24% |
| Cache-read tokens | 144,896 | 107,008 | -37,888 | -26.15% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 218,084 | 174,021 | -44,063 | -20.20% |
| Prompt-cache reuse | 68.23% | 63.31% | -4.91 pp | — |
| Input cost | $0.337390 | $0.310010 | -0.027380 | -8.12% |
| Output cost | $0.171300 | $0.150330 | -0.020970 | -12.24% |
| Cache-read cost | $0.072448 | $0.053504 | -0.018944 | -26.15% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.581138 | $0.513844 | -0.067294 | -11.58% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 15 | +15 | n/a (zero baseline) |
| Archive source bytes | 0 | 197,812 | +197,812 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 18,559 | +18,559 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 9.38% | +9.38 pp | — |
| Archive chunks | 0 | 24 | +24 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 423,487 | +423,487 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 196,034 | +196,034 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,402 | +39,402 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 395,624 | +395,624 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 107,008 | +107,008 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 62,002 | +62,002 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


---

<a id="task-25"></a>

## Task 25: Feature Flag Evaluator (`feature-flags`)

- **Package / domain:** `featureflags`; feature delivery, targeting, and configuration evaluation.
- **Initial task and baseline:** Implement `evaluate(config, flag_key, context=None) -> bool` for configs shaped as `{"flags": {name: {"default": boolean}}}`. Return the named flag's boolean default, treat missing context as an empty mapping, raise `KeyError(flag_key)` for an unknown flag, and mutate neither config nor context. Retain the exact evaluate signature.
- **Live steering constraint:** Preserve caller inputs, deterministic evaluation, and the phase-one `evaluate` API. Continue working without completing the goal.
- **Pivot — ordered targeting and rollout:** A flag may have ordered targets `{"when": mapping, "value": bool}`. A target matches only when all its key/value pairs exactly match the context, and the first match wins. If none matches and `rollout` is present and `context["subject"]` is a string, compute a stable bucket in `0..9999` by iterating over `f"{flag_key}:{subject}"` with `n = (n * 131 + ord(ch)) % 10000`; return `bucket < rollout * 100` for an integer percentage in `0..100`. Without a usable subject, use the default. Priority is first target, then rollout, then default. Tests lock all-of target matching, first-rule precedence, deterministic repeatability, and fallback behavior.
- **Follow-up — tenant overrides, explanations, CLI:** `tenant_overrides` maps tenant names to booleans and takes precedence over targets, rollout, and default. Add `explain(config, key, context=None)` with one exact shape selected by the winning branch: tenant `{flag,value,reason:"tenant_override",tenant}`; target `{flag,value,reason:"target",rule_index}`; rollout `{flag,value,reason:"rollout",bucket,percentage}`; or default `{flag,value,reason:"default"}`. `evaluate(...)` must equal the explanation's `value`. `python -m featureflags.cli CONFIG.json FLAG [--context JSON] [--explain]` prints one JSON value plus a newline and returns zero on success. The tests include the exact rollout bucket `166` for flag `new-dashboard` and subject `bob`.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `featureflags/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must follow the full staged intervention order and occur only after lock.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `FEATURE FLAG GOAL COMPLETE`

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 189.30 s vs 600.00 s; Δ -410.70 s (-68.45%).
- **Model calls:** 17 vs 70; Δ -53 (-75.71%).
- **Tool calls:** 18 vs 15; Δ +3 (+20.00%).
- **Compactions:** 4 vs 14; Δ -10 (-71.43%).
- **Total tokens:** 171,187 vs 652,241; Δ -481,054 (-73.75%).
- **Reported API cost:** $0.491212 vs $1.254112; Δ -0.762900 (-60.83%).
- **Visible tool bytes:** 145,092 vs 279,274; Δ -134,182 (-48.05%).
- **Prompt-cache reuse:** 56.81% vs 72.45%; Δ -15.65 pp.

- **Expected exact final response:** `FEATURE FLAG GOAL COMPLETE`
- **vanilla prime-agent final response:** `Awaiting `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `FEATURE FLAG GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 189.30 s | -410.70 s | -68.45% |
| Lifecycle wall time | 600.30 s | 189.86 s | -410.44 s | -68.37% |
| Instruction wall time | 600.00 s | 189.30 s | -410.70 s | -68.45% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 70 | 17 | -53 | -75.71% |
| Tool calls | 15 | 18 | +3 | +20.00% |
| Tool results | 15 | 18 | +3 | +20.00% |
| Visible tool bytes | 279,274 | 145,092 | -134,182 | -48.05% |
| Compactions | 14 | 4 | -10 | -71.43% |
| Goal-context injections | 58 | 3 | -55 | -94.83% |
| Assistant output events | 68 | 17 | -51 | -75.00% |
| Interventions delivered | 4 | 5 | +1 | +25.00% |
| Stage responses recorded | 5 | 9 | +4 | +80.00% |
| Test-run observations | 3 | 5 | +2 | +66.67% |
| Goal updates | 125 | 19 | -106 | -84.80% |
| RPC compaction completions | 14 | 4 | -10 | -71.43% |
| Compaction requests | 1 | 3 | +2 | +200.00% |
| Compaction waits | 0 | 1 | +1 | n/a (zero baseline) |
| Accepted stage/command responses | 5 | 7 | +2 | +40.00% |
| Rejected stage/command responses | 0 | 2 | +2 | n/a (zero baseline) |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 4 | +1 | +33.33% |
| Failing observed test runs | 0 | 1 | +1 | n/a (zero baseline) |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 125 | 18 | -107 | -85.60% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 56 | 2 | -54 | -96.43% |
| Maximum goal tokens used | 181,834 | 74,968 | -106,866 | -58.77% |
| Completed RPC compactions | 14 | 4 | -10 | -71.43% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 0 | 2 | +2 | n/a (zero baseline) |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | +1 | n/a (zero baseline) |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 178,510 | 72,798 | -105,712 | -59.22% |
| Output tokens | 4,227 | 2,645 | -1,582 | -37.43% |
| Cache-read tokens | 469,504 | 95,744 | -373,760 | -79.61% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 652,241 | 171,187 | -481,054 | -73.75% |
| Prompt-cache reuse | 72.45% | 56.81% | -15.65 pp | — |
| Input cost | $0.892550 | $0.363990 | -0.528560 | -59.22% |
| Output cost | $0.126810 | $0.079350 | -0.047460 | -37.43% |
| Cache-read cost | $0.234752 | $0.047872 | -0.186880 | -79.61% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.254112 | $0.491212 | -0.762900 | -60.83% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 17 | +17 | n/a (zero baseline) |
| Archive source bytes | 0 | 132,536 | +132,536 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 14,023 | +14,023 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 10.58% | +10.58 pp | — |
| Archive chunks | 0 | 27 | +27 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 284,237 | +284,237 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 131,214 | +131,214 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 42,060 | +42,060 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 265,072 | +265,072 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 95,744 | +95,744 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 72,798 | +72,798 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 13 | +13 | n/a (zero baseline) |


---

<a id="task-26"></a>

## Task 26: Layered Configuration Merger (`layered-config`)

- **Package / domain:** `layeredconfig`; configuration composition, environment substitution, and provenance.
- **Initial task and baseline:** Implement `merge_layers(layers) -> dict`, where layers are `(unique_name, mapping)` pairs applied left to right. Recursively merge mapping values without mutating inputs; otherwise the later value replaces the earlier one. Lists replace by default, and JSON `null` is normal data rather than a deletion marker. Tests cover deep merge, mapping/list/scalar type replacement, list replacement, and `None` replacement.
- **Live steering constraint:** Preserve input immutability, deterministic ordering, and phase-one API compatibility. Keep the goal active.
- **Pivot — delete markers, list policy, provenance:** Treat only the exact mapping `{"$delete": true}` as deletion; a mapping with any extra member is normal data, and such markers inside lists are normal list values. Add `list_policy` values `replace`, `append`, and `unique`; `unique` uses stable JSON-value equality and a linear scan. Add `merge_layers_detailed(...) -> MergeResult(config, sources)`. `sources` maps every surviving RFC 6901 pointer—including root `""`, containers, and list elements—to its current source layer. A deep-merged container receives the incoming layer while untouched children retain prior sources. Append/unique preserve old element sources, stamp admitted new elements, and deletion removes the whole pointer subtree. Only current provenance is retained. The tests lock stable deduplication and a mixed-source tree such as `/db` from the later layer while `/db/port` remains from the base.
- **Follow-up — explicit environment, explanation, CLI:** If and only if an explicit `env` mapping is supplied, expand string values after merging in one pass. Support `${NAME}` and `${NAME:-default}`; the default applies when the name is absent, not when it is present with an empty value. Do not expand keys and do not consult the ambient process environment. A missing name without a default raises `ExpansionError` that identifies both its JSON pointer and variable name; expansion leaves provenance unchanged. `MergeResult.explain(pointer)` returns exactly `{path, value, source}`; missing pointers raise `KeyError` and malformed RFC 6901 pointers raise `ValueError`. The CLI accepts repeated `--layer NAME=FILE`, optional `--list-policy`, repeated `--env NAME=VALUE`, and optional `--explain POINTER`, then prints one compact key-sorted JSON line for the merged config or explanation.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `layeredconfig/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion is valid only after the lock and the full staged intervention sequence.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `LAYERED CONFIG GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 300.70 s vs 471.62 s; Δ -170.91 s (-36.24%).
- **Model calls:** 17 vs 23; Δ -6 (-26.09%).
- **Tool calls:** 16 vs 19; Δ -3 (-15.79%).
- **Compactions:** 5 vs 8; Δ -3 (-37.50%).
- **Total tokens:** 178,753 vs 235,089; Δ -56,336 (-23.96%).
- **Reported API cost:** $0.655136 vs $0.872520; Δ -0.217384 (-24.91%).
- **Visible tool bytes:** 275,975 vs 212,053; Δ +63,922 (+30.14%).
- **Prompt-cache reuse:** 52.37% vs 50.87%; Δ +1.50 pp.

- **Expected exact final response:** `LAYERED CONFIG GOAL COMPLETE`
- **vanilla prime-agent final response:** `LAYERED CONFIG GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `LAYERED CONFIG GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 471.62 s | 300.70 s | -170.91 s | -36.24% |
| Lifecycle wall time | 472.12 s | 301.20 s | -170.91 s | -36.20% |
| Instruction wall time | 471.62 s | 300.70 s | -170.91 s | -36.24% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 23 | 17 | -6 | -26.09% |
| Tool calls | 19 | 16 | -3 | -15.79% |
| Tool results | 19 | 16 | -3 | -15.79% |
| Visible tool bytes | 212,053 | 275,975 | +63,922 | +30.14% |
| Compactions | 8 | 5 | -3 | -37.50% |
| Goal-context injections | 9 | 4 | -5 | -55.56% |
| Assistant output events | 23 | 17 | -6 | -26.09% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 13 | 7 | -6 | -46.15% |
| Test-run observations | 6 | 5 | -1 | -16.67% |
| Goal updates | 33 | 20 | -13 | -39.39% |
| RPC compaction completions | 8 | 5 | -3 | -37.50% |
| Compaction requests | 5 | 2 | -3 | -60.00% |
| Compaction waits | 3 | 0 | -3 | -100.00% |
| Accepted stage/command responses | 9 | 6 | -3 | -33.33% |
| Rejected stage/command responses | 4 | 1 | -3 | -75.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 5 | 4 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 32 | 19 | -13 | -40.62% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 8 | 3 | -5 | -62.50% |
| Maximum goal tokens used | 116,011 | 87,384 | -28,627 | -24.68% |
| Completed RPC compactions | 8 | 5 | -3 | -37.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 4 | 1 | -3 | -75.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 3 | 0 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 111,270 | 81,966 | -29,304 | -26.34% |
| Output tokens | 8,619 | 6,675 | -1,944 | -22.55% |
| Cache-read tokens | 115,200 | 90,112 | -25,088 | -21.78% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 235,089 | 178,753 | -56,336 | -23.96% |
| Prompt-cache reuse | 50.87% | 52.37% | +1.50 pp | — |
| Input cost | $0.556350 | $0.409830 | -0.146520 | -26.34% |
| Output cost | $0.258570 | $0.200250 | -0.058320 | -22.55% |
| Cache-read cost | $0.057600 | $0.045056 | -0.012544 | -21.78% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.872520 | $0.655136 | -0.217384 | -24.91% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 15 | +15 | n/a (zero baseline) |
| Archive source bytes | 0 | 262,312 | +262,312 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 20,630 | +20,630 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 7.86% | +7.86 pp | — |
| Archive chunks | 0 | 23 | +23 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 544,501 | +544,501 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 260,076 | +260,076 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 25,681 | +25,681 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 524,624 | +524,624 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 6 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 90,112 | +90,112 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 81,966 | +81,966 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


---

<a id="task-27"></a>

## Task 27: Ranked-Choice Election Tabulator (`ranked-choice`)

- **Package / domain:** `rankedchoice`; elections and instant-runoff/ranked-choice tabulation.
- **Initial task and baseline:** Implement `tabulate(ballots, *, withdrawn=()) -> dict`. A legacy ballot is a ranking list with weight 1. Candidates are the union of ranked names minus withdrawn names. In each round, assign each ballot's weight to its first active ranked candidate or count it as exhausted; include all active candidates in lexically sorted `counts`. A winner needs strictly more than half of the non-exhausted weight. Otherwise eliminate a minimum-count candidate, breaking ties by eliminating the lexicographically greatest name. Return `{"winner": ..., "rounds": [...]}`, where each ordered round has `counts`, `exhausted`, and `eliminated`; a winning round has `eliminated: null`. No active candidates means no winner and no rounds. Inputs stay unchanged.
- **Live steering constraint:** Preserve strict-majority semantics, deterministic elimination, exhaustion accounting, and input immutability. Keep the goal active.
- **Pivot — weighted ballots and withdrawals:** Also accept ballots shaped as `{"ranking": [...], "weight": positive_integer}` while preserving legacy lists at weight 1. Skip withdrawn candidates from the first round onward; they never appear in counts or round data. If all ranked candidates are withdrawn, return `{"winner": null, "rounds": []}`. Preserve ballots and deterministic tie behavior. Tests cover weighted/legacy mixes, transfer after withdrawal, exhaustion, and lexicographically greatest elimination on tied minimum counts.
- **Follow-up — JSON and NDJSON CLI:** `python -m rankedchoice.cli` reads one JSON request from stdin. With `--ndjson`, each nonblank line is an independent request and output order must match input order. A request contains `ballots` and optional `withdrawn` (default `[]`). Emit exactly one compact, key-sorted JSON result line per request and no other output; blank NDJSON lines are ignored.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `rankedchoice/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must be after lock and after every staged intervention.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `RANKED CHOICE GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 174.87 s vs 194.75 s; Δ -19.87 s (-10.20%).
- **Model calls:** 15 vs 21; Δ -6 (-28.57%).
- **Tool calls:** 14 vs 17; Δ -3 (-17.65%).
- **Compactions:** 4 vs 3; Δ +1 (+33.33%).
- **Total tokens:** 148,002 vs 175,220; Δ -27,218 (-15.53%).
- **Reported API cost:** $0.392328 vs $0.462174; Δ -0.069846 (-15.11%).
- **Visible tool bytes:** 13,651 vs 92,458; Δ -78,807 (-85.24%).
- **Prompt-cache reuse:** 64.60% vs 65.34%; Δ -0.75 pp.

- **Expected exact final response:** `RANKED CHOICE GOAL COMPLETE`
- **vanilla prime-agent final response:** `RANKED CHOICE GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `RANKED CHOICE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 194.75 s | 174.87 s | -19.87 s | -10.20% |
| Lifecycle wall time | 195.04 s | 175.30 s | -19.73 s | -10.12% |
| Instruction wall time | 194.75 s | 174.87 s | -19.87 s | -10.20% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 21 | 15 | -6 | -28.57% |
| Tool calls | 17 | 14 | -3 | -17.65% |
| Tool results | 17 | 14 | -3 | -17.65% |
| Visible tool bytes | 92,458 | 13,651 | -78,807 | -85.24% |
| Compactions | 3 | 4 | +1 | +33.33% |
| Goal-context injections | 3 | 3 | +0 | +0.00% |
| Assistant output events | 21 | 15 | -6 | -28.57% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 11 | 7 | -4 | -36.36% |
| Test-run observations | 4 | 5 | +1 | +25.00% |
| Goal updates | 25 | 17 | -8 | -32.00% |
| RPC compaction completions | 3 | 4 | +1 | +33.33% |
| Compaction requests | 4 | 2 | -2 | -50.00% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 9 | 7 | -2 | -22.22% |
| Rejected stage/command responses | 2 | 0 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 4 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 24 | 16 | -8 | -33.33% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 2 | -1 | -33.33% |
| Maximum goal tokens used | 61,834 | 53,055 | -8,779 | -14.20% |
| Completed RPC compactions | 3 | 4 | +1 | +33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 2 | 0 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 59,466 | 51,348 | -8,118 | -13.65% |
| Output tokens | 3,626 | 2,958 | -668 | -18.42% |
| Cache-read tokens | 112,128 | 93,696 | -18,432 | -16.44% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 175,220 | 148,002 | -27,218 | -15.53% |
| Prompt-cache reuse | 65.34% | 64.60% | -0.75 pp | — |
| Input cost | $0.297330 | $0.256740 | -0.040590 | -13.65% |
| Output cost | $0.108780 | $0.088740 | -0.020040 | -18.42% |
| Cache-read cost | $0.056064 | $0.046848 | -0.009216 | -16.44% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.462174 | $0.392328 | -0.069846 | -15.11% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 13 | +13 | n/a (zero baseline) |
| Archive source bytes | 0 | 0 | +0 | 0.00% |
| Compressed archive bytes | 0 | 5,840 | +5,840 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 0.00% | +0.00 pp | — |
| Archive chunks | 0 | 15 | +15 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 3,074 | +3,074 | n/a (zero baseline) |
| Source bytes admitted | 0 | 13,710 | +13,710 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 0 | +0 | 0.00% |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 39,451 | +39,451 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 0 | +0 | 0.00% |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 5 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 93,696 | +93,696 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 51,348 | +51,348 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-28"></a>

## Task 28: Stock Reservation Engine (`stock-reservation`)

- **Package / domain:** `stockroom`; inventory allocation and reservation lifecycle management.
- **Initial task and baseline:** Implement immutable `Line(sku, quantity)` and `Reservation(id, lines, expires_at=None)`, plus `Inventory(stock)` with `reserve`, `release`, `available`, and `active`. Stock values are nonnegative integers and line quantities are positive integers. A multi-SKU reserve is atomic and returns `"accepted"` or `"insufficient"`. The first accepted reservation ID remains seen forever; reuse returns `"duplicate"`, but an insufficient attempt does not consume the ID. `release(id)` returns `"released"` or `"missing"` and restores held availability. `active()` returns open reservations sorted by ID, `available()` returns zero for an unknown SKU, and caller inputs must not be mutated.
- **Live steering constraint:** Preserve atomic multi-SKU operations, deterministic ordering, and first-accepted ID semantics. Continue without completing the goal.
- **Pivot — expiration, commit, amendment:** Inventory time starts at 0. `advance_time(now)` is monotonic and returns newly expired IDs once, ordered by `(expires_at, id)`; expiration occurs at `now >= expires_at` and releases the hold. A reserve whose `expires_at <= current time` raises `ValueError`. `commit(id)` returns `"committed"` or `"missing"`, removes the open hold, permanently deducts its quantities from stock, and leaves the ID seen. `amend(id, lines)` returns `"accepted"`, `"insufficient"`, or `"missing"`; evaluate the replacement atomically as if the old hold were temporarily released, retain the original reservation unchanged on failure, and preserve its expiration on success. Aggregate duplicate SKUs in a request before checking availability. Tests lock same-time expiry ordering, single release, permanent commit, and failed-amend rollback.
- **Follow-up — snapshots, previews, CLI:** `snapshot()` has exactly sorted `stock`, integer `now`, sorted `seen_ids`, and sorted `open` reservation dictionaries; each open reservation's lines are sorted by SKU. `from_snapshot()` restores equivalent state. Nonmutating `explain(reservation)` returns exactly `id`, `status`, `reason`, `shortages`, `expires_at`, and `now`. Its reserve decision order is seen ID → `duplicate` / `id_seen`; otherwise shortages → `insufficient` / `insufficient_stock`; otherwise `accepted` / `stock_available`. Each shortage is a sorted `{sku, requested, available}` record. `python -m stockroom.cli --stock JSON` consumes NDJSON operations and emits compact key-sorted responses for `reserve`, `release`, `commit`, `amend`, `advance`, `explain`, and `snapshot`.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `stockroom/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must occur after lock and the complete staged intervention order.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `STOCKROOM GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 185.49 s vs 405.73 s; Δ -220.24 s (-54.28%).
- **Model calls:** 13 vs 21; Δ -8 (-38.10%).
- **Tool calls:** 12 vs 17; Δ -5 (-29.41%).
- **Compactions:** 3 vs 7; Δ -4 (-57.14%).
- **Total tokens:** 130,366 vs 194,460; Δ -64,094 (-32.96%).
- **Reported API cost:** $0.420102 vs $0.666952; Δ -0.246850 (-37.01%).
- **Visible tool bytes:** 77,773 vs 163,141; Δ -85,368 (-52.33%).
- **Prompt-cache reuse:** 64.22% vs 58.00%; Δ +6.22 pp.

- **Expected exact final response:** `STOCKROOM GOAL COMPLETE`
- **vanilla prime-agent final response:** `STOCKROOM GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `STOCKROOM GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 405.73 s | 185.49 s | -220.24 s | -54.28% |
| Lifecycle wall time | 406.21 s | 185.66 s | -220.55 s | -54.29% |
| Instruction wall time | 405.73 s | 185.49 s | -220.24 s | -54.28% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 21 | 13 | -8 | -38.10% |
| Tool calls | 17 | 12 | -5 | -29.41% |
| Tool results | 17 | 12 | -5 | -29.41% |
| Visible tool bytes | 163,141 | 77,773 | -85,368 | -52.33% |
| Compactions | 7 | 3 | -4 | -57.14% |
| Goal-context injections | 8 | 1 | -7 | -87.50% |
| Assistant output events | 21 | 13 | -8 | -38.10% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 13 | 7 | -6 | -46.15% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 30 | 15 | -15 | -50.00% |
| RPC compaction completions | 7 | 3 | -4 | -57.14% |
| Compaction requests | 5 | 2 | -3 | -60.00% |
| Compaction waits | 3 | 0 | -3 | -100.00% |
| Accepted stage/command responses | 9 | 7 | -2 | -22.22% |
| Rejected stage/command responses | 4 | 0 | -4 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 29 | 14 | -15 | -51.72% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 7 | 1 | -6 | -85.71% |
| Maximum goal tokens used | 85,002 | 48,708 | -36,294 | -42.70% |
| Completed RPC compactions | 7 | 3 | -4 | -57.14% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 4 | 0 | -4 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 3 | 0 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 78,592 | 44,782 | -33,810 | -43.02% |
| Output tokens | 7,324 | 5,200 | -2,124 | -29.00% |
| Cache-read tokens | 108,544 | 80,384 | -28,160 | -25.94% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 194,460 | 130,366 | -64,094 | -32.96% |
| Prompt-cache reuse | 58.00% | 64.22% | +6.22 pp | — |
| Input cost | $0.392960 | $0.223910 | -0.169050 | -43.02% |
| Output cost | $0.219720 | $0.156000 | -0.063720 | -29.00% |
| Cache-read cost | $0.054272 | $0.040192 | -0.014080 | -25.94% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.666952 | $0.420102 | -0.246850 | -37.01% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 11 | +11 | n/a (zero baseline) |
| Archive source bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 8,467 | +8,467 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 12.91% | +12.91 pp | — |
| Archive chunks | 0 | 13 | +13 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 146,011 | +146,011 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 65,121 | +65,121 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 43,194 | +43,194 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 131,156 | +131,156 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 4 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 80,384 | +80,384 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 44,782 | +44,782 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 9 | +9 | n/a (zero baseline) |


---

<a id="task-29"></a>

## Task 29: Trip Expense Settlement (`trip-settlement`)

- **Package / domain:** `tripsplit`; expense sharing, cent allocation, and deterministic debt settlement.
- **Initial task and baseline:** Implement `settle(people, expenses) -> list[dict]`. Each initial expense has a `payer` and decimal-string `amount` shared equally by all people. Convert to integer cents exactly, assign each participant the floor share, and distribute leftover cents in `people` order. Compute net balance as paid minus owed, then greedily match debtors and creditors, both in `people` order. Return only positive transfers as `{"from": name, "to": name, "amount": "0.00"}`. Preserve inputs and deterministic order. Tests cover spare-cent allocation, multiple payers, and the fact that a one-cent expense can settle to no transfer when its payer receives the ordered remainder.
- **Live steering constraint:** Preserve exact cent arithmetic, deterministic person order, and input immutability. Keep the goal active.
- **Pivot — subset and weighted shares:** Expenses without `shares` remain equally split. An expense may instead have `shares`, mapping only the owing participants to positive integer weights. Allocate cents in proportion to total weight using largest fractional remainder; break equal remainders by global `people` order. Payers and share names must be present in `people`, and people names are unique. Tests cover a subset that excludes the payer, weighted rounding (1:2:3 over 1000 cents), and mixing custom and default sharing.
- **Follow-up — ordered NDJSON CLI:** `python -m tripsplit.cli` reads NDJSON requests from stdin. Each nonblank request contains `id`, `people`, and `expenses`; emit one compact, key-sorted JSON line with that same `id` and its `settlements`. Preserve request order, ignore blank lines, and read or write no other files.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `tripsplit/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must happen only after lock and the staged intervention sequence.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `TRIP SPLIT GOAL COMPLETE`

### Measured outcome

**Verdict:** `prime-context 8.1.0` meets all acceptance criteria while `vanilla prime-agent` does not meet all acceptance criteria: a strict correctness gain.

- **Wall time:** 140.15 s vs 600.00 s; Δ -459.85 s (-76.64%).
- **Model calls:** 15 vs 88; Δ -73 (-82.95%).
- **Tool calls:** 14 vs 14; Δ +0 (+0.00%).
- **Compactions:** 3 vs 12; Δ -9 (-75.00%).
- **Total tokens:** 148,598 vs 843,852; Δ -695,254 (-82.39%).
- **Reported API cost:** $0.474697 vs $1.586011; Δ -1.111314 (-70.07%).
- **Visible tool bytes:** 80,491 vs 82,295; Δ -1,804 (-2.19%).
- **Prompt-cache reuse:** 49.71% vs 73.68%; Δ -23.97 pp.

- **Expected exact final response:** `TRIP SPLIT GOAL COMPLETE`
- **vanilla prime-agent final response:** `Goal remains active pending `REQUIREMENTS LOCKED`.`
- **prime-context 8.1.0 final response:** `TRIP SPLIT GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | no | yes |
| Runner task-completed gate | yes | no | yes |
| External cumulative tests | 9/9 | 6/6 | 9/9 |
| External-tests gate | yes | no | yes |
| Protected files unchanged | yes | no | yes |
| Goal status | complete | active | complete |
| Goal completed after lock | yes | no | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | no | yes |
| Exact final response | yes | no | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | no | yes |
| Run error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction error | none | TimeoutError: condition timed out after 600 seconds | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 600.00 s | 140.15 s | -459.85 s | -76.64% |
| Lifecycle wall time | 600.55 s | 140.52 s | -460.03 s | -76.60% |
| Instruction wall time | 600.00 s | 140.15 s | -459.85 s | -76.64% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 88 | 15 | -73 | -82.95% |
| Tool calls | 14 | 14 | +0 | +0.00% |
| Tool results | 14 | 14 | +0 | +0.00% |
| Visible tool bytes | 82,295 | 80,491 | -1,804 | -2.19% |
| Compactions | 12 | 3 | -9 | -75.00% |
| Goal-context injections | 76 | 2 | -74 | -97.37% |
| Assistant output events | 88 | 15 | -73 | -82.95% |
| Interventions delivered | 3 | 5 | +2 | +66.67% |
| Stage responses recorded | 8 | 7 | -1 | -12.50% |
| Test-run observations | 2 | 5 | +3 | +150.00% |
| Goal updates | 163 | 18 | -145 | -88.96% |
| RPC compaction completions | 12 | 3 | -9 | -75.00% |
| Compaction requests | 3 | 2 | -1 | -33.33% |
| Compaction waits | 2 | 0 | -2 | -100.00% |
| Accepted stage/command responses | 6 | 7 | +1 | +16.67% |
| Rejected stage/command responses | 2 | 0 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 1 | 4 | +3 | +300.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 163 | 17 | -146 | -89.57% |
| Complete goal updates | 0 | 1 | +1 | n/a (zero baseline) |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 76 | 2 | -74 | -97.37% |
| Maximum goal tokens used | 226,380 | 75,406 | -150,974 | -66.69% |
| Completed RPC compactions | 12 | 3 | -9 | -75.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 2 | 0 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 2 | 0 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 220,565 | 73,539 | -147,026 | -66.66% |
| Output tokens | 5,815 | 2,355 | -3,460 | -59.50% |
| Cache-read tokens | 617,472 | 72,704 | -544,768 | -88.23% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 843,852 | 148,598 | -695,254 | -82.39% |
| Prompt-cache reuse | 73.68% | 49.71% | -23.97 pp | — |
| Input cost | $1.102825 | $0.367695 | -0.735130 | -66.66% |
| Output cost | $0.174450 | $0.070650 | -0.103800 | -59.50% |
| Cache-read cost | $0.308736 | $0.036352 | -0.272384 | -88.23% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.586011 | $0.474697 | -1.111314 | -70.07% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 13 | +13 | n/a (zero baseline) |
| Archive source bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 9,404 | +9,404 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 14.34% | +14.34 pp | — |
| Archive chunks | 0 | 16 | +16 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 147,262 | +147,262 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 65,094 | +65,094 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 42,481 | +42,481 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 131,156 | +131,156 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 4 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 72,704 | +72,704 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 73,539 | +73,539 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 11 | +11 | n/a (zero baseline) |


---

<a id="task-30"></a>

## Task 30: Webhook Delivery Scheduler (`webhook-scheduler`)

- **Package / domain:** `webhooks`; asynchronous webhook delivery, retries, and host-scoped concurrency scheduling.
- **Initial task and baseline:** Implement `SendResult(status: int)`, immutable `DeliveryView(id, url, state, attempts, next_attempt_at, last_status, last_error)`, and `WebhookScheduler(sender, clock, executor, max_attempts=3, backoff_base=1.0, max_per_host=2)`. Provide `submit(url, payload, delivery_id=None, not_before=None)`, nonblocking `pump()`, `get()`, `list()`, `cancel()`, and `close()`. Serialize payloads to canonical JSON bytes with sorted keys and compact separators, send `Content-Type: application/json`, and use only the injected clock—never sleep. Select eligible pending jobs by `(next_attempt_at, insertion_sequence)`, increment attempts on dispatch, and treat all 2xx results as success. Tests accept either `SendResult` or an integer status, lock `not_before` eligibility and FIFO order, and require a permanent 400 to fail after one attempt.
- **Live steering constraint:** Preserve deterministic FIFO behavior, never sleep, and derive scheduler time only from the injected clock. Keep the goal active.
- **Pivot — retry classification and backoff:** Treat 408, 425, 429, all 5xx statuses, and sender exceptions as transient; all other non-2xx statuses fail immediately. After transient attempt number `n`, schedule at `clock() + backoff_base * 2**(n-1)`. On reaching `max_attempts`, mark failed and clear `next_attempt_at`. A pending exception retry stores the exception text in `last_error`; a later success clears the error and records the successful status. There is no jitter or sleeping, and the exact clock deadline controls eligibility. Tests lock deadlines (for base 2: times 2 then 6), attempt counts, exhaustion, and exception-then-success state.
- **Follow-up — host limits, cancellation, CLI:** Host identity is lower-cased `urlsplit(url).hostname`; different ports share one host. At most `max_per_host` futures may run for one host, but a blocked host must not stop eligible work for another, and a later `pump()` fills slots released by completed futures. Protect callback-touched state with one re-entrant lock. `cancel()` changes pending work to cancelled and returns true; for running work it calls `Future.cancel()` and returns true only on success; terminal work returns false, and cancelled work never retries. `close()` shuts down only an executor created/owned by the scheduler. Expose `webhooks.cli.main(argv, stdout, sender, clock, executor)` for `--json --id ID URL PAYLOAD_JSON`. JSON mode emits exactly one compact, key-sorted, newline-terminated `DeliveryView` object and returns 0 for succeeded, 1 for failed/cancelled, and 2 for pending/running or usage error. The CLI test locks all seven view fields for an immediate success.
- **Locked acceptance and edit boundary:** On `REQUIREMENTS LOCKED`, run the complete suite, edit only `webhooks/`, then call `await goal.complete()`. Protected artifacts are `TASK.md`, `PIVOT.md`, `FOLLOWUP.md`, `run_tests.py`, `tests/test_base.py`, `tests/test_pivot.py`, and `tests/test_followup.py`. Completion must be after the lock and all staged interventions.
- **Expected full result:** `TEST_RESULT PASS 9/9`.
- **Exact final response:** `WEBHOOK GOAL COMPLETE`

### Measured outcome

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 289.36 s vs 351.92 s; Δ -62.56 s (-17.78%).
- **Model calls:** 18 vs 20; Δ -2 (-10.00%).
- **Tool calls:** 18 vs 18; Δ +0 (+0.00%).
- **Compactions:** 6 vs 7; Δ -1 (-14.29%).
- **Total tokens:** 189,921 vs 203,172; Δ -13,251 (-6.52%).
- **Reported API cost:** $0.635778 vs $0.711810; Δ -0.076032 (-10.68%).
- **Visible tool bytes:** 288,535 vs 227,639; Δ +60,896 (+26.75%).
- **Prompt-cache reuse:** 51.99% vs 52.01%; Δ -0.02 pp.

- **Expected exact final response:** `WEBHOOK GOAL COMPLETE`
- **vanilla prime-agent final response:** `WEBHOOK GOAL COMPLETE`
- **prime-context 8.1.0 final response:** `WEBHOOK GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | vanilla prime-agent | prime-context 8.1.0 |
|---|---:|---:|---:|
| Meets all acceptance criteria | yes | yes | yes |
| Runner task-completed gate | yes | yes | yes |
| External cumulative tests | 9/9 | 9/9 | 9/9 |
| External-tests gate | yes | yes | yes |
| Protected files unchanged | yes | yes | yes |
| Goal status | complete | complete | complete |
| Goal completed after lock | yes | yes | yes |
| Interventions accepted | yes | yes | yes |
| Intervention order correct | yes | yes | yes |
| Exact final response | yes | yes | yes |
| Early completion observed | no | no | no |
| Goal-complete event observed | yes | yes | yes |
| Run error | none | none | none |
| Interaction error | none | none | none |
| Interaction stderr | empty | empty | empty |
| Retained Docker evidence | yes | yes | yes |

### Complete common metric comparison

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 351.92 s | 289.36 s | -62.56 s | -17.78% |
| Lifecycle wall time | 352.31 s | 289.60 s | -62.70 s | -17.80% |
| Instruction wall time | 351.92 s | 289.36 s | -62.56 s | -17.78% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 20 | 18 | -2 | -10.00% |
| Tool calls | 18 | 18 | +0 | +0.00% |
| Tool results | 18 | 18 | +0 | +0.00% |
| Visible tool bytes | 227,639 | 288,535 | +60,896 | +26.75% |
| Compactions | 7 | 6 | -1 | -14.29% |
| Goal-context injections | 5 | 4 | -1 | -20.00% |
| Assistant output events | 20 | 18 | -2 | -10.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 6 | 5 | -1 | -16.67% |
| Goal updates | 26 | 21 | -5 | -19.23% |
| RPC compaction completions | 7 | 6 | -1 | -14.29% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 7 | +1 | +16.67% |
| Rejected stage/command responses | 1 | 0 | -1 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 5 | 4 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 25 | 20 | -5 | -20.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 3 | -1 | -25.00% |
| Maximum goal tokens used | 97,496 | 88,693 | -8,803 | -9.03% |
| Completed RPC compactions | 7 | 6 | -1 | -14.29% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | +1 | +100.00% |
| Failed compaction requests | 1 | 0 | -1 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 94,502 | 88,892 | -5,610 | -5.94% |
| Output tokens | 6,270 | 4,773 | -1,497 | -23.88% |
| Cache-read tokens | 102,400 | 96,256 | -6,144 | -6.00% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 203,172 | 189,921 | -13,251 | -6.52% |
| Prompt-cache reuse | 52.01% | 51.99% | -0.02 pp | — |
| Input cost | $0.472510 | $0.444460 | -0.028050 | -5.94% |
| Output cost | $0.188100 | $0.143190 | -0.044910 | -23.88% |
| Cache-read cost | $0.051200 | $0.048128 | -0.003072 | -6.00% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.711810 | $0.635778 | -0.076032 | -10.68% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | vanilla prime-agent | prime-context 8.1.0 | Δ (prime-context 8.1.0 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 0 | 17 | +17 | n/a (zero baseline) |
| Archive source bytes | 0 | 263,398 | +263,398 | n/a (zero baseline) |
| Compressed archive bytes | 0 | 22,201 | +22,201 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 8.43% | +8.43 pp | — |
| Archive chunks | 0 | 22 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 0 | 65,578 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 0 | 551,205 | +551,205 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 260,681 | +260,681 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 0 | 24,037 | +24,037 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 526,796 | +526,796 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 0 | 7 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 0 | 96,256 | +96,256 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 0 | 88,892 | +88,892 | n/a (zero baseline) |
| Stable-projection extension turns | 0 | 12 | +12 | n/a (zero baseline) |


## Evidence and reproducibility reference

The public repository contains the runner and every deterministic fixture under [`benchmarks/`](benchmarks/). Raw run artifacts are intentionally excluded from Git because they contain complete session evidence and are large. The aggregate and per-task values in this document were generated directly from each retained `result.json`; text/log fields, container identifiers, and session paths are evidence rather than scalar metrics and are not reproduced here.
