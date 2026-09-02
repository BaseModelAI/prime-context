# Markdown Knowledge-Base Repair

Create `solution/kb_repair.py`. The benchmark will run it as:

```bash
python3.12 -E -S -m solution.kb_repair inputs/kb --redirects inputs/redirects.json --output output
```

Use only the Python 3.12 standard library.

## Markdown subset

Process UTF-8 `.md` files recursively. A heading is an ATX heading whose first non-space characters are one through six `#` characters followed by whitespace. Trim surrounding whitespace and an optional closing run of `#` characters from its text.

Inspect inline Markdown links and images of the forms `[label](destination)` and `![alt](destination)`. Fixture destinations do not contain a Markdown title. A destination can be wrapped in angle brackets. Preserve those angle brackets when rewriting it.

Do not inspect, report, index, or edit a link-like string inside a fenced code block. An opening fence has optional leading spaces followed by at least three backticks or at least three tildes. It closes only at a later line with the same marker character and at least as many markers. Fence lines and all bytes between them must remain unchanged.

## Paths, redirects, and fragments

- Recursively copy the complete knowledge base to `output/kb`. Do not modify the input. Do not change bytes unrelated to a repaired link or a required move.
- Leave URI-scheme destinations such as `http:`, `https:`, and `mailto:` unchanged. Also leave destinations beginning with `/` unchanged. Report these non-local links as `external`.
- Split a local destination at its first `#`. Resolve a nonempty path relative to the source document. An empty path refers to the source document. Root-relative report and index paths use POSIX separators. A path that escapes the knowledge-base root is unresolved.
- `inputs/redirects.json` maps missing knowledge-base-root-relative paths to arrays of possible replacement paths. Repair a missing path only when exactly one listed replacement exists. Do not guess when zero or multiple replacements exist.
- Validate a fragment only when the resolved target is a Markdown document. To derive heading anchors, normalize heading text with Unicode NFKC and `casefold()`, remove Unicode punctuation except spaces and hyphens, change each run of whitespace to `-`, collapse repeated hyphens, and trim leading and trailing hyphens. Within each file, the first occurrence uses that base anchor; later duplicate headings append `-1`, `-2`, and so on.
- A fragment is valid when it is already one of those anchors. Otherwise, apply the same base normalization to the fragment. If that identifies exactly one anchor, rewrite it to that canonical anchor. Otherwise the local link is unresolved and must stay unchanged.
- Rewrite a repaired destination as a relative POSIX path from the final source document to the final target. Preserve an empty path for a same-document fragment. Preserve angle brackets. Existing local links whose destination does not change remain byte-for-byte unchanged.

## Outputs

Create both outputs below on every successful run.

### `output/link_report.csv`

Use the exact columns:

```text
source_path,original_target,resolved_target,status
```

Include every inspected link and image, but not links inside fences. Sort rows by final `source_path` using case-sensitive POSIX lexical order and retain source link order within each file.

- `original_target` is the destination without surrounding angle brackets.
- `resolved_target` is the final knowledge-base-root-relative path, plus `#fragment` when present, for resolved local links. It is empty for unresolved and external links.
- `status` is `ok` when a local destination is already correct, `repaired` when its path or fragment is rewritten, `unresolved` when it cannot be resolved, and `external` for the non-local cases above.

### `output/index.json`

The top-level object is keyed by final root-relative Markdown path. Each value contains:

- `title`: the text of the first level-one heading, or `""`;
- `headings`: objects with `text` and `anchor`, in source order;
- `outgoing_local_links`: final root-relative resolved destinations, including canonical fragments, in source order. Exclude unresolved and external destinations.

Write UTF-8 JSON and sort all object keys. Output order and contents must be deterministic.

All output belongs under `output/`.
