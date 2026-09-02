# Python Real-World 30 benchmark

This directory implements `prime-context-python-realworld-30-benchmark-spec.md`.
It replaces the Docker synthetic corpus with 30 deterministic Python 3.12 tasks.
Candidate solutions and all fixture code use only the Python standard library.

## Layout

- `tasks.json` indexes the 30 scenarios.
- `tasks/<id>-<slug>/` contains `TASK.md`, `scenario.json`, `seed.py`, initial and staged payloads, and an external `judge.py`.
- `benchlib.py` contains deterministic setup, staging, metrics, and judge helpers.
- `run.py` is the one RPC runner for all tasks and variants.
- `bash-tool.mjs` is a neutral benchmark adapter that exposes the same isolated `bash` tool to all variants.

The runner creates a separate workspace, config directory, session directory,
Prime Context home, and process for every task/variant/attempt. It generates
future-stage payloads outside the workspace, injects them only after the prior
assistant turn is idle, makes task inputs read-only, and exposes only declared
editable paths. The agent tool allowlist contains only `bash` and, when the
extension provides it, `prime_context`; Prime Agent 0.9.1's persistent REPL tools are
disabled. The runner loads `bash-tool.mjs` identically for all variants so host tool
changes cannot alter the comparison. The adapter only forwards a command to the
generated Bubblewrap launcher and does not add variant-specific context behavior. A generated Bubblewrap shell exposes only the candidate workspace, Python 3.12 standard
library, and a small file-inspection/management command set. It hides the host repository,
judges, later stages, credentials, package managers, and all public network
interfaces. Runner-managed services are replicated inside its loopback
namespace. Judges run after the measured agent interval. Each judge rebuilds
clean main and edge fixtures and copies only declared candidate artifacts.

The host needs `bwrap` and Python 3.12. The runner never installs or updates
packages.

## Validate the corpus

```sh
python3.12 -E -S run.py --validate-only
```

## Run

Build current and prepare separate isolated stock and patched
`prime-agent@0.9.1` package trees first. Never point these options at the machine's
installed host. Vanilla uses the stock executable; current uses a copy changed only
by the packaged Prime Context patch. A published comparison may be supplied only
when that extension supports the same 0.9.1 host contract. Host paths are required
for the selected arms. The packaged patcher checks every site and rejects patched,
partially patched, or stock hosts in the wrong arm.
For a current-only
compatibility sample, run:

```sh
python3.12 -E -S run.py \
  --tasks 1,8,24 \
  --variants current \
  --provider openai-codex \
  --model gpt-5.6-sol \
  --thinking medium \
  --timeout-seconds 1200 \
  --group-size 1 \
  --max-workers 1 \
  --retry-failed 1 \
  --current-prime-agent /tmp/isolated/patched-prime-agent-0.9.1/dist/bundle/cli.js \
  --current-extension ../..
```

Each task is one three-instance comparison group (`vanilla`, `published`, and
`current`). At most two task groups, or six isolated agent processes, run at
once. A failed primary attempt can receive one diagnostic retry.
Both attempts are retained; correctness-first selection marks the better one
for comparisons without deleting or rewriting the primary record.

Each output root contains raw RPC events, a message transcript, stderr, service
logs, full session JSONL files, the final workspace, per-attempt judge output,
`results.json`, `summary.json`, and `SUMMARY.md`. Efficiency deltas are reported
only for task pairs where both variants reached strict progress level 5.

## Accounting

Each attempt retains RPC events, the transcript, session data, the final
workspace, judge output, and its result. Summaries report primary, selected, and
all retained attempts separately. Efficiency comparisons include only pairs
where both variants reach strict progress level 5.

For `current`, the runner sets `PRIME_CONTEXT_BENCHMARK_METRICS` to an
attempt-local file. Prime Context writes aggregate observational accounting for
`semantic-distill`, `task-scout`, `stall-recovery`, and `knowledge-compile`
calls. The runner combines their factual usage and cost with solver usage.
Frozen variants leave unavailable auxiliary and refinement fields as `null`;
they are never inferred. Provider prompt anchors count input, cache-read, and
cache-write tokens and exclude output tokens.
