# Changelog

## 8.1.0 - 2026-08-29

- Align the Prime Context release line with Prime Agent 0.8.1 and include all beast-mode context-management improvements developed against that runtime.
- Inject the no-verification-theater/KISS policy into Prime Agent's assembled system prompt once per agent run, so it remains active across ordinary turns, autonomous continuations, and compaction without requiring `AGENTS.md`.
- Preserve raw session history while projecting a stable, purpose-aware model view with immutable completed exchanges, multipart envelopes, large-output streaming archives, typed media paging, bounded recovery, scoped recall, and prefix folds.
- Add execution-aware tool intent, validation-suite identity, staged workflow state, durable task anchors, exact terminal-result handling, and direct IPython `write_text`/`write_bytes` workspace revision tracking.
- Bundle the runtime `diff` dependency and target Prime Agent 0.8.1 extension, compaction, recursive-session, and cache-local context hooks.
- Include a version-pinned, idempotent Prime Agent 0.8.1 host-contract patch for purpose-aware `model_context`, awaited hidden `turn_end` messages, execution-mode metadata, and exact entry references. Full 8.1.0 behavior requires this patch.

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
