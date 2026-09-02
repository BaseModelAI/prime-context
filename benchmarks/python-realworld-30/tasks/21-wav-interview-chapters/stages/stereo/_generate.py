#!/usr/bin/env python3
"""Generate the deterministic stage-two stereo input payload."""
from __future__ import annotations

import argparse
import csv
import random
import struct
import wave
from pathlib import Path

SEED = 20260831 + 21


def main(output: Path, fixture: str) -> None:
    (output / "stage.json").unlink(missing_ok=True)
    if fixture == "edge":
        return

    rng = random.Random(SEED)
    inputs = output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    with (inputs / "interview_stereo.csv").open(
        "w", newline="", encoding="utf-8"
    ) as transcript:
        writer = csv.writer(transcript, lineterminator="\n")
        writer.writerow(["speaker", "start_seconds", "end_seconds", "text"])
        writer.writerows(
            [
                ["Dana", "0.000", "4.000", "Stereo opening"],
                ["Eli", "595.000", "607.000", "Stereo boundary"],
                ["Dana", "700.000", "704.000", "Stereo close"],
            ]
        )

    rate = 100
    frame_count = 704 * rate
    with wave.open(str(inputs / "interview_stereo.wav"), "wb") as audio:
        audio.setparams((2, 2, rate, frame_count, "NONE", "not compressed"))
        pending = bytearray()
        for frame in range(frame_count):
            at = frame / rate
            if at < 2 or 604 <= at < 606 or at >= 702:
                samples = (0, 0)
            elif 601 <= at < 603:
                # Only the left channel is quiet, so these frames are not silent.
                samples = (0, 1_200)
            else:
                samples = (
                    (1_600 if frame % 2 else -1_600) + rng.randrange(-40, 41),
                    (-1_500 if frame % 2 else 1_500) + rng.randrange(-40, 41),
                )
            pending.extend(struct.pack("<hh", *samples))
            if len(pending) >= 64 * 1024:
                audio.writeframesraw(pending)
                pending.clear()
        if pending:
            audio.writeframesraw(pending)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    main(arguments.output.resolve(), arguments.fixture)
