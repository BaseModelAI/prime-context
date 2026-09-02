#!/usr/bin/env python3
"""Fresh-fixture semantic main-and-edge judge for Task 18."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from dataclasses import dataclass
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import unicodedata

PYTHON = "python3.12"
DUPLICATE_FIELDS = ["canonical_path", "duplicate_path"]


@dataclass(frozen=True)
class Note:
    path: str
    title_counts: Counter[str]
    body_counts: Counter[str]
    body_set: frozenset[str]
    normalized_body: str


def run_python(*arguments: str, cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PYTHON, "-E", "-S", *arguments],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def merge_copy(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def prepare(candidate: Path, fixture: str) -> tuple[tempfile.TemporaryDirectory[str], Path, Path, bool]:
    holder = tempfile.TemporaryDirectory(prefix=f"pcbench-18-{fixture}-")
    root = Path(holder.name)
    workspace = root / "candidate-workspace"
    task_dir = Path(__file__).resolve().parent

    seeded = run_python(
        str(task_dir / "seed.py"), "--workspace", str(workspace), "--fixture", fixture,
        cwd=task_dir, timeout=30,
    )
    if seeded.returncode:
        holder.cleanup()
        raise RuntimeError("fixture seed failed")

    # Materialize both generated payloads outside the candidate workspace.
    initial_payload = root / "initial-payload"
    initial_payload.mkdir()
    generated = run_python(
        str(task_dir / "visible" / "_generate.py"),
        "--output", str(initial_payload), "--fixture", fixture,
        cwd=task_dir / "visible", timeout=120,
    )
    if generated.returncode:
        holder.cleanup()
        raise RuntimeError("initial fixture generation failed")
    merge_copy(initial_payload, workspace)

    future_payload = root / "future-payload"
    future_payload.mkdir()
    generated = run_python(
        str(task_dir / "stages" / "update" / "_generate.py"),
        "--output", str(future_payload), "--fixture", fixture,
        cwd=task_dir / "stages" / "update", timeout=60,
    )
    if generated.returncode:
        holder.cleanup()
        raise RuntimeError("update fixture generation failed")
    if (workspace / "inputs" / "notes-new").exists() or (workspace / "inputs" / "deleted.txt").exists():
        holder.cleanup()
        raise RuntimeError("future payload leaked into initial workspace")

    # Rebuild outputs and state. Only the declared solution artifact is copied.
    source = candidate / "solution"
    copied = source.is_dir() and (source / "notes_index.py").is_file()
    if source.is_dir():
        shutil.copytree(source, workspace / "solution", dirs_exist_ok=True)
    return holder, workspace, future_payload, copied


def normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text).casefold()


def raw_tokens(text: str) -> list[str]:
    result: list[str] = []
    current: list[str] = []
    for character in normalize(text):
        if character.isalnum():
            current.append(character)
        elif current:
            result.append("".join(current))
            current.clear()
    if current:
        result.append("".join(current))
    return result


def load_stopwords(path: Path) -> set[str]:
    words: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            words.update(raw_tokens(line))
    return words


def parse_note(path: Path, root: Path, stopwords: set[str]) -> Note:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    if len(lines) < 4 or not lines[0].startswith("Title:") or lines[3].strip():
        raise ValueError("malformed fixture note")
    title = lines[0][len("Title:"):].strip()
    body = "".join(lines[4:])
    title_tokens = [token for token in raw_tokens(title) if token not in stopwords]
    body_tokens = [token for token in raw_tokens(body) if token not in stopwords]
    return Note(
        path.relative_to(root).as_posix(),
        Counter(title_tokens),
        Counter(body_tokens),
        frozenset(body_tokens),
        normalize(body),
    )


def load_notes(root: Path, stopwords: set[str]) -> dict[str, Note]:
    notes: dict[str, Note] = {}
    for path in sorted(root.rglob("*.md")):
        if path.is_file():
            note = parse_note(path, root, stopwords)
            notes[note.path] = note
    return notes


def post_update_notes(workspace: Path, initial: dict[str, Note], stopwords: set[str]) -> dict[str, Note]:
    notes = dict(initial)
    deleted_path = workspace / "inputs" / "deleted.txt"
    for line in deleted_path.read_text(encoding="utf-8").splitlines():
        relative = line.strip()
        if relative:
            notes.pop(relative, None)
    notes.update(load_notes(workspace / "inputs" / "notes-new", stopwords))
    return notes


def expected_search(notes: dict[str, Note], stopwords: set[str], query: str, limit: int) -> list[dict[str, object]]:
    terms = sorted(set(raw_tokens(query)) - stopwords)
    total = len(notes)
    dfs = {
        term: sum(term in note.title_counts or term in note.body_counts for note in notes.values())
        for term in terms
    }
    results: list[dict[str, object]] = []
    for path, note in notes.items():
        score = 0.0
        for term in terms:
            count = note.body_counts[term] + 2 * note.title_counts[term]
            if count:
                tf = 1.0 + math.log(count)
                idf = math.log((total + 1) / (dfs[term] + 1)) + 1.0
                score += tf * idf
        if score:
            results.append({"path": path, "score": score})
    results.sort(key=lambda item: (-float(item["score"]), str(item["path"])))
    return results[:limit]


class DisjointSet:
    def __init__(self, paths: list[str]) -> None:
        self.parent = {path: path for path in paths}

    def find(self, path: str) -> str:
        parent = self.parent[path]
        while parent != self.parent[parent]:
            parent = self.parent[parent]
        while path != parent:
            next_path = self.parent[path]
            self.parent[path] = parent
            path = next_path
        return parent

    def union(self, left: str, right: str) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            if left_root < right_root:
                self.parent[right_root] = left_root
            else:
                self.parent[left_root] = right_root


def expected_duplicates(notes: dict[str, Note]) -> list[tuple[str, str]]:
    paths = sorted(notes)
    groups = DisjointSet(paths)

    exact: dict[str, list[str]] = defaultdict(list)
    postings: dict[str, list[str]] = defaultdict(list)
    for path in paths:
        note = notes[path]
        exact[note.normalized_body].append(path)
        for token in note.body_set:
            postings[token].append(path)
    for members in exact.values():
        for member in members[1:]:
            groups.union(members[0], member)

    candidates: set[tuple[str, str]] = set()
    for members in postings.values():
        for left_index, left in enumerate(members):
            for right in members[left_index + 1:]:
                candidates.add((left, right) if left < right else (right, left))
    for left, right in candidates:
        left_set = notes[left].body_set
        right_set = notes[right].body_set
        union = left_set | right_set
        if union and len(left_set & right_set) / len(union) >= 0.92:
            groups.union(left, right)

    components: dict[str, list[str]] = defaultdict(list)
    for path in paths:
        components[groups.find(path)].append(path)
    rows: list[tuple[str, str]] = []
    for members in components.values():
        members.sort()
        if len(members) > 1:
            rows.extend((members[0], member) for member in members[1:])
    return sorted(rows)


def read_duplicates(path: Path) -> list[tuple[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != DUPLICATE_FIELDS:
            raise ValueError("wrong duplicate header")
        rows = list(reader)
    if any(set(row) != set(DUPLICATE_FIELDS) or any(value is None for value in row.values()) for row in rows):
        raise ValueError("malformed duplicate row")
    return [(row["canonical_path"], row["duplicate_path"]) for row in rows]


def run_build(workspace: Path) -> subprocess.CompletedProcess[str]:
    return run_python(
        "-m", "solution.notes_index", "build", "inputs/notes", "workspace/notes.db",
        "output/duplicates.csv", cwd=workspace, timeout=180,
    )


def run_update(workspace: Path) -> subprocess.CompletedProcess[str]:
    return run_python(
        "-m", "solution.notes_index", "update", "workspace/notes.db", "inputs/notes-new",
        "inputs/deleted.txt", "output/duplicates.csv", cwd=workspace, timeout=180,
    )


def run_search(workspace: Path, query: str, limit: int) -> list[dict[str, object]]:
    completed = run_python(
        "-m", "solution.notes_index", "search", "workspace/notes.db", query,
        "--limit", str(limit), cwd=workspace, timeout=30,
    )
    if completed.returncode:
        raise ValueError("search command failed")
    value = json.loads(completed.stdout)
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError("search output is not a bounded array")
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict) or set(item) != {"path", "score"}:
            raise ValueError("malformed search result")
        path = item["path"]
        score = item["score"]
        if not isinstance(path, str) or path in seen:
            raise ValueError("invalid result path")
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score):
            raise ValueError("invalid result score")
        seen.add(path)
    return value


def results_match(actual: list[dict[str, object]], expected: list[dict[str, object]]) -> bool:
    if len(actual) != len(expected):
        return False
    return all(
        actual_item["path"] == expected_item["path"]
        and math.isclose(
            float(actual_item["score"]), float(expected_item["score"]),
            rel_tol=1e-12, abs_tol=1e-12,
        )
        for actual_item, expected_item in zip(actual, expected)
    )


def main_fixture(candidate: Path) -> tuple[list[bool], bool, bool, bool, list[str]]:
    checks = [False] * 5
    notes: list[str] = []
    holder: tempfile.TemporaryDirectory[str] | None = None
    artifact = (candidate / "solution" / "notes_index.py").is_file()
    runnable = False
    parseable = False
    try:
        holder, workspace, future_payload, copied = prepare(candidate, "main")
        artifact = artifact and copied
        stopwords = load_stopwords(workspace / "inputs" / "stopwords.txt")
        initial_notes = load_notes(workspace / "inputs" / "notes", stopwords)
        if len(initial_notes) != 8_000:
            raise RuntimeError("wrong generated initial note count")

        built = run_build(workspace)
        if built.returncode == 0:
            runnable = True
        elif copied:
            imported = run_python("-c", "import solution.notes_index", cwd=workspace, timeout=10)
            runnable = imported.returncode == 0
            notes.append("main build command failed")

        stable_before: list[dict[str, object]] | None = None
        if built.returncode == 0:
            try:
                actual_duplicates = read_duplicates(workspace / "output" / "duplicates.csv")
                if not (workspace / "workspace" / "notes.db").is_file():
                    raise ValueError("database missing")

                ranking_queries = [
                    ("ＣＡＦÉ RE\u0301SUME\u0301 alpha-42 the", 7),
                    ("Straße STRASSE", 10),
                    ("countprobe", 10),
                    ("the AND of", 10),
                ]
                ranking_ok = True
                for query, limit in ranking_queries:
                    actual = run_search(workspace, query, limit)
                    expected = expected_search(initial_notes, stopwords, query, limit)
                    ranking_ok = ranking_ok and results_match(actual, expected)

                tie_expected = expected_search(initial_notes, stopwords, "tieonly", 10)
                tie_first = run_search(workspace, "tieonly", 10)
                tie_second = run_search(workspace, "tieonly", 10)
                tie_limited = run_search(workspace, "tieonly", 2)
                stable_before = run_search(workspace, "steadymarker", 10)
                parseable = True

                checks[0] = ranking_ok
                checks[1] = (
                    tie_first == tie_second
                    and results_match(tie_first, tie_expected)
                    and results_match(tie_limited, tie_expected[:2])
                    and [item["path"] for item in tie_first] == sorted(item["path"] for item in tie_first)
                )
                checks[2] = actual_duplicates == expected_duplicates(initial_notes)
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError):
                notes.append("initial outputs are not parseable")

        # The withheld payload enters only after all initial build/search observations.
        merge_copy(future_payload, workspace)
        updated = run_update(workspace) if built.returncode == 0 else None
        if updated is not None and updated.returncode != 0:
            notes.append("update command failed")
        if parseable and updated is not None and updated.returncode == 0:
            try:
                post_notes = post_update_notes(workspace, initial_notes, stopwords)
                if len(post_notes) != 8_000:
                    raise ValueError("wrong post-update note count")
                post_duplicates = read_duplicates(workspace / "output" / "duplicates.csv")
                update_queries = [
                    ("newsignal revisedpulse", 10),
                    ("café countprobe", 10),
                    ("nearword24 replacementb", 10),
                    ("sig00000a", 10),
                ]
                update_ok = post_duplicates == expected_duplicates(post_notes)
                for query, limit in update_queries:
                    update_ok = update_ok and results_match(
                        run_search(workspace, query, limit),
                        expected_search(post_notes, stopwords, query, limit),
                    )
                stable_after = run_search(workspace, "steadymarker", 10)
                stable_expected = expected_search(post_notes, stopwords, "steadymarker", 10)
                checks[3] = update_ok
                checks[4] = (
                    stable_before is not None
                    and stable_before == stable_after
                    and results_match(stable_after, stable_expected)
                )
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError):
                notes.append("updated outputs are not parseable")
    except (OSError, RuntimeError, subprocess.SubprocessError):
        notes.append("main judge execution failed")
    finally:
        if holder is not None:
            holder.cleanup()
    return checks, artifact, runnable, parseable, notes


def edge_fixture(candidate: Path) -> bool:
    holder: tempfile.TemporaryDirectory[str] | None = None
    try:
        holder, workspace, _future_payload, copied = prepare(candidate, "edge")
        if not copied:
            return False
        stopwords = load_stopwords(workspace / "inputs" / "stopwords.txt")
        edge_notes = load_notes(workspace / "inputs" / "notes", stopwords)
        if len(edge_notes) != 2:
            return False
        raw_bodies = [note.normalized_body for note in edge_notes.values()]
        built = run_build(workspace)
        duplicates = read_duplicates(workspace / "output" / "duplicates.csv") if built.returncode == 0 else []
        expected = [("unicode/composed.md", "unicode/decomposed.md")]
        return (
            raw_bodies[0] == raw_bodies[1]
            and expected_duplicates(edge_notes) == expected
            and duplicates == expected
        )
    except (OSError, UnicodeError, csv.Error, ValueError, RuntimeError, subprocess.SubprocessError):
        return False
    finally:
        if holder is not None:
            holder.cleanup()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()

    checks, artifact, runnable, parseable, notes = main_fixture(candidate)
    edge_passed = edge_fixture(candidate)
    passed = sum(checks)
    if not artifact or not runnable:
        level = 0
    elif not parseable:
        level = 1
    elif passed == 5:
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_passed,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
