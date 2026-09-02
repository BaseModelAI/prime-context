# Changelog

## 9.1.1 - 2026-09-02

### Installation repair

- Reorders the public setup flow so Prime Context is installed before invoking its packaged `prime-context-patch-agent` command.
- Uses the installed patch command directly instead of relying on a pre-install `npx` invocation.
- Documents the working npm `allowScripts` policy for the exact pinned Prime Agent release-tarball identity. npm's generated package-name approval does not match a remote tarball dependency and therefore repeats the warning.
- Corrects upgrades for version-pinned Prime Agent package sources, which are not changed by `prime-agent package update`.
- Runtime behavior and the Prime Agent 0.9.1 host patch are unchanged from 9.1.0.

## 9.1.0 - 2026-09-02

> **Interim release:** 9.1.0 is usable now and represents a major improvement, but the replacement benchmark and its reference points are still in progress. Results from the retired benchmark are retained as historical evidence and are not directly comparable with the new protocol.

### Major runtime upgrade

- Moves Prime Context onto the native Prime Agent 0.9.1 persistent REPL and Bash runtime while retaining the exact host surfaces required for finalized exchanges and purpose-aware projection.
- Hardens long-task continuity: assistant `stop` no longer resets the task root, arbitrary first output lines no longer become durable task facts, and provisional session accounting no longer creates a fake task.
- Keeps novel sub-24-KiB call bodies literal when there is no real admission pressure, including large Bash commands that must remain executable after projection.
- Routes project and parent search through exact recall, persists task state only after archive finalization, and keeps projection reuse tied to the exact structural epoch, tools, prompt contract, and usage anchor.
- Adds native `await bash(...)`, direct `rlm(...)`, `pytest.main()`, and `unittest` intent recognition, plus separate recovery of unattributed REPL background output.
- Ships a single explicit, idempotent, exact-version host patcher. No `postinstall` hook mutates Prime Agent.

### Interim benchmark result and reference reset

- Replaces the Docker/synthetic corpus with a hermetic 30-task Python 3.12 suite using isolated hosts, hidden future stages, fresh judge fixtures, loopback-only tool networking, and identical neutral Bash behavior across arms.
- Compared 9.1.0 with isolated copies of locally installed Prime Agent 0.8.1 plus Prime Context 8.1.1 on one frozen random sample of 12 tasks using `gpt-5.6-sol` at medium effort and at most six concurrent attempts.
- 9.1.0 achieved **10/12 selected strict passes** versus **9/12**, and **9/12 primary strict passes** versus **8/12**. Its accuracy tuple was never worse on any sampled task.
- Across nine matched strict pairs, 9.1.0 used **49.6% fewer provider tokens**, **31.7% less agent time**, and **31.8% less API cost**.
- Across every retained primary and diagnostic retry, it used **36.0% fewer tokens**, **27.4% less time**, and **26.4% less cost**.
- The frozen analyzer found zero correctness, individual-efficiency, or aggregate-efficiency regression candidates. Diagnosed failures were solver or candidate-implementation variance, so no result-invalidating product fix was required.
- Earlier benchmark scores remain in the changelog as historical progress markers only. Because tasks, isolation, judging, and reference points changed, those numbers are invalid as a current 9.1.0 comparison baseline. See `benchmarks/RELEASE-9.1.0.md`.

### Prime Agent 0.9.1 migration

- Retargeted the package, type augmentation, startup diagnostics, benchmark runner, and documentation from Prime Agent 0.8.1 to the exact Prime Agent 0.9.1 release artifacts.
- Audited the complete 0.8.1-to-0.9.1 upstream range. The public extension event surface used by Prime Context is unchanged; the main upstream work replaces the IPython-first kernel with the persistent REPL/bash runtime and restructures daemon session transport, recovery, and agent rosters.
- Adapted the explicit host patch to the 0.9.1 daemon readiness and attach call shapes and switched late bundle patches to semantic chunk discovery instead of a generated chunk filename.
- Kept the finalized-exchange, awaited hidden `turn_end`, purpose-aware model-context, exact entry-ref, compaction, usage-anchor, and refinement controls that stock 0.9.1 still does not provide.
- Retained the provider prompt-usage exclusion and the rest of the custom host contract; none of those behavioral hooks were upstreamed.
- Removed the patcher's obsolete optional mutation of a sibling Prime Context bundle. The patcher now changes only the exact host passed to it.
- Installs the exact Prime Agent 0.9.1 runtime packages from their pinned upstream release tarballs, because matching registry peer versions do not exist; plain npm and Prime Agent package installs no longer fail with `ETARGET` or silently select an incompatible registry peer.
- Preflights every host transformation in memory before writing any file. The documented flow now checks the stock contract, patches, and verifies the final contract.
- Package smoke copies an explicit or repository-local pristine Prime Agent root into a disposable host, resolves dependencies only from that host, and never mutates or falls back to a global installation.
- Updated the hermetic Python benchmark runner to require explicit isolated executable paths, use the packaged patcher's full stock/patched contract checks, reject partially patched hosts, and preserve native Bash failure semantics in the neutral adapter.
- Recognizes native REPL `await bash(...)` calls, including literal `command=...`, for validation and workspace mutation tracking, and archives unattributed REPL `backgroundOutput` as a separate typed part. Legacy `%%bash` classification was removed because 0.9.1 rejects magic cells.

## 8.1.1 - 2026-08-30

### Ranked context architecture

- Added an explicit, packaged, idempotent `prime-context-patch-agent` command pinned to `prime-agent@0.8.1`; installation never patches the host automatically.
- Uses authoritative finalized exchanges in assistant source order, including original and executed input, final replaced results, typed parts, and usage.
- Commits each finalized exchange batch to the archive once and installs the returned fixed views directly.
- Reuses provider projections only for an exact entry-ID prefix in the same semantic epoch.
- Patches Prime Agent to cache the complete provider-bound next-request estimate: effective system prompt, active tool definitions, and budget-projected messages.
- Replaced plugin-generated lossy folds with host-owned compaction and tree summaries; legacy fold controls are excluded rather than applied.
- Returns recovered text and images directly as persistent message content; removed transient recovery leases and show-once media bookkeeping.
- Imports user Bash output only from the dedicated `user_bash_end` event.

### Descriptive state, skills, and bounded inference

