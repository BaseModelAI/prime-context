# Prime Context realistic benchmark suite

This directory contains the 30 long-running Python tasks and paired runners used for Prime Context evaluation. It is self-contained and does not rely on Prime Agent global memory or continual-harness memory.

Each task under `realistic-30/tasks/` contains:

- `scenario.json`: the exact goal, initial prompt, steering message, pivot prompt, follow-up prompt, final lock, expected final response, protected files, and pass criteria.
- `initial/`: the initial task document, package stubs, baseline tests, and standard-library test runner.
- `pivot/`: the hidden pivot document and tests injected after baseline steering and compaction.
- `followup/`: the hidden follow-up document and tests injected later.
- `legacy-runner.py`: the recovered original self-contained comparison runner for reference.

## Tasks

| ID | Slug | Task | Expected tests |
|---:|---|---|---:|
| 1 | `parcel-rate` | Parcel Rate Optimizer | 9 |
| 2 | `json-merge` | Three-Way JSON Merge Service | 9 |
| 3 | `spreadsheet` | Incremental Spreadsheet Engine | 9 |
| 4 | `heat-plate` | Heat Diffusion Plate | 9 |
| 5 | `telemetry-codec` | Binary Telemetry Frame Codec | 9 |
| 6 | `cash-flow` | Decimal Cash-Flow Mathematics | 9 |
| 7 | `pgm-regions` | PGM Region Analyzer | 9 |
| 8 | `gear-train` | Exact Gear-Train Constraint Solver | 9 |
| 9 | `signal-lab` | Streaming Signal Analysis | 9 |
| 10 | `rhythm` | Polyphonic Rhythm Quantizer | 9 |
| 11 | `record-migration` | Versioned Record Migration Engine | 9 |
| 12 | `transit-fares` | Transit Fare Settlement Engine | 9 |
| 13 | `league-standings` | Correctable League Standings | 9 |
| 14 | `bank-reconciliation` | Bank Deposit Reconciler | 9 |
| 15 | `authorization` | Hierarchical Authorization Engine | 9 |
| 16 | `subscription-invoice` | Subscription Invoice Generator | 9 |
| 17 | `dns-zone` | Authoritative DNS Zone Compiler | 9 |
| 18 | `dna-alignment` | Deterministic DNA Alignment | 9 |
| 19 | `union-payroll` | Union Payroll Calculator | 9 |
| 20 | `lock-resolver` | Constraint-Aware Dependency Lock Resolver | 9 |
| 21 | `build-planner` | Dependency-Aware Build Planner | 9 |
| 22 | `committee-apportionment` | Committee Seat Apportionment | 9 |
| 23 | `content-routing` | Content Routing Engine | 9 |
| 24 | `event-window` | Event-Time Window Counter | 9 |
| 25 | `feature-flags` | Feature Flag Evaluator | 9 |
| 26 | `layered-config` | Layered Configuration Merger | 9 |
| 27 | `ranked-choice` | Ranked-Choice Election Tabulator | 9 |
| 28 | `stock-reservation` | Stock Reservation Engine | 9 |
| 29 | `trip-settlement` | Trip Expense Settlement | 9 |
| 30 | `webhook-scheduler` | Webhook Delivery Scheduler | 9 |

## Current strict vanilla/current workflow

`vanilla-current.py` samples ten tasks and compares Prime Agent 0.8.1 without extensions against the current Prime Context package. It uses an alternating paired queue, at most four active Docker jobs, and an exact 600-second deadline from the initial instruction. Containers and networks remain available until pair inspection.

Omit both `--tasks` and `--seed` for a fresh random-without-replacement sample:

```bash
uv run python benchmarks/vanilla-current.py \
  --round public-reproduction \
  --output .benchmark-runs/public-reproduction
```

Use `--seed` to replay a sample, `--tasks` for a focused regression replay, and `--exclude-tasks` only for tasks fixed in the immediately preceding iteration. Each output includes the manifest, per-arm metadata, strict acceptance result, recursive metrics, and aggregate summary. Authentication is copied at runtime and is never committed to this repository.

## Historical major-spec three-arm workflow

Use `major-spec.py` after each major implementation step. It samples three tasks once and runs the same tasks against:

