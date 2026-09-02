# Prime Context benchmarks

## Active benchmark

[`python-realworld-30/`](python-realworld-30/) is the active benchmark. It is a hermetic Python 3.12 protocol defined by [`prime-context-python-realworld-30-benchmark-spec.md`](../prime-context-python-realworld-30-benchmark-spec.md).

The suite contains 30 real-world, staged software tasks. Candidate execution is isolated from the repository, future stages, judges, credentials, package managers, and public networking. Both comparison arms receive the same neutral Bash tool and fresh judge fixtures.

Read the curated [Prime Context 9.1.0 interim benchmark report](RELEASE-9.1.0.md) for the frozen local 8.1.1 versus new 9.1.0 comparison.

## Reference reset

The Python suite replaces the former Docker-based synthetic corpus and compatibility runners. Tasks, staging, judging, isolation, and reference points changed. Results from the retired benchmark are therefore **historical only** and are not valid direct baselines for the active suite.

Those earlier results are still useful evidence of historical improvement. They should always be labeled with their original protocol and must not be mixed into current aggregate claims.

The active runner requires explicit isolated Prime Agent executables. It supports vanilla, a same-host-compatible published extension, and current. It retains primary attempts plus at most one diagnostic retry and reports selected correctness separately from all-retained resource use.