- Added bounded `TaskSnapshotV2` objective, constraints, focus, open items, observations, artifacts, and sparse updates without inferred completion gates.
- Added native skill-resource discovery plus frozen library validation, deterministic ranking, direct injection, and a zero-call high-confidence path.
- Added a bounded utility-gated auxiliary broker with registered model resolution, strict parsers, factual accounting, and one-shot task-scout, semantic-distill, stall-recovery, and knowledge-compile execution.
- Added `/pc learn --topic <text> [--from <session-file>]...` for one bounded selected-episode compilation and at most one validated current pattern/skill upsert. Changes activate after reload.
- Added narrowly gated nonblocking post-task learning after authoritative feedback and a strong reuse signal.
- Removed semantic outcome-label repetition, kept exact subject-scoped repetition, and uses a single bounded stall-recovery hint after a confirmed repeat.
- Disabled Prime Agent automatic refinement while Prime Context is active.

### Configuration and distribution

- Added `auxiliaryMode`, `auxiliaryModel`, `libraryPath`, `skillBudgetTokens`, `learningModel`, and `autoLearn` configuration.
- Package smoke verifies the packed extension, packaged patch command, patched host contract, and `--check` behavior.
- Benchmark implementation and reporting are intentionally deferred to a separate release task.

## 8.1.0 - 2026-08-29

> **Cumulative upgrade note:** this entry describes the complete change from the public 6.3.4 baseline to 8.1.0. It includes the Prime Agent 0.8.1 alignment first released as 6.3.5 and the full context-virtualization implementation developed afterward. This is a major architecture release, not a small iteration on the old output pager.

### Executive summary

Prime Context 8.1.0 changes the extension from a result-oriented compression layer into a branch-aware context runtime. It now observes complete tool exchanges, understands execution and validation semantics, stores exact multipart evidence, keeps raw session history intact, and creates a separate stable working set for the model. Long tasks retain their objective, requirements revision, workspace revision, validation state, failures, open items, and exact recoverable evidence across tool-heavy turns, compaction, tree navigation, and recursive child sessions.

The release also adds a global no-verification-theater/KISS system policy, a strict 30-task evaluation corpus, a retained vanilla/current runner, and a version-pinned Prime Agent 0.8.1 host-contract patch required by the full projection pipeline.

### At a glance: 6.3.4 versus 8.1.0

| Area | 6.3.4 behavior | 8.1.0 behavior |
|---|---|---|
| Model context | Primarily reduced oversized visible tool results | Projects complete call/result exchanges into a purpose-aware working set |
| Persisted history | Tool output handling and model view were closely coupled | Raw session history remains intact; provider projection is temporary and separate |
| Tool understanding | Mostly output- and command-text-oriented | Execution-aware typed intent, resources, mutation, validation identity, and factual outcomes |
| Task state | Compact snapshot and dynamic task tail | Branch-scoped runtime, durable task anchor, state checkpoint, revisions, diagnostics, gates, and readiness |
| Archive format | Ordinary full-text observation storage | Multipart exchange envelopes, typed parts, line-aligned gzip chunks, media, and pageable call fields |
| Repeated output | Pass-through, structured capsule, or one delta | Immutable completed views, subject-scoped deltas, multiple change hunks, and utility-aware budgets |
| Compaction | Primarily relied on the host's normal context | Shared projection for provider, compaction, tree summary, and refinement, plus deterministic fast paths |
| Long-context reduction | Repeated local reductions | Stable fixed views and rare immutable prefix-fold generations |
| Recovery | Direct list/read/search of current observations | Part-addressable inspect, deterministic recall, task/session/parent/project scopes, and one-response leases |
| Media | Tool images could remain expensive in repeated context | Exact media archive, show-once semantics, bounded recovery, and placeholders afterward |
| Recursive work | Limited cross-session context | Direct-parent recall, exact-cwd project recall, fork import, and bounded child task anchors |
| Observability | Basic broker/status metrics | Archive, projection, recovery, fold, reload, recursive cost, token, and cache economics |

### Compatibility and required Prime Agent host contract

- The package version moves from the 6.x line to **8.1.0** and targets **Prime Agent 0.8.1** and Node.js `>=22.8.0`.
- Carries forward the 6.3.5 baseline update from Prime Agent 0.8.0 to 0.8.1 and its recursive accounting of descendant delegation cost after Prime Agent raised the default RLM depth.
- Full 8.1.0 behavior requires the version-pinned host patch published in the GitHub source as `scripts/patch-prime-agent.mjs`.
- The patch adds runtime surfaces that stock Prime Agent 0.8.1 does not provide:
  - a purpose-aware `model_context` event for provider, compaction, branch-summary, and refinement projections;
  - exact message-to-session-entry references;
  - awaited hidden custom messages returned from `turn_end`;
  - the effective parallel/sequential tool-execution mode on `turn_end`;
  - the bundled and nested-agent plumbing needed to preserve those results through the active run.
- The patch is idempotent, accepts only Prime Agent 0.8.1, checks each exact patch site, and fails instead of guessing when the installed host differs.
- The host patch was installed identically in benchmark vanilla and Prime Context arms. It was shared infrastructure; the only paired product difference was whether Prime Context was loaded.
- The npm 8.1.0 tarball contains the extension, README, changelog, and license. The host patch is distributed in the GitHub source, so installation requires cloning the repository before applying the patch.
- Reinstalling or updating Prime Agent may overwrite the patch; rerun the patch and `--check` command afterward.
- The npm package name remains `prime-agent-context`.

### Complete exchange lifecycle and deterministic turn reduction

- Added a first-class exchange tracker that correlates:
  - model-authored tool calls;
  - the actual executed tool input;
  - execution-start metadata;
  - provisional public tool results;
  - authoritative results persisted at `turn_end`;
  - assistant source order and completion state.
- Each completed exchange now receives a stable exchange ID and typed metadata rather than being treated as an isolated output string.
- Parallel tool batches are reduced in assistant source order after all results are known. Sequential batches advance revisions after each successful mutation.
- Validation in a parallel batch observes the base workspace revision; validation in a sequential batch observes prior successful mutations from the same batch.
- Captures both the model-visible call and executed call so shell wrapping, argument transformation, and host adapters cannot silently change the semantic record.
- Reconciles persisted call/result payloads at the turn boundary and records whether either changed after an earlier hook.
- Defers final semantic admission until `turn_end`; partial and out-of-order hook events no longer advance task readiness prematurely.
- Freezes file-backed Bash output when execution completes so later file changes cannot alter the archived evidence.
- Preserves replay-sensitive signed, encrypted, or opaque metadata literally when safe reconstruction is impossible.
- Excludes Prime Context's own recovery calls from ordinary observation archiving to prevent recursive self-compression.

