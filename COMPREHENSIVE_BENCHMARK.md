# Comprehensive Prime Context 8.1.1 Benchmark

&gt; Full-corpus isolated Docker comparison of `prime-context 8.1.1` and `vanilla prime-agent` across all 30 realistic staged coding tasks.

## Aggregate summary

`prime-context 8.1.1` met every acceptance criterion on **30/30 tasks**; `vanilla prime-agent` did so on **30/30 tasks**. There were **0 strict correctness gains** and **0 strict correctness losses** for `prime-context 8.1.1`.

The **30 matched-correct pairs** form the formal efficiency cohort. Raw metrics remain reported for every other pair, but resource use does not override failed acceptance.

| Correctness measure | prime-context 8.1.1 | vanilla prime-agent | Paired interpretation |
|---|---:|---:|---|
| Tasks meeting every acceptance criterion | 30 / 30 | 30 / 30 | +0 tasks |
| Strict completion rate | 100.00% | 100.00% | +0.00 pp |
| Correctness gains | 0 | — | none |
| Correctness losses | 0 | — | none |
| Matched-correct pairs | 30 | 30 | formal efficiency cohort |

### Whole-corpus workload totals

These totals use one selected strict-passing result for each of all 30 tasks per variant. When an initial run failed and its one retry passed, only the retry is included; the failed initial attempt is excluded from every comparison and aggregate and retained only in retry disclosures and run artifacts. Aggregate totals and deltas use unrounded source values; displayed per-task values are rounded for readability.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 10,304.04 s | 13,529.07 s | -3,225.03 s | -23.84% |
| Lifecycle wall time | 10,314.52 s | 13,539.99 s | -3,225.48 s | -23.82% |
| Model calls | 536 | 698 | -162 | -23.21% |
| Tool calls | 520 | 632 | -112 | -17.72% |
| Tool results | 519 | 632 | -113 | -17.88% |
| Visible tool bytes | 6,322,704 | 5,527,703 | +795,001 | +14.38% |
| Compactions | 173 | 229 | -56 | -24.45% |
| Input tokens | 2,522,228 | 2,944,355 | -422,127 | -14.34% |
| Output tokens | 161,425 | 255,963 | -94,538 | -36.93% |
| Cache-read tokens | 2,859,520 | 3,795,456 | -935,936 | -24.66% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 5,543,173 | 6,995,774 | -1,452,601 | -20.76% |
| Prompt-cache reuse | 53.13% | 56.31% | -3.18 pp | — |
| Total API cost | $18.883650 | $24.298393 | -5.414743 | -22.28% |

### Matched-correct efficiency totals

These totals include only the 30 task pairs where both variants met every strict acceptance criterion: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 10,304.04 s | 13,529.07 s | -3,225.03 s | -23.84% |
| Lifecycle wall time | 10,314.52 s | 13,539.99 s | -3,225.48 s | -23.82% |
| Model calls | 536 | 698 | -162 | -23.21% |
| Tool calls | 520 | 632 | -112 | -17.72% |
| Tool results | 519 | 632 | -113 | -17.88% |
| Visible tool bytes | 6,322,704 | 5,527,703 | +795,001 | +14.38% |
| Compactions | 173 | 229 | -56 | -24.45% |
| Input tokens | 2,522,228 | 2,944,355 | -422,127 | -14.34% |
| Output tokens | 161,425 | 255,963 | -94,538 | -36.93% |
| Cache-read tokens | 2,859,520 | 3,795,456 | -935,936 | -24.66% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 5,543,173 | 6,995,774 | -1,452,601 | -20.76% |
| Prompt-cache reuse | 53.13% | 56.31% | -3.18 pp | — |
| Total API cost | $18.883650 | $24.298393 | -5.414743 | -22.28% |

### Success-adjusted workload

This view divides total whole-corpus consumption by the number of strict completions. It does not replace the paired comparison; it describes the cost of obtaining a successful corpus outcome.

| Success-adjusted measure | prime-context 8.1.1 | vanilla prime-agent | Relative change |
|---|---:|---:|---:|
| Task-seconds per strict completion | 343.47 s | 450.97 s | -23.84% |
| Model calls per strict completion | 17.87 | 23.27 | -23.21% |
| Tokens per strict completion | 184,772 | 233,192 | -20.76% |
| API cost per strict completion | $0.629455 | $0.809946 | -22.28% |

### Direction across individual tasks

All 30 task pairs:

| Metric | prime-context 8.1.1 lower | equal | prime-context 8.1.1 higher |
|---|---:|---:|---:|
| Wall time | 25 | 0 | 5 |
| Model calls | 25 | 1 | 4 |
| Tool calls | 24 | 1 | 5 |
| Tool results | 24 | 1 | 5 |
| Visible tool bytes | 12 | 0 | 18 |
| Compactions | 18 | 7 | 5 |
| Total tokens | 25 | 0 | 5 |
| Total API cost | 25 | 0 | 5 |

Matched-correct pairs only:

| Metric | prime-context 8.1.1 lower | equal | prime-context 8.1.1 higher |
|---|---:|---:|---:|
| Wall time | 25 | 0 | 5 |
| Model calls | 25 | 1 | 4 |
| Tool calls | 24 | 1 | 5 |
| Tool results | 24 | 1 | 5 |
| Visible tool bytes | 12 | 0 | 18 |
| Compactions | 18 | 7 | 5 |
| Total tokens | 25 | 0 | 5 |
| Total API cost | 25 | 0 | 5 |

### Aggregate acceptance gates

| Acceptance aggregate | prime-context 8.1.1 | vanilla prime-agent |
|---|---:|---:|
| Meets all acceptance criteria | 30 / 30 | 30 / 30 |
| Runner task-completed gate | 30 / 30 | 30 / 30 |
| External verifier tests passed | 270/270 | 270/270 |
| External-tests gate | 30 / 30 | 30 / 30 |
| Protected files unchanged | 30 / 30 | 30 / 30 |
| Goal status complete | 30 / 30 | 30 / 30 |
| Goal completed after lock | 30 / 30 | 30 / 30 |
| Interventions accepted | 30 / 30 | 30 / 30 |
| Intervention order correct | 30 / 30 | 30 / 30 |
| Exact final response | 30 / 30 | 30 / 30 |
| No early completion | 30 / 30 | 30 / 30 |
| Goal-complete event observed | 30 / 30 | 30 / 30 |
| No run error | 30 / 30 | 30 / 30 |
| Docker evidence retained | 30 / 30 | 30 / 30 |

### Complete whole-corpus scalar totals

This table includes every common numeric field used in the repeated per-task schema. Additive counters are summed. Prompt-cache reuse is recomputed as a weighted ratio. The two cumulative goal-budget maxima are aggregated with `max`, not summed. Instruction wall time is shown explicitly even though it normally aliases wall time.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 10,304.04 s | 13,529.07 s | -3,225.03 s | -23.84% |
| Lifecycle wall time | 10,314.52 s | 13,539.99 s | -3,225.48 s | -23.82% |
| Instruction wall time | 10,304.04 s | 13,529.07 s | -3,225.03 s | -23.84% |
| Sessions | 30 | 30 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 536 | 698 | -162 | -23.21% |
| Tool calls | 520 | 632 | -112 | -17.72% |
| Tool results | 519 | 632 | -113 | -17.88% |
| Visible tool bytes | 6,322,704 | 5,527,703 | +795,001 | +14.38% |
| Compactions | 173 | 229 | -56 | -24.45% |
| Goal-context injections | 136 | 219 | -83 | -37.90% |
| Assistant output events | 535 | 698 | -163 | -23.35% |
| Interventions delivered | 150 | 150 | +0 | +0.00% |
| Stage responses recorded | 212 | 295 | -83 | -28.14% |
| Test-run observations | 151 | 162 | -11 | -6.79% |
| Goal updates | 655 | 917 | -262 | -28.57% |
| RPC compaction completions | 173 | 229 | -56 | -24.45% |
| Compaction requests | 61 | 100 | -39 | -39.00% |
| Compaction waits | 1 | 45 | -44 | -97.78% |
| Accepted stage/command responses | 189 | 234 | -45 | -19.23% |
| Rejected stage/command responses | 23 | 61 | -38 | -62.30% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 117 | 131 | -14 | -10.69% |
| Failing observed test runs | 34 | 31 | +3 | +9.68% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 625 | 887 | -262 | -29.54% |
| Complete goal updates | 30 | 30 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 18 | 18 | +0 | +0.00% |
| Maximum goal tokens used | 223,771 | 214,656 | +9,115 | +4.25% |
| Completed RPC compactions | 173 | 229 | -56 | -24.45% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 38 | 39 | -1 | -2.56% |
| Failed compaction requests | 23 | 61 | -38 | -62.30% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 45 | -44 | -97.78% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 2,522,228 | 2,944,355 | -422,127 | -14.34% |
| Output tokens | 161,425 | 255,963 | -94,538 | -36.93% |
| Cache-read tokens | 2,859,520 | 3,795,456 | -935,936 | -24.66% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 5,543,173 | 6,995,774 | -1,452,601 | -20.76% |
| Prompt-cache reuse | 53.13% | 56.31% | -3.18 pp | — |
| Input cost | $12.611140 | $14.721775 | -2.110635 | -14.34% |
| Output cost | $4.842750 | $7.678890 | -2.836140 | -36.93% |
| Cache-read cost | $1.429760 | $1.897728 | -0.467968 | -24.66% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $18.883650 | $24.298393 | -5.414743 | -22.28% |

### Complete archive and projection aggregate

Archive counters are summed except largest chunk and end-state projected-view bytes, which use the maximum task value. Compression is a source-byte-weighted ratio. `vanilla prime-agent` does not load Prime Context, so its archive fields are zero/not applicable.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 489 | 0 | +489 | n/a (zero baseline) |
| Archive source bytes | 5,657,789 | 0 | +5,657,789 | n/a (zero baseline) |
| Compressed archive bytes | 548,589 | 0 | +548,589 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.70% | 0.00% | +9.70 pp | — |
| Archive chunks | 672 | 0 | +672 | n/a (zero baseline) |
| Largest chunk bytes | 65,949 | 0 | +65,949 | n/a (zero baseline) |
| Source bytes admitted | 12,125,721 | 0 | +12,125,721 | n/a (zero baseline) |
| Call-argument bytes projected out | 17,432 | 0 | +17,432 | n/a (zero baseline) |
| Result bytes projected out | 5,608,920 | 0 | +5,608,920 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 1,373 | 0 | +1,373 | n/a (zero baseline) |
| End-state projected model-view bytes | 42,164 | 0 | +42,164 | n/a (zero baseline) |
| Streaming bytes processed | 11,321,257 | 0 | +11,321,257 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 203 | 0 | +203 | n/a (zero baseline) |
| Prime Context cache-read tokens | 2,859,520 | 0 | +2,859,520 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 2,522,228 | 0 | +2,522,228 | n/a (zero baseline) |
| Stable-projection extension turns | 355 | 0 | +355 | n/a (zero baseline) |

## Task-level headline index

