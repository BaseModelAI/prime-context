# Prime Context benchmarks

## Current benchmark

[`python-realworld-30/`](python-realworld-30/) is the active benchmark. It is a hermetic Python 3.12 protocol defined by [`prime-context-python-realworld-30-benchmark-spec.md`](../prime-context-python-realworld-30-benchmark-spec.md).

The suite contains 30 staged software tasks. Candidate execution is isolated from the repository, future stages, judges, credentials, package managers, and public networking. The Prime Agent arms receive the same neutral Bash tool. The vanilla Codex arm receives the same task stages, fixtures, services, judges, timeouts, model family, reasoning effort, and maximum concurrency.

## Current published result

| 30-task result | **Prime Context** | Vanilla Prime Agent | Vanilla Codex |
|---|---:|---:|---:|
| Strict completion | **30/30** | 29/30 | 30/30 |
| Agent wall time | **6,172.066 s** | 7,667.468 s | 10,338.905 s |
| Cost | **$13.233338** | $18.513607 | $31.447008 |
| Provider tokens | **4,199,330** | 6,865,456 | 23,327,077 |

Prime Context is compared directly with each baseline. It is faster on **29/29** strict pairs against vanilla Prime Agent and **29/30** against vanilla Codex. It has lower cost on **29/29** and **30/30**, respectively. No baseline-to-baseline delta is reported.

Read [`BENCHMARKS.md`](../BENCHMARKS.md) for the full three-arm scorecard, all 30 task rows, charts, method, retries, and evidence map. Read [`RECENT_RESULTS.md`](../RECENT_RESULTS.md) for the selected Prime Agent publication records. The current Codex publication evidence is under [`python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1/`](python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1/).
