#!/usr/bin/env python3
"""Generate the withheld update payload outside the candidate workspace."""
from __future__ import annotations

import argparse
from pathlib import Path

NEW_COUNT = 580
EDIT_COUNT = 20
DELETE_COUNT = 580


def write_note(root: Path, relative: str, title: str, body: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"Title: {title}\nTags: update, research\nCreated: 2026-02-20\n\n{body}",
        encoding="utf-8",
        newline="\n",
    )


def filler_path(index: int) -> str:
    return f"archive/section-{index % 37:02d}/note-{index:05d}.md"


def generate_main(output: Path) -> None:
    notes_root = output / "inputs" / "notes-new"
    near = [f"nearword{index:02d}" for index in range(25)]
    near_b = near[:-1] + ["replacementb"]

    # Three inserts exercise ranking and duplicate-component refreshes.
    write_note(
        notes_root,
        "incoming/search-new.md",
        "NewSignal",
        "newsignal newsignal revisedpulse countprobe.\n",
    )
    write_note(
        notes_root,
        "dup/000-new-canonical.md",
        "New exact canonical",
        "shared café body.\nsecond line 1.\n",
    )
    write_note(
        notes_root,
        "dup/near-new.md",
        "Near replacement",
        " ".join(near_b) + ".\n",
    )
    for index in range(NEW_COUNT - 3):
        tokens = " ".join(f"fresh{index:05d}{suffix}" for suffix in "abcdefgh")
        write_note(
            notes_root,
            f"incoming/batch-{index % 29:02d}/fresh-{index:05d}.md",
            f"Incoming record {index:05d}",
            tokens + ".\n",
        )

    # Twenty paths replace records already in the database.
    write_note(
        notes_root,
        "ranking/a.md",
        "Revised Alpha",
        "revisedpulse revisedpulse countprobe. Straße.\n",
    )
    write_note(
        notes_root,
        "dup/exact-b.md",
        "No longer exact",
        "This body was edited and is no longer a duplicate.\n",
    )
    for offset, index in enumerate(range(578, 596)):
        tokens = " ".join(f"edited{offset:05d}{suffix}" for suffix in "abcdefgh")
        write_note(
            notes_root,
            filler_path(index),
            f"Edited archive {index:05d}",
            tokens + " revisedarchive.\n",
        )

    deleted = ["ranking/c.md", "dup/near-a.md"]
    deleted.extend(filler_path(index) for index in range(578))
    if len(deleted) != DELETE_COUNT:
        raise AssertionError("wrong deletion count")
    deleted_path = output / "inputs" / "deleted.txt"
    deleted_path.parent.mkdir(parents=True, exist_ok=True)
    deleted_path.write_text("".join(path + "\n" for path in sorted(deleted)), encoding="utf-8", newline="\n")

    created = sum(1 for path in notes_root.rglob("*.md") if path.is_file())
    if created != NEW_COUNT + EDIT_COUNT:
        raise AssertionError(f"wrong update note count: {created}")


def generate_edge(output: Path) -> None:
    notes_root = output / "inputs" / "notes-new"
    notes_root.mkdir(parents=True, exist_ok=True)
    deleted = output / "inputs" / "deleted.txt"
    deleted.parent.mkdir(parents=True, exist_ok=True)
    deleted.write_text("", encoding="utf-8")


def generate(output: Path, fixture: str) -> None:
    if fixture == "main":
        generate_main(output)
    else:
        generate_edge(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    generate(args.output.resolve(), args.fixture)