### Execution-aware tool adapters

- Added direct adapters for Prime Agent `bash`, `edit`, `ipython`, the `prime_context` tool, and generic custom tools.
- Bash handling now understands:
  - Bash and Zsh execution;
  - command chains, pipelines, redirection, and heredocs;
  - Python, Node, shell, and executable test runners;
  - typed complete-output files supplied by Prime Agent;
  - stdout, stderr, exit status, timeout, and command facts.
- IPython handling now understands:
  - normal Python code;
  - executable `%%bash` cells;
  - subprocess-based validation;
  - `Path.write_text(...)` and `Path.write_bytes(...)` mutations;
  - literal and persistent-kernel path expressions.
- Edit handling records changed resources and archives oversized old/new bodies separately instead of retaining huge edit calls in every model turn.
- Generic tools receive conservative intent, resource, mutation, and factual-outcome handling instead of being forced through shell-specific assumptions.
- Path-valued subprocess arguments such as `str(root / "run_tests.py")` resolve to the same validation suite as their direct command form.
- Direct IPython writes advance the workspace revision even when a persistent expression cannot be statically resolved; literal paths also attach normalized resources.

### Branch- and task-scoped semantic runtime

- Replaced mutable global workflow state with a bounded full replacement runtime snapshot scoped to the selected branch and task.
- Added deterministic task selection from session structure, active goals, root user entries, and child-session context.
- Resets runtime state before loading another branch so stale requirements, validations, diagnostics, or folds cannot leak across tree navigation.
- Tracks requirements revision and workspace revision independently.
- Records modified resources with the workspace revision that produced them.
- Replaced the old “largest test total wins” heuristic with explicit validation identities:
  - suite family;
  - target/scope;
  - command identity;
  - test count and result;
  - requirements/workspace revision;
  - turn sequence.
- Smaller focused checks no longer replace the largest cumulative acceptance suite.
- Later requirements changes make older validation stale even when the workspace did not change.
- Later mutations make earlier validation stale even when the requirements did not change.
- Added active diagnostics that survive failed checks and become “awaiting rerun” after a relevant mutation.
- Successful validation clears diagnostics for its own suite without erasing unrelated failures.
- Requirements lock is monotonic and accepted only from a leading declaration in the complete user message; quoted or incidental text cannot lock the workflow.
- Staged readiness now distinguishes command-clean, stage-clean, and goal-ready states.
- Goal readiness requires a current cumulative post-lock pass and no later decisive failure.

### Durable cache-stable control plane

- Replaced the disappearing dynamic task tail with typed hidden control messages.
- Added one durable task anchor containing only missing, task-defining information:
  - objective and task identity;
  - acceptance requirements;
  - relevant child deliverables and parent references;
  - bounded focus and open work.
- Added small state checkpoints after meaningful workflow changes rather than replaying a full volatile state dump every turn.
- State checkpoints include requirements/workspace revisions, lock state, latest and cumulative validation, active diagnostics, and readiness.
- Control messages are omitted when the same exact state is already visible.
- After compaction or branch changes, missing control state is reconstructed from persisted runtime snapshots rather than inferred from an incomplete transcript.
- Goal-context repeats, unchanged idle polls, and oversized IPython name inventories are compacted in the model view without changing Prime Agent scheduler or kernel state.
- Focus, open items, completed items, and pinned observations remain bounded and branch aware.
- `/pc mode off` disables archive/projection behavior for the current session but intentionally does not remove the bundled global system policy.

### Multipart exact observation envelopes

- Introduced the `prime-context.exchange/v2` multipart envelope: one envelope per completed exchange rather than one undifferentiated text blob.
- Stores call arguments, result text, stdout, stderr, traceback, diffs, and media as addressable parts with typed metadata.
- Preserves exact public evidence locally while allowing each part to receive an independent model-facing representation.
- Records source kind, visible bytes, source bytes, line counts, media type, dimensions, archive references, and replay protection.
- Oversized call fields are independently pageable:
  - edit old/new aggregates over 4 KiB;
  - Bash/IPython fields over 8 KiB;
  - generic strings or JSON subtrees over 8 KiB.
- Projected calls use explicit `<archived-call ...>` markers that retain the exact part reference needed for recovery.
- Existing legacy observation records remain minimally readable while all new writes use the multipart format.

### Streamed, bounded archive storage

- Replaced whole-file handling for large artifacts with streamable sources and bounded-memory processing.
- Text is written in line-aligned **256 KiB gzip chunks** with sidecar metadata for exact paging.
- Sources above **1 MiB** switch to bounded streaming summarization; ordinary admitted text still uses the same exact chunk store.
- Archive finalization is independent from the synchronous turn-boundary control result, reducing model-loop latency.
- Large Bash complete-output sources are frozen before admission and streamed without rereading the whole artifact into memory.
- Catalog and envelope updates avoid rewriting a single growing central index for every part.
- Archive reads, fixed-string searches, inspection, recall, and fork import work directly from local JSON envelopes and compressed parts.
- Small novel pass-through output is intentionally not archived; only admitted observations can later be recovered through Prime Context.
- Exact content comparison remains hash-free.
- Storage remains local under the Prime Context session root, with optional `PRIME_CONTEXT_HOME` relocation and explicit cleanup.

### Immutable complete-exchange projection

- Provider context now virtualizes both historical calls and results for completed exchanges.
- The first completed representation is frozen into a fixed exchange view; later turns do not continually recompute a different summary for the same evidence.
- Raw session entries are not rewritten. Prime Context builds a temporary model view immediately before the relevant host operation.
- Fixed views can contain:
  - literal compact calls/results;
  - archived call-field markers;
  - structured result capsules;
  - typed delta capsules;
  - media descriptors;
  - replay-protected literal data.
- Added an aggregate first-exposure budget so one parallel tool batch cannot flood the next model request even when each individual result is under its local threshold.
- Fixed-view budgets adapt to context pressure: approximately 24 KiB below 60% use, 16 KiB above 60%, and 8 KiB above 80%.
- Stable projection generations are measured and reused when the visible prefix and fold generation remain unchanged.
- Model-irrelevant typed details are removed from provider messages while exact typed data remains in the archive.
- User `!` Bash entries receive reconstructed fixed views when Prime Agent exposes their complete public output.

