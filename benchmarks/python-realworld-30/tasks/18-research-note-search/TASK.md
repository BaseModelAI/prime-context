# Research-Note Search and Deduplication

Use Python 3.12 and only the standard library. Implement `solution/notes_index.py`. The judge runs commands from the workspace root with `python3.12 -E -S`.

## Initial commands

```bash
python3.12 -E -S -m solution.notes_index build inputs/notes workspace/notes.db output/duplicates.csv
python3.12 -E -S -m solution.notes_index search workspace/notes.db "query terms" --limit 10
```

`build` must replace the database and duplicate report deterministically. Create missing parent directories. The database representation is your choice, but it must be one file at the given path and later `search` commands must use only that file.

## Note format and paths

Read UTF-8 `.md` files recursively. Every fixture note starts with these four lines:

```text
Title: A note title
Tags: comma, separated, values
Created: YYYY-MM-DD

```

The body is every character after that blank line. Trim surrounding whitespace from the `Title:` value. Tags and creation time do not affect search or duplicate detection. A note path is its case-sensitive, input-root-relative POSIX path. Sort paths with ordinary Python string order.

## Normalization and tokens

For both indexed text and queries, first apply `unicodedata.normalize("NFKC", text).casefold()`. A token is a maximal nonempty run of characters for which `str.isalnum()` is true. Every other character separates tokens.

`inputs/stopwords.txt` is next to the `notes` directory. Normalize and tokenize each nonempty line by the same rule. The resulting tokens are stop words. Remove stop words from title tokens, body tokens, and query tokens.

For exact-body duplicate comparison, the normalized body is the complete body after only the NFKC-plus-casefold normalization above. Do not trim it or change its whitespace.

## Search

Treat the query as a set of distinct normalized, non-stop-word tokens. Process those terms in lexical order. Let `N` be the number of notes currently in the database. For each query term and note:

- `count` is its number of body-token occurrences plus twice its number of title-token occurrences;
- `tf = 1 + math.log(count)` when `count` is positive;
- `df` is the number of notes in which the term occurs at least once in either the title or body; and
- `idf = math.log((N + 1) / (df + 1)) + 1`.

A note's score is the sum of `tf * idf` over the distinct query terms. Omit notes with score zero. Sort by descending numeric score, then by ascending note path, and return at most `--limit` notes.

Write exactly one UTF-8 JSON array to standard output. Each result is an object with exactly these keys:

```json
{"path": "relative/note.md", "score": 1.0}
```

The array order is the result order. Scores are JSON numbers. A query containing no indexed terms returns `[]`.

## Duplicate report

Two different notes have a duplicate edge when either:

1. their normalized bodies are exactly equal; or
2. the Jaccard similarity of their sets of non-stop-word body tokens is at least `0.92`.

Jaccard similarity is `len(A & B) / len(A | B)`. Two empty sets do not form a Jaccard edge, though equal normalized empty bodies still form an exact edge.

Duplicate groups are the connected components of this undirected edge graph. Ignore one-note components. In each group the lexically first path is canonical. Write one row for every other group member to the CSV path supplied to `build`, sorted by `(canonical_path, duplicate_path)`, with this exact header:

```text
canonical_path,duplicate_path
```

Use UTF-8, ordinary CSV quoting, and LF records.

Do not embed the fixture corpus in source code or load it into a conversation. Process the local files. All implementation and generated artifacts must stay under the declared editable directories.