| Task | prime-context 8.1.1 | vanilla prime-agent | prime-context wall | vanilla wall | prime-context tokens | vanilla tokens | prime-context cost | vanilla cost |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| [01](#task-01) Parcel Rate Optimizer | correct | correct | 166.64 s | 183.98 s | 133,016 | 175,558 | $0.404528 | $0.438332 |
| [02](#task-02) Three-Way JSON Merge Service | correct | correct | 201.47 s | 844.29 s | 155,619 | 359,131 | $0.508257 | $1.290278 |
| [03](#task-03) Incremental Spreadsheet Engine | correct | correct | 257.37 s | 293.29 s | 154,933 | 179,856 | $0.561384 | $0.663687 |
| [04](#task-04) Heat Diffusion Plate | correct | correct | 207.53 s | 313.84 s | 151,623 | 183,274 | $0.488184 | $0.613978 |
| [05](#task-05) Binary Telemetry Frame Codec | correct | correct | 243.54 s | 330.08 s | 165,478 | 191,781 | $0.515222 | $0.666024 |
| [06](#task-06) Decimal Cash-Flow Mathematics | correct | correct | 745.71 s | 540.55 s | 178,045 | 310,375 | $0.662997 | $1.018899 |
| [07](#task-07) PGM Region Analyzer | correct | correct | 313.97 s | 336.77 s | 201,697 | 175,824 | $0.715488 | $0.626911 |
| [08](#task-08) Exact Gear-Train Constraint Solver | correct | correct | 259.41 s | 320.82 s | 172,298 | 194,550 | $0.548597 | $0.696488 |
| [09](#task-09) Streaming Signal Analysis | correct | correct | 164.22 s | 186.69 s | 138,765 | 178,403 | $0.469290 | $0.500187 |
| [10](#task-10) Polyphonic Rhythm Quantizer | correct | correct | 236.96 s | 257.60 s | 155,666 | 174,999 | $0.568076 | $0.592613 |
| [11](#task-11) Versioned Record Migration Engine | correct | correct | 350.45 s | 1,042.63 s | 154,313 | 412,416 | $0.598743 | $1.545047 |
| [12](#task-12) Transit Fare Settlement Engine | correct | correct | 254.49 s | 381.36 s | 178,732 | 203,915 | $0.577603 | $0.772375 |
| [13](#task-13) Correctable League Standings | correct | correct | 455.82 s | 404.44 s | 240,854 | 187,167 | $0.808876 | $0.797814 |
| [14](#task-14) Bank Deposit Reconciler | correct | correct | 477.39 s | 648.50 s | 247,208 | 298,586 | $0.941134 | $1.037483 |
| [15](#task-15) Hierarchical Authorization Engine | correct | correct | 249.58 s | 500.17 s | 118,397 | 220,401 | $0.538831 | $0.898835 |
| [16](#task-16) Subscription Invoice Generator | correct | correct | 285.98 s | 468.52 s | 201,593 | 227,044 | $0.683117 | $0.896095 |
| [17](#task-17) Authoritative DNS Zone Compiler | correct | correct | 293.12 s | 585.29 s | 191,922 | 287,315 | $0.639265 | $1.149414 |
| [18](#task-18) Deterministic DNA Alignment | correct | correct | 223.39 s | 384.72 s | 141,480 | 269,221 | $0.566103 | $0.954834 |
| [19](#task-19) Union Payroll Calculator | correct | correct | 1,102.01 s | 583.70 s | 433,363 | 298,596 | $1.422312 | $0.995962 |
| [20](#task-20) Constraint-Aware Dependency Lock Resolver | correct | correct | 452.21 s | 1,097.54 s | 214,670 | 442,053 | $0.793583 | $1.502143 |
| [21](#task-21) Dependency-Aware Build Planner | correct | correct | 257.76 s | 287.52 s | 162,791 | 173,714 | $0.541153 | $0.583690 |
| [22](#task-22) Committee Seat Apportionment | correct | correct | 263.13 s | 258.24 s | 172,332 | 165,029 | $0.552723 | $0.515278 |
| [23](#task-23) Content Routing Engine | correct | correct | 422.38 s | 512.74 s | 191,473 | 217,101 | $0.713779 | $0.843265 |
| [24](#task-24) Event-Time Window Counter | correct | correct | 353.91 s | 451.43 s | 188,624 | 255,014 | $0.568210 | $0.738929 |
| [25](#task-25) Feature Flag Evaluator | correct | correct | 210.23 s | 247.37 s | 143,482 | 163,967 | $0.391046 | $0.451693 |
| [26](#task-26) Layered Configuration Merger | correct | correct | 357.85 s | 450.18 s | 165,211 | 204,752 | $0.619752 | $0.757680 |
| [27](#task-27) Ranked-Choice Election Tabulator | correct | correct | 198.35 s | 223.05 s | 136,797 | 216,417 | $0.425696 | $0.547145 |
| [28](#task-28) Stock Reservation Engine | correct | correct | 504.41 s | 829.87 s | 196,239 | 233,507 | $0.571731 | $0.940624 |
| [29](#task-29) Trip Expense Settlement | correct | correct | 167.12 s | 184.77 s | 145,342 | 178,975 | $0.436431 | $0.516531 |
| [30](#task-30) Webhook Delivery Scheduler | correct | correct | 627.67 s | 379.12 s | 311,210 | 216,833 | $1.051539 | $0.746159 |

## Methodology

### Compared variants

- **`prime-context 8.1.1`:** Prime Context 8.1.1 loaded from `/opt/prime-context` on the patched Prime Agent 0.8.1 host.
- **`vanilla prime-agent`:** the same patched Prime Agent 0.8.1 host with `packages: []` and no extension.
- Neither variant received a custom prompt or `AGENTS.md`; both were launched with `--no-context-files`.
- The host patch was identical in both arms. The paired product difference was whether Prime Context was loaded.

### Execution protocol

- Source commit: `0eb4d96b69dfde8d912496efae8f0cefcf0ccec0`.
- Benchmark round: `all30-no-agents-811-timeout1200-20260830-174810`.
- Model: `openai-codex/gpt-5.6-sol` at `medium` thinking.
- Exact deadline: 1,200 seconds from initial-instruction delivery.
- Maximum concurrent jobs: 4.
- Initial campaign elapsed wall time: 8,045.26 seconds.
- Each arm used a fresh isolated Docker container, internal network, work tree, home, configuration, session tree, daemon socket, and Prime Context archive root.
- The queue alternated `prime-context 8.1.1` and `vanilla prime-agent` by task while respecting the four-job limit.
- Containers and networks were retained until result collection and inspection.

- Retry policy: each initially strict-failed arm received exactly one isolated retry. 8 retry attempt(s) were run: Task 7 vanilla prime-agent (strict pass), Task 11 prime-context 8.1.1 (strict pass), Task 15 prime-context 8.1.1 (strict pass), Task 16 prime-context 8.1.1 (strict pass), Task 16 vanilla prime-agent (strict pass), Task 20 vanilla prime-agent (strict pass), Task 21 vanilla prime-agent (strict pass), Task 30 prime-context 8.1.1 (strict pass). Final comparisons use the strict-passing retry result for those arms. Failed initial attempts are excluded from all comparative metrics and aggregates and remain only in retry disclosures and run artifacts.

### Strict acceptance rule

A task is strict-correct only when all of these conditions hold:

- the cumulative verifier reports the expected 9/9 tests;
- protected files remain byte-identical;
- the active goal reaches `complete` only after the final lock;
- all staged interventions are accepted and delivered in the expected order;
- the run has no terminal error;
- and the final response exactly matches the task contract.

Efficiency conclusions use only matched strict-correct pairs. Failed attempts are excluded from comparative metrics and retained only in retry disclosures and run artifacts.

### Repeated metric schema

Every task repeats the same complete schema: 16 acceptance/lifecycle checks, 49 common scalar metrics, and 20 Prime Context archive/projection metrics. `prime-context 8.1.1` is always the left comparison column; `vanilla prime-agent` is always the right column. Signed deltas are `prime-context 8.1.1 − vanilla prime-agent`, and relative changes use vanilla as the denominator.

### Metric glossary

- **Wall time:** deadline-clock duration from initial instruction through terminal lifecycle.
- **Lifecycle wall time:** complete process lifecycle duration measured by the runner.
- **Visible tool bytes:** model-visible tool-result text accumulated across recursive sessions.
- **Prompt-cache reuse:** cache-read tokens divided by uncached input plus cache-read plus cache-write tokens; aggregate values are recomputed from summed counters.
- **Archive/projection telemetry:** Prime Context counters collected from the same result schema in both arms; vanilla zeros are expected because the extension is absent.
- **Reported API cost:** provider-reported input, output, and cache costs summed across recursive sessions.

### Interpretation limits

- Results are specific to this model, effort level, host version, task corpus, timeout, and execution date.
- The benchmark demonstrates behavior on this controlled corpus; it is not a universal performance guarantee.
- A lower resource count is not a win when strict acceptance fails.
- Retry-selected outcomes are disclosed and should be interpreted as bounded recovery from a potentially transient initial trajectory.

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

- **Wall time:** 166.64 s vs 183.98 s; Δ -17.34 s (-9.42%).
- **Model calls:** 14 vs 20; Δ -6 (-30.00%).
- **Tool calls:** 13 vs 15; Δ -2 (-13.33%).
- **Compactions:** 4 vs 4; Δ +0 (+0.00%).
- **Total tokens:** 133,016 vs 175,558; Δ -42,542 (-24.23%).
- **Total API cost:** $0.404528 vs $0.438332; Δ -0.033804 (-7.71%).
- **Visible tool bytes:** 144,372 vs 27,487; Δ +116,885 (+425.24%).
- **Prompt-cache reuse:** 54.05% vs 67.49%; Δ -13.44 pp.

- **Expected exact final response:** `PARCEL RATE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `PARCEL RATE GOAL COMPLETE`
- **vanilla prime-agent final response:** `PARCEL RATE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 166.64 s | 183.98 s | -17.34 s | -9.42% |
| Lifecycle wall time | 167.27 s | 184.50 s | -17.23 s | -9.34% |
| Instruction wall time | 166.64 s | 183.98 s | -17.34 s | -9.42% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 14 | 20 | -6 | -30.00% |
| Tool calls | 13 | 15 | -2 | -13.33% |
| Tool results | 13 | 15 | -2 | -13.33% |
| Visible tool bytes | 144,372 | 27,487 | +116,885 | +425.24% |
| Compactions | 4 | 4 | +0 | +0.00% |
| Goal-context injections | 3 | 5 | -2 | -40.00% |
| Assistant output events | 14 | 20 | -6 | -30.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 13 | -6 | -46.15% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 16 | 24 | -8 | -33.33% |
| RPC compaction completions | 4 | 4 | +0 | +0.00% |
| Compaction requests | 2 | 5 | -3 | -60.00% |
| Compaction waits | 0 | 3 | -3 | -100.00% |
| Accepted stage/command responses | 7 | 10 | -3 | -30.00% |
| Rejected stage/command responses | 0 | 3 | -3 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 15 | 23 | -8 | -34.78% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 4 | -2 | -50.00% |
| Maximum goal tokens used | 61,198 | 58,804 | +2,394 | +4.07% |
| Completed RPC compactions | 4 | 4 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 0 | 3 | -3 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 3 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 60,064 | 55,992 | +4,072 | +7.27% |
| Output tokens | 2,296 | 3,342 | -1,046 | -31.30% |
| Cache-read tokens | 70,656 | 116,224 | -45,568 | -39.21% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 133,016 | 175,558 | -42,542 | -24.23% |
| Prompt-cache reuse | 54.05% | 67.49% | -13.44 pp | — |
| Input cost | $0.300320 | $0.279960 | +0.020360 | +7.27% |
| Output cost | $0.068880 | $0.100260 | -0.031380 | -31.30% |
| Cache-read cost | $0.035328 | $0.058112 | -0.022784 | -39.21% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.404528 | $0.438332 | -0.033804 | -7.71% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 12 | 0 | +12 | n/a (zero baseline) |
| Archive source bytes | 131,156 | 0 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 11,768 | 0 | +11,768 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.97% | 0.00% | +8.97 pp | — |
| Archive chunks | 16 | 0 | +16 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 277,585 | 0 | +277,585 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,184 | 0 | +130,184 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 33,344 | 0 | +33,344 | n/a (zero baseline) |
| Streaming bytes processed | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 70,656 | 0 | +70,656 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 60,064 | 0 | +60,064 | n/a (zero baseline) |
| Stable-projection extension turns | 10 | 0 | +10 | n/a (zero baseline) |


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

- **Wall time:** 201.47 s vs 844.29 s; Δ -642.82 s (-76.14%).
- **Model calls:** 15 vs 33; Δ -18 (-54.55%).
- **Tool calls:** 14 vs 31; Δ -17 (-54.84%).
- **Compactions:** 4 vs 14; Δ -10 (-71.43%).
- **Total tokens:** 155,619 vs 359,131; Δ -203,512 (-56.67%).
- **Total API cost:** $0.508257 vs $1.290278; Δ -0.782021 (-60.61%).
- **Visible tool bytes:** 286,604 vs 330,004; Δ -43,400 (-13.15%).
- **Prompt-cache reuse:** 58.49% vs 53.73%; Δ +4.76 pp.

- **Expected exact final response:** `JSON MERGE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `JSON MERGE GOAL COMPLETE`
- **vanilla prime-agent final response:** `JSON MERGE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 201.47 s | 844.29 s | -642.82 s | -76.14% |
| Lifecycle wall time | 201.74 s | 844.45 s | -642.71 s | -76.11% |
| Instruction wall time | 201.47 s | 844.29 s | -642.82 s | -76.14% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 33 | -18 | -54.55% |
| Tool calls | 14 | 31 | -17 | -54.84% |
| Tool results | 14 | 31 | -17 | -54.84% |
| Visible tool bytes | 286,604 | 330,004 | -43,400 | -13.15% |
| Compactions | 4 | 14 | -10 | -71.43% |
| Goal-context injections | 3 | 13 | -10 | -76.92% |
| Assistant output events | 15 | 33 | -18 | -54.55% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 8 | -3 | -37.50% |
| Goal updates | 17 | 47 | -30 | -63.83% |
| RPC compaction completions | 4 | 14 | -10 | -71.43% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 0 | 2 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 7 | -3 | -42.86% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 46 | -30 | -65.22% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 12 | -10 | -83.33% |
| Maximum goal tokens used | 66,972 | 172,004 | -105,032 | -61.06% |
| Completed RPC compactions | 4 | 14 | -10 | -71.43% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | +1 | +100.00% |
| Failed compaction requests | 0 | 2 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 62,497 | 160,036 | -97,539 | -60.95% |
| Output tokens | 5,058 | 13,239 | -8,181 | -61.79% |
| Cache-read tokens | 88,064 | 185,856 | -97,792 | -52.62% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 155,619 | 359,131 | -203,512 | -56.67% |
| Prompt-cache reuse | 58.49% | 53.73% | +4.76 pp | — |
| Input cost | $0.312485 | $0.800180 | -0.487695 | -60.95% |
| Output cost | $0.151740 | $0.397170 | -0.245430 | -61.79% |
| Cache-read cost | $0.044032 | $0.092928 | -0.048896 | -52.62% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.508257 | $1.290278 | -0.782021 | -60.61% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 13 | 0 | +13 | n/a (zero baseline) |
| Archive source bytes | 263,700 | 0 | +263,700 | n/a (zero baseline) |
| Compressed archive bytes | 20,526 | 0 | +20,526 | n/a (zero baseline) |
| Archive compression ratio (derived) | 7.78% | 0.00% | +7.78 pp | — |
| Archive chunks | 18 | 0 | +18 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 549,575 | 0 | +549,575 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 261,014 | 0 | +261,014 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 42,164 | 0 | +42,164 | n/a (zero baseline) |
| Streaming bytes processed | 527,400 | 0 | +527,400 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 88,064 | 0 | +88,064 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 62,497 | 0 | +62,497 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 257.37 s vs 293.29 s; Δ -35.93 s (-12.25%).
- **Model calls:** 15 vs 19; Δ -4 (-21.05%).
- **Tool calls:** 16 vs 19; Δ -3 (-15.79%).
- **Compactions:** 4 vs 5; Δ -1 (-20.00%).
- **Total tokens:** 154,933 vs 179,856; Δ -24,923 (-13.86%).
- **Total API cost:** $0.561384 vs $0.663687; Δ -0.102303 (-15.41%).
- **Visible tool bytes:** 207,300 vs 170,698; Δ +36,602 (+21.44%).
- **Prompt-cache reuse:** 56.60% vs 57.29%; Δ -0.69 pp.

- **Expected exact final response:** `WORKBOOK GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `WORKBOOK GOAL COMPLETE`
- **vanilla prime-agent final response:** `WORKBOOK GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 257.37 s | 293.29 s | -35.93 s | -12.25% |
| Lifecycle wall time | 257.64 s | 293.49 s | -35.85 s | -12.22% |
| Instruction wall time | 257.37 s | 293.29 s | -35.93 s | -12.25% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 19 | -4 | -21.05% |
| Tool calls | 16 | 19 | -3 | -15.79% |
| Tool results | 16 | 19 | -3 | -15.79% |
| Visible tool bytes | 207,300 | 170,698 | +36,602 | +21.44% |
| Compactions | 4 | 5 | -1 | -20.00% |
| Goal-context injections | 3 | 4 | -1 | -25.00% |
| Assistant output events | 15 | 19 | -4 | -21.05% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 4 | +1 | +25.00% |
| Goal updates | 17 | 24 | -7 | -29.17% |
| RPC compaction completions | 4 | 5 | -1 | -20.00% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 0 | 2 | -2 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 3 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 23 | -7 | -30.43% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 4 | -2 | -50.00% |
| Maximum goal tokens used | 59,695 | 80,288 | -20,593 | -25.65% |
| Completed RPC compactions | 4 | 5 | -1 | -20.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | +1 | +100.00% |
| Failed compaction requests | 0 | 2 | -2 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 64,382 | 73,281 | -8,899 | -12.14% |
| Output tokens | 6,583 | 8,271 | -1,688 | -20.41% |
| Cache-read tokens | 83,968 | 98,304 | -14,336 | -14.58% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 154,933 | 179,856 | -24,923 | -13.86% |
| Prompt-cache reuse | 56.60% | 57.29% | -0.69 pp | — |
| Input cost | $0.321910 | $0.366405 | -0.044495 | -12.14% |
| Output cost | $0.197490 | $0.248130 | -0.050640 | -20.41% |
| Cache-read cost | $0.041984 | $0.049152 | -0.007168 | -14.58% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.561384 | $0.663687 | -0.102303 | -15.41% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 15 | 0 | +15 | n/a (zero baseline) |
| Archive source bytes | 197,812 | 0 | +197,812 | n/a (zero baseline) |
| Compressed archive bytes | 13,425 | 0 | +13,425 | n/a (zero baseline) |
| Archive compression ratio (derived) | 6.79% | 0.00% | +6.79 pp | — |
| Archive chunks | 22 | 0 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 405,848 | 0 | +405,848 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 196,033 | 0 | +196,033 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 37,054 | 0 | +37,054 | n/a (zero baseline) |
| Streaming bytes processed | 395,624 | 0 | +395,624 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 83,968 | 0 | +83,968 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 64,382 | 0 | +64,382 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 207.53 s vs 313.84 s; Δ -106.31 s (-33.87%).
- **Model calls:** 15 vs 19; Δ -4 (-21.05%).
- **Tool calls:** 14 vs 16; Δ -2 (-12.50%).
- **Compactions:** 4 vs 6; Δ -2 (-33.33%).
- **Total tokens:** 151,623 vs 183,274; Δ -31,651 (-17.27%).
- **Total API cost:** $0.488184 vs $0.613978; Δ -0.125794 (-20.49%).
- **Visible tool bytes:** 143,546 vs 95,980; Δ +47,566 (+49.56%).
- **Prompt-cache reuse:** 57.00% vs 57.24%; Δ -0.23 pp.

- **Expected exact final response:** `HEAT PLATE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `HEAT PLATE GOAL COMPLETE`
- **vanilla prime-agent final response:** `HEAT PLATE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 207.53 s | 313.84 s | -106.31 s | -33.87% |
| Lifecycle wall time | 207.88 s | 314.42 s | -106.54 s | -33.88% |
| Instruction wall time | 207.53 s | 313.84 s | -106.31 s | -33.87% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 19 | -4 | -21.05% |
| Tool calls | 14 | 16 | -2 | -12.50% |
| Tool results | 14 | 16 | -2 | -12.50% |
| Visible tool bytes | 143,546 | 95,980 | +47,566 | +49.56% |
| Compactions | 4 | 6 | -2 | -33.33% |
| Goal-context injections | 3 | 4 | -1 | -25.00% |
| Assistant output events | 15 | 19 | -4 | -21.05% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 19 | 24 | -5 | -20.83% |
| RPC compaction completions | 4 | 6 | -2 | -33.33% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 8 | -1 | -12.50% |
| Rejected stage/command responses | 0 | 1 | -1 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 18 | 23 | -5 | -21.74% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 3 | +0 | +0.00% |
| Maximum goal tokens used | 66,498 | 78,481 | -11,983 | -15.27% |
| Completed RPC compactions | 4 | 6 | -2 | -33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 0 | 1 | -1 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 63,338 | 75,746 | -12,408 | -16.38% |
| Output tokens | 4,317 | 6,152 | -1,835 | -29.83% |
| Cache-read tokens | 83,968 | 101,376 | -17,408 | -17.17% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 151,623 | 183,274 | -31,651 | -17.27% |
| Prompt-cache reuse | 57.00% | 57.24% | -0.23 pp | — |
| Input cost | $0.316690 | $0.378730 | -0.062040 | -16.38% |
| Output cost | $0.129510 | $0.184560 | -0.055050 | -29.83% |
| Cache-read cost | $0.041984 | $0.050688 | -0.008704 | -17.17% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.488184 | $0.613978 | -0.125794 | -20.49% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 13 | 0 | +13 | n/a (zero baseline) |
| Archive source bytes | 132,248 | 0 | +132,248 | n/a (zero baseline) |
| Compressed archive bytes | 11,658 | 0 | +11,658 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.82% | 0.00% | +8.82 pp | — |
| Archive chunks | 17 | 0 | +17 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 277,529 | 0 | +277,529 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,877 | 0 | +130,877 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 38,952 | 0 | +38,952 | n/a (zero baseline) |
| Streaming bytes processed | 264,496 | 0 | +264,496 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 83,968 | 0 | +83,968 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 63,338 | 0 | +63,338 | n/a (zero baseline) |
| Stable-projection extension turns | 10 | 0 | +10 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 243.54 s vs 330.08 s; Δ -86.55 s (-26.22%).
- **Model calls:** 16 vs 20; Δ -4 (-20.00%).
- **Tool calls:** 15 vs 18; Δ -3 (-16.67%).
- **Compactions:** 4 vs 5; Δ -1 (-20.00%).
- **Total tokens:** 165,478 vs 191,781; Δ -26,303 (-13.72%).
- **Total API cost:** $0.515222 vs $0.666024; Δ -0.150802 (-22.64%).
- **Visible tool bytes:** 276,193 vs 111,933; Δ +164,260 (+146.75%).
- **Prompt-cache reuse:** 61.34% vs 59.62%; Δ +1.72 pp.

- **Expected exact final response:** `TELEMETRY CODEC GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `TELEMETRY CODEC GOAL COMPLETE`
- **vanilla prime-agent final response:** `TELEMETRY CODEC GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 243.54 s | 330.08 s | -86.55 s | -26.22% |
| Lifecycle wall time | 243.78 s | 330.24 s | -86.46 s | -26.18% |
| Instruction wall time | 243.54 s | 330.08 s | -86.55 s | -26.22% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 16 | 20 | -4 | -20.00% |
| Tool calls | 15 | 18 | -3 | -16.67% |
| Tool results | 15 | 18 | -3 | -16.67% |
| Visible tool bytes | 276,193 | 111,933 | +164,260 | +146.75% |
| Compactions | 4 | 5 | -1 | -20.00% |
| Goal-context injections | 3 | 4 | -1 | -25.00% |
| Assistant output events | 16 | 20 | -4 | -20.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 4 | +1 | +25.00% |
| Goal updates | 18 | 25 | -7 | -28.00% |
| RPC compaction completions | 4 | 5 | -1 | -20.00% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 3 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 17 | 24 | -7 | -29.17% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 3 | -1 | -33.33% |
| Maximum goal tokens used | 66,157 | 81,230 | -15,073 | -18.56% |
| Completed RPC compactions | 4 | 5 | -1 | -20.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 61,966 | 74,206 | -12,240 | -16.49% |
| Output tokens | 5,208 | 8,007 | -2,799 | -34.96% |
| Cache-read tokens | 98,304 | 109,568 | -11,264 | -10.28% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 165,478 | 191,781 | -26,303 | -13.72% |
| Prompt-cache reuse | 61.34% | 59.62% | +1.72 pp | — |
| Input cost | $0.309830 | $0.371030 | -0.061200 | -16.49% |
| Output cost | $0.156240 | $0.240210 | -0.083970 | -34.96% |
| Cache-read cost | $0.049152 | $0.054784 | -0.005632 | -10.28% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.515222 | $0.666024 | -0.150802 | -22.64% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 14 | 0 | +14 | n/a (zero baseline) |
| Archive source bytes | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Compressed archive bytes | 17,362 | 0 | +17,362 | n/a (zero baseline) |
| Archive compression ratio (derived) | 6.62% | 0.00% | +6.62 pp | — |
| Archive chunks | 18 | 0 | +18 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 537,747 | 0 | +537,747 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 260,049 | 0 | +260,049 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 35,103 | 0 | +35,103 | n/a (zero baseline) |
| Streaming bytes processed | 524,624 | 0 | +524,624 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 98,304 | 0 | +98,304 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 61,966 | 0 | +61,966 | n/a (zero baseline) |
| Stable-projection extension turns | 12 | 0 | +12 | n/a (zero baseline) |


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

- **Wall time:** 745.71 s vs 540.55 s; Δ +205.16 s (+37.95%).
- **Model calls:** 18 vs 29; Δ -11 (-37.93%).
- **Tool calls:** 19 vs 27; Δ -8 (-29.63%).
- **Compactions:** 6 vs 9; Δ -3 (-33.33%).
- **Total tokens:** 178,045 vs 310,375; Δ -132,330 (-42.64%).
- **Total API cost:** $0.662997 vs $1.018899; Δ -0.355902 (-34.93%).
- **Visible tool bytes:** 351,683 vs 235,596; Δ +116,087 (+49.27%).
- **Prompt-cache reuse:** 46.55% vs 58.71%; Δ -12.16 pp.

- **Expected exact final response:** `CASH FLOW GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `CASH FLOW GOAL COMPLETE`
- **vanilla prime-agent final response:** `CASH FLOW GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 745.71 s | 540.55 s | +205.16 s | +37.95% |
| Lifecycle wall time | 746.19 s | 540.84 s | +205.34 s | +37.97% |
| Instruction wall time | 745.71 s | 540.55 s | +205.16 s | +37.95% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 29 | -11 | -37.93% |
| Tool calls | 19 | 27 | -8 | -29.63% |
| Tool results | 18 | 27 | -9 | -33.33% |
| Visible tool bytes | 351,683 | 235,596 | +116,087 | +49.27% |
| Compactions | 6 | 9 | -3 | -33.33% |
| Goal-context injections | 5 | 8 | -3 | -37.50% |
| Assistant output events | 17 | 29 | -12 | -41.38% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 21 | 38 | -17 | -44.74% |
| RPC compaction completions | 6 | 9 | -3 | -33.33% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 5 | -2 | -40.00% |
| Failing observed test runs | 2 | 1 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 20 | 37 | -17 | -45.95% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 7 | -3 | -42.86% |
| Maximum goal tokens used | 96,514 | 130,437 | -33,923 | -26.01% |
| Completed RPC compactions | 6 | 9 | -3 | -33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 92,281 | 123,863 | -31,582 | -25.50% |
| Output tokens | 5,380 | 10,384 | -5,004 | -48.19% |
| Cache-read tokens | 80,384 | 176,128 | -95,744 | -54.36% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 178,045 | 310,375 | -132,330 | -42.64% |
| Prompt-cache reuse | 46.55% | 58.71% | -12.16 pp | — |
| Input cost | $0.461405 | $0.619315 | -0.157910 | -25.50% |
| Output cost | $0.161400 | $0.311520 | -0.150120 | -48.19% |
| Cache-read cost | $0.040192 | $0.088064 | -0.047872 | -54.36% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.662997 | $1.018899 | -0.355902 | -34.93% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 17 | 0 | +17 | n/a (zero baseline) |
| Archive source bytes | 328,631 | 0 | +328,631 | n/a (zero baseline) |
| Compressed archive bytes | 26,929 | 0 | +26,929 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.19% | 0.00% | +8.19 pp | — |
| Archive chunks | 27 | 0 | +27 | n/a (zero baseline) |
| Largest chunk bytes | 65,949 | 0 | +65,949 | n/a (zero baseline) |
| Source bytes admitted | 691,164 | 0 | +691,164 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 325,239 | 0 | +325,239 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 1,373 | 0 | +1,373 | n/a (zero baseline) |
| End-state projected model-view bytes | 25,114 | 0 | +25,114 | n/a (zero baseline) |
| Streaming bytes processed | 658,387 | 0 | +658,387 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 7 | 0 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 80,384 | 0 | +80,384 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 92,281 | 0 | +92,281 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 313.97 s vs 336.77 s; Δ -22.80 s (-6.77%).
- **Model calls:** 19 vs 18; Δ +1 (+5.56%).
- **Tool calls:** 20 vs 15; Δ +5 (+33.33%).
- **Compactions:** 6 vs 6; Δ +0 (+0.00%).
- **Total tokens:** 201,697 vs 175,824; Δ +25,873 (+14.72%).
- **Total API cost:** $0.715488 vs $0.626911; Δ +0.088577 (+14.13%).
- **Visible tool bytes:** 215,963 vs 95,265; Δ +120,698 (+126.70%).
- **Prompt-cache reuse:** 50.51% vs 59.79%; Δ -9.28 pp.

- **Retry:** vanilla prime-agent initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `PGM REGIONS GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `PGM REGIONS GOAL COMPLETE`
- **vanilla prime-agent final response:** `PGM REGIONS GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 313.97 s | 336.77 s | -22.80 s | -6.77% |
| Lifecycle wall time | 314.38 s | 337.24 s | -22.86 s | -6.78% |
| Instruction wall time | 313.97 s | 336.77 s | -22.80 s | -6.77% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 19 | 18 | +1 | +5.56% |
| Tool calls | 20 | 15 | +5 | +33.33% |
| Tool results | 20 | 15 | +5 | +33.33% |
| Visible tool bytes | 215,963 | 95,265 | +120,698 | +126.70% |
| Compactions | 6 | 6 | +0 | +0.00% |
| Goal-context injections | 5 | 5 | +0 | +0.00% |
| Assistant output events | 19 | 18 | +1 | +5.56% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 11 | -4 | -36.36% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 23 | 23 | +0 | +0.00% |
| RPC compaction completions | 6 | 6 | +0 | +0.00% |
| Compaction requests | 2 | 4 | -2 | -50.00% |
| Compaction waits | 0 | 2 | -2 | -100.00% |
| Accepted stage/command responses | 6 | 9 | -3 | -33.33% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 22 | 22 | +0 | +0.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 4 | +0 | +0.00% |
| Maximum goal tokens used | 101,889 | 71,825 | +30,064 | +41.86% |
| Completed RPC compactions | 6 | 6 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | -1 | -50.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 2 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 96,814 | 67,497 | +29,317 | +43.43% |
| Output tokens | 6,067 | 7,975 | -1,908 | -23.92% |
| Cache-read tokens | 98,816 | 100,352 | -1,536 | -1.53% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 201,697 | 175,824 | +25,873 | +14.72% |
| Prompt-cache reuse | 50.51% | 59.79% | -9.28 pp | — |
| Input cost | $0.484070 | $0.337485 | +0.146585 | +43.43% |
| Output cost | $0.182010 | $0.239250 | -0.057240 | -23.92% |
| Cache-read cost | $0.049408 | $0.050176 | -0.000768 | -1.53% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.715488 | $0.626911 | +0.088577 | +14.13% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 19 | 0 | +19 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 19,017 | 0 | +19,017 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.67% | 0.00% | +9.67 pp | — |
| Archive chunks | 27 | 0 | +27 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 422,222 | 0 | +422,222 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,360 | 0 | +195,360 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 37,986 | 0 | +37,986 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 7 | 0 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 98,816 | 0 | +98,816 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 96,814 | 0 | +96,814 | n/a (zero baseline) |
| Stable-projection extension turns | 13 | 0 | +13 | n/a (zero baseline) |


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

- **Wall time:** 259.41 s vs 320.82 s; Δ -61.41 s (-19.14%).
- **Model calls:** 17 vs 21; Δ -4 (-19.05%).
- **Tool calls:** 16 vs 19; Δ -3 (-15.79%).
- **Compactions:** 5 vs 5; Δ +0 (+0.00%).
- **Total tokens:** 172,298 vs 194,550; Δ -22,252 (-11.44%).
- **Total API cost:** $0.548597 vs $0.696488; Δ -0.147891 (-21.23%).
- **Visible tool bytes:** 148,393 vs 104,482; Δ +43,911 (+42.03%).
- **Prompt-cache reuse:** 58.82% vs 55.61%; Δ +3.21 pp.

- **Expected exact final response:** `GEAR TRAIN GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `GEAR TRAIN GOAL COMPLETE`
- **vanilla prime-agent final response:** `GEAR TRAIN GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 259.41 s | 320.82 s | -61.41 s | -19.14% |
| Lifecycle wall time | 259.64 s | 321.40 s | -61.76 s | -19.22% |
| Instruction wall time | 259.41 s | 320.82 s | -61.41 s | -19.14% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 17 | 21 | -4 | -19.05% |
| Tool calls | 16 | 19 | -3 | -15.79% |
| Tool results | 16 | 19 | -3 | -15.79% |
| Visible tool bytes | 148,393 | 104,482 | +43,911 | +42.03% |
| Compactions | 5 | 5 | +0 | +0.00% |
| Goal-context injections | 3 | 4 | -1 | -25.00% |
| Assistant output events | 17 | 21 | -4 | -19.05% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 21 | 26 | -5 | -19.23% |
| RPC compaction completions | 5 | 5 | +0 | +0.00% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 20 | 25 | -5 | -20.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 3 | +0 | +0.00% |
| Maximum goal tokens used | 69,214 | 89,331 | -20,117 | -22.52% |
| Completed RPC compactions | 5 | 5 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 68,815 | 82,956 | -14,141 | -17.05% |
| Output tokens | 5,179 | 7,658 | -2,479 | -32.37% |
| Cache-read tokens | 98,304 | 103,936 | -5,632 | -5.42% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 172,298 | 194,550 | -22,252 | -11.44% |
| Prompt-cache reuse | 58.82% | 55.61% | +3.21 pp | — |
| Input cost | $0.344075 | $0.414780 | -0.070705 | -17.05% |
| Output cost | $0.155370 | $0.229740 | -0.074370 | -32.37% |
| Cache-read cost | $0.049152 | $0.051968 | -0.002816 | -5.42% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.548597 | $0.696488 | -0.147891 | -21.23% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 15 | 0 | +15 | n/a (zero baseline) |
| Archive source bytes | 131,156 | 0 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 13,599 | 0 | +13,599 | n/a (zero baseline) |
| Archive compression ratio (derived) | 10.37% | 0.00% | +10.37 pp | — |
| Archive chunks | 19 | 0 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 283,970 | 0 | +283,970 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,208 | 0 | +130,208 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 23,989 | 0 | +23,989 | n/a (zero baseline) |
| Streaming bytes processed | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 98,304 | 0 | +98,304 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 68,815 | 0 | +68,815 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 164.22 s vs 186.69 s; Δ -22.47 s (-12.04%).
- **Model calls:** 14 vs 20; Δ -6 (-30.00%).
- **Tool calls:** 13 vs 18; Δ -5 (-27.78%).
- **Compactions:** 3 vs 3; Δ +0 (+0.00%).
- **Total tokens:** 138,765 vs 178,403; Δ -39,638 (-22.22%).
- **Total API cost:** $0.469290 vs $0.500187; Δ -0.030897 (-6.18%).
- **Visible tool bytes:** 12,167 vs 77,527; Δ -65,360 (-84.31%).
- **Prompt-cache reuse:** 53.16% vs 68.78%; Δ -15.62 pp.

- **Expected exact final response:** `SIGNAL LAB GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `SIGNAL LAB GOAL COMPLETE`
- **vanilla prime-agent final response:** `SIGNAL LAB GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 164.22 s | 186.69 s | -22.47 s | -12.04% |
| Lifecycle wall time | 164.41 s | 187.07 s | -22.66 s | -12.11% |
| Instruction wall time | 164.22 s | 186.69 s | -22.47 s | -12.04% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 14 | 20 | -6 | -30.00% |
| Tool calls | 13 | 18 | -5 | -27.78% |
| Tool results | 13 | 18 | -5 | -27.78% |
| Visible tool bytes | 12,167 | 77,527 | -65,360 | -84.31% |
| Compactions | 3 | 3 | +0 | +0.00% |
| Goal-context injections | 2 | 2 | +0 | +0.00% |
| Assistant output events | 14 | 20 | -6 | -30.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 17 | 21 | -4 | -19.05% |
| RPC compaction completions | 3 | 3 | +0 | +0.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 0 | 0 | +0 | 0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 20 | -4 | -20.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 1 | +1 | +100.00% |
| Maximum goal tokens used | 54,962 | 58,663 | -3,701 | -6.31% |
| Completed RPC compactions | 3 | 3 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 0 | 0 | +0 | 0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 63,164 | 53,911 | +9,253 | +17.16% |
| Output tokens | 3,921 | 5,708 | -1,787 | -31.31% |
| Cache-read tokens | 71,680 | 118,784 | -47,104 | -39.66% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 138,765 | 178,403 | -39,638 | -22.22% |
| Prompt-cache reuse | 53.16% | 68.78% | -15.62 pp | — |
| Input cost | $0.315820 | $0.269555 | +0.046265 | +17.16% |
| Output cost | $0.117630 | $0.171240 | -0.053610 | -31.31% |
| Cache-read cost | $0.035840 | $0.059392 | -0.023552 | -39.66% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.469290 | $0.500187 | -0.030897 | -6.18% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 12 | 0 | +12 | n/a (zero baseline) |
| Archive source bytes | 0 | 0 | +0 | 0.00% |
| Compressed archive bytes | 5,028 | 0 | +5,028 | n/a (zero baseline) |
| Archive compression ratio (derived) | 0.00% | 0.00% | +0.00 pp | — |
| Archive chunks | 12 | 0 | +12 | n/a (zero baseline) |
| Largest chunk bytes | 2,888 | 0 | +2,888 | n/a (zero baseline) |
| Source bytes admitted | 11,414 | 0 | +11,414 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 0 | 0 | +0 | 0.00% |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 42,035 | 0 | +42,035 | n/a (zero baseline) |
| Streaming bytes processed | 0 | 0 | +0 | 0.00% |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 4 | 0 | +4 | n/a (zero baseline) |
| Prime Context cache-read tokens | 71,680 | 0 | +71,680 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 63,164 | 0 | +63,164 | n/a (zero baseline) |
| Stable-projection extension turns | 10 | 0 | +10 | n/a (zero baseline) |


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

- **Wall time:** 236.96 s vs 257.60 s; Δ -20.64 s (-8.01%).
- **Model calls:** 15 vs 18; Δ -3 (-16.67%).
- **Tool calls:** 14 vs 15; Δ -1 (-6.67%).
- **Compactions:** 4 vs 3; Δ +1 (+33.33%).
- **Total tokens:** 155,666 vs 174,999; Δ -19,333 (-11.05%).
- **Total API cost:** $0.568076 vs $0.592613; Δ -0.024537 (-4.14%).
- **Visible tool bytes:** 271,837 vs 26,760; Δ +245,077 (+915.83%).
- **Prompt-cache reuse:** 51.49% vs 63.72%; Δ -12.24 pp.

- **Expected exact final response:** `RHYTHM GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `RHYTHM GOAL COMPLETE`
- **vanilla prime-agent final response:** `RHYTHM GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 236.96 s | 257.60 s | -20.64 s | -8.01% |
| Lifecycle wall time | 237.38 s | 257.82 s | -20.44 s | -7.93% |
| Instruction wall time | 236.96 s | 257.60 s | -20.64 s | -8.01% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 18 | -3 | -16.67% |
| Tool calls | 14 | 15 | -1 | -6.67% |
| Tool results | 14 | 15 | -1 | -6.67% |
| Visible tool bytes | 271,837 | 26,760 | +245,077 | +915.83% |
| Compactions | 4 | 3 | +1 | +33.33% |
| Goal-context injections | 3 | 3 | +0 | +0.00% |
| Assistant output events | 15 | 18 | -3 | -16.67% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 11 | -4 | -36.36% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 17 | 21 | -4 | -19.05% |
| RPC compaction completions | 4 | 3 | +1 | +33.33% |
| Compaction requests | 2 | 4 | -2 | -50.00% |
| Compaction waits | 0 | 2 | -2 | -100.00% |
| Accepted stage/command responses | 6 | 9 | -3 | -33.33% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 20 | -4 | -20.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 3 | -1 | -33.33% |
| Maximum goal tokens used | 77,244 | 66,907 | +10,337 | +15.45% |
| Completed RPC compactions | 4 | 3 | +1 | +33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | -1 | -50.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 2 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 72,848 | 60,629 | +12,219 | +20.15% |
| Output tokens | 5,506 | 7,874 | -2,368 | -30.07% |
| Cache-read tokens | 77,312 | 106,496 | -29,184 | -27.40% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 155,666 | 174,999 | -19,333 | -11.05% |
| Prompt-cache reuse | 51.49% | 63.72% | -12.24 pp | — |
| Input cost | $0.364240 | $0.303145 | +0.061095 | +20.15% |
| Output cost | $0.165180 | $0.236220 | -0.071040 | -30.07% |
| Cache-read cost | $0.038656 | $0.053248 | -0.014592 | -27.40% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.568076 | $0.592613 | -0.024537 | -4.14% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 13 | 0 | +13 | n/a (zero baseline) |
| Archive source bytes | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Compressed archive bytes | 16,110 | 0 | +16,110 | n/a (zero baseline) |
| Archive compression ratio (derived) | 6.14% | 0.00% | +6.14 pp | — |
| Archive chunks | 17 | 0 | +17 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 533,403 | 0 | +533,403 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 260,076 | 0 | +260,076 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 40,840 | 0 | +40,840 | n/a (zero baseline) |
| Streaming bytes processed | 524,624 | 0 | +524,624 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 77,312 | 0 | +77,312 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 72,848 | 0 | +72,848 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 350.45 s vs 1,042.63 s; Δ -692.18 s (-66.39%).
- **Model calls:** 15 vs 36; Δ -21 (-58.33%).
- **Tool calls:** 18 vs 37; Δ -19 (-51.35%).
- **Compactions:** 6 vs 18; Δ -12 (-66.67%).
- **Total tokens:** 154,313 vs 412,416; Δ -258,103 (-62.58%).
- **Total API cost:** $0.598743 vs $1.545047; Δ -0.946304 (-61.25%).
- **Visible tool bytes:** 216,347 vs 471,610; Δ -255,263 (-54.13%).
- **Prompt-cache reuse:** 49.45% vs 51.97%; Δ -2.51 pp.

- **Retry:** prime-context 8.1.1 initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `RECORD MIGRATION GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `RECORD MIGRATION GOAL COMPLETE`
- **vanilla prime-agent final response:** `RECORD MIGRATION GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 350.45 s | 1,042.63 s | -692.18 s | -66.39% |
| Lifecycle wall time | 350.61 s | 1,042.90 s | -692.29 s | -66.38% |
| Instruction wall time | 350.45 s | 1,042.63 s | -692.18 s | -66.39% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 36 | -21 | -58.33% |
| Tool calls | 18 | 37 | -19 | -51.35% |
| Tool results | 18 | 37 | -19 | -51.35% |
| Visible tool bytes | 216,347 | 471,610 | -255,263 | -54.13% |
| Compactions | 6 | 18 | -12 | -66.67% |
| Goal-context injections | 4 | 15 | -11 | -73.33% |
| Assistant output events | 15 | 36 | -21 | -58.33% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 8 | -3 | -37.50% |
| Goal updates | 18 | 51 | -33 | -64.71% |
| RPC compaction completions | 6 | 18 | -12 | -66.67% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 7 | -3 | -42.86% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 17 | 50 | -33 | -66.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 14 | -11 | -78.57% |
| Maximum goal tokens used | 71,025 | 203,040 | -132,015 | -65.02% |
| Completed RPC compactions | 6 | 18 | -12 | -66.67% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 74,831 | 190,225 | -115,394 | -60.66% |
| Output tokens | 6,266 | 16,367 | -10,101 | -61.72% |
| Cache-read tokens | 73,216 | 205,824 | -132,608 | -64.43% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 154,313 | 412,416 | -258,103 | -62.58% |
| Prompt-cache reuse | 49.45% | 51.97% | -2.51 pp | — |
| Input cost | $0.374155 | $0.951125 | -0.576970 | -60.66% |
| Output cost | $0.187980 | $0.491010 | -0.303030 | -61.72% |
| Cache-read cost | $0.036608 | $0.102912 | -0.066304 | -64.43% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.598743 | $1.545047 | -0.946304 | -61.25% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 17 | 0 | +17 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 18,542 | 0 | +18,542 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.42% | 0.00% | +9.42 pp | — |
| Archive chunks | 22 | 0 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 420,582 | 0 | +420,582 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,361 | 0 | +195,361 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 25,935 | 0 | +25,935 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 7 | 0 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 73,216 | 0 | +73,216 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 74,831 | 0 | +74,831 | n/a (zero baseline) |
| Stable-projection extension turns | 9 | 0 | +9 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 254.49 s vs 381.36 s; Δ -126.87 s (-33.27%).
- **Model calls:** 17 vs 21; Δ -4 (-19.05%).
- **Tool calls:** 16 vs 17; Δ -1 (-5.88%).
- **Compactions:** 5 vs 8; Δ -3 (-37.50%).
- **Total tokens:** 178,732 vs 203,915; Δ -25,183 (-12.35%).
- **Total API cost:** $0.577603 vs $0.772375; Δ -0.194772 (-25.22%).
- **Visible tool bytes:** 337,276 vs 230,196; Δ +107,080 (+46.52%).
- **Prompt-cache reuse:** 53.69% vs 45.33%; Δ +8.36 pp.

- **Expected exact final response:** `TRANSIT FARES GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `TRANSIT FARES GOAL COMPLETE`
- **vanilla prime-agent final response:** `TRANSIT FARES GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 254.49 s | 381.36 s | -126.87 s | -33.27% |
| Lifecycle wall time | 255.09 s | 381.90 s | -126.81 s | -33.21% |
| Instruction wall time | 254.49 s | 381.36 s | -126.87 s | -33.27% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 17 | 21 | -4 | -19.05% |
| Tool calls | 16 | 17 | -1 | -5.88% |
| Tool results | 16 | 17 | -1 | -5.88% |
| Visible tool bytes | 337,276 | 230,196 | +107,080 | +46.52% |
| Compactions | 5 | 8 | -3 | -37.50% |
| Goal-context injections | 3 | 9 | -6 | -66.67% |
| Assistant output events | 17 | 21 | -4 | -19.05% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 11 | -4 | -36.36% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 19 | 31 | -12 | -38.71% |
| RPC compaction completions | 5 | 8 | -3 | -37.50% |
| Compaction requests | 2 | 4 | -2 | -50.00% |
| Compaction waits | 0 | 2 | -2 | -100.00% |
| Accepted stage/command responses | 6 | 8 | -2 | -25.00% |
| Rejected stage/command responses | 1 | 3 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 5 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 18 | 30 | -12 | -40.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 8 | -6 | -75.00% |
| Maximum goal tokens used | 82,724 | 110,327 | -27,603 | -25.02% |
| Completed RPC compactions | 5 | 8 | -3 | -37.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 3 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 2 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 80,813 | 108,075 | -27,262 | -25.23% |
| Output tokens | 4,223 | 6,240 | -2,017 | -32.32% |
| Cache-read tokens | 93,696 | 89,600 | +4,096 | +4.57% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 178,732 | 203,915 | -25,183 | -12.35% |
| Prompt-cache reuse | 53.69% | 45.33% | +8.36 pp | — |
| Input cost | $0.404065 | $0.540375 | -0.136310 | -25.23% |
| Output cost | $0.126690 | $0.187200 | -0.060510 | -32.32% |
| Cache-read cost | $0.046848 | $0.044800 | +0.002048 | +4.57% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.577603 | $0.772375 | -0.194772 | -25.22% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 15 | 0 | +15 | n/a (zero baseline) |
| Archive source bytes | 328,260 | 0 | +328,260 | n/a (zero baseline) |
| Compressed archive bytes | 21,311 | 0 | +21,311 | n/a (zero baseline) |
| Archive compression ratio (derived) | 6.49% | 0.00% | +6.49 pp | — |
| Archive chunks | 25 | 0 | +25 | n/a (zero baseline) |
| Largest chunk bytes | 65,948 | 0 | +65,948 | n/a (zero baseline) |
| Source bytes admitted | 671,915 | 0 | +671,915 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 325,422 | 0 | +325,422 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 38,248 | 0 | +38,248 | n/a (zero baseline) |
| Streaming bytes processed | 657,082 | 0 | +657,082 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 93,696 | 0 | +93,696 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 80,813 | 0 | +80,813 | n/a (zero baseline) |
| Stable-projection extension turns | 12 | 0 | +12 | n/a (zero baseline) |


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

- **Wall time:** 455.82 s vs 404.44 s; Δ +51.38 s (+12.70%).
- **Model calls:** 23 vs 19; Δ +4 (+21.05%).
- **Tool calls:** 22 vs 17; Δ +5 (+29.41%).
- **Compactions:** 9 vs 8; Δ +1 (+12.50%).
- **Total tokens:** 240,854 vs 187,167; Δ +53,687 (+28.68%).
- **Total API cost:** $0.808876 vs $0.797814; Δ +0.011062 (+1.39%).
- **Visible tool bytes:** 236,959 vs 218,801; Δ +18,158 (+8.30%).
- **Prompt-cache reuse:** 51.44% vs 42.63%; Δ +8.81 pp.

- **Expected exact final response:** `LEAGUE TABLE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `LEAGUE TABLE GOAL COMPLETE`
- **vanilla prime-agent final response:** `LEAGUE TABLE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 455.82 s | 404.44 s | +51.38 s | +12.70% |
| Lifecycle wall time | 456.02 s | 404.89 s | +51.13 s | +12.63% |
| Instruction wall time | 455.82 s | 404.44 s | +51.38 s | +12.70% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 23 | 19 | +4 | +21.05% |
| Tool calls | 22 | 17 | +5 | +29.41% |
| Tool results | 22 | 17 | +5 | +29.41% |
| Visible tool bytes | 236,959 | 218,801 | +18,158 | +8.30% |
| Compactions | 9 | 8 | +1 | +12.50% |
| Goal-context injections | 7 | 6 | +1 | +16.67% |
| Assistant output events | 23 | 19 | +4 | +21.05% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 31 | 26 | +5 | +19.23% |
| RPC compaction completions | 9 | 8 | +1 | +12.50% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 30 | 25 | +5 | +20.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 7 | 5 | +2 | +40.00% |
| Maximum goal tokens used | 115,048 | 107,545 | +7,503 | +6.98% |
| Completed RPC compactions | 9 | 8 | +1 | +12.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 114,088 | 102,668 | +11,420 | +11.12% |
| Output tokens | 5,934 | 8,211 | -2,277 | -27.73% |
| Cache-read tokens | 120,832 | 76,288 | +44,544 | +58.39% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 240,854 | 187,167 | +53,687 | +28.68% |
| Prompt-cache reuse | 51.44% | 42.63% | +8.81 pp | — |
| Input cost | $0.570440 | $0.513340 | +0.057100 | +11.12% |
| Output cost | $0.178020 | $0.246330 | -0.068310 | -27.73% |
| Cache-read cost | $0.060416 | $0.038144 | +0.022272 | +58.39% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.808876 | $0.797814 | +0.011062 | +1.39% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 21 | 0 | +21 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 22,059 | 0 | +22,059 | n/a (zero baseline) |
| Archive compression ratio (derived) | 11.21% | 0.00% | +11.21 pp | — |
| Archive chunks | 28 | 0 | +28 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 435,303 | 0 | +435,303 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,361 | 0 | +195,361 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 24,344 | 0 | +24,344 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 10 | 0 | +10 | n/a (zero baseline) |
| Prime Context cache-read tokens | 120,832 | 0 | +120,832 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 114,088 | 0 | +114,088 | n/a (zero baseline) |
| Stable-projection extension turns | 13 | 0 | +13 | n/a (zero baseline) |


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

- **Wall time:** 477.39 s vs 648.50 s; Δ -171.11 s (-26.39%).
- **Model calls:** 23 vs 27; Δ -4 (-14.81%).
- **Tool calls:** 22 vs 26; Δ -4 (-15.38%).
- **Compactions:** 9 vs 12; Δ -3 (-25.00%).
- **Total tokens:** 247,208 vs 298,586; Δ -51,378 (-17.21%).
- **Total API cost:** $0.941134 vs $1.037483; Δ -0.096349 (-9.29%).
- **Visible tool bytes:** 236,271 vs 259,746; Δ -23,475 (-9.04%).
- **Prompt-cache reuse:** 45.79% vs 56.63%; Δ -10.84 pp.

- **Expected exact final response:** `BANK RECONCILE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `BANK RECONCILE GOAL COMPLETE`
- **vanilla prime-agent final response:** `BANK RECONCILE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 477.39 s | 648.50 s | -171.11 s | -26.39% |
| Lifecycle wall time | 477.94 s | 648.64 s | -170.70 s | -26.32% |
| Instruction wall time | 477.39 s | 648.50 s | -171.11 s | -26.39% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 23 | 27 | -4 | -14.81% |
| Tool calls | 22 | 26 | -4 | -15.38% |
| Tool results | 22 | 26 | -4 | -15.38% |
| Visible tool bytes | 236,271 | 259,746 | -23,475 | -9.04% |
| Compactions | 9 | 12 | -3 | -25.00% |
| Goal-context injections | 8 | 10 | -2 | -20.00% |
| Assistant output events | 23 | 27 | -4 | -14.81% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 30 | 38 | -8 | -21.05% |
| RPC compaction completions | 9 | 12 | -3 | -25.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 4 | -1 | -25.00% |
| Failing observed test runs | 2 | 2 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 29 | 37 | -8 | -21.62% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 7 | 9 | -2 | -22.22% |
| Maximum goal tokens used | 136,318 | 132,214 | +4,104 | +3.10% |
| Completed RPC compactions | 9 | 12 | -3 | -25.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 129,714 | 124,681 | +5,033 | +4.04% |
| Output tokens | 7,926 | 11,089 | -3,163 | -28.52% |
| Cache-read tokens | 109,568 | 162,816 | -53,248 | -32.70% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 247,208 | 298,586 | -51,378 | -17.21% |
| Prompt-cache reuse | 45.79% | 56.63% | -10.84 pp | — |
| Input cost | $0.648570 | $0.623405 | +0.025165 | +4.04% |
| Output cost | $0.237780 | $0.332670 | -0.094890 | -28.52% |
| Cache-read cost | $0.054784 | $0.081408 | -0.026624 | -32.70% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.941134 | $1.037483 | -0.096349 | -9.29% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 21 | 0 | +21 | n/a (zero baseline) |
| Archive source bytes | 197,105 | 0 | +197,105 | n/a (zero baseline) |
| Compressed archive bytes | 25,928 | 0 | +25,928 | n/a (zero baseline) |
| Archive compression ratio (derived) | 13.15% | 0.00% | +13.15 pp | — |
| Archive chunks | 32 | 0 | +32 | n/a (zero baseline) |
| Largest chunk bytes | 65,949 | 0 | +65,949 | n/a (zero baseline) |
| Source bytes admitted | 445,115 | 0 | +445,115 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,180 | 0 | +195,180 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 35,919 | 0 | +35,919 | n/a (zero baseline) |
| Streaming bytes processed | 394,773 | 0 | +394,773 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 10 | 0 | +10 | n/a (zero baseline) |
| Prime Context cache-read tokens | 109,568 | 0 | +109,568 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 129,714 | 0 | +129,714 | n/a (zero baseline) |
| Stable-projection extension turns | 14 | 0 | +14 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 249.58 s vs 500.17 s; Δ -250.59 s (-50.10%).
- **Model calls:** 12 vs 23; Δ -11 (-47.83%).
- **Tool calls:** 11 vs 20; Δ -9 (-45.00%).
- **Compactions:** 4 vs 8; Δ -4 (-50.00%).
- **Total tokens:** 118,397 vs 220,401; Δ -102,004 (-46.28%).
- **Total API cost:** $0.538831 vs $0.898835; Δ -0.360004 (-40.05%).
- **Visible tool bytes:** 140,581 vs 189,781; Δ -49,200 (-25.92%).
- **Prompt-cache reuse:** 46.50% vs 50.07%; Δ -3.57 pp.

- **Retry:** prime-context 8.1.1 initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `AUTHORIZATION GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `AUTHORIZATION GOAL COMPLETE`
- **vanilla prime-agent final response:** `AUTHORIZATION GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 249.58 s | 500.17 s | -250.59 s | -50.10% |
| Lifecycle wall time | 249.85 s | 500.51 s | -250.66 s | -50.08% |
| Instruction wall time | 249.58 s | 500.17 s | -250.59 s | -50.10% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 12 | 23 | -11 | -47.83% |
| Tool calls | 11 | 20 | -9 | -45.00% |
| Tool results | 11 | 20 | -9 | -45.00% |
| Visible tool bytes | 140,581 | 189,781 | -49,200 | -25.92% |
| Compactions | 4 | 8 | -4 | -50.00% |
| Goal-context injections | 2 | 8 | -6 | -75.00% |
| Assistant output events | 12 | 23 | -11 | -47.83% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 11 | -4 | -36.36% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 13 | 32 | -19 | -59.38% |
| RPC compaction completions | 4 | 8 | -4 | -50.00% |
| Compaction requests | 2 | 4 | -2 | -50.00% |
| Compaction waits | 0 | 2 | -2 | -100.00% |
| Accepted stage/command responses | 7 | 8 | -1 | -12.50% |
| Rejected stage/command responses | 0 | 3 | -3 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 12 | 31 | -19 | -61.29% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 1 | 7 | -6 | -85.71% |
| Maximum goal tokens used | 61,077 | 114,947 | -53,870 | -46.87% |
| Completed RPC compactions | 4 | 8 | -4 | -50.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | +1 | +100.00% |
| Failed compaction requests | 0 | 3 | -3 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 2 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 59,503 | 104,675 | -45,172 | -43.15% |
| Output tokens | 7,182 | 10,766 | -3,584 | -33.29% |
| Cache-read tokens | 51,712 | 104,960 | -53,248 | -50.73% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 118,397 | 220,401 | -102,004 | -46.28% |
| Prompt-cache reuse | 46.50% | 50.07% | -3.57 pp | — |
| Input cost | $0.297515 | $0.523375 | -0.225860 | -43.15% |
| Output cost | $0.215460 | $0.322980 | -0.107520 | -33.29% |
| Cache-read cost | $0.025856 | $0.052480 | -0.026624 | -50.73% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.538831 | $0.898835 | -0.360004 | -40.05% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 10 | 0 | +10 | n/a (zero baseline) |
| Archive source bytes | 131,156 | 0 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 11,790 | 0 | +11,790 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.99% | 0.00% | +8.99 pp | — |
| Archive chunks | 13 | 0 | +13 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 280,045 | 0 | +280,045 | n/a (zero baseline) |
| Call-argument bytes projected out | 8,878 | 0 | +8,878 | n/a (zero baseline) |
| Result bytes projected out | 130,207 | 0 | +130,207 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 33,158 | 0 | +33,158 | n/a (zero baseline) |
| Streaming bytes processed | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 51,712 | 0 | +51,712 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 59,503 | 0 | +59,503 | n/a (zero baseline) |
| Stable-projection extension turns | 8 | 0 | +8 | n/a (zero baseline) |


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

- **Wall time:** 285.98 s vs 468.52 s; Δ -182.54 s (-38.96%).
- **Model calls:** 19 vs 23; Δ -4 (-17.39%).
- **Tool calls:** 18 vs 20; Δ -2 (-10.00%).
- **Compactions:** 5 vs 8; Δ -3 (-37.50%).
- **Total tokens:** 201,593 vs 227,044; Δ -25,451 (-11.21%).
- **Total API cost:** $0.683117 vs $0.896095; Δ -0.212978 (-23.77%).
- **Visible tool bytes:** 28,400 vs 221,778; Δ -193,378 (-87.19%).
- **Prompt-cache reuse:** 55.65% vs 53.36%; Δ +2.28 pp.

- **Retry:** prime-context 8.1.1 initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).
- **Retry:** vanilla prime-agent initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`
- **vanilla prime-agent final response:** `SUBSCRIPTION INVOICE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 285.98 s | 468.52 s | -182.54 s | -38.96% |
| Lifecycle wall time | 286.24 s | 468.92 s | -182.68 s | -38.96% |
| Instruction wall time | 285.98 s | 468.52 s | -182.54 s | -38.96% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 19 | 23 | -4 | -17.39% |
| Tool calls | 18 | 20 | -2 | -10.00% |
| Tool results | 18 | 20 | -2 | -10.00% |
| Visible tool bytes | 28,400 | 221,778 | -193,378 | -87.19% |
| Compactions | 5 | 8 | -3 | -37.50% |
| Goal-context injections | 4 | 8 | -4 | -50.00% |
| Assistant output events | 19 | 23 | -4 | -17.39% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 11 | -4 | -36.36% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 22 | 32 | -10 | -31.25% |
| RPC compaction completions | 5 | 8 | -3 | -37.50% |
| Compaction requests | 2 | 4 | -2 | -50.00% |
| Compaction waits | 0 | 2 | -2 | -100.00% |
| Accepted stage/command responses | 6 | 8 | -2 | -25.00% |
| Rejected stage/command responses | 1 | 3 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 21 | 31 | -10 | -32.26% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 7 | -4 | -57.14% |
| Maximum goal tokens used | 92,151 | 111,481 | -19,330 | -17.34% |
| Completed RPC compactions | 5 | 8 | -3 | -37.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 3 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 2 | -2 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 86,505 | 100,673 | -14,168 | -14.07% |
| Output tokens | 6,544 | 11,171 | -4,627 | -41.42% |
| Cache-read tokens | 108,544 | 115,200 | -6,656 | -5.78% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 201,593 | 227,044 | -25,451 | -11.21% |
| Prompt-cache reuse | 55.65% | 53.36% | +2.28 pp | — |
| Input cost | $0.432525 | $0.503365 | -0.070840 | -14.07% |
| Output cost | $0.196320 | $0.335130 | -0.138810 | -41.42% |
| Cache-read cost | $0.054272 | $0.057600 | -0.003328 | -5.78% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.683117 | $0.896095 | -0.212978 | -23.77% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 17 | 0 | +17 | n/a (zero baseline) |
| Archive source bytes | 5,062 | 0 | +5,062 | n/a (zero baseline) |
| Compressed archive bytes | 12,029 | 0 | +12,029 | n/a (zero baseline) |
| Archive compression ratio (derived) | 237.63% | 0.00% | +237.63 pp | — |
| Archive chunks | 22 | 0 | +22 | n/a (zero baseline) |
| Largest chunk bytes | 8,504 | 0 | +8,504 | n/a (zero baseline) |
| Source bytes admitted | 44,492 | 0 | +44,492 | n/a (zero baseline) |
| Call-argument bytes projected out | 8,554 | 0 | +8,554 | n/a (zero baseline) |
| Result bytes projected out | 4,365 | 0 | +4,365 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 38,248 | 0 | +38,248 | n/a (zero baseline) |
| Streaming bytes processed | 11,588 | 0 | +11,588 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 108,544 | 0 | +108,544 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 86,505 | 0 | +86,505 | n/a (zero baseline) |
| Stable-projection extension turns | 14 | 0 | +14 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 293.12 s vs 585.29 s; Δ -292.17 s (-49.92%).
- **Model calls:** 18 vs 25; Δ -7 (-28.00%).
- **Tool calls:** 17 vs 27; Δ -10 (-37.04%).
- **Compactions:** 5 vs 9; Δ -4 (-44.44%).
- **Total tokens:** 191,922 vs 287,315; Δ -95,393 (-33.20%).
- **Total API cost:** $0.639265 vs $1.149414; Δ -0.510149 (-44.38%).
- **Visible tool bytes:** 212,027 vs 246,335; Δ -34,308 (-13.93%).
- **Prompt-cache reuse:** 56.48% vs 53.34%; Δ +3.14 pp.

- **Expected exact final response:** `DNS ZONE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `DNS ZONE GOAL COMPLETE`
- **vanilla prime-agent final response:** `DNS ZONE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 293.12 s | 585.29 s | -292.17 s | -49.92% |
| Lifecycle wall time | 293.47 s | 585.84 s | -292.37 s | -49.91% |
| Instruction wall time | 293.12 s | 585.29 s | -292.17 s | -49.92% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 25 | -7 | -28.00% |
| Tool calls | 17 | 27 | -10 | -37.04% |
| Tool results | 17 | 27 | -10 | -37.04% |
| Visible tool bytes | 212,027 | 246,335 | -34,308 | -13.93% |
| Compactions | 5 | 9 | -4 | -44.44% |
| Goal-context injections | 4 | 8 | -4 | -50.00% |
| Assistant output events | 18 | 25 | -7 | -28.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 8 | -1 | -12.50% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 21 | 30 | -9 | -30.00% |
| RPC compaction completions | 5 | 9 | -4 | -44.44% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 20 | 29 | -9 | -31.03% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 7 | -4 | -57.14% |
| Maximum goal tokens used | 85,834 | 141,036 | -55,202 | -39.14% |
| Completed RPC compactions | 5 | 9 | -4 | -44.44% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 80,883 | 127,220 | -46,337 | -36.42% |
| Output tokens | 6,079 | 14,687 | -8,608 | -58.61% |
| Cache-read tokens | 104,960 | 145,408 | -40,448 | -27.82% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 191,922 | 287,315 | -95,393 | -33.20% |
| Prompt-cache reuse | 56.48% | 53.34% | +3.14 pp | — |
| Input cost | $0.404415 | $0.636100 | -0.231685 | -36.42% |
| Output cost | $0.182370 | $0.440610 | -0.258240 | -58.61% |
| Cache-read cost | $0.052480 | $0.072704 | -0.020224 | -27.82% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.639265 | $1.149414 | -0.510149 | -44.38% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 16 | 0 | +16 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 18,241 | 0 | +18,241 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.27% | 0.00% | +9.27 pp | — |
| Archive chunks | 24 | 0 | +24 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 417,582 | 0 | +417,582 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,360 | 0 | +195,360 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 38,640 | 0 | +38,640 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 104,960 | 0 | +104,960 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 80,883 | 0 | +80,883 | n/a (zero baseline) |
| Stable-projection extension turns | 13 | 0 | +13 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 223.39 s vs 384.72 s; Δ -161.33 s (-41.93%).
- **Model calls:** 14 vs 25; Δ -11 (-44.00%).
- **Tool calls:** 13 vs 21; Δ -8 (-38.10%).
- **Compactions:** 4 vs 5; Δ -1 (-20.00%).
- **Total tokens:** 141,480 vs 269,221; Δ -127,741 (-47.45%).
- **Total API cost:** $0.566103 vs $0.954834; Δ -0.388731 (-40.71%).
- **Visible tool bytes:** 142,982 vs 99,496; Δ +43,486 (+43.71%).
- **Prompt-cache reuse:** 44.34% vs 59.49%; Δ -15.15 pp.

- **Expected exact final response:** `DNA ALIGNMENT GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `DNA ALIGNMENT GOAL COMPLETE`
- **vanilla prime-agent final response:** `DNA ALIGNMENT GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 223.39 s | 384.72 s | -161.33 s | -41.93% |
| Lifecycle wall time | 223.59 s | 385.05 s | -161.46 s | -41.93% |
| Instruction wall time | 223.39 s | 384.72 s | -161.33 s | -41.93% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 14 | 25 | -11 | -44.00% |
| Tool calls | 13 | 21 | -8 | -38.10% |
| Tool results | 13 | 21 | -8 | -38.10% |
| Visible tool bytes | 142,982 | 99,496 | +43,486 | +43.71% |
| Compactions | 4 | 5 | -1 | -20.00% |
| Goal-context injections | 3 | 5 | -2 | -40.00% |
| Assistant output events | 14 | 25 | -11 | -44.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 8 | -1 | -12.50% |
| Test-run observations | 5 | 4 | +1 | +25.00% |
| Goal updates | 16 | 28 | -12 | -42.86% |
| RPC compaction completions | 4 | 5 | -1 | -20.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 7 | 7 | +0 | +0.00% |
| Rejected stage/command responses | 0 | 1 | -1 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 3 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 15 | 27 | -12 | -44.44% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 4 | -2 | -50.00% |
| Maximum goal tokens used | 80,006 | 115,096 | -35,090 | -30.49% |
| Completed RPC compactions | 4 | 5 | -1 | -20.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 1 | +1 | +100.00% |
| Failed compaction requests | 0 | 1 | -1 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 75,841 | 104,228 | -28,387 | -27.24% |
| Output tokens | 5,223 | 11,905 | -6,682 | -56.13% |
| Cache-read tokens | 60,416 | 153,088 | -92,672 | -60.54% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 141,480 | 269,221 | -127,741 | -47.45% |
| Prompt-cache reuse | 44.34% | 59.49% | -15.15 pp | — |
| Input cost | $0.379205 | $0.521140 | -0.141935 | -27.24% |
| Output cost | $0.156690 | $0.357150 | -0.200460 | -56.13% |
| Cache-read cost | $0.030208 | $0.076544 | -0.046336 | -60.54% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.566103 | $0.954834 | -0.388731 | -40.71% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 12 | 0 | +12 | n/a (zero baseline) |
| Archive source bytes | 132,846 | 0 | +132,846 | n/a (zero baseline) |
| Compressed archive bytes | 10,172 | 0 | +10,172 | n/a (zero baseline) |
| Archive compression ratio (derived) | 7.66% | 0.00% | +7.66 pp | — |
| Archive chunks | 15 | 0 | +15 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 275,077 | 0 | +275,077 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 131,445 | 0 | +131,445 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 40,390 | 0 | +40,390 | n/a (zero baseline) |
| Streaming bytes processed | 265,692 | 0 | +265,692 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 60,416 | 0 | +60,416 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 75,841 | 0 | +75,841 | n/a (zero baseline) |
| Stable-projection extension turns | 10 | 0 | +10 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 1,102.01 s vs 583.70 s; Δ +518.31 s (+88.80%).
- **Model calls:** 40 vs 28; Δ +12 (+42.86%).
- **Tool calls:** 41 vs 28; Δ +13 (+46.43%).
- **Compactions:** 19 vs 11; Δ +8 (+72.73%).
- **Total tokens:** 433,363 vs 298,596; Δ +134,767 (+45.13%).
- **Total API cost:** $1.422312 vs $0.995962; Δ +0.426350 (+42.81%).
- **Visible tool bytes:** 287,507 vs 252,142; Δ +35,365 (+14.03%).
- **Prompt-cache reuse:** 48.96% vs 56.11%; Δ -7.15 pp.

- **Expected exact final response:** `UNION PAYROLL GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `UNION PAYROLL GOAL COMPLETE`
- **vanilla prime-agent final response:** `UNION PAYROLL GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 1,102.01 s | 583.70 s | +518.31 s | +88.80% |
| Lifecycle wall time | 1,102.22 s | 583.86 s | +518.36 s | +88.78% |
| Instruction wall time | 1,102.01 s | 583.70 s | +518.31 s | +88.80% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 40 | 28 | +12 | +42.86% |
| Tool calls | 41 | 28 | +13 | +46.43% |
| Tool results | 41 | 28 | +13 | +46.43% |
| Visible tool bytes | 287,507 | 252,142 | +35,365 | +14.03% |
| Compactions | 19 | 11 | +8 | +72.73% |
| Goal-context injections | 18 | 10 | +8 | +80.00% |
| Assistant output events | 40 | 28 | +12 | +42.86% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 8 | -1 | -12.50% |
| Test-run observations | 5 | 4 | +1 | +25.00% |
| Goal updates | 59 | 34 | +25 | +73.53% |
| RPC compaction completions | 19 | 11 | +8 | +72.73% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 3 | +1 | +33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 58 | 33 | +25 | +75.76% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 18 | 9 | +9 | +100.00% |
| Maximum goal tokens used | 223,771 | 135,809 | +87,962 | +64.77% |
| Completed RPC compactions | 19 | 11 | +8 | +72.73% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 217,250 | 126,958 | +90,292 | +71.12% |
| Output tokens | 7,729 | 9,334 | -1,605 | -17.20% |
| Cache-read tokens | 208,384 | 162,304 | +46,080 | +28.39% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 433,363 | 298,596 | +134,767 | +45.13% |
| Prompt-cache reuse | 48.96% | 56.11% | -7.15 pp | — |
| Input cost | $1.086250 | $0.634790 | +0.451460 | +71.12% |
| Output cost | $0.231870 | $0.280020 | -0.048150 | -17.20% |
| Cache-read cost | $0.104192 | $0.081152 | +0.023040 | +28.39% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.422312 | $0.995962 | +0.426350 | +42.81% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 40 | 0 | +40 | n/a (zero baseline) |
| Archive source bytes | 200,127 | 0 | +200,127 | n/a (zero baseline) |
| Compressed archive bytes | 43,425 | 0 | +43,425 | n/a (zero baseline) |
| Archive compression ratio (derived) | 21.70% | 0.00% | +21.70 pp | — |
| Archive chunks | 51 | 0 | +51 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 498,556 | 0 | +498,556 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 197,748 | 0 | +197,748 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 30,749 | 0 | +30,749 | n/a (zero baseline) |
| Streaming bytes processed | 401,095 | 0 | +401,095 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 20 | 0 | +20 | n/a (zero baseline) |
| Prime Context cache-read tokens | 208,384 | 0 | +208,384 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 217,250 | 0 | +217,250 | n/a (zero baseline) |
| Stable-projection extension turns | 20 | 0 | +20 | n/a (zero baseline) |


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

- **Wall time:** 452.21 s vs 1,097.54 s; Δ -645.33 s (-58.80%).
- **Model calls:** 20 vs 41; Δ -21 (-51.22%).
- **Tool calls:** 19 vs 47; Δ -28 (-59.57%).
- **Compactions:** 7 vs 20; Δ -13 (-65.00%).
- **Total tokens:** 214,670 vs 442,053; Δ -227,383 (-51.44%).
- **Total API cost:** $0.793583 vs $1.502143; Δ -0.708560 (-47.17%).
- **Visible tool bytes:** 358,030 vs 390,466; Δ -32,436 (-8.31%).
- **Prompt-cache reuse:** 55.61% vs 52.80%; Δ +2.81 pp.

- **Retry:** vanilla prime-agent initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `LOCK RESOLVER GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `LOCK RESOLVER GOAL COMPLETE`
- **vanilla prime-agent final response:** `LOCK RESOLVER GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 452.21 s | 1,097.54 s | -645.33 s | -58.80% |
| Lifecycle wall time | 452.78 s | 1,097.69 s | -644.91 s | -58.75% |
| Instruction wall time | 452.21 s | 1,097.54 s | -645.33 s | -58.80% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 20 | 41 | -21 | -51.22% |
| Tool calls | 19 | 47 | -28 | -59.57% |
| Tool results | 19 | 47 | -28 | -59.57% |
| Visible tool bytes | 358,030 | 390,466 | -32,436 | -8.31% |
| Compactions | 7 | 20 | -13 | -65.00% |
| Goal-context injections | 6 | 19 | -13 | -68.42% |
| Assistant output events | 20 | 41 | -21 | -51.22% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 8 | -1 | -12.50% |
| Test-run observations | 5 | 7 | -2 | -28.57% |
| Goal updates | 27 | 58 | -31 | -53.45% |
| RPC compaction completions | 7 | 20 | -13 | -65.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 6 | -2 | -33.33% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 26 | 57 | -31 | -54.39% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 6 | 18 | -12 | -66.67% |
| Maximum goal tokens used | 100,071 | 214,656 | -114,585 | -53.38% |
| Completed RPC compactions | 7 | 20 | -13 | -65.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 91,133 | 202,735 | -111,602 | -55.05% |
| Output tokens | 9,361 | 12,502 | -3,141 | -25.12% |
| Cache-read tokens | 114,176 | 226,816 | -112,640 | -49.66% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 214,670 | 442,053 | -227,383 | -51.44% |
| Prompt-cache reuse | 55.61% | 52.80% | +2.81 pp | — |
| Input cost | $0.455665 | $1.013675 | -0.558010 | -55.05% |
| Output cost | $0.280830 | $0.375060 | -0.094230 | -25.12% |
| Cache-read cost | $0.057088 | $0.113408 | -0.056320 | -49.66% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.793583 | $1.502143 | -0.708560 | -47.17% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 18 | 0 | +18 | n/a (zero baseline) |
| Archive source bytes | 327,890 | 0 | +327,890 | n/a (zero baseline) |
| Compressed archive bytes | 27,378 | 0 | +27,378 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.35% | 0.00% | +8.35 pp | — |
| Archive chunks | 26 | 0 | +26 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 701,310 | 0 | +701,310 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 325,135 | 0 | +325,135 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 35,121 | 0 | +35,121 | n/a (zero baseline) |
| Streaming bytes processed | 655,780 | 0 | +655,780 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 8 | 0 | +8 | n/a (zero baseline) |
| Prime Context cache-read tokens | 114,176 | 0 | +114,176 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 91,133 | 0 | +91,133 | n/a (zero baseline) |
| Stable-projection extension turns | 12 | 0 | +12 | n/a (zero baseline) |


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

- **Wall time:** 257.76 s vs 287.52 s; Δ -29.76 s (-10.35%).
- **Model calls:** 16 vs 20; Δ -4 (-20.00%).
- **Tool calls:** 17 vs 20; Δ -3 (-15.00%).
- **Compactions:** 5 vs 5; Δ +0 (+0.00%).
- **Total tokens:** 162,791 vs 173,714; Δ -10,923 (-6.29%).
- **Total API cost:** $0.541153 vs $0.583690; Δ -0.042537 (-7.29%).
- **Visible tool bytes:** 281,006 vs 298,449; Δ -17,443 (-5.84%).
- **Prompt-cache reuse:** 52.59% vs 59.74%; Δ -7.14 pp.

- **Retry:** vanilla prime-agent initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `BUILD PLAN GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `BUILD PLAN GOAL COMPLETE`
- **vanilla prime-agent final response:** `BUILD PLAN GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 257.76 s | 287.52 s | -29.76 s | -10.35% |
| Lifecycle wall time | 258.06 s | 287.92 s | -29.86 s | -10.37% |
| Instruction wall time | 257.76 s | 287.52 s | -29.76 s | -10.35% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 16 | 20 | -4 | -20.00% |
| Tool calls | 17 | 20 | -3 | -15.00% |
| Tool results | 17 | 20 | -3 | -15.00% |
| Visible tool bytes | 281,006 | 298,449 | -17,443 | -5.84% |
| Compactions | 5 | 5 | +0 | +0.00% |
| Goal-context injections | 4 | 3 | +1 | +33.33% |
| Assistant output events | 16 | 20 | -4 | -20.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 19 | 26 | -7 | -26.92% |
| RPC compaction completions | 5 | 5 | +0 | +0.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 18 | 25 | -7 | -28.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 3 | +0 | +0.00% |
| Maximum goal tokens used | 78,087 | 72,632 | +5,455 | +7.51% |
| Completed RPC compactions | 5 | 5 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 75,225 | 67,298 | +7,927 | +11.78% |
| Output tokens | 4,110 | 6,576 | -2,466 | -37.50% |
| Cache-read tokens | 83,456 | 99,840 | -16,384 | -16.41% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 162,791 | 173,714 | -10,923 | -6.29% |
| Prompt-cache reuse | 52.59% | 59.74% | -7.14 pp | — |
| Input cost | $0.376125 | $0.336490 | +0.039635 | +11.78% |
| Output cost | $0.123300 | $0.197280 | -0.073980 | -37.50% |
| Cache-read cost | $0.041728 | $0.049920 | -0.008192 | -16.41% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.541153 | $0.583690 | -0.042537 | -7.29% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 16 | 0 | +16 | n/a (zero baseline) |
| Archive source bytes | 262,682 | 0 | +262,682 | n/a (zero baseline) |
| Compressed archive bytes | 22,773 | 0 | +22,773 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.67% | 0.00% | +8.67 pp | — |
| Archive chunks | 25 | 0 | +25 | n/a (zero baseline) |
| Largest chunk bytes | 65,948 | 0 | +65,948 | n/a (zero baseline) |
| Source bytes admitted | 553,291 | 0 | +553,291 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 260,302 | 0 | +260,302 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 34,441 | 0 | +34,441 | n/a (zero baseline) |
| Streaming bytes processed | 525,926 | 0 | +525,926 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 83,456 | 0 | +83,456 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 75,225 | 0 | +75,225 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 263.13 s vs 258.24 s; Δ +4.89 s (+1.89%).
- **Model calls:** 17 vs 17; Δ +0 (+0.00%).
- **Tool calls:** 16 vs 17; Δ -1 (-5.88%).
- **Compactions:** 4 vs 4; Δ +0 (+0.00%).
- **Total tokens:** 172,332 vs 165,029; Δ +7,303 (+4.43%).
- **Total API cost:** $0.552723 vs $0.515278; Δ +0.037445 (+7.27%).
- **Visible tool bytes:** 143,994 vs 89,932; Δ +54,062 (+60.11%).
- **Prompt-cache reuse:** 54.16% vs 63.69%; Δ -9.53 pp.

- **Expected exact final response:** `COMMITTEE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `COMMITTEE GOAL COMPLETE`
- **vanilla prime-agent final response:** `COMMITTEE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 263.13 s | 258.24 s | +4.89 s | +1.89% |
| Lifecycle wall time | 263.53 s | 258.46 s | +5.08 s | +1.96% |
| Instruction wall time | 263.13 s | 258.24 s | +4.89 s | +1.89% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 17 | 17 | +0 | +0.00% |
| Tool calls | 16 | 17 | -1 | -5.88% |
| Tool results | 16 | 17 | -1 | -5.88% |
| Visible tool bytes | 143,994 | 89,932 | +54,062 | +60.11% |
| Compactions | 4 | 4 | +0 | +0.00% |
| Goal-context injections | 3 | 3 | +0 | +0.00% |
| Assistant output events | 17 | 17 | +0 | +0.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 19 | 21 | -2 | -9.52% |
| RPC compaction completions | 4 | 4 | +0 | +0.00% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 0 | +1 | n/a (zero baseline) |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 18 | 20 | -2 | -10.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 2 | +0 | +0.00% |
| Maximum goal tokens used | 80,121 | 62,446 | +17,675 | +28.30% |
| Completed RPC compactions | 4 | 4 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | -1 | -50.00% |
| Failed compaction requests | 1 | 0 | +1 | n/a (zero baseline) |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 77,149 | 57,800 | +19,349 | +33.48% |
| Output tokens | 4,047 | 5,853 | -1,806 | -30.86% |
| Cache-read tokens | 91,136 | 101,376 | -10,240 | -10.10% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 172,332 | 165,029 | +7,303 | +4.43% |
| Prompt-cache reuse | 54.16% | 63.69% | -9.53 pp | — |
| Input cost | $0.385745 | $0.289000 | +0.096745 | +33.48% |
| Output cost | $0.121410 | $0.175590 | -0.054180 | -30.86% |
| Cache-read cost | $0.045568 | $0.050688 | -0.005120 | -10.10% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.552723 | $0.515278 | +0.037445 | +7.27% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 15 | 0 | +15 | n/a (zero baseline) |
| Archive source bytes | 132,234 | 0 | +132,234 | n/a (zero baseline) |
| Compressed archive bytes | 11,583 | 0 | +11,583 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.76% | 0.00% | +8.76 pp | — |
| Archive chunks | 21 | 0 | +21 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 277,074 | 0 | +277,074 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,913 | 0 | +130,913 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 42,115 | 0 | +42,115 | n/a (zero baseline) |
| Streaming bytes processed | 264,468 | 0 | +264,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 91,136 | 0 | +91,136 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 77,149 | 0 | +77,149 | n/a (zero baseline) |
| Stable-projection extension turns | 13 | 0 | +13 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 422.38 s vs 512.74 s; Δ -90.36 s (-17.62%).
- **Model calls:** 18 vs 21; Δ -3 (-14.29%).
- **Tool calls:** 20 vs 20; Δ +0 (+0.00%).
- **Compactions:** 7 vs 8; Δ -1 (-12.50%).
- **Total tokens:** 191,473 vs 217,101; Δ -25,628 (-11.80%).
- **Total API cost:** $0.713779 vs $0.843265; Δ -0.129486 (-15.36%).
- **Visible tool bytes:** 299,567 vs 231,978; Δ +67,589 (+29.14%).
- **Prompt-cache reuse:** 51.13% vs 51.83%; Δ -0.70 pp.

- **Expected exact final response:** `CONTENT ROUTER GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `CONTENT ROUTER GOAL COMPLETE`
- **vanilla prime-agent final response:** `CONTENT ROUTER GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 422.38 s | 512.74 s | -90.36 s | -17.62% |
| Lifecycle wall time | 422.53 s | 512.87 s | -90.34 s | -17.61% |
| Instruction wall time | 422.38 s | 512.74 s | -90.36 s | -17.62% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 21 | -3 | -14.29% |
| Tool calls | 20 | 20 | +0 | +0.00% |
| Tool results | 20 | 20 | +0 | +0.00% |
| Visible tool bytes | 299,567 | 231,978 | +67,589 | +29.14% |
| Compactions | 7 | 8 | -1 | -12.50% |
| Goal-context injections | 6 | 7 | -1 | -14.29% |
| Assistant output events | 18 | 21 | -3 | -14.29% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 7 | +0 | +0.00% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 23 | 28 | -5 | -17.86% |
| RPC compaction completions | 7 | 8 | -1 | -12.50% |
| Compaction requests | 2 | 2 | +0 | +0.00% |
| Compaction waits | 0 | 0 | +0 | 0.00% |
| Accepted stage/command responses | 6 | 6 | +0 | +0.00% |
| Rejected stage/command responses | 1 | 1 | +0 | +0.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 5 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 22 | 27 | -5 | -18.52% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 5 | 6 | -1 | -16.67% |
| Maximum goal tokens used | 96,476 | 108,549 | -12,073 | -11.12% |
| Completed RPC compactions | 7 | 8 | -1 | -12.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 1 | +0 | +0.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 0 | +0 | 0.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 90,051 | 99,917 | -9,866 | -9.87% |
| Output tokens | 7,214 | 9,664 | -2,450 | -25.35% |
| Cache-read tokens | 94,208 | 107,520 | -13,312 | -12.38% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 191,473 | 217,101 | -25,628 | -11.80% |
| Prompt-cache reuse | 51.13% | 51.83% | -0.70 pp | — |
| Input cost | $0.450255 | $0.499585 | -0.049330 | -9.87% |
| Output cost | $0.216420 | $0.289920 | -0.073500 | -25.35% |
| Cache-read cost | $0.047104 | $0.053760 | -0.006656 | -12.38% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.713779 | $0.843265 | -0.129486 | -15.36% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 19 | 0 | +19 | n/a (zero baseline) |
| Archive source bytes | 262,682 | 0 | +262,682 | n/a (zero baseline) |
| Compressed archive bytes | 26,607 | 0 | +26,607 | n/a (zero baseline) |
| Archive compression ratio (derived) | 10.13% | 0.00% | +10.13 pp | — |
| Archive chunks | 26 | 0 | +26 | n/a (zero baseline) |
| Largest chunk bytes | 65,948 | 0 | +65,948 | n/a (zero baseline) |
| Source bytes admitted | 567,388 | 0 | +567,388 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 260,258 | 0 | +260,258 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 36,302 | 0 | +36,302 | n/a (zero baseline) |
| Streaming bytes processed | 525,926 | 0 | +525,926 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 8 | 0 | +8 | n/a (zero baseline) |
| Prime Context cache-read tokens | 94,208 | 0 | +94,208 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 90,051 | 0 | +90,051 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 353.91 s vs 451.43 s; Δ -97.52 s (-21.60%).
- **Model calls:** 18 vs 26; Δ -8 (-30.77%).
- **Tool calls:** 16 vs 19; Δ -3 (-15.79%).
- **Compactions:** 4 vs 6; Δ -2 (-33.33%).
- **Total tokens:** 188,624 vs 255,014; Δ -66,390 (-26.03%).
- **Total API cost:** $0.568210 vs $0.738929; Δ -0.170719 (-23.10%).
- **Visible tool bytes:** 213,802 vs 155,576; Δ +58,226 (+37.43%).
- **Prompt-cache reuse:** 59.89% vs 62.65%; Δ -2.76 pp.

- **Expected exact final response:** `EVENT WINDOW GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `EVENT WINDOW GOAL COMPLETE`
- **vanilla prime-agent final response:** `EVENT WINDOW GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 353.91 s | 451.43 s | -97.52 s | -21.60% |
| Lifecycle wall time | 354.25 s | 452.05 s | -97.80 s | -21.63% |
| Instruction wall time | 353.91 s | 451.43 s | -97.52 s | -21.60% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 18 | 26 | -8 | -30.77% |
| Tool calls | 16 | 19 | -3 | -15.79% |
| Tool results | 16 | 19 | -3 | -15.79% |
| Visible tool bytes | 213,802 | 155,576 | +58,226 | +37.43% |
| Compactions | 4 | 6 | -2 | -33.33% |
| Goal-context injections | 3 | 9 | -6 | -66.67% |
| Assistant output events | 18 | 26 | -8 | -30.77% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 14 | -7 | -50.00% |
| Test-run observations | 6 | 6 | +0 | +0.00% |
| Goal updates | 20 | 33 | -13 | -39.39% |
| RPC compaction completions | 4 | 6 | -2 | -33.33% |
| Compaction requests | 2 | 5 | -3 | -60.00% |
| Compaction waits | 0 | 4 | -4 | -100.00% |
| Accepted stage/command responses | 6 | 10 | -4 | -40.00% |
| Rejected stage/command responses | 1 | 4 | -3 | -75.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 5 | -1 | -20.00% |
| Failing observed test runs | 2 | 1 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 19 | 32 | -13 | -40.62% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 8 | -6 | -75.00% |
| Maximum goal tokens used | 77,943 | 98,578 | -20,635 | -20.93% |
| Completed RPC compactions | 4 | 6 | -2 | -33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 4 | -3 | -75.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 4 | -4 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 73,726 | 92,795 | -19,069 | -20.55% |
| Output tokens | 4,818 | 6,571 | -1,753 | -26.68% |
| Cache-read tokens | 110,080 | 155,648 | -45,568 | -29.28% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 188,624 | 255,014 | -66,390 | -26.03% |
| Prompt-cache reuse | 59.89% | 62.65% | -2.76 pp | — |
| Input cost | $0.368630 | $0.463975 | -0.095345 | -20.55% |
| Output cost | $0.144540 | $0.197130 | -0.052590 | -26.68% |
| Cache-read cost | $0.055040 | $0.077824 | -0.022784 | -29.28% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.568210 | $0.738929 | -0.170719 | -23.10% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 15 | 0 | +15 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 17,502 | 0 | +17,502 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.90% | 0.00% | +8.90 pp | — |
| Archive chunks | 25 | 0 | +25 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 417,326 | 0 | +417,326 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,344 | 0 | +195,344 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 41,856 | 0 | +41,856 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 110,080 | 0 | +110,080 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 73,726 | 0 | +73,726 | n/a (zero baseline) |
| Stable-projection extension turns | 14 | 0 | +14 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 210.23 s vs 247.37 s; Δ -37.14 s (-15.02%).
- **Model calls:** 15 vs 20; Δ -5 (-25.00%).
- **Tool calls:** 13 vs 12; Δ +1 (+8.33%).
- **Compactions:** 4 vs 5; Δ -1 (-20.00%).
- **Total tokens:** 143,482 vs 163,967; Δ -20,485 (-12.49%).
- **Total API cost:** $0.391046 vs $0.451693; Δ -0.060647 (-13.43%).
- **Visible tool bytes:** 143,412 vs 78,120; Δ +65,292 (+83.58%).
- **Prompt-cache reuse:** 60.18% vs 63.18%; Δ -3.01 pp.

- **Expected exact final response:** `FEATURE FLAG GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `FEATURE FLAG GOAL COMPLETE`
- **vanilla prime-agent final response:** `FEATURE FLAG GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 210.23 s | 247.37 s | -37.14 s | -15.02% |
| Lifecycle wall time | 210.61 s | 247.69 s | -37.08 s | -14.97% |
| Instruction wall time | 210.23 s | 247.37 s | -37.14 s | -15.02% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 20 | -5 | -25.00% |
| Tool calls | 13 | 12 | +1 | +8.33% |
| Tool results | 13 | 12 | +1 | +8.33% |
| Visible tool bytes | 143,412 | 78,120 | +65,292 | +83.58% |
| Compactions | 4 | 5 | -1 | -20.00% |
| Goal-context injections | 3 | 10 | -7 | -70.00% |
| Assistant output events | 15 | 20 | -5 | -25.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 9 | 19 | -10 | -52.63% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 17 | 28 | -11 | -39.29% |
| RPC compaction completions | 4 | 5 | -1 | -20.00% |
| Compaction requests | 3 | 8 | -5 | -62.50% |
| Compaction waits | 1 | 6 | -5 | -83.33% |
| Accepted stage/command responses | 7 | 13 | -6 | -46.15% |
| Rejected stage/command responses | 2 | 6 | -4 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 27 | -11 | -40.74% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 9 | -7 | -77.78% |
| Maximum goal tokens used | 57,138 | 61,280 | -4,142 | -6.76% |
| Completed RPC compactions | 4 | 5 | -1 | -20.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | -1 | -50.00% |
| Failed compaction requests | 2 | 6 | -4 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 1 | 6 | -5 | -83.33% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 56,246 | 59,069 | -2,823 | -4.78% |
| Output tokens | 2,244 | 3,522 | -1,278 | -36.29% |
| Cache-read tokens | 84,992 | 101,376 | -16,384 | -16.16% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 143,482 | 163,967 | -20,485 | -12.49% |
| Prompt-cache reuse | 60.18% | 63.18% | -3.01 pp | — |
| Input cost | $0.281230 | $0.295345 | -0.014115 | -4.78% |
| Output cost | $0.067320 | $0.105660 | -0.038340 | -36.29% |
| Cache-read cost | $0.042496 | $0.050688 | -0.008192 | -16.16% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.391046 | $0.451693 | -0.060647 | -13.43% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 12 | 0 | +12 | n/a (zero baseline) |
| Archive source bytes | 132,234 | 0 | +132,234 | n/a (zero baseline) |
| Compressed archive bytes | 12,513 | 0 | +12,513 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.46% | 0.00% | +9.46 pp | — |
| Archive chunks | 20 | 0 | +20 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 281,462 | 0 | +281,462 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,913 | 0 | +130,913 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 32,910 | 0 | +32,910 | n/a (zero baseline) |
| Streaming bytes processed | 264,468 | 0 | +264,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 84,992 | 0 | +84,992 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 56,246 | 0 | +56,246 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 357.85 s vs 450.18 s; Δ -92.33 s (-20.51%).
- **Model calls:** 16 vs 21; Δ -5 (-23.81%).
- **Tool calls:** 15 vs 18; Δ -3 (-16.67%).
- **Compactions:** 5 vs 8; Δ -3 (-37.50%).
- **Total tokens:** 165,211 vs 204,752; Δ -39,541 (-19.31%).
- **Total API cost:** $0.619752 vs $0.757680; Δ -0.137928 (-18.20%).
- **Visible tool bytes:** 211,215 vs 221,000; Δ -9,785 (-4.43%).
- **Prompt-cache reuse:** 50.56% vs 50.57%; Δ -0.01 pp.

- **Expected exact final response:** `LAYERED CONFIG GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `LAYERED CONFIG GOAL COMPLETE`
- **vanilla prime-agent final response:** `LAYERED CONFIG GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 357.85 s | 450.18 s | -92.33 s | -20.51% |
| Lifecycle wall time | 358.45 s | 450.76 s | -92.31 s | -20.48% |
| Instruction wall time | 357.85 s | 450.18 s | -92.33 s | -20.51% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 16 | 21 | -5 | -23.81% |
| Tool calls | 15 | 18 | -3 | -16.67% |
| Tool results | 15 | 18 | -3 | -16.67% |
| Visible tool bytes | 211,215 | 221,000 | -9,785 | -4.43% |
| Compactions | 5 | 8 | -3 | -37.50% |
| Goal-context injections | 4 | 9 | -5 | -55.56% |
| Assistant output events | 16 | 21 | -5 | -23.81% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 13 | -6 | -46.15% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 19 | 31 | -12 | -38.71% |
| RPC compaction completions | 5 | 8 | -3 | -37.50% |
| Compaction requests | 2 | 5 | -3 | -60.00% |
| Compaction waits | 0 | 3 | -3 | -100.00% |
| Accepted stage/command responses | 6 | 9 | -3 | -33.33% |
| Rejected stage/command responses | 1 | 4 | -3 | -75.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 5 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 18 | 30 | -12 | -40.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 3 | 8 | -5 | -62.50% |
| Maximum goal tokens used | 83,680 | 103,828 | -20,148 | -19.41% |
| Completed RPC compactions | 5 | 8 | -3 | -37.50% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 4 | -3 | -75.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 3 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 78,610 | 97,584 | -18,974 | -19.44% |
| Output tokens | 6,217 | 7,328 | -1,111 | -15.16% |
| Cache-read tokens | 80,384 | 99,840 | -19,456 | -19.49% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 165,211 | 204,752 | -39,541 | -19.31% |
| Prompt-cache reuse | 50.56% | 50.57% | -0.01 pp | — |
| Input cost | $0.393050 | $0.487920 | -0.094870 | -19.44% |
| Output cost | $0.186510 | $0.219840 | -0.033330 | -15.16% |
| Cache-read cost | $0.040192 | $0.049920 | -0.009728 | -19.49% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.619752 | $0.757680 | -0.137928 | -18.20% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 14 | 0 | +14 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 15,425 | 0 | +15,425 | n/a (zero baseline) |
| Archive compression ratio (derived) | 7.84% | 0.00% | +7.84 pp | — |
| Archive chunks | 18 | 0 | +18 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 409,338 | 0 | +409,338 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,361 | 0 | +195,361 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 25,620 | 0 | +25,620 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 6 | 0 | +6 | n/a (zero baseline) |
| Prime Context cache-read tokens | 80,384 | 0 | +80,384 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 78,610 | 0 | +78,610 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 198.35 s vs 223.05 s; Δ -24.70 s (-11.07%).
- **Model calls:** 14 vs 23; Δ -9 (-39.13%).
- **Tool calls:** 13 vs 18; Δ -5 (-27.78%).
- **Compactions:** 4 vs 4; Δ +0 (+0.00%).
- **Total tokens:** 136,797 vs 216,417; Δ -79,620 (-36.79%).
- **Total API cost:** $0.425696 vs $0.547145; Δ -0.121449 (-22.20%).
- **Visible tool bytes:** 143,306 vs 82,209; Δ +61,097 (+74.32%).
- **Prompt-cache reuse:** 53.82% vs 68.98%; Δ -15.16 pp.

- **Expected exact final response:** `RANKED CHOICE GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `RANKED CHOICE GOAL COMPLETE`
- **vanilla prime-agent final response:** `RANKED CHOICE GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 198.35 s | 223.05 s | -24.70 s | -11.07% |
| Lifecycle wall time | 198.52 s | 223.67 s | -25.15 s | -11.24% |
| Instruction wall time | 198.35 s | 223.05 s | -24.70 s | -11.07% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 14 | 23 | -9 | -39.13% |
| Tool calls | 13 | 18 | -5 | -27.78% |
| Tool results | 13 | 18 | -5 | -27.78% |
| Visible tool bytes | 143,306 | 82,209 | +61,097 | +74.32% |
| Compactions | 4 | 4 | +0 | +0.00% |
| Goal-context injections | 3 | 6 | -3 | -50.00% |
| Assistant output events | 14 | 23 | -9 | -39.13% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 13 | -6 | -46.15% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 16 | 28 | -12 | -42.86% |
| RPC compaction completions | 4 | 4 | +0 | +0.00% |
| Compaction requests | 2 | 5 | -3 | -60.00% |
| Compaction waits | 0 | 3 | -3 | -100.00% |
| Accepted stage/command responses | 6 | 10 | -4 | -40.00% |
| Rejected stage/command responses | 1 | 3 | -2 | -66.67% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 3 | 5 | -2 | -40.00% |
| Failing observed test runs | 2 | 1 | +1 | +100.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 15 | 27 | -12 | -44.44% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 5 | -3 | -60.00% |
| Maximum goal tokens used | 63,884 | 68,943 | -5,059 | -7.34% |
| Completed RPC compactions | 4 | 4 | +0 | +0.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 2 | -1 | -50.00% |
| Failed compaction requests | 1 | 3 | -2 | -66.67% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 3 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 61,942 | 65,629 | -3,687 | -5.62% |
| Output tokens | 2,663 | 4,868 | -2,205 | -45.30% |
| Cache-read tokens | 72,192 | 145,920 | -73,728 | -50.53% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 136,797 | 216,417 | -79,620 | -36.79% |
| Prompt-cache reuse | 53.82% | 68.98% | -15.16 pp | — |
| Input cost | $0.309710 | $0.328145 | -0.018435 | -5.62% |
| Output cost | $0.079890 | $0.146040 | -0.066150 | -45.30% |
| Cache-read cost | $0.036096 | $0.072960 | -0.036864 | -50.53% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.425696 | $0.547145 | -0.121449 | -22.20% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 12 | 0 | +12 | n/a (zero baseline) |
| Archive source bytes | 131,156 | 0 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 11,562 | 0 | +11,562 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.82% | 0.00% | +8.82 pp | — |
| Archive chunks | 15 | 0 | +15 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 278,542 | 0 | +278,542 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,242 | 0 | +130,242 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 35,917 | 0 | +35,917 | n/a (zero baseline) |
| Streaming bytes processed | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 72,192 | 0 | +72,192 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 61,942 | 0 | +61,942 | n/a (zero baseline) |
| Stable-projection extension turns | 10 | 0 | +10 | n/a (zero baseline) |


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

- **Wall time:** 504.41 s vs 829.87 s; Δ -325.46 s (-39.22%).
- **Model calls:** 19 vs 23; Δ -4 (-17.39%).
- **Tool calls:** 17 vs 20; Δ -3 (-15.00%).
- **Compactions:** 6 vs 12; Δ -6 (-50.00%).
- **Total tokens:** 196,239 vs 233,507; Δ -37,268 (-15.96%).
- **Total API cost:** $0.571731 vs $0.940624; Δ -0.368893 (-39.22%).
- **Visible tool bytes:** 219,637 vs 251,491; Δ -31,854 (-12.67%).
- **Prompt-cache reuse:** 64.80% vs 47.92%; Δ +16.89 pp.

- **Expected exact final response:** `STOCKROOM GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `STOCKROOM GOAL COMPLETE`
- **vanilla prime-agent final response:** `STOCKROOM GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 504.41 s | 829.87 s | -325.46 s | -39.22% |
| Lifecycle wall time | 504.78 s | 830.27 s | -325.49 s | -39.20% |
| Instruction wall time | 504.41 s | 829.87 s | -325.46 s | -39.22% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 19 | 23 | -4 | -17.39% |
| Tool calls | 17 | 20 | -3 | -15.00% |
| Tool results | 17 | 20 | -3 | -15.00% |
| Visible tool bytes | 219,637 | 251,491 | -31,854 | -12.67% |
| Compactions | 6 | 12 | -6 | -50.00% |
| Goal-context injections | 4 | 11 | -7 | -63.64% |
| Assistant output events | 19 | 23 | -4 | -17.39% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 6 | -1 | -16.67% |
| Goal updates | 24 | 34 | -10 | -29.41% |
| RPC compaction completions | 6 | 12 | -6 | -50.00% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 5 | -1 | -20.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 23 | 33 | -10 | -30.30% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 4 | 10 | -6 | -60.00% |
| Maximum goal tokens used | 68,085 | 122,240 | -54,155 | -44.30% |
| Completed RPC compactions | 6 | 12 | -6 | -50.00% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 67,015 | 116,314 | -49,299 | -42.38% |
| Output tokens | 5,832 | 10,185 | -4,353 | -42.74% |
| Cache-read tokens | 123,392 | 107,008 | +16,384 | +15.31% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 196,239 | 233,507 | -37,268 | -15.96% |
| Prompt-cache reuse | 64.80% | 47.92% | +16.89 pp | — |
| Input cost | $0.335075 | $0.581570 | -0.246495 | -42.38% |
| Output cost | $0.174960 | $0.305550 | -0.130590 | -42.74% |
| Cache-read cost | $0.061696 | $0.053504 | +0.008192 | +15.31% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.571731 | $0.940624 | -0.368893 | -39.22% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 16 | 0 | +16 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 18,111 | 0 | +18,111 | n/a (zero baseline) |
| Archive compression ratio (derived) | 9.21% | 0.00% | +9.21 pp | — |
| Archive chunks | 20 | 0 | +20 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 418,693 | 0 | +418,693 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,362 | 0 | +195,362 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 21,874 | 0 | +21,874 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 7 | 0 | +7 | n/a (zero baseline) |
| Prime Context cache-read tokens | 123,392 | 0 | +123,392 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 67,015 | 0 | +67,015 | n/a (zero baseline) |
| Stable-projection extension turns | 12 | 0 | +12 | n/a (zero baseline) |


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

**Verdict:** Both variants meet all acceptance criteria; this pair is eligible for formal efficiency comparison.

- **Wall time:** 167.12 s vs 184.77 s; Δ -17.66 s (-9.56%).
- **Model calls:** 15 vs 20; Δ -5 (-25.00%).
- **Tool calls:** 14 vs 15; Δ -1 (-6.67%).
- **Compactions:** 4 vs 3; Δ +1 (+33.33%).
- **Total tokens:** 145,342 vs 178,975; Δ -33,633 (-18.79%).
- **Total API cost:** $0.436431 vs $0.516531; Δ -0.080100 (-15.51%).
- **Visible tool bytes:** 211,330 vs 27,165; Δ +184,165 (+677.95%).
- **Prompt-cache reuse:** 54.05% vs 61.85%; Δ -7.80 pp.

- **Expected exact final response:** `TRIP SPLIT GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `TRIP SPLIT GOAL COMPLETE`
- **vanilla prime-agent final response:** `TRIP SPLIT GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 167.12 s | 184.77 s | -17.66 s | -9.56% |
| Lifecycle wall time | 167.54 s | 184.92 s | -17.37 s | -9.40% |
| Instruction wall time | 167.12 s | 184.77 s | -17.66 s | -9.56% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 15 | 20 | -5 | -25.00% |
| Tool calls | 14 | 15 | -1 | -6.67% |
| Tool results | 14 | 15 | -1 | -6.67% |
| Visible tool bytes | 211,330 | 27,165 | +184,165 | +677.95% |
| Compactions | 4 | 3 | +1 | +33.33% |
| Goal-context injections | 3 | 5 | -2 | -40.00% |
| Assistant output events | 15 | 20 | -5 | -25.00% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 13 | -6 | -46.15% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 17 | 26 | -9 | -34.62% |
| RPC compaction completions | 4 | 3 | +1 | +33.33% |
| Compaction requests | 2 | 5 | -3 | -60.00% |
| Compaction waits | 0 | 3 | -3 | -100.00% |
| Accepted stage/command responses | 7 | 10 | -3 | -30.00% |
| Rejected stage/command responses | 0 | 3 | -3 | -100.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 16 | 25 | -9 | -36.00% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 2 | 4 | -2 | -50.00% |
| Maximum goal tokens used | 67,023 | 70,085 | -3,062 | -4.37% |
| Completed RPC compactions | 4 | 3 | +1 | +33.33% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 2 | 2 | +0 | +0.00% |
| Failed compaction requests | 0 | 3 | -3 | -100.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 3 | -3 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 65,725 | 66,631 | -906 | -1.36% |
| Output tokens | 2,305 | 4,312 | -2,007 | -46.54% |
| Cache-read tokens | 77,312 | 108,032 | -30,720 | -28.44% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 145,342 | 178,975 | -33,633 | -18.79% |
| Prompt-cache reuse | 54.05% | 61.85% | -7.80 pp | — |
| Input cost | $0.328625 | $0.333155 | -0.004530 | -1.36% |
| Output cost | $0.069150 | $0.129360 | -0.060210 | -46.54% |
| Cache-read cost | $0.038656 | $0.054016 | -0.015360 | -28.44% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $0.436431 | $0.516531 | -0.080100 | -15.51% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 13 | 0 | +13 | n/a (zero baseline) |
| Archive source bytes | 196,734 | 0 | +196,734 | n/a (zero baseline) |
| Compressed archive bytes | 15,810 | 0 | +15,810 | n/a (zero baseline) |
| Archive compression ratio (derived) | 8.04% | 0.00% | +8.04 pp | — |
| Archive chunks | 19 | 0 | +19 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 409,577 | 0 | +409,577 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 195,361 | 0 | +195,361 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 38,765 | 0 | +38,765 | n/a (zero baseline) |
| Streaming bytes processed | 393,468 | 0 | +393,468 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 5 | 0 | +5 | n/a (zero baseline) |
| Prime Context cache-read tokens | 77,312 | 0 | +77,312 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 65,725 | 0 | +65,725 | n/a (zero baseline) |
| Stable-projection extension turns | 11 | 0 | +11 | n/a (zero baseline) |


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

- **Wall time:** 627.67 s vs 379.12 s; Δ +248.55 s (+65.56%).
- **Model calls:** 29 vs 22; Δ +7 (+31.82%).
- **Tool calls:** 28 vs 20; Δ +8 (+40.00%).
- **Compactions:** 13 vs 7; Δ +6 (+85.71%).
- **Total tokens:** 311,210 vs 216,833; Δ +94,377 (+43.53%).
- **Total API cost:** $1.051539 vs $0.746159; Δ +0.305380 (+40.93%).
- **Visible tool bytes:** 200,997 vs 235,700; Δ -34,703 (-14.72%).
- **Prompt-cache reuse:** 47.64% vs 52.02%; Δ -4.38 pp.

- **Retry:** prime-context 8.1.1 initially failed strict acceptance and used its single permitted retry; the table reports the retry attempt (strict pass).

- **Expected exact final response:** `WEBHOOK GOAL COMPLETE`
- **prime-context 8.1.1 final response:** `WEBHOOK GOAL COMPLETE`
- **vanilla prime-agent final response:** `WEBHOOK GOAL COMPLETE`

### Complete acceptance and lifecycle comparison

| Acceptance item | Expected | prime-context 8.1.1 | vanilla prime-agent |
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

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Wall time | 627.67 s | 379.12 s | +248.55 s | +65.56% |
| Lifecycle wall time | 628.13 s | 379.72 s | +248.41 s | +65.42% |
| Instruction wall time | 627.67 s | 379.12 s | +248.55 s | +65.56% |
| Sessions | 1 | 1 | +0 | +0.00% |
| Child sessions | 0 | 0 | +0 | 0.00% |
| Model calls | 29 | 22 | +7 | +31.82% |
| Tool calls | 28 | 20 | +8 | +40.00% |
| Tool results | 28 | 20 | +8 | +40.00% |
| Visible tool bytes | 200,997 | 235,700 | -34,703 | -14.72% |
| Compactions | 13 | 7 | +6 | +85.71% |
| Goal-context injections | 11 | 6 | +5 | +83.33% |
| Assistant output events | 29 | 22 | +7 | +31.82% |
| Interventions delivered | 5 | 5 | +0 | +0.00% |
| Stage responses recorded | 7 | 9 | -2 | -22.22% |
| Test-run observations | 5 | 5 | +0 | +0.00% |
| Goal updates | 39 | 29 | +10 | +34.48% |
| RPC compaction completions | 13 | 7 | +6 | +85.71% |
| Compaction requests | 2 | 3 | -1 | -33.33% |
| Compaction waits | 0 | 1 | -1 | -100.00% |
| Accepted stage/command responses | 6 | 7 | -1 | -14.29% |
| Rejected stage/command responses | 1 | 2 | -1 | -50.00% |
| Unanswered stage/command responses | 0 | 0 | +0 | 0.00% |
| Passing observed test runs | 4 | 4 | +0 | +0.00% |
| Failing observed test runs | 1 | 1 | +0 | +0.00% |
| Error-classified observed test runs | 0 | 0 | +0 | 0.00% |
| Active goal updates | 38 | 28 | +10 | +35.71% |
| Complete goal updates | 1 | 1 | +0 | +0.00% |
| Other-status goal updates | 0 | 0 | +0 | 0.00% |
| Maximum goal continuations used | 10 | 5 | +5 | +100.00% |
| Maximum goal tokens used | 160,982 | 106,144 | +54,838 | +51.66% |
| Completed RPC compactions | 13 | 7 | +6 | +85.71% |
| Aborted RPC compactions | 0 | 0 | +0 | 0.00% |
| Successful compaction requests | 1 | 1 | +0 | +0.00% |
| Failed compaction requests | 1 | 2 | -1 | -50.00% |
| Unanswered compaction requests | 0 | 0 | +0 | 0.00% |
| Successful compaction waits | 0 | 1 | -1 | -100.00% |
| Failed compaction waits | 0 | 0 | +0 | 0.00% |
| Unanswered compaction waits | 0 | 0 | +0 | 0.00% |
| Input tokens | 159,809 | 101,063 | +58,746 | +58.13% |
| Output tokens | 5,993 | 6,202 | -209 | -3.37% |
| Cache-read tokens | 145,408 | 109,568 | +35,840 | +32.71% |
| Cache-write tokens | 0 | 0 | +0 | 0.00% |
| Total tokens | 311,210 | 216,833 | +94,377 | +43.53% |
| Prompt-cache reuse | 47.64% | 52.02% | -4.38 pp | — |
| Input cost | $0.799045 | $0.505315 | +0.293730 | +58.13% |
| Output cost | $0.179790 | $0.186060 | -0.006270 | -3.37% |
| Cache-read cost | $0.072704 | $0.054784 | +0.017920 | +32.71% |
| Cache-write cost | $0.000000 | $0.000000 | +0.000000 | 0.00% |
| Total API cost | $1.051539 | $0.746159 | +0.305380 | +40.93% |

### Complete archive and projection telemetry

These fields are emitted by the same result collector for both variants. Zero values for `vanilla prime-agent` are expected because it does not load Prime Context.

| Metric | prime-context 8.1.1 | vanilla prime-agent | Δ (prime-context 8.1.1 − vanilla prime-agent) | Relative change |
|---|---:|---:|---:|---:|
| Archived observations | 27 | 0 | +27 | n/a (zero baseline) |
| Archive source bytes | 131,156 | 0 | +131,156 | n/a (zero baseline) |
| Compressed archive bytes | 30,406 | 0 | +30,406 | n/a (zero baseline) |
| Archive compression ratio (derived) | 23.18% | 0.00% | +23.18 pp | — |
| Archive chunks | 32 | 0 | +32 | n/a (zero baseline) |
| Largest chunk bytes | 65,578 | 0 | +65,578 | n/a (zero baseline) |
| Source bytes admitted | 332,596 | 0 | +332,596 | n/a (zero baseline) |
| Call-argument bytes projected out | 0 | 0 | +0 | 0.00% |
| Result bytes projected out | 130,240 | 0 | +130,240 | n/a (zero baseline) |
| Typed/media bytes projected out | 0 | 0 | +0 | 0.00% |
| Recovery bytes exposed | 0 | 0 | +0 | 0.00% |
| End-state projected model-view bytes | 23,549 | 0 | +23,549 | n/a (zero baseline) |
| Streaming bytes processed | 262,312 | 0 | +262,312 | n/a (zero baseline) |
| Inspect/recall hits | 0 | 0 | +0 | 0.00% |
| Fold generations | 0 | 0 | +0 | 0.00% |
| Branch-runtime reloads | 14 | 0 | +14 | n/a (zero baseline) |
| Prime Context cache-read tokens | 145,408 | 0 | +145,408 | n/a (zero baseline) |
| Prime Context cache-write tokens | 0 | 0 | +0 | 0.00% |
| Prime Context uncached input tokens | 159,809 | 0 | +159,809 | n/a (zero baseline) |
| Stable-projection extension turns | 16 | 0 | +16 | n/a (zero baseline) |