1. `vanilla`: Prime Agent 0.8.1 with no extensions.
2. `published`: the same Prime Agent image plus `prime-agent-context@6.3.4`.
3. `progressive`: the vanilla image plus a package made from the current working tree.

Use `step-a` through `step-i` for the checkpoints in `prime-context-beast-mode-implementation-spec.md`. Omit both `--tasks` and `--seed` for each primary checkpoint so the runner records a fresh random three-task sample:

```bash
python benchmarks/major-spec.py \
  --step step-a \
  --output .benchmark-runs/major-spec/step-a
```

Each report renders all three paired comparisons: published versus vanilla, progressive versus published, and progressive versus vanilla. Efficiency is paired only across tasks completed by both arms and includes visible tool bytes as well as tokens, compactions, calls, cost, wall time, and cache reuse.

The reusable image tree is defined in [`docker/Dockerfile`](docker/Dockerfile):

```text
prime-context-benchmark:base-pa-0.8.1
└── prime-context-benchmark:vanilla-pa-0.8.1
    ├── prime-context-benchmark:published-6.3.4-pa-0.8.1
    └── prime-context-benchmark:progressive-current-pa-0.8.1
```

The base image installs Prime Agent with the official `curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh` flow, plus Node/npm, Python 3.11, uv, the complete Prime Agent IPython environment, every bundled Python skill (including `goal`), and the system tools needed by the 30 tasks. It then runs the idempotent [`patch-prime-agent.mjs`](docker/patch-prime-agent.mjs) against Prime Agent 0.8.1. This generic host patch exposes the effective `"parallel" | "sequential"` branch as `turn_end.toolExecution` and an awaited `TurnEndEventResult.messages` surface for ordered hidden custom messages. The nested agent core, Prime Agent extension runtime and declarations, and bundled CLI runtime all receive the same patch. All three arms inherit the same patched base, so the surface is a shared host capability rather than a progressive-only feature. The published layer runs `prime-agent package install npm:prime-agent-context@6.3.4`. The progressive tarball is unpacked at `/opt/prime-context` and installed with `prime-agent package install /opt/prime-context`. Each Prime Context arm loads that complete package root, including every declared extension, skill, prompt, and theme. Vanilla and published are rebuilt only when their pinned version or image revision changes. The progressive package is built and packed on each invocation, but Docker reuses every unchanged layer and replaces only its small plugin layer when the package changes.

The published baseline is pinned in `major-spec.json` as `npm:prime-agent-context@6.3.4`. Use `--seed` to make random selection replayable, or `--tasks 4,17,29` to replay exactly three task IDs.

For each selected task, all three variants run concurrently. The next task starts only after that triple finishes. Every task/variant arm gets:

- its own disposable Docker container and internal Docker network; a per-arm CONNECT relay permits only the required OpenAI and runtime HTTPS hosts and rejects all local, private, or unrelated destinations;
- a fresh work tree, home, config, auth copy, session tree, daemon socket, and Prime Context home;
- a fresh kernel process backed by the shared read-only preinstalled Python environment;
- a read-only container root and no mount of the project, host home, task pool, global Prime Agent state, historical capsules, memories, or another arm.

The containers share only immutable image layers, the selected task inputs, fixed runtime controls, the session policy, and credentials copied from the requested auth file. Before Prime Agent starts, every variant receives a private read-only global `/sandbox/config/AGENTS.md` copied from [`session-policy.md`](session-policy.md). Context-file loading is enabled for these arms, so Prime Agent loads the policy before the initial task prompt. No project or host `AGENTS.md` is mounted. The fixed controls are `openai-codex/gpt-5.6-sol` with `medium` thinking and a 1,200-second condition timeout.

Run the image, package, policy, and isolation preflight without calling a model. The preflight also checks patch idempotence and runs the direct non-bundled/bundled turn-boundary host smoke, then uses RPC `get_commands` to require `/pc` from the published and progressive extensions and require it to be absent from vanilla:

```bash
python benchmarks/major-spec.py \
  --step setup-preflight \
  --tasks 1,2,3 \
  --preflight-only \
  --output /tmp/prime-context-major-spec-preflight
```

