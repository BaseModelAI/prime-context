"""One-shot delivery worker."""

from __future__ import annotations

from pathlib import Path

from .db import connect


def run_worker(db_path: str, sink_url_file: str, now: str) -> int:
    """Deliver due events and persist their results.

    URL loading and database setup are included so the command has a useful
    starting shape.  Selection, HTTP delivery, and retry updates remain to be
    implemented.
    """
    sink_url = Path(sink_url_file).read_text(encoding="utf-8").strip()
    if not sink_url:
        raise ValueError("sink URL is empty")
    with connect(db_path):
        pass
    # TODO: deliver due events using sink_url and now.
    return 0
