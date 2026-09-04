# Pure vanilla Codex CLI benchmark evidence

This directory is the persisted publication subset of the full local run `benchmarks/python-realworld-30/results/20260904-codex0153-gpt56sol-all30-v1`.

- Run: 2026-09-04
- CLI: `codex-cli 0.153.0`
- Authentication: ChatGPT subscription
- Model: `gpt-5.6-sol`
- Reasoning effort: medium
- Maximum concurrency: 6
- Result: 30/30 strict passes; all on A1
- Cost: $31.447008

Start with:

- `invocation.json` for isolation and configuration;
- `summary.json` or `SUMMARY.md` for aggregate and per-task Codex metrics;
- `comparison.json` for Prime Context's correctness-first comparison with each vanilla baseline;
- `results.json` for every selected and retained attempt;
- each task directory for raw public Codex JSONL events, stderr, final messages, service/judge logs, and per-attempt results;
- `run_codex.py` for the exact adapter.

Authentication state, private Codex rollout state, and bulky duplicated workspaces are intentionally excluded. The full local run retains them outside version control. Cost uses the same matched rates as the other benchmark arms.
