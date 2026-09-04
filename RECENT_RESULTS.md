# Current Benchmark Publication Record

_Last updated 2026-09-04._

This file records only the evidence selected for the current Python Real-World 30 publication. Superseded and invalidated benchmark reports are not retained in the repository.

## Three-arm publication snapshot

| 30-task selected result | **Prime Context** | Vanilla Prime Agent | Vanilla Codex |
|---|---:|---:|---:|
| Strict completion | **30/30** | 29/30 | 30/30 |
| Main checks | **150/150** | 149/150 | 150/150 |
| Edge checks | **30/30** | 30/30 | 30/30 |
| Agent wall time | **6,172.066 s** | 7,667.468 s | 10,338.905 s |
| Cost | **$13.233338** | $18.513607 | $31.447008 |
| Provider tokens | **4,199,330** | 6,865,456 | 23,327,077 |
| Retained attempts | 32 | 32 | 30 |

Prime Context is compared directly with each baseline:

- Against vanilla Prime Agent: a **30/30 versus 29/30 correctness win**. On 29 strict both-pass tasks, Prime Context is **29/29 faster**, **29/29 lower cost**, uses **19.65% less agent time**, **29.39% less cost**, and **39.51% fewer provider tokens**.
- Against vanilla Codex: both are **30/30 strict**. Prime Context is **29/30 faster**, **30/30 lower cost**, uses **40.30% less agent time**, **57.92% less cost**, and **81.998% fewer provider tokens**. Task 13 is the single Codex time win.

No vanilla Prime Agent-versus-Codex delta or winner is reported.

## Selected Prime Agent publication sources

The accepted targeted-replacement set contains only these current sources:

- **v19 base:** `benchmarks/python-realworld-30/results/20260903-pa091-pc911-all30-v19-invalid-task08-rebook-contract-parent-scope-tool` supplies unaffected Tasks 1–6, 9–12, 14–15, and 17–26.
- **Task 7 replacement:** `benchmarks/python-realworld-30/results/20260903-pa091-pc911-targeted-task07-replacement2`.
- **Task 13 replacement:** `benchmarks/python-realworld-30/results/20260903-pa091-pc911-targeted-task07-13-replacement`.
- **Post-fix gate:** `benchmarks/python-realworld-30/results/20260903-pa091-pc911-postfix-gate-task08-16-27-30` supplies Tasks 8, 16, and 27–30.

Selected attempts are A1 except Prime Context Tasks 6 and 27 and vanilla Prime Agent Tasks 2 and 30, which use A2. Vanilla Task 30 failed both allowed attempts; Prime Context Task 30 passed A1 and is a correctness win.

## Selected Codex publication source

- Full local run: `benchmarks/python-realworld-30/results/20260904-codex0153-gpt56sol-all30-v1`.
- Curated tracked evidence: [`benchmarks/python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1/`](benchmarks/python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1/).
- Configuration: stock `codex-cli 0.153.0`, ChatGPT authentication, `gpt-5.6-sol`, medium effort, maximum concurrency 6, exact loopback-only command proxy.
- Isolation: no Prime Agent or Prime Context, API-key variables, custom system/developer prompt, global/local `AGENTS.md`, `AGENTS.override.md`, or Codex config file. Prompts were sent on stdin from fresh `/tmp` workspaces and isolated homes. Stock Codex built-in context remained.
- Result: **30/30 strict**, **150/150 main checks**, **30/30 edge checks**, all A1; `10,338.905 s`; `$31.447008`; `23,327,077` provider tokens; 69 staged turns.

## Validation

- 110 product tests.
- 6 benchmark harness tests.
- Valid 30-task, 669-file staged corpus.
- Python compilation, Ruff, typecheck, build, link, SVG render, evidence consistency, and diff checks.
- Codex evidence audit: 30 tasks, 30 attempts, 69 event streams, and 1,616 public JSONL events with no malformed output, selected error, usage mismatch, external command URL, package installation, instruction-path leak, or retry.

See [`BENCHMARKS.md`](BENCHMARKS.md) for all three arms, all 30 task rows, visualizations, method, comparison policy, retries, and evidence links.