### Smarter observation broker and capsules

- Kept the three useful outcomes—pass-through, structured capsule, and delta—but rebuilt their admission around typed exchange facts.
- Short, novel, decision-useful output still passes through.
- The normal broker admission threshold remains 24 KiB. Large, repetitive, trace-heavy, verbose-usage, or semantically repeated output can become a bounded capsule earlier when compression has useful token return on investment.
- Failure capsules preserve decisive evidence:
  - recognized terminal/test summary;
  - all detected failing-test IDs;
  - direct exception messages;
  - source locations;
  - exit/timeout status;
  - relevant factual outcomes.
- Subject keys now come from tool intent, resources, suite identity, and typed facts rather than the first informative output line.
- Repeated file/tool subjects can produce several bounded changed hunks instead of a single fragile textual delta.
- Clean test results, failing test sets, exceptions, paths, and command failures are normalized before comparison.
- Counted test outcomes are accepted only from result-shaped runtime lines; requirements or source code that merely mention phrases such as `1 failed` are not mistaken for executed tests.
- Trace-only capsules avoid low-value recovery hints and recommend rerunning a filtered source command when exact trace content would be more useful.
- Capsule budgets adapt from observed recovery utility while remaining bounded.
- Poor-ROI failure or delta capsules can pass through instead of optimizing compression ratio at the expense of follow-up reasoning.
- Workflow commands and internal control text are kept out of ordinary observation capsules.

### Shared purpose-aware projection and immutable folds

- Added one projection engine for four host purposes:
  - provider inference;
  - automatic compaction;
  - branch/tree summaries;
  - continual-harness refinement input.
- Compaction and tree preparation can consume the same fixed exchange views used by the model instead of summarizing the large raw tool payload again.
- Added narrow deterministic compaction/tree fast paths when entry identities, roles, media, and fold boundaries can be represented exactly.
- Fast paths fail closed: unsafe, opaque, ambiguous, or unsupported content falls back to Prime Agent's normal behavior.
- Structural boundaries reload branch-scoped runtime and fixed views before the next provider projection.
- Added rare immutable prefix-fold generations for high-pressure sessions.
- Fold creation begins only above meaningful pressure (normally 65%), keeps the latest four turn starts hot, and requires roughly 8,000 saved tokens or 15% estimated savings.
- Fold selection:
  - starts only after meaningful context pressure;
  - keeps the recent hot turns visible;
  - requires substantial estimated savings;
  - retains pinned, modified, failing, validation, and task-defining evidence;
  - never continuously rewrites a “latest-only” summary.
- Unsafe or opaque entries remain exact instead of being forced into a fold.

### Part-addressable recovery and deterministic recall

- Retained direct `list`, `read`, `search`, `status`, and `update` actions.
- Added `inspect` for exact part-level access:
  - result/call bodies;
  - JSON-pointer call fields;
  - stdout/stderr/traceback;
  - diffs;
  - archived media references;
  - line, byte, and fixed-query pages.
- Added deterministic embedding-free `recall` ranked by explicit ID, query, path, subject, kind, tool, status, and scope.
- Recall scopes include:
  - current task;
  - current session;
  - direct parent session;
  - other local project sessions with the exact normalized working directory.
- Historical evidence is never injected automatically; the model or user must request it.
- Recovery uses a one-successful-response lease: exact requested content appears in the next provider view once, while persisted history retains only a compact receipt.
- Recovery utility records whether exposed evidence contributed to later work and informs future bounded capsule budgets.
- Model-facing recovery remains capped at 12 KiB, 80 lines, 10 matches, and 20 listed observations even when the human `/pc` budget is larger.
- Snapshot updates support bounded focus, open items, completion, and pin/unpin operations.

### Tool-generated media and typed attachments

- Archives exact tool-generated image and attachment parts rather than flattening them into text.
- Provider-displayable PNG, JPEG, GIF, and WebP images up to 8 MiB are shown once after successful generation.
- Later turns use a compact inspectable descriptor rather than resending the same base64 payload.
- Unsupported or oversized media fails closed to a textual placeholder with an exact archive reference.
- Recovered images can be leased into one provider response using the same transient-recovery mechanism.
- User-authored images remain under Prime Agent's normal handling and are not paged by Prime Context.
- Signed or otherwise opaque replay metadata stays literal when transformation could invalidate it.

### Branching, forks, and recursive child sessions

- Observation metadata includes branch anchor, task key, goal ID, turn sequence, and relevant revisions.
- Session start restores only fixed views that are visible on the selected branch.
- Tree navigation resets and reloads runtime before reconstructing the provider working set.
- Fork handling imports visible and pinned parent evidence instead of copying the entire archive.
- Child sessions receive bounded task anchors with deliverable paths, constraints, and explicit direct-parent references.
- Direct-parent and exact-working-directory project recall are explicit and local; no remote sync or automatic cross-session injection was added.
- Prime Context does not launch children or change Prime Agent scheduling/delegation policy.

### Metrics and success-adjusted context economics

- Expanded `/pc status` and `prime_context status` with bounded session totals for:
  - archived source and compressed bytes;
  - projected call, result, typed/media, and current provider-view bytes;
  - streaming work;
  - transient recovery exposure and usefulness;
  - inspect and recall hits;
  - fold generations;
  - runtime reloads;
  - recursive model calls, tokens, cost, and compactions;
  - cache-read, cache-write, and uncached input tokens;
  - turns that extend a stable projection generation.
- Correctness remains the first acceptance gate. Wall time, cost, compactions, tokens, calls, and cache behavior are compared only after required completion succeeds.
- Visible byte reduction is treated as a mechanism diagnostic, not a success metric by itself.
- The implementation avoids a new ledger, remote telemetry service, or alternate scheduler; metrics summarize the existing local session and archive.

### Global system-prompt policy

- Added `src/policy.ts` with the bundled **Absolute Prohibition: No Verification Theater / Proof Boilerplate** policy.
- The policy is appended to Prime Agent's fully assembled system prompt through `before_agent_start`.
- An exact existing copy is detected and not appended twice.
- It applies without requiring a global or project `AGENTS.md`.
- It remains active for ordinary runs, autonomous continuations, and after compaction.
- Policy injection is intentionally independent from projection mode; `/pc mode off` does not remove it.

