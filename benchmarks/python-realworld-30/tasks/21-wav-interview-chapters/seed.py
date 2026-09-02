#!/usr/bin/env python3
"""Generate the fresh main fixture or the isolated all-silence edge fixture."""
from __future__ import annotations

import argparse
import csv
import random
import shutil
import struct
import wave
from pathlib import Path

SEED = 20260831 + 21


def write_wav(
    path: Path,
    *,
    channels: int,
    rate: int,
    seconds: int,
    silent_intervals: list[tuple[float, float]],
    rng: random.Random,
) -> None:
    """Write deterministic signed 16-bit PCM without holding it all in memory."""
    frame_count = rate * seconds
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = bytearray()
    with wave.open(str(path), "wb") as output:
        output.setparams((channels, 2, rate, frame_count, "NONE", "not compressed"))
        for frame in range(frame_count):
            at = frame / rate
            silent = any(start <= at < end for start, end in silent_intervals)
            samples: list[int] = []
            for channel in range(channels):
                if silent:
                    sample = rng.randrange(-150, 151)
                else:
                    base = 1_800 if (frame + channel) % 2 else -1_800
                    sample = base + rng.randrange(-100, 101)
                samples.append(sample)
            pending.extend(struct.pack("<" + "h" * channels, *samples))
            if len(pending) >= 64 * 1024:
                output.writeframesraw(pending)
                pending.clear()
        if pending:
            output.writeframesraw(pending)


def write_transcript(path: Path, rows: list[list[str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(["speaker", "start_seconds", "end_seconds", "text"])
        writer.writerows(rows)


def seed(workspace: Path, fixture: str) -> None:
    rng = random.Random(SEED)
    if workspace.exists():
        shutil.rmtree(workspace)
    inputs = workspace / "inputs"
    inputs.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()

    if fixture == "main":
        # The two internal silence midpoints, after the two-second trim, are
        # 598.005 and 601.995 seconds. They tie around the 600-second target;
        # the earlier interval wins and its half-frame midpoint rounds earlier.
        # No silence is in the next window, so the 12-minute fallback is used.
        write_wav(
            inputs / "interview.wav",
            channels=1,
            rate=100,
            seconds=1325,
            silent_intervals=[
                (0.0, 2.0),
                (599.0, 601.01),
                (603.0, 604.99),
                (1322.0, 1325.0),
            ],
            rng=rng,
        )
        write_transcript(
            inputs / "transcript.csv",
            [
                ["Alice", "1.000", "5.000", "Opening"],
                ["Bob", "590.000", "610.000", "A boundary-spanning answer"],
                ["Carol", "700.250", "705.750", "Middle section"],
                ["Alice", "1318.000", "1324.000", "Closing"],
            ],
        )
        return

    write_wav(
        inputs / "edge_silence.wav",
        channels=1,
        rate=80,
        seconds=4,
        silent_intervals=[(0.0, 4.0)],
        rng=rng,
    )
    write_transcript(
        inputs / "edge_silence.csv",
        [["Ghost", "0.500", "3.500", "This is removed"]],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    seed(arguments.workspace.resolve(), arguments.fixture)
