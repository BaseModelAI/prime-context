#!/usr/bin/env python3
"""Generate Task 16's initial visible main or edge payload."""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

SEED = 20260831 + 16


def write(path: Path, data: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8", newline="\n")


def make_main(output: Path) -> None:
    rng = random.Random(SEED)
    kb = output / "inputs" / "kb"
    write(kb / "docs" / "start.md", """# Start Here

[Old API](../legacy/api-old.md#CAFÉ-SETUP)
[Moved page](../guides/move-me.md#Overview!)
[Redirect moved](../legacy/moved-old.md#OVERVIEW)
[Unknown](../missing/nope.md)
[Ambiguous](../legacy/ambiguous.md)
![Old logo](../assets/old-logo.bin)
[Web](https://example.invalid/guide)
[Mail](mailto:docs@example.invalid)
[Root path](/reference/api.md)

```markdown
[Old API](../legacy/api-old.md#not-a-real-anchor)
![Old logo](../assets/old-logo.bin)
```
""")
    write(kb / "reference" / "api.md", """# API Reference

## Café Setup!
Install it.

## Repeat
First.

## Repeat
Second.

## A_B
Punctuation is removed from anchors.
""")
    write(kb / "guides" / "move-me.md", """# Moving Guide

## Overview
This document will move.

[API setup](../reference/api.md#CAFÉ SETUP!)
![Logo](../assets/logo.bin)
""")
    write(kb / "guides" / "consumer.md", """# Consumer

See [the overview](move-me.md#OVERVIEW!) and [the second repeat](../reference/api.md#repeat-1).
Return to [this page](#CONSUMER!).
""")
    write(kb / "overview.md", """# Knowledge Base

See [Start](docs/start.md) and [API](reference/api.md#api-reference).
""")
    for index in range(245):
        directory = kb / "articles" / f"section-{index % 7:02d}"
        number = rng.randrange(100000, 999999)
        write(
            directory / f"note-{index:03d}.md",
            f"# Note {index:03d}\n\nReference number {number}.\n",
        )
    write(kb / "assets" / "logo.bin", b"KB-LOGO\x00\x01\n")
    redirects = {
        "assets/old-logo.bin": ["assets/logo.bin"],
        "legacy/ambiguous.md": ["reference/api.md", "guides/move-me.md"],
        "legacy/api-old.md": ["reference/api.md"],
        "legacy/moved-old.md": ["guides/move-me.md"],
    }
    write(
        output / "inputs" / "redirects.json",
        json.dumps(redirects, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def make_edge(output: Path) -> None:
    kb = output / "inputs" / "kb"
    write(kb / "docs" / "edge.md", """# Fence Edge

Before.

   ~~~~markdown
[Broken](../legacy/api-old.md#WRONG)
![Old logo](../assets/old-logo.bin)
   ~~~~

After [valid](../reference/api.md#REAL HEADING!).
""")
    write(kb / "reference" / "api.md", "# API\n\n## Real Heading\nText.\n")
    write(kb / "assets" / "logo.bin", b"EDGE\n")
    redirects = {
        "assets/old-logo.bin": ["assets/logo.bin"],
        "legacy/api-old.md": ["reference/api.md"],
    }
    write(
        output / "inputs" / "redirects.json",
        json.dumps(redirects, indent=2, sort_keys=True) + "\n",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    (make_main if args.fixture == "main" else make_edge)(args.output)


if __name__ == "__main__":
    main()