### Lifecycle, adapter, and correctness fixes completed before release

- Fixed executable validation detection for Python scripts, shell scripts, Bash/Zsh cells, redirected shell output, subprocess path expressions, and project-relative test runners.
- Fixed persisted intent and validation-suite identities when the executed input differs from the model-authored call.
- Fixed direct IPython file writes failing to advance workspace revision.
- Fixed reverse-completing parallel tools so semantic reduction and archive admission remain in assistant source order.
- Fixed file-backed result races by freezing bytes before later commands can modify the source file.
- Fixed branch reload, fork import, compaction, and tree-navigation gaps that could leave stale fixed views or task state active.
- Fixed image MIME filtering, show-once consumption, unsupported media placeholders, and recovered-image leases.
- Fixed call/result archive references and exact byte/line paging across long single-line and multibyte content.
- Fixed user Bash view reconstruction and exclusion of host entries marked out of context.
- Fixed state/fold/recovery control messages so they appear only when semantically changed.
- Fixed source text containing test-like prose from becoming a false workflow success or failure.
- Bundled the runtime `diff` dependency into `dist/index.js`, eliminating packed-install failures such as `Cannot find module 'diff'`.

### Commands and configuration

The human command surface remains compatible and now reports the richer runtime:

- `/pc status`
- `/pc list [limit]`
- `/pc read <observation-id> [start:end]`
- `/pc search <observation-id|all> <fixed text>`
- `/pc focus <text|clear>`
- `/pc add <text>`
- `/pc done <item-id>`
- `/pc pin <observation-id>` / `/pc unpin <observation-id>`
- `/pc mode on|off`
- `/pc cleanup current`
- `/pc doctor`

The model-facing `prime_context` actions are `list`, `read`, `search`, `inspect`, `recall`, `status`, and `update`.

Configuration remains deliberately small and backward compatible:

```json
{
  "enabled": true,
  "minTextBytes": 24576,
  "capsuleMaxBytes": 6144,
  "readMaxBytes": 65536
}
```

- Project configuration overrides global configuration field by field.
- Invalid fields use package defaults and produce a once-consumed `/pc doctor` warning.
- Configuration is loaded at session start.
- Mode changes are in-memory for the current session.
- Archives remain local and require explicit cleanup.

### Benchmark and evaluation infrastructure

- Added a self-contained 30-task realistic Python corpus with deterministic initial, pivot, follow-up, and final-lock stages.
- Each task contains exact prompts, protected files, expected final response, standard-library fixtures, and a cumulative nine-test acceptance suite.
- Added the original two-arm reproduction runner with frozen host/package inputs and recursive usage/cost/cache metrics.
- Added a three-arm major-spec workflow comparing vanilla, a published Prime Context baseline, and the progressive working tree on the same sampled tasks.
- Added reusable Docker image layers for Prime Agent, vanilla, published, and progressive variants.
- Added isolated per-arm workspaces, homes, configuration, session trees, daemon sockets, Prime Context storage, read-only roots, and restricted outbound network relays.
- Added package/host/image preflight checks and Bash/Zsh package smoke against Prime Agent 0.8.1.
- Loaded the same private read-only benchmark session policy before every arm's initial task prompt, without mounting host or project context files.
- Reused complete bundled Prime Agent image layers and skipped the unused published-baseline stage in progressive-only builds.
- Added explicit Step A through Step I checkpoints matching the consolidated implementation specification.
- Added cleanup of round-owned containers, networks, superseded tags, and dangling benchmark layers while preserving reusable and unrelated Docker state.
- Added the final strict vanilla/current runner:
  - fresh random sample of ten eligible tasks when `--tasks` and `--seed` are omitted;
  - alternating adjacent vanilla/current queue entries;
  - maximum four active Docker jobs;
  - exact 600-second deadline from initial instruction delivery;
  - retained completed containers and networks until all pairs are inspected;
  - explicit task exclusions for the immediate post-fix round;
  - strict correctness before efficiency comparison.
- Strict correctness requires both the task protocol and exact final response; a timeout, active goal, missing intervention, protected-file change, failed cumulative suite, wrong response, or run error cannot become an efficiency win.
- Staged test detection now accepts only anchored runtime `TEST_RESULT PASS|FAIL n/n` lines and deduplicates terminal tool events.
- Compaction boundaries advance only after a successful compact response or later authoritative completion event.
- “Session too short to compact” now grows the session with a neutral no-tools turn before retrying instead of releasing the next stage incorrectly.
- The runner waits for the model's actual exact final response after goal completion rather than synthesizing or projecting one.
- Experimental local Prime Agent daemon transport changes were investigated, isolated, and then removed from the Prime Context product history; no transport patch is shipped as a Prime Context feature.

### Final benchmark outcome used for the release decision

The accepted final round used the same patched Prime Agent 0.8.1 host in both arms, `openai-codex/gpt-5.6-sol` at medium effort, an exact 600-second limit, and a random ten-task sample from 28 eligible tasks.

- Strict completion: **Prime Context 10/10 versus vanilla 8/10**.
- Correctness gains: **2**; correctness losses: **0**.
- Across the eight matched-correct pairs:
  - wall time: **−21.24%**;
  - model calls: **−21.64%**;
  - compactions: **−20.45%**;
  - tokens: **−18.47%**;
  - reported API cost: **−17.46%**;
  - tool calls: **−1.46%**;
  - cost was lower in **8/8** matched-correct pairs.
- Across all ten tasks, including two vanilla timeouts:
  - wall time: **−28.73%**;
  - model calls: **−39.86%**;
  - compactions: **−27.27%**;
  - tokens: **−38.24%**;
  - reported API cost: **−26.98%**;
  - cost was lower in **10/10** pairs.
- The release suite contained **106 TypeScript tests** plus **14 benchmark-runner tests**, typecheck/build, and packed Bash/Zsh smoke.
- These figures describe one model, effort level, seed, task cohort, timeout, and patched host contract; they are release evidence, not a universal claim for every workload.

### Packaging, documentation, and public source

