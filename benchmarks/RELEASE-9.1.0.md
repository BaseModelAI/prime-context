# Prime Context 9.1.0 interim benchmark report

Prime Context 9.1.0 is an **interim, usable release** of a major runtime upgrade. The product result is strong; the replacement benchmark and its reference points remain in progress.

## Direct old-versus-new comparison

The release comparison used one frozen random sample from the new 30-task hermetic Python 3.12 suite.

- Old arm: isolated copies of locally installed `prime-agent@0.8.1` and `prime-agent-context@8.1.1`.
- New arm: patched `prime-agent@0.9.1` and Prime Context `9.1.0`.
- Model: `openai-codex/gpt-5.6-sol`, medium effort.
- Sample seed: `64b1d6f70cff83e15b2354ceceb33084`.
- Tasks: `4, 5, 6, 10, 13, 14, 15, 18, 20, 21, 25, 30`.
- Concurrency: at most six attempts; paired task waves used identical neutral Bash tooling.
- Failed primaries retained at most one diagnostic retry. Retry resources were never erased.

### Correctness

| Measure | Local 8.1.1 | New 9.1.0 |
|---|---:|---:|
| Selected strict passes | 9/12 | **10/12** |
| Primary strict passes | 8/12 | **9/12** |
| Selected mean progress | 4.0833 | **4.2500** |

The new accuracy tuple was never worse. It improved over old on Task 13 and passed the Task 30 edge check that old missed. Task 6 was a paired candidate-runtime timeout; the remaining nine tasks were matched strict passes.

### Matched strict efficiency

| Metric | Local 8.1.1 | New 9.1.0 | New delta |
|---|---:|---:|---:|
| Agent time | 2,357.536 s | 1,610.507 s | **-31.7%** |
| Provider tokens | 1,406,138 | 708,070 | **-49.6%** |
| API cost | $4.659754 | $3.180271 | **-31.8%** |

Median per-pair changes were -11.5% time, -38.1% tokens, and -14.1% cost.

### All retained attempts

| Metric | Local 8.1.1 (16 attempts) | New 9.1.0 (15 attempts) | New delta |
|---|---:|---:|---:|
| Agent time | 9,181.609 s | 6,667.542 s | **-27.4%** |
| Provider tokens | 4,601,610 | 2,944,503 | **-36.0%** |
| API cost | $11.511597 | $8.474608 | **-26.4%** |

The frozen correctness-first analyzer reported zero correctness candidates, zero significant individual-efficiency candidates, and zero aggregate-efficiency candidates. Task 5, Task 6, and Task 30 artifact reviews found solver or candidate-implementation variance, not a deterministic current-product defect. No source fix was justified, so the comparison remained valid.

## Benchmark reset

This suite replaces the retired Docker/synthetic benchmark. It changes tasks, isolation, staging, judging, tools, and reference points. **Scores from the retired benchmark are not valid comparison baselines for 9.1.0.**

For historical context only, Prime Context 8.1 previously reported 100% strict completion, 20.8% fewer tokens, 23.2% fewer model calls, and lower cost on 25/30 pairs against its then-current vanilla baseline. Those figures remain evidence of the architecture's direction, but they must not be compared numerically with the 9.1.0 result above.

## What “interim” means

- The 9.1.0 package and pinned host patch are usable on Prime Agent 0.9.1.
- The new benchmark is hermetic and fully implemented, but future work may refine tasks and reference points.
- New benchmark revisions should establish fresh baselines rather than silently carrying forward retired scores.

See [`python-realworld-30/README.md`](python-realworld-30/README.md) for the active protocol and [`../PRIME_AGENT_0.9.1_MIGRATION.md`](../PRIME_AGENT_0.9.1_MIGRATION.md) for the host migration analysis.
