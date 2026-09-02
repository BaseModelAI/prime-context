# Calendar Merge and Conflict Report

Build a deterministic iCalendar merge command using only the Python standard library.

Run it from the workspace root as:

```bash
python -m solution.calendar_merge inputs/calendars output/merged.ics output/conflicts.csv
```

The first argument is a directory. Read every regular `*.ics` file in that directory in filename order. Create the output parent directories when needed.

## Input subset

Each input is a `VCALENDAR` with `X-WR-TIMEZONE` and `VEVENT` records. Support:

- iCalendar line unfolding: a physical line beginning with one space or tab continues the preceding logical line;
- `UID`, decimal `SEQUENCE`, `STATUS`, `DTSTART`, `DTEND`, `SUMMARY`, and `LOCATION`;
- UTC date-times such as `20250310T140000Z`;
- local date-times with a `TZID` parameter;
- local date-times without `TZID`, which use that file's `X-WR-TIMEZONE`;
- `VALUE=DATE` all-day values. Their interval is midnight at the start date through midnight at the exclusive `DTEND` date in that file's `X-WR-TIMEZONE`.

Fixtures have a `DTEND`, valid IANA timezone names, and no ambiguous or nonexistent local endpoints. Property and parameter names are case-insensitive.

## Merge rules

Group records by exact `UID`. Keep only the record with the highest numeric `SEQUENCE`. Sequence ties do not occur. If that winning record has `STATUS:CANCELLED` (case-insensitive), omit the UID entirely.

Normalize each retained event's `DTSTART` and `DTEND` to UTC and emit them as `YYYYMMDDTHHMMSSZ`. This includes the UTC boundaries of an all-day event. Preserve the winning `UID`, numeric `SEQUENCE`, unfolded `SUMMARY`, and `LOCATION` when present. Emit retained events in ascending `(UTC start, UID)` order.

Two retained events conflict when their half-open UTC intervals overlap:

```text
start_a < end_b and start_b < end_a
```

Thus events that only touch at an endpoint do not conflict.

## Outputs

`output/merged.ics` must be a valid `VCALENDAR`. Use CRLF for every line and end the file with CRLF. Each emitted `VEVENT` must contain `UID`, `SEQUENCE`, `DTSTART`, `DTEND`, and `SUMMARY`; `LOCATION` is included when the winning event has one. Do not emit cancelled records.

`output/conflicts.csv` must be UTF-8 CSV with this exact header:

```text
uid_a,uid_b
```

For every conflicting pair, put the lexicographically smaller UID in `uid_a`. Emit each pair once, sorted by `(uid_a, uid_b)`. Emit only the header when there are no conflicts. Do not include timestamps or other nondeterministic data.

The input files are read-only. Write only under `solution/` and `output/`.

The held-out edge case has a folded `SUMMARY` and two events where one ends exactly when the other starts. The summary must be unfolded, and the events must not be reported as a conflict.
