#!/usr/bin/env python3
"""Generate the initial note corpus outside the candidate workspace."""
from __future__ import annotations

import argparse
from pathlib import Path

TOTAL_MAIN_NOTES = 8_000


def write_note(root: Path, relative: str, title: str, body: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"Title: {title}\nTags: generated, research\nCreated: 2026-01-15\n\n{body}",
        encoding="utf-8",
        newline="\n",
    )


def main_notes() -> dict[str, tuple[str, str]]:
    near = [f"nearword{index:02d}" for index in range(25)]
    near_b = near[:-1] + ["replacementb"]
    near_c = ["replacementc"] + near[1:]
    return {
        "ranking/a.md": (
            "Ｃａｆé Résumé CountProbe",
            "café re\u0301sume\u0301 alpha-42 countprobe countprobe.\nStraße signal.\n",
        ),
        "ranking/b.md": (
            "Café",
            "résumé alpha 42 countprobe countprobe countprobe. STRASSE.\n",
        ),
        "ranking/c.md": (
            "Archive",
            "café café café café résumé alpha 42 countprobe.\n",
        ),
        "ties/a-first.md": ("Tie A", "tieonly uniquea.\n"),
        "ties/b-second.md": ("Tie B", "tieonly uniqueb.\n"),
        "ties/c-third.md": ("Tie C", "tieonly uniquec.\n"),
        "stable/a.md": ("Stable A", "steadymarker steadymarker anchorone.\n"),
        "stable/b.md": ("Stable B", "steadymarker anchortwo.\n"),
        "dup/exact-b.md": ("Exact B", "Shared Café Body.\nSecond line ①.\n"),
        "dup/exact-z.md": ("Exact Z", "SHARED Cafe\u0301 BODY.\nSecond line 1.\n"),
        "dup/boundary-a.md": (
            "Boundary A",
            " ".join([*(f"boundary{index:02d}" for index in range(23)), "onlya", "the"]) + ".\n",
        ),
        "dup/boundary-b.md": (
            "Boundary B",
            " ".join([*(f"boundary{index:02d}" for index in range(23)), "onlyb"]) + ".\n",
        ),
        "dup/near-a.md": ("Near A", " ".join(near) + ".\n"),
        "dup/near-b.md": ("Near B", " ".join(near_b) + ".\n"),
        "dup/near-c.md": ("Near C", " ".join(near_c) + ".\n"),
    }


def generate_main(output: Path) -> None:
    inputs = output / "inputs"
    notes_root = inputs / "notes"
    notes = main_notes()
    for relative, (title, body) in notes.items():
        write_note(notes_root, relative, title, body)

    filler_count = TOTAL_MAIN_NOTES - len(notes)
    token_neutral_padding = "-_/." * 700
    for index in range(filler_count):
        relative = f"archive/section-{index % 37:02d}/note-{index:05d}.md"
        tokens = " ".join(f"sig{index:05d}{suffix}" for suffix in "abcdefgh")
        write_note(
            notes_root,
            relative,
            f"Archive record {index:05d}",
            tokens + ".\n" + token_neutral_padding + "\n",
        )

    (inputs / "stopwords.txt").parent.mkdir(parents=True, exist_ok=True)
    (inputs / "stopwords.txt").write_text("the\nand\nof\nto\n", encoding="utf-8", newline="\n")


def generate_edge(output: Path) -> None:
    inputs = output / "inputs"
    notes_root = inputs / "notes"
    write_note(
        notes_root,
        "unicode/composed.md",
        "Composed",
        "A composed Café body with ① marker.\n",
    )
    write_note(
        notes_root,
        "unicode/decomposed.md",
        "Decomposed",
        "a composed Cafe\u0301 BODY with 1 marker.\n",
    )
    (inputs / "stopwords.txt").parent.mkdir(parents=True, exist_ok=True)
    (inputs / "stopwords.txt").write_text("the\nand\n", encoding="utf-8", newline="\n")


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