- Bumped `package.json` and `package-lock.json` to 8.1.0.
- Continued publishing the built ESM extension from `dist/index.js` with declarations in `dist/index.d.ts`.
- Added the runtime `diff` dependency to the bundle rather than relying on the host's module resolution.
- Expanded package smoke to exercise the packed artifact, public extension ABI, archives, projections, recovery, lifecycle behavior, and Bash/Zsh environments.
- Added a comprehensive README with architecture, strongest benchmark results, install/patch procedure, commands, configuration, storage, compatibility, autonomous-mode behavior, development, and limitations.
- Added GitHub repository metadata, npm homepage, issue URL, release tag, and public-source topics.
- Published a clean public source snapshot without local Git history, credentials, personal paths, private benchmark reports, or machine-specific files.
- Made all retained legacy benchmark runners portable by deriving the project root from their file location and the Prime Agent home from `Path.home()`.

### Deliberate boundaries retained in 8.1.0

- No remote archive service or cross-machine synchronization was introduced.
- No encryption layer, cryptographic content addressing, or hash-based equality system was added.
- No automatic archive deletion was added; cleanup remains explicit.
- No full-text index, regex search, fuzzy search, or embedding service was added; search and recall remain deterministic and bounded.
- No automatic historical-memory injection was added; recall must be explicitly requested.
- No scheduler, heartbeat, goal, or delegation behavior is replaced by Prime Context.
- No child agent is launched automatically.
- No general tool-specific parser framework was added; unsupported tools use conservative generic handling.
- No claim is made that every short pass-through result can later be recovered; small novel output is intentionally left only in the raw session.
- No claim is made that the npm extension alone provides the missing Prime Agent runtime hooks; the documented host patch is required.

### Upgrade guidance from 6.3.4

Apply and verify the required host contract from the cloned source:

```bash
node scripts/patch-prime-agent.mjs "$(npm root -g)/prime-agent"
node scripts/patch-prime-agent.mjs --check "$(npm root -g)/prime-agent"
```

1. Install Prime Agent 0.8.1 and Node.js 22.8 or newer.
2. Clone the public Prime Context source.
3. Run the version-pinned host patch against the installed Prime Agent root and verify it with `--check`.
4. Install `prime-agent-context@8.1.0` from npm, or build and install the cloned source.
5. Start a new Prime Agent session and run `/pc doctor` followed by `/pc status`.
6. Existing local archives can remain in place; new observations use the multipart exchange format and legacy records remain minimally readable.
7. Reapply the host patch after reinstalling or updating Prime Agent.
8. To disable the bundled global system policy, remove the package; projection mode alone does not disable policy injection.

## 6.3.5 - 2026-08-26

- Update the development and package-smoke baseline from Prime Agent 0.8.0 to 0.8.1; the extension hooks and Bash output contract used by Prime Context remain unchanged.
- Apply the positive delegation threshold recursively now that Prime Agent defaults new sessions to RLM depth 2, counting all descendant cost before a nested launch.

## 6.3.4 - 2026-08-24

- Replace oversized generated IPython name inventories with a compact count and focused lookup hint before model calls, while keeping the persistent kernel untouched.
- Keep only the newest IPython state notice and normalize volatile observation IDs in unchanged idle-poll detection.
- Cap model-facing archive recovery at 12 KiB, 80 read lines, 10 search matches, and 20 listed observations; retain the configured larger budget for human `/pc` commands.

## 6.3.3 - 2026-08-24

- Coalesce repeated Prime Agent `goal_context` prompts and consecutive unchanged idle polling turns before each model call, keeping only the current prompt and meaningful state transitions.
- Scope recovery to the active goal or current user turn, and enable staged workflow guards only for explicitly staged work, preventing old session requirements from being replayed into unrelated tasks.
- Keep Prime Agent's scheduler and UI unchanged; this release stops redundant continuation history from consuming model context and triggering needless compaction.

## 6.3.2 - 2026-08-22

- Update the development and package-smoke baseline from Prime Agent 0.7.4 to 0.8.0.
- Confirm the existing Prime Context extension hooks remain compatible; Prime Agent 0.8.0 only adds an optional refinement hook to the public extension API used here.

## 6.3.1 - 2026-08-21

- Update the development and package-smoke baseline from Prime Agent 0.7.3 to 0.7.4.
- Confirm the public extension API used by Prime Context is unchanged; no runtime behavior change is required.

## 6.3.0 - 2026-08-20

- Keep later staged edits incremental: patch only changed sections instead of rewriting unchanged file bodies.
- Reduce assistant edit payloads that remain in conversation history and can raise output and fresh-input cost.
- Preserve the 6.2.0 delegation threshold, workflow gates, and cache-local prompt layout.

## 6.2.0 - 2026-08-20

- Define the positive delegation threshold instead of only prohibiting redundant review children.
- Work locally for one package or serial critical path.
- Delegate only independent concurrent work with a distinct deliverable when expected parent-work savings exceed launch, context reconstruction, and reply-integration cost.
- Prevent multiple children from reviewing the same files or tests.

## 6.1.0 - 2026-08-20

- Add one compact single-package delegation guard after 6.0.0 launched three redundant review children on each of its first two rebenchmark tasks.
- Keep review, design, requirements reconstruction, and audit work local when it covers the same files and tests.
- Retain 6.0.0 prompt-tail cache locality and compact workflow state.

## 6.0.0 - 2026-08-20

- Move volatile workflow context to the prompt tail so readiness updates preserve the cacheable conversation prefix.
- Replace the 5.x policy/contract prompt with compact workflow state and bounded exact recovery of missing user instructions.
- Restrict workflow-bearing test outcomes to whole result-shaped lines and keep generic command errors from invalidating a passing cumulative suite.
- Remove progression deltas that discarded novel composite output; repetitive capsules now keep an informative non-trace head.
- Remove Prime Context delegation policy and leave recursive scheduling to Prime Agent.

## 5.4.0 - 2026-08-20

- Recognize counted test outcomes only on result-shaped lines.
- Preserve requirement and source text containing prose such as `1 failed/cancelled` instead of manufacturing failure deltas.
- Retain pytest-style summaries such as `1 failed, 8 passed in 0.10s` and their cumulative test total.

## 5.3.0 - 2026-08-20

- Make the `GOAL_READY` action exact: `Call await goal.complete() now`.
- Tell the agent not to inspect the goal API after readiness is established.

## 5.2.0 - 2026-08-20

- Make valid `GOAL_READY` an immediate completion instruction.
- Tell the agent not to read source, reconstruct requirements, run probes, or rerun an unchanged suite after current cumulative post-lock success unless new evidence appears.

