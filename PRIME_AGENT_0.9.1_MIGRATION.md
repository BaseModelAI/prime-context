# Prime Agent 0.9.1 migration analysis

## Scope and conclusion

Prime Context 9.1.0 targets exactly `prime-agent@0.9.1`. The review covered the complete `v0.8.1..v0.9.0..v0.9.1` upstream range, the official release archives, the public extension ABI, generated bundles, Python runtime, daemon protocol, compaction, refinement, and every packaged Prime Context host-patch target.

Prime Agent 0.9.x modernizes the Python runtime and daemon transport, but it does not upstream the extension surfaces Prime Context needs. The explicit host patch therefore remains required. The migration rebases that patch rather than replacing the host's new behavior.

## Exact upstream range

| Release | Commit | Relevant scope |
|---|---|---|
| `v0.8.1` | `514633727bf26d74f39f3119c2b0e31a5ceb2a9d` | Historical Prime Context host |
| `v0.9.0` | `c394506e2f0dd887b3f94908da9f2910b43c846b` | Persistent REPL, native async Bash, daemon roster/direct transport, compaction coordination |
| `v0.9.1` | `81ae3cb34d27d38ee37f9e205a1e73694993b344` | Saved-session catalog fix plus coordinated release rebuild |

The `v0.8.1..v0.9.0` range contains 52 non-merge commits over 255 paths. The only functional `v0.9.0..v0.9.1` change is `c32f27257a61c755e7f82f322dd38a524cc52d98`, which lets Agents View fetch inactive saved sessions before a non-empty search is present.

## Upstream changes and their impact

### Persistent Python REPL

- Jupyter, ipykernel, ZeroMQ, and the fork server are replaced by the newline-delimited protocol-3 `rlm.repl` runtime.
- The tool is still named `ipython` and still accepts `{ code: string }`.
- Shell magic such as `%%bash` is invalid. Shell work now uses the pre-imported async `bash()` callable.
- `IpythonToolDetails` adds `backgroundOutput?: string` for output that cannot be attributed to normal stdout or stderr.
- Kernel snapshot/restore is native to the new REPL. Python skills use `rlm.emit()` instead of IPython display internals; their public call signatures remain compatible.

Prime Context now classifies literal positional and `command=` forms of `await bash(...)`, including test/build/lint evidence and workspace mutations. It no longer treats `%%bash` as supported syntax. `backgroundOutput` is archived as its own recoverable typed part.

### Public package and extension APIs

The coding-agent root export and the extension event types used by stock extensions remain materially compatible. Other public changes include roster subscriptions, richer `SessionSummary`, `AgentSession.disposeAsync({ kernelSnapshot })`, and `clearQueuedAgentMessages()`.

These additions do not replace the Prime Context contract. Stock 0.9.1 still lacks:

- awaited `turn_end` handler results;
- finalized exchanges with source order and original/executed tool input;
- `turn_end.toolExecution`;
- the durable `user_bash_end` event;
- purpose-aware `model_context` for provider, budget, compaction, branch-summary, and refine calls;
- exact entry references and projection identity;
- automatic-refinement override control.

The nested agent-core implementation containing the turn loop is unchanged across the release range apart from package metadata. None of these Prime Context hooks was upstreamed.

### Compaction and refinement

Prime Agent 0.9.0 replaces timer-based post-compaction continuation with activity and session-action commit fences. It also prevents a refinement apply race and exposes automatic compaction through the existing operation state. Prime Context retains this upstream coordination and adds only its purpose-aware projections, usage anchors, and refinement override. Public `waitForIdle()`, `compact`, and `refine` APIs remain compatible.

### Daemon transport

Daemon protocol version 7 remains, while schema revision moves from 22 to 25. New behavior includes authoritative roster pushes, direct worker transport, worker-instance ownership, peer authentication, recoverable requests, and stricter recovery before session reuse. An old 0.8.1 daemon is not schema-compatible with 0.9.1.