The root `report.md` gives the user-facing result. `report.json` retains the structured three-arm comparison, selected seed and tasks, resolved package versions, correctness regressions, paired efficiency deltas, and release gate. Efficiency comparisons use only tasks completed by both compared variants. The primary gate compares progressive against published:

- `FAIL_CORRECTNESS`: any correctness regression.
- `WARN_EFFICIENCY`: correctness is retained, but one or more paired efficiency metrics worsen.
- `PASS`: no detected regression.
- `NO_COMPARABLE_TASKS`: no matched-correct task exists for efficiency comparison.

At startup and shutdown, the workflow removes benchmark-labeled disposable containers and networks. It keeps the active tagged base, vanilla, published, and progressive images. Superseded benchmark tags and dangling benchmark image layers are removed after reports are written or timed-out conditions are recorded.

## Historical two-arm runner

`run.py` preserves the original two-arm workflow for historical reproduction. It redirects each condition's working directory, configuration, home, sessions, daemon socket, and Prime Context archives, but it does not container-sandbox host filesystem or network access. Do not use it for the strict major-spec workflow; use `major-spec.py` above.

The runner executes vanilla and Prime Context concurrently for each task, then advances to the next task.

```bash
python benchmarks/run.py \
  --tasks 1-3,22 \
  --prime-agent-cli /path/to/prime-agent/package/dist/bundle/cli.js \
  --prime-context-source npm:prime-agent-context@8.1.0 \
  --output /data/benchmarks/pa-0.8.1-pc-8.1.0
```

`--prime-context-source` accepts an npm spec, a package directory, or a `.tgz`. The runner packs or extracts it once under the output directory. It also packs the Prime Agent package containing `--prime-agent-cli` and installs that package plus its resolved dependencies under `_frozen/prime-agent-host`. Both condition arms therefore use the same frozen host and extension contents for the cohort. To compare another Prime Agent version, unpack its release tarball and point `--prime-agent-cli` at that version's `dist/bundle/cli.js`.

Run one condition when needed:

```bash
python benchmarks/run.py --tasks 30 --condition vanilla \
  --prime-agent-cli /path/to/cli.js --output /data/benchmarks/task-30-vanilla
```

The default condition timeout is 1,200 seconds. Override it with `--timeout`. Authentication is copied at runtime from `~/.prime/agent/auth.json` by default; credentials are never written into this repository.

## Staging and correctness

The agent initially sees only `initial/`. The runner then:

1. Sends the baseline steering message after the first test invocation.
2. Injects the pivot files and prompt after the next compaction.
3. Injects the follow-up files after the first pivot test invocation.
4. Sends `REQUIREMENTS LOCKED` after the next compaction.
5. Requires the complete external suite, protected-file preservation, accepted interventions, exact final response, and goal completion after lock.

A timeout, early goal completion, missing intervention, modified protected file, or failed external test makes `task_completed` false. The exact final response is retained as a diagnostic because later Prime Agent cohorts exposed final-response capture anomalies even when the persisted goal and implementation were correct.

The pivot and follow-up tests are stage-hidden, not security-sandboxed secrets: they remain outside the condition work tree until injection, but a deliberately escaping agent could inspect the benchmark repository. Use an OS sandbox when evaluator secrecy is required.

## Metrics

Each condition writes `result.json`, each task writes `pair-analysis.json`, and the root writes lightweight `cohort-summary.json` plus the full `cohort.json`. They report:

- recursive input, output, cache-read, cache-write, and total tokens;
- recursive model calls, tool calls, child sessions, and compactions;
- elapsed condition wall time;
- summed API cost from authoritative session JSONL usage;
- prompt-cache reuse (`cacheRead / (input + cacheRead + cacheWrite)`);
- task completion and goal-after-lock status;
- passing and expected test counts;
- visible tool-result bytes and Prime Context archive size.

Every session JSONL below the isolated run root is identified by its session header and counted once. Child wall time is not added to the condition wall clock. The cohort summary includes aggregate condition metrics and Prime Context percentage deltas versus vanilla.

## Minimal runner checks

```bash
python -m unittest discover -s benchmarks/tests -p 'test_*.py'
python -m py_compile benchmarks/run.py
```

These checks do not call a model or require API credentials.