## 5.1.0 - 2026-08-20

- Admit the consolidated requirement contract only when at least one branch requirement message is no longer visible.
- Avoid duplicating visible APIs, invariants, additions, and protected paths while retaining workflow state, delegation policy, and known failures.
- Restore the complete contract automatically after compaction hides any staged instruction.

## 5.0.0 - 2026-08-20

- Add a deterministic, first-class workflow tracker for requirements revision, monotonic lock, latest test, cumulative suite, and goal readiness.
- Accept `REQUIREMENTS LOCKED` only as a leading declaration of the complete user message; quoted, inline, and later-line occurrences cannot change control state.
- Parse test-suite totals and keep smaller focused runs from replacing the largest observed cumulative suite.
- Emit `COMMAND_CLEAN`, `STAGE_CLEAN`, and `GOAL_READY` with a post-lock current-suite requirement and later-failure invalidation.
- Keep the durable task contract and economic delegation policy before a small volatile workflow suffix for better cache locality.
- Advise local work for one clear package and delegation only for independent parallel work whose savings exceed launch and reconstruction cost.
- Expose workflow state through `prime_context status` without changing Prime Agent telemetry, scheduling, continuation, or child APIs.
- Preserve decision-complete failure capsules and their existing ROI policy.

## 4.7.0 - 2026-08-20

- Identify trace-only capsules that contain no decisive success or failure diagnostic.
- Omit low-value Read/Search recovery hints for those capsules, including fallback searches derived from repetitive payload text.
- Recommend rerunning the source command with filtered output when its actual result is needed.

## 4.6.0 - 2026-08-20

- Share consolidated staged lock state with the observation broker.
- Mark clean command successes as intermediate while requirements remain unlocked and tell the agent to keep its active goal open.
- Remove the open-requirements note after an explicit `REQUIREMENTS LOCKED` message.

## 4.5.0 - 2026-08-20

- Describe clean test results as clean command successes rather than terminal successes.
- State that no diagnostic recovery is needed without implying that an unlocked staged goal is complete.

## 4.4.0 - 2026-08-20

- Label every clean-success semantic or progression delta with `Clean terminal success; no recovery needed.`
- Keep clean delta capsules free of Read and Search actions while making completion readiness explicit.

## 4.3.0 - 2026-08-20

- Recognize staged intent on the first user prompt instead of waiting for a second branch message.
- Treat requirements as locked only when a message begins with `REQUIREMENTS LOCKED`; a future-lock reference no longer creates a false locked state.
- Inject an explicit do-not-complete guard while staged requirements remain unlocked.

## 4.2.0 - 2026-08-20

- Detect exact prior observations embedded inside a later composite result without using hashes.
- Replace repeated sections of at least 512 bytes with unchanged-section markers when the novel composite remainder is at most 30% of the source.

## 4.1.0 - 2026-08-20

- Restrict semantic exception recognition to diagnostic `Type: message` lines or a bare exception type, avoiding false outcomes from source code that merely references an exception class.
- Tighten token-ROI admission for sampled failures and deltas from 35% to 30% after a low-savings delta obscured a useful short source observation.

## 4.0.0 - 2026-08-20

- Add a stateful observation broker with pass-through, structured-capsule, and delta-capsule decisions.
- Make failure capsules decision-complete with detected test summaries, every failing-test ID, exception messages, source locations, and command status.
- Add 35% token-return-on-investment admission for sampled failures and deltas so short useful failures remain visible when compression saves little.
- Suppress repeated small and medium observations across tools, show bounded changed-document sections, and normalize clean success, failing-test sets, compiler errors, command failures, and test progression.
- Inject consolidated staged-requirements state during active multi-stage goals, including lock state, APIs, invariants, protected paths, known failures, outcome, and completion readiness.
- Report broker decisions, recovery usefulness, post-success turns, child launches after capsules, bytes saved, and context-token load per KiB saved through status.

## 3.4.0 - 2026-08-20

- Archive trace-only repetitive bursts from 2 KiB even when they contain no terminal test status.
- Require at least six trace/debug/progress lines and an 80% low-signal ratio, retaining bounded recovery through the normal capsule.

## 3.3.0 - 2026-08-20

- Detect repeated clean success by normalized terminal signature, including `TEST_RESULT PASS n/n` and `n passed`.
- Use the unchanged-success delta capsule when wrappers or trace lines differ but the clean terminal result is identical.

## 3.2.0 - 2026-08-20

- Emit a compact delta capsule when a tool archives exactly the same clean terminal-success output again.
- Report that the terminal success is unchanged without repeating evidence or adding recovery actions.

## 3.1.0 - 2026-08-20

- Prefer the first concrete `FAIL test_module.TestCase.test_name` prefix in failure-capsule Search hints.
- Fall back to the existing truthful terminal or literal hints when no concrete failing test is present.

## 3.0.0 - 2026-08-20

- Label clean terminal-success capsules as complete success summaries.
- Remove both Read and Search recovery actions from clean terminal success, preventing unnecessary archive recovery after a passing suite.

## 2.9.0 - 2026-08-20

- Stop promoting Markdown bullet prose as decisive evidence in compact terminal-failure capsules.
- Keep terminal summaries and direct exception lines ahead of staged requirement text that merely mentions failure.

## 2.8.0 - 2026-08-20

- Make focused capsule recovery windows asymmetric: 20 lines before and 10 lines after the highest-priority evidence line.
- Favor leading traceback and staged-requirement context while keeping recovery bounded.

## 2.7.0 - 2026-08-20

- Archive verbose command-usage output from 4 KiB when it contains a usage line and at least ten option lines.
- Preserve decisive fatal/usage evidence in the capsule instead of exposing the full help listing.

## 2.6.0 - 2026-08-20

- Archive an exact consecutive 8–24 KiB tool-result repeat on its second appearance instead of waiting for a third medium result.
- Keep the existing two-result grace period for distinct medium outputs and keep repeat state scoped per tool.

## 2.5.0 - 2026-08-20

- Omit the redundant Search action from clean terminal-success capsules while retaining their targeted Read action.
- Leave failure and nonterminal recovery hints unchanged.

## 2.4.0 - 2026-08-20

- Focus each capsule’s suggested archive read on a bounded 21-line window around the highest-priority selected evidence line.
- Avoid the previous fixed `startLine=1 endLine=200` hint when decisive evidence is elsewhere in the archive.

