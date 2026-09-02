# Cross-Service Incident Timeline

Investigate a production incident from a large set of service logs. Use only the
Python standard library. The input tree is read-only. Put your program under
`solution/` and write generated artifacts under `output/`.

## Initial command

Make this command work from the workspace root:

```bash
python -m solution.incident inputs/logs \
  --window-start 2025-04-17T14:00:00Z \
  --window-end 2025-04-17T14:30:00Z \
  --output output
```

The start and end of the window are inclusive RFC 3339 instants. The command
must replace its two outputs on every run.

## Inputs and correlation

`inputs/logs/` contains both plain-text and `.gz` files. Treat a gzip file as a
text stream after decompression. Do not expand a compressed file beside the
input or load a whole log into memory. Blank or malformed lines may be skipped.
Line numbers always mean the 1-based line number in the decompressed text.

The services use several structured-log styles. Records contain an RFC 3339
timestamp (either as a leading token, a `timestamp=` field, or a JSON
`timestamp` string), a service, a severity, and some of these fields:
`request_id`, `release_id` (sometimes named `release`), `code` (sometimes named
`event`), `status`, `operation`, `column`, and `message`. Text fields can be
quoted and can contain spaces. Normalize timestamps to an RFC 3339 UTC form
with milliseconds, such as `2025-04-17T14:00:00.000Z`.

Build a focused incident chain rather than dumping every log line in the time
window. Deployment and database records can be connected by a release ID or a
named schema object. Application errors connect to access responses by request
ID and to a deployment by release ID or the named schema object. A request ID
is only one correlation chain while consecutive records for it are at most 15
minutes apart. The same ID after a gap of more than 15 minutes is a new chain
and must not be pulled into the incident merely because the text is equal.
Unrelated errors and unrelated releases must not appear in the focused chain.

At the initial stage, each service clock has an unknown offset. Use the instant
represented by the timestamp itself as the best available ordering. Do not
infer or invent cross-service clock corrections.

## `output/timeline.csv`

Write this exact header:

```text
timestamp_utc,raw_timestamp,service,severity,request_id,release_id,event_code,source_file,source_line,message
```

Requirements:

- `raw_timestamp` preserves the timestamp token exactly as found in the source.
- Initially, `timestamp_utc` is the normalized UTC instant represented by that
  raw timestamp. If clock-offset data is supplied later, it becomes the
  corrected UTC instant instead.
- Canonical service names are `access`, `application`, `deployment`, and
  `database`. Severity is uppercase.
- Missing request IDs or release IDs are empty strings.
- `source_file` is the POSIX path relative to the log directory, including a
  `.gz` suffix where present. `source_line` is the decompressed 1-based line.
- Sort rows by corrected `timestamp_utc`, then service, source file, and source
  line. Do not discard two distinct source records that happen to have equal
  content.

## `output/incident_report.md`

Write a concise evidence report. Describe the observed failure sequence without
claiming an unsupported clock correction. Include exactly three primary source
anchors in `source_file:line` form. The paths and line numbers must match
`timeline.csv`. It is fine to explain uncertainty. Do not quote unrelated errors
as evidence.

## Required edge behavior

Request IDs are reused. If the same request ID occurs the next day, or otherwise
has a gap greater than 15 minutes, the distant records are separate chains.
They must not be joined into this incident even when a caller requests a window
wide enough to contain both occurrences.
