# Python Real-World 30 benchmark

This directory implements `prime-context-python-realworld-30-benchmark-spec.md`.
It replaces the Docker synthetic corpus with 30 deterministic Python 3.12 tasks.
Candidate solutions and all fixture code use only the Python standard library.

## Layout

- `tasks.json` indexes the 30 scenarios.
- `tasks/<id>-<slug>/` contains `TASK.md`, `scenario.json`, `seed.py`, initial and staged payloads, and an external `judge.py`.
- `benchlib.py` contains deterministic setup, staging, metrics, and judge helpers.
- `prepare-hosts.py` installs the two pinned npm prefixes and applies the packaged host patch.
- `run.py` is the paired Prime Agent RPC runner for all tasks and variants.
- `run_codex.py` is the supplemental stock Codex CLI runner.
- `bash-tool.mjs` is a neutral benchmark adapter that exposes the same isolated `bash` tool, including optional per-command millisecond timeouts, to all variants.

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

Prepare fresh, separate npm prefixes. This installs vanilla `prime-agent@0.9.1`
in both arms, installs `prime-agent-context@9.2.0` only in the current arm, and
runs the installed patch command in this order: `--check-stock`, patch, and
`--check`. It writes a host manifest only after the vanilla tree passes the stock
check and the current tree passes the patched check.

```sh
python3.12 -E -S prepare-hosts.py --force
```

The setup uses the release tarball and the npm script policy from the public
9.2.0 installation procedure. Its npm prefix, cache, home, Prime Agent config,
and Prime Context home are arm-local. It does not read or modify a machine-wide
Prime Agent or Prime Context installation.

Run the full comparison with the fixed publication settings:

```sh
python3.12 -E -S run.py \
  --hosts-manifest ../../.benchmark-runs/hosts-pa091-pc911/hosts.json \
  --tasks all \
  --variants vanilla,current \
  --provider openai-codex \
  --model gpt-5.6-sol \
  --thinking medium \
  --timeout-seconds 1800 \
  --group-size 2 \
  --max-workers 6 \
  --retry-failed 1
```

Each wave contains three tasks in two flavors, for at most six isolated agent
processes. A non-strict primary receives one retry. When both primaries strictly
pass but current is not faster or cheaper, current receives one retry. There are
never more than two attempts for one task/variant. Both are retained, and
correctness-first selection chooses the published comparison attempt.

The metric gates are ordered as requested: completion/progress, agent elapsed
time, then billed API cost. Provider tokens remain supporting diagnostic data.
A comparison is publication-ready when current strictly passes all 30 tasks and,
for each task, either vanilla fails after its one allowed retry (a current
correctness win) or both variants strictly pass and current is faster and
cheaper. Efficiency is not compared on a task that current wins on correctness.

Each output root contains raw RPC events, a message transcript, stderr, service
logs, full session JSONL files, the final workspace, per-attempt judge output,
`results.json`, `summary.json`, and `SUMMARY.md`. A task-scoped contract fix
invalidates that task's comparison and requires a clean paired replacement.
Unaffected task results may be retained under the targeted-replacement protocol.
A global product or harness performance fix invalidates every task it can affect.

### Supplemental pure vanilla Codex CLI run

The independent Codex arm uses the installed stock `codex exec` CLI under an existing ChatGPT subscription login. The runner pins `gpt-5.6-sol` and medium reasoning effort, uses at most six sessions, and retries only an initial strict failure once:

```sh
python3 run_codex.py \
  --tasks 1-30 \
  --max-workers 6 \
  --retry-failed 1 \
  --timeout-seconds 1800 \
  --output results/20260904-codex0153-gpt56sol-all30-v1
```

This arm does not run Prime Agent or Prime Context. It starts every attempt in a fresh `/tmp` workspace, uses an empty isolated `HOME` and fresh run-scoped `CODEX_HOME`, copies only ChatGPT `auth.json` at startup, and passes benchmark messages on stdin. It strips API-key variables and uses `--ignore-user-config`, `--ignore-rules`, no custom system prompt, and no global or local `AGENTS.md`, `AGENTS.override.md`, or `.codex/config.toml`. Stock Codex built-in instructions remain. `workspace-write` uses the stock command-network proxy with only exact `127.0.0.1` allowed so the two loopback fixture tasks can run while other command destinations remain blocked.

Codex subscription token telemetry is diagnostic. The CLI exposes no actual per-run billed API charge, so billed cost is `N/A`. Any matched-rate API equivalent is clearly labeled as an estimate, not a bill. Codex turns are staged CLI turns and are not compared with Prime Agent model-call counts.

The full local run remains under `results/`. Curated publication evidence under `evidence/20260904-codex0153-gpt56sol-all30-v1/` retains invocation, aggregate and pairwise summaries, every attempt result, every public JSONL event stream, stderr, final messages, service/judge logs, and the exact runner. It excludes authentication state, Codex private rollout state, and bulky duplicated workspaces.

## Accounting

Each attempt retains RPC events, the transcript, session data, the final
workspace, judge output, and its result. Summaries report primary, selected, and
all retained attempts separately. Efficiency comparisons include only pairs
where both variants reach strict progress level 5.

For `current`, the runner sets `PRIME_CONTEXT_BENCHMARK_METRICS` to an
attempt-local file. Prime Context writes aggregate observational accounting for
`semantic-distill`, `task-scout`, `stall-recovery`, and `knowledge-compile`
calls. The runner combines their factual usage and cost with solver usage.
Vanilla leaves unavailable auxiliary and refinement fields as `null`; they are
never inferred. Provider prompt anchors count input, cache-read, and cache-write
tokens and exclude output tokens.
