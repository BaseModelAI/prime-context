#!/usr/bin/env python3
"""Create deterministic main or edge fixtures for Task 15."""
from __future__ import annotations

import argparse
import calendar
import io
import json
from pathlib import Path
import random
import shutil
import tarfile
import zipfile

SEED = 20260831 + 15


def epoch(stamp: str) -> int:
    parts = tuple(int(value) for value in stamp.replace("T", "-").replace(":", "-").replace("Z", "").split("-"))
    return calendar.timegm(parts)


def add_tar_file(archive: tarfile.TarFile, name: str, data: bytes, stamp: str) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mtime = epoch(stamp)
    info.mode = 0o640
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    archive.addfile(info, io.BytesIO(data))


def add_tar_link(archive: tarfile.TarFile, name: str, target: str, stamp: str) -> None:
    info = tarfile.TarInfo(name)
    info.type = tarfile.SYMTYPE
    info.linkname = target
    info.mtime = epoch(stamp)
    info.mode = 0o777
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    archive.addfile(info)


def add_zip_file(archive: zipfile.ZipFile, name: str, data: bytes, stamp: str) -> None:
    date, clock = stamp.removesuffix("Z").split("T")
    info = zipfile.ZipInfo(name, tuple(map(int, date.split("-"))) + tuple(map(int, clock.split(":"))))
    info.create_system = 3
    info.external_attr = (0o100640 << 16)
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data)


def write_main(inputs: Path, rng: random.Random) -> None:
    with tarfile.open(inputs / "snapshot-01.tar", "w") as archive:
        add_tar_file(archive, "docs/report.txt", b"quarterly report: draft one\n", "2025-04-01T08:00:00Z")
        add_tar_file(archive, "data/table.csv", b"item,value\nA,1\n", "2025-04-02T09:30:00Z")
        add_tar_file(archive, "old/expired.txt", b"not yet eligible\n", "2025-05-04T00:00:00Z")
        for index in range(12):
            add_tar_file(archive, f"filler/early-{index:02d}.bin", rng.randbytes(31 + index), "2025-03-15T10:00:00Z")

    with zipfile.ZipFile(inputs / "snapshot-02.zip", "w") as archive:
        add_zip_file(archive, "docs/report.txt", b"quarterly report: approved\n", "2025-04-20T16:45:00Z")
        add_zip_file(archive, "config/app.ini", b"[service]\nworkers=3\n", "2025-04-18T06:00:00Z")
        add_zip_file(archive, "data/table.csv", b"item,value\nA,2\nB,4\n", "2025-04-29T19:20:00Z")
        for index in range(12):
            add_zip_file(archive, f"filler/middle-{index:02d}.bin", rng.randbytes(43 + index), "2025-04-10T11:00:00Z")

    with tarfile.open(inputs / "snapshot-03.tar", "w") as archive:
        add_tar_file(archive, "docs/report.txt", b"quarterly report: after cutoff\n", "2025-05-02T07:00:00Z")
        add_tar_file(archive, "config/app.ini", b"[service]\nworkers=5\n", "2025-05-01T11:00:00Z")
        add_tar_file(archive, "images/logo.bin", b"\x89RESTORE\x00LOGO\xff\n", "2025-04-30T23:59:58Z")
        add_tar_link(archive, "data/table.csv", "../elsewhere/table.csv", "2025-05-01T11:30:00Z")
        for index in range(12):
            add_tar_file(archive, f"filler/late-{index:02d}.bin", rng.randbytes(37 + index), "2025-04-25T15:00:00Z")

    request = {
        "cutoff": "2025-05-01T12:00:00Z",
        "paths": [
            "missing/not-there.txt",
            "images/logo.bin",
            "data/table.csv",
            "docs/report.txt",
            "old/expired.txt",
            "config/app.ini",
        ],
    }
    (inputs / "restore_request.json").write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")


def write_edge(inputs: Path, rng: random.Random) -> None:
    with tarfile.open(inputs / "snapshot-01.tar", "w") as archive:
        add_tar_file(archive, "../requested.txt", b"must never be restored\n", "2025-04-01T08:00:00Z")
        add_tar_file(archive, "filler/safe.bin", rng.randbytes(19), "2025-03-01T00:00:00Z")
    with zipfile.ZipFile(inputs / "snapshot-02.zip", "w") as archive:
        add_zip_file(archive, "filler/other.bin", rng.randbytes(23), "2025-03-02T00:00:00Z")
    with tarfile.open(inputs / "snapshot-03.tar", "w") as archive:
        add_tar_file(archive, "filler/last.bin", rng.randbytes(29), "2025-03-03T00:00:00Z")
    request = {"cutoff": "2025-05-01T12:00:00Z", "paths": ["requested.txt"]}
    (inputs / "restore_request.json").write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")


def seed(workspace: Path, fixture: str) -> None:
    task_dir = Path(__file__).resolve().parent
    if workspace.exists():
        if workspace.is_symlink() or not workspace.is_dir():
            raise ValueError(f"workspace is not a normal directory: {workspace}")
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    inputs = workspace / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    (workspace / "output").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(task_dir / "TASK.md", workspace / "TASK.md")
    rng = random.Random(SEED)
    if fixture == "main":
        write_main(inputs, rng)
    else:
        write_edge(inputs, rng)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)


if __name__ == "__main__":
    main()