## 2.3.0 - 2026-08-20

- Retain each selected capsule line’s original source coordinate through signal selection, deduplication, display truncation, and byte packing.
- Prevent repeated or long prefix-identical lines from being assigned another line’s `L<n>:` label.

## 2.2.0 - 2026-08-20

- Pack capsule excerpts as complete escaped numbered lines instead of cutting joined XML text at an arbitrary byte.
- Preserve a complete compact recovery capsule when fixed metadata leaves no excerpt room.
- Require `capsuleMaxBytes` to be at least 512 bytes so configured capsules retain their recovery boundary.

## 2.1.0 - 2026-08-20

- Make every capsule fallback search hint name a fixed string present in the archived text.
- Omit the Search instruction when signal-free output has no safe searchable token.
- Retain the existing outcome-aware hints for tests, failures, exceptions, and successes.

## 2.0.0 - 2026-08-20

- Add caller-selected `maxMatches` bounds from 1 to 50 for archive search.
- Apply the bound consistently to one-observation and recent-observation searches.
- Compose smaller result pages with `matchOffset` and `contextLines` without changing defaults.

## 1.9.0 - 2026-08-20

- Add deterministic `matchOffset` pagination to archive search.
- Page through later matches within one observation or across recent observations.
- Report when earlier or later matches exist while preserving the 50-match response bound.

## 1.8.0 - 2026-08-19

- Let archive searches select a surrounding context radius from 0 to 20 lines.
- Keep one surrounding line as the default and continue merging overlapping match windows.
- Apply the selected radius to both observation-specific and recent-observation searches.

## 1.7.0 - 2026-08-19

- Prefix capsule excerpts with their exact archived source line numbers.
- Make every retained outcome or diagnostic directly addressable by the existing line-range recovery action.
- Preserve the existing capsule budgets and exact archived bodies.

## 1.6.0 - 2026-08-19

- Match concrete error names and error summaries without treating identifiers such as `errors=errors` as decisive failures.
- Keep terminal-failure capsules focused on the actual exception instead of nearby source-frame parameter lines.

## 1.5.0 - 2026-08-19

- Recognize short sampled terminal runs with four or more repetitive trace lines.
- Archive sampled terminal output from 1 KiB upward even below the normal large-output threshold.
- Keep exact terminal outcomes while removing the sampled trace noise.

## 1.4.0 - 2026-08-19

- Stop treating assertion helper calls such as `self.assertEqual(...)` as decisive failure lines.
- Continue prioritizing `AssertionError`, assertion summaries, explicit `assert` statements, and other failure diagnostics.

## 1.3.0 - 2026-08-19

- Make repetitive terminal-failure capsules outcome-focused when explicit failure evidence exists.
- Keep terminal summaries, decisive error lines, and command exit status.
- Omit generic trace, head, and tail samples from those concise failure capsules.

## 1.2.0 - 2026-08-19

- Make clean repetitive success capsules outcome-only.
- Omit generic trace, head, and tail samples after an unambiguous terminal success.
- Leave terminal-failure and nonterminal evidence selection unchanged.

## 1.1.0 - 2026-08-19

- Distinguish repetitive terminal successes from failures.
- Limit clean terminal success capsules to 768 bytes.
- Retain the 1 KiB budget when terminal failure evidence exists.

## 1.0.0 - 2026-08-19

- Track medium-sized output frequency independently for each tool.
- Leave the first two below-threshold medium results untouched.
- Archive later 8–24 KiB results from that tool with an at-most 1.5 KiB capsule.

## 0.9.0 - 2026-08-19

- Put recognized terminal summaries first in capsule excerpts.
- Deduplicate repetitive decisive lines by normalized shape.
- Bound each selected excerpt line to 384 UTF-8 bytes.

## 0.8.0 - 2026-08-19

- Recognize unittest `OK` and `FAILED (...)` plus common pass/fail count summaries as terminal outcomes.
- Prefer exact terminal result phrases in recovery search hints.
- Retain a bounded amount of context around decisive failure lines.

## 0.7.0 - 2026-08-19

- Reduce repetitive terminal test output to an approximately 1 KiB capsule.
- Keep decisive pass/fail lines ahead of generic trace excerpts.
- Shorten fixed capsule metadata and recovery instructions.
- Choose a compact `ERROR`, `FAIL`, or `PASS` search hint from the archived output.

## 0.6.0 - 2026-08-19

- Return a literal no-op from the context hook when no task context changes are needed.
- Let visible active Prime Agent goal context own task continuity when no durable Prime Context state is set.
- Reuse unchanged rendered task-context messages at the stable first-user boundary.
- Reduce the static `prime_context` tool prompt and guidance footprint.
- Lower the effective archive threshold at high model-context usage while keeping configuration as the normal bound.

## 0.5.0 - 2026-08-19

- Skip task-context injection when the root request and current instruction are already visible and no durable state is set.
- Keep unchanged durable task context at a stable first-user boundary without a changing timestamp.
- Restore only missing root or current instructions after compaction instead of duplicating visible user text.
- Use smaller capsules for repetitive output while keeping decisive failure and success lines.
- Adapt capsule size to projected model context usage while preserving `capsuleMaxBytes` as an upper bound.

## 0.4.0 - 2026-08-19

- Prioritize decisive failure lines over warning-only lines in generic capsules.
- Archive typed Bash complete output from `BashToolDetails.fullOutputPath` when available.
- Merge overlapping fixed-string search context windows.
- Copy pinned parent observations into fork session storage.
- Add `/pc cleanup current` for explicit current-session archive removal.
- Leave `prime_context` recovery responses unarchived so reads are not hidden behind new capsules.

## 0.3.0 - 2026-08-19

- Search recent archived observations in one call by omitting the tool `id`.
- Add `/pc search all <fixed text>` for the same bounded recovery workflow.
- Keep cross-observation results fixed-string, capped at 50 matches, and bounded by the existing response limit.

## 0.2.0 - 2026-08-19

- Add bounded recent-observation listing through `prime_context action=list` and `/pc list [limit]`.
- Make unpinned archived output IDs discoverable after they leave model context.

## 0.1.0 - 2026-08-19

- Add local gzip paging for large visible tool output.
- Add exact line reads and fixed-string search by observation ID.
- Add one branch-local durable task snapshot with context injection.
- Add the `prime_context` tool and `/pc` command namespace.