The host patch was rebased onto the new ownership and transport code:

- daemon capability insertion uses `SUPERVISOR_SERVER_CAPABILITIES`;
- attach timeout changes preserve the new `options` argument;
- launch environment, snapshot, recovery, and immediate supervisor hello changes are applied to both source modules and active bundle copies;
- generated `chunk-*.js` paths are discovered by semantic anchors rather than hard-coded filenames.

The immediate hello behavior remains because it prevents stale supervisor handshakes. Isolated new-session, saved-session resume, compaction, and shutdown tests all pass with the 0.9.1 ownership path.

### Packaging

Release rebundles change generated chunk names even when source behavior is unchanged. The patcher now discovers each active chunk, requires exactly one semantic match, targets only 0.9.1, and changes only the host path passed to it. The obsolete optional mutation of a neighboring Prime Context bundle is removed.

Package smoke no longer uses a global host or mutates its input host. It copies a pristine explicit or repository-local 0.9.1 tree into a disposable directory, installs the packed extension with its exact pinned 0.9.1 runtime dependencies using ordinary npm behavior, patches and verifies the disposable host, and exercises the public ABI and RPC loading path.

## Patch decision

### Retained

The finalized-exchange, awaited turn completion, tool-execution metadata, purpose-aware projection, entry-ref/projection identity, provider-usage anchor, compaction projection, `user_bash_end`, and refinement-control patches remain necessary because stock 0.9.1 has no equivalent.

### Rebased

Daemon capability names, attach signatures, Agents View launch state, generated bundles, and package/version guards were updated for 0.9.1. Sequential provider-usage transformations remain ordered patch steps; an earlier step satisfying a later old string is intra-script supersession, not upstream support.

### Simplified or removed

- Removed all current-runtime assumptions about `%%bash`.
- Removed hard-coded bundle chunk filenames.
- Removed optional sibling Prime Context mutation.
- Package smoke no longer falls back to any globally installed host or checkout peer when an explicit host is incomplete.
- Benchmark host paths are explicit and absolute; full patch-site preflight rejects stock, patched, or partially patched hosts in the wrong arm.
- The neutral benchmark Bash adapter now reports non-zero exits as tool errors, matching native 0.9.1 behavior.

No custom behavioral patch could be removed as “now upstream”: none had a stock 0.9.1 replacement with the required semantics.

## Isolation and validation

All release archives, stock/patched hosts, homes, daemon sockets, kernel venvs, and runtime tests were created below `/tmp`. The machine's globally installed Prime Agent remained at 0.8.1 throughout. Package smoke checks that both its source host and the Prime Context checkout stay unchanged while the disposable copy is patched.

Validated behaviors include:

- packaged full-stock `--check-stock`, patch application, and idempotent `--check` on exact 0.9.1, including rejection of early and late partial patches;
- repository-local and explicit-host package smoke;
- RPC startup, extension command registration, clean shutdown, and saved-session resume;
- protocol-3 persistent REPL bootstrap in an isolated venv;
- a real model-issued `ipython` call running `await bash(command=...)` and writing the expected file;
- separate archival and `inspect` recovery of REPL `backgroundOutput`;
- current-only real-world Tasks 1, 8, and 24 on the isolated patched host.

Task outcomes:

| Task | Result | Agent time | Provider tokens | Cost |
|---:|---|---:|---:|---:|
| 1 | 5/5 main checks and edge pass | 93.740 s | 29,146 | $0.159627 |
| 8 | 5/5 main checks and edge pass | 223.418 s | 72,255 | $0.374467 |
| 24 | 5/5 main checks and edge pass; compaction completed | 352.965 s | 190,524 | $0.598225 |
| 1 post-fix rerun | 5/5 main checks and edge pass | 83.792 s | 30,803 | $0.147687 |

The run directories contain no retained `auth.json`, RPC stderr, escaped sandbox process, or task daemon. Historical 0.8.1 comparison artifacts remain unchanged and continue to be labeled historical.
