# Backup Restore Planner

Build a restore planner using only the Python standard library.

Run it with:

```bash
python -m solution.restore_plan inputs --output output
```

`inputs/restore_request.json` contains:

```json
{
  "cutoff": "2025-05-01T12:00:00Z",
  "paths": ["relative/path.txt"]
}
```

The `inputs` directory also contains three snapshot archives in tar, compressed-tar, or ZIP format. Inspect archive metadata without first extracting an archive.

For every requested path, consider only regular-file members with that exact POSIX member path and a timestamp at or before the cutoff. Choose the eligible member with the newest timestamp. If timestamps tie, choose the archive whose filename sorts first. Treat ZIP date/time fields as UTC. A directory, tar link, or other non-regular member is not a file version.

Create:

* `output/restore_plan.csv` with columns `path,archive,member,member_timestamp,size`. Include one chosen file per row. Use the archive basename and write timestamps as `YYYY-MM-DDTHH:MM:SSZ` in UTC.
* `output/restored/`, containing the exact bytes of every chosen member at its requested relative path.
* `output/warnings.csv` with columns `path,reason`. Use `no_eligible_version` when no safe regular-file version is at or before the cutoff.

Sort both CSV files by `path`. Always write their headers, including when there are no data rows.

Archive member names are untrusted. Never extract an absolute member path or one containing a `..` path component, and never allow a write to escape `output/restored`. If an unsafe member name would otherwise target a requested path after traversal components are removed, do not select or extract it and report `unsafe_member` for that request. An unsafe matching member takes precedence over the generic `no_eligible_version` warning when there is no safe eligible version.

The supplied edge case has a requested `requested.txt` whose only apparent archive version is stored as `../requested.txt`. It must produce an `unsafe_member` warning and must not create that file either inside or outside the restore root.
