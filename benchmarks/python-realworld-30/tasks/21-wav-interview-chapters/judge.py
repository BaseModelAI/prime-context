#!/usr/bin/env python3
"""Fresh main-and-edge semantic judge for Task 21."""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any

TASK = Path(__file__).resolve().parent
PYTHON = "/usr/bin/python3.12" if Path("/usr/bin/python3.12").is_file() else "python3.12"
ARTIFACTS = (Path("solution/__init__.py"), Path("solution/audio_chapters.py"))
WavParams = tuple[int, int, int, str, str]


def invoke(arguments: list[str], *, cwd: Path, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    command = [PYTHON, "-E", "-S", *arguments]
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        completed = subprocess.run(command, cwd=cwd, stdout=stdout, stderr=stderr, timeout=timeout)
        stdout.seek(0)
        stderr.seek(0)
        return subprocess.CompletedProcess(
            command,
            completed.returncode,
            stdout.read(4096).decode("utf-8", "replace"),
            stderr.read(4096).decode("utf-8", "replace"),
        )


def copy_artifacts(candidate: Path, workspace: Path) -> None:
    """Copy only the two solution files declared in TASK.md."""
    for relative in ARTIFACTS:
        source = candidate / relative
        if source.is_file():
            target = workspace / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def make_inputs_read_only(workspace: Path) -> None:
    inputs = workspace / "inputs"
    for path in sorted(inputs.rglob("*"), reverse=True):
        path.chmod(0o555 if path.is_dir() else 0o444)
    inputs.chmod(0o555)


def run_fixture(
    candidate: Path, fixture: str
) -> tuple[Path, tempfile.TemporaryDirectory[str], dict[str, bool], list[str]]:
    holder = tempfile.TemporaryDirectory(prefix=f"task21-{fixture}-")
    workspace = Path(holder.name) / "workspace"
    notes: list[str] = []
    seeded = invoke(
        [str(TASK / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        cwd=TASK,
        timeout=60,
    )
    if seeded.returncode:
        notes.append("fixture seed failed")
        return workspace, holder, {}, notes

    generated = invoke(
        [
            str(TASK / "stages/stereo/_generate.py"),
            "--output",
            str(workspace),
            "--fixture",
            fixture,
        ],
        cwd=TASK / "stages/stereo",
        timeout=60,
    )
    if generated.returncode:
        notes.append("stage fixture generation failed")
        return workspace, holder, {}, notes

    copy_artifacts(candidate, workspace)
    make_inputs_read_only(workspace)
    pairs = (
        [
            ("interview.wav", "transcript.csv"),
            ("interview_stereo.wav", "interview_stereo.csv"),
        ]
        if fixture == "main"
        else [("edge_silence.wav", "edge_silence.csv")]
    )
    statuses: dict[str, bool] = {}
    for wav_name, transcript_name in pairs:
        completed = invoke(
            [
                "-m",
                "solution.audio_chapters",
                f"inputs/{wav_name}",
                f"inputs/{transcript_name}",
                "--output",
                "output",
            ],
            cwd=workspace,
        )
        statuses[Path(wav_name).stem] = completed.returncode == 0
        if completed.returncode:
            detail = completed.stderr.strip().replace("\n", " ")[-240:]
            notes.append(f"command failed for {wav_name}" + (f": {detail}" if detail else ""))
    return workspace, holder, statuses, notes


def read_wav(path: Path) -> tuple[WavParams, int, bytes]:
    with wave.open(str(path), "rb") as audio:
        params: WavParams = (
            audio.getnchannels(),
            audio.getsampwidth(),
            audio.getframerate(),
            audio.getcomptype(),
            audio.getcompname(),
        )
        frame_count = audio.getnframes()
        frames = audio.readframes(frame_count)
    return params, frame_count, frames


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("JSON root is not an object")
    return value


def read_speaker_time(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames != ["speaker", "duration_seconds"]:
            raise ValueError("speaker_time.csv has the wrong header")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError("speaker_time.csv has a malformed row")
    return rows


def expected_mono_chapters() -> list[dict[str, Any]]:
    return [
        {
            "number": 1,
            "file": "chapters/01.wav",
            "start_seconds": "0.000",
            "end_seconds": "598.000",
            "utterances": [
                {
                    "speaker": "Alice",
                    "start_seconds": "0.000",
                    "end_seconds": "3.000",
                    "text": "Opening",
                },
                {
                    "speaker": "Bob",
                    "start_seconds": "588.000",
                    "end_seconds": "598.000",
                    "text": "A boundary-spanning answer",
                },
            ],
        },
        {
            "number": 2,
            "file": "chapters/02.wav",
            "start_seconds": "598.000",
            "end_seconds": "1318.000",
            "utterances": [
                {
                    "speaker": "Bob",
                    "start_seconds": "598.000",
                    "end_seconds": "608.000",
                    "text": "A boundary-spanning answer",
                },
                {
                    "speaker": "Carol",
                    "start_seconds": "698.250",
                    "end_seconds": "703.750",
                    "text": "Middle section",
                },
                {
                    "speaker": "Alice",
                    "start_seconds": "1316.000",
                    "end_seconds": "1318.000",
                    "text": "Closing",
                },
            ],
        },
        {
            "number": 3,
            "file": "chapters/03.wav",
            "start_seconds": "1318.000",
            "end_seconds": "1320.000",
            "utterances": [
                {
                    "speaker": "Alice",
                    "start_seconds": "1318.000",
                    "end_seconds": "1320.000",
                    "text": "Closing",
                }
            ],
        },
    ]


def expected_stereo_chapters() -> list[dict[str, Any]]:
    return [
        {
            "number": 1,
            "file": "chapters/01.wav",
            "start_seconds": "0.000",
            "end_seconds": "603.000",
            "utterances": [
                {
                    "speaker": "Dana",
                    "start_seconds": "0.000",
                    "end_seconds": "2.000",
                    "text": "Stereo opening",
                },
                {
                    "speaker": "Eli",
                    "start_seconds": "593.000",
                    "end_seconds": "603.000",
                    "text": "Stereo boundary",
                },
            ],
        },
        {
            "number": 2,
            "file": "chapters/02.wav",
            "start_seconds": "603.000",
            "end_seconds": "700.000",
            "utterances": [
                {
                    "speaker": "Eli",
                    "start_seconds": "603.000",
                    "end_seconds": "605.000",
                    "text": "Stereo boundary",
                },
                {
                    "speaker": "Dana",
                    "start_seconds": "698.000",
                    "end_seconds": "700.000",
                    "text": "Stereo close",
                },
            ],
        },
    ]


def boundaries(value: dict[str, Any]) -> tuple[str | None, list[tuple[Any, Any, Any]]]:
    chapters = value.get("chapters")
    if not isinstance(chapters, list):
        raise ValueError("chapters is not a list")
    return value.get("duration_seconds"), [
        (chapter.get("number"), chapter.get("start_seconds"), chapter.get("end_seconds"))
        for chapter in chapters
        if isinstance(chapter, dict)
    ]


def chapter_audio_matches(
    output: Path,
    params: WavParams,
    clean_frames: bytes,
    frame_size: int,
    cuts: list[int],
) -> bool:
    chapters = output / "chapters"
    names = sorted(path.name for path in chapters.glob("*.wav"))
    if names != [f"{number:02d}.wav" for number in range(1, len(cuts))]:
        return False
    for number, (start, end) in enumerate(zip(cuts, cuts[1:]), 1):
        actual_params, actual_count, actual_frames = read_wav(chapters / f"{number:02d}.wav")
        if actual_params != params or actual_count != end - start:
            return False
        if actual_frames != clean_frames[start * frame_size : end * frame_size]:
            return False
    return True


def outputs_parse(workspace: Path, statuses: dict[str, bool]) -> bool:
    if not statuses or not all(statuses.values()):
        return False
    try:
        for stem in ("interview", "interview_stereo"):
            output = workspace / "output" / stem
            read_wav(output / "clean.wav")
            value = read_json(output / "chapters.json")
            if not isinstance(value.get("chapters"), list):
                return False
            read_speaker_time(output / "speaker_time.csv")
            if not (output / "chapters").is_dir():
                return False
        return True
    except (OSError, EOFError, UnicodeError, ValueError, json.JSONDecodeError, wave.Error):
        return False


def main_checks(workspace: Path) -> tuple[list[bool], list[str]]:
    checks = [False] * 5
    labels = [
        "mono frame/sample math and stem output layout",
        "trim points and clean PCM frames",
        "boundary choice and fallback timing",
        "chapter WAV headers and data lengths",
        "transcript clipping and per-speaker duration totals",
    ]
    mono = workspace / "output/interview"
    stereo = workspace / "output/interview_stereo"

    try:
        mono_source_params, mono_source_count, mono_source_frames = read_wav(
            workspace / "inputs/interview.wav"
        )
        mono_clean_params, mono_clean_count, mono_clean_frames = read_wav(mono / "clean.wav")
        checks[0] = (
            mono_source_params == (1, 2, 100, "NONE", "not compressed")
            and mono_source_count == 132_500
            and len(mono_source_frames) == mono_source_count * 2
            and mono_clean_params == mono_source_params
            and len(mono_clean_frames) == mono_clean_count * 2
            and read_json(mono / "chapters.json").get("chapters") is not None
            and read_speaker_time(mono / "speaker_time.csv") is not None
            and not (workspace / "output/clean.wav").exists()
        )
    except (OSError, EOFError, UnicodeError, ValueError, json.JSONDecodeError, csv.Error, wave.Error):
        pass

    try:
        mono_source_params, _, mono_source_frames = read_wav(workspace / "inputs/interview.wav")
        stereo_source_params, _, stereo_source_frames = read_wav(
            workspace / "inputs/interview_stereo.wav"
        )
        mono_clean_params, mono_clean_count, mono_clean_frames = read_wav(mono / "clean.wav")
        stereo_clean_params, stereo_clean_count, stereo_clean_frames = read_wav(
            stereo / "clean.wav"
        )
        checks[1] = (
            mono_clean_params == mono_source_params
            and mono_clean_count == 132_000
            and mono_clean_frames == mono_source_frames[200 * 2 : 132_200 * 2]
            and stereo_clean_params == stereo_source_params
            and stereo_clean_count == 70_000
            and stereo_clean_frames == stereo_source_frames[200 * 4 : 70_200 * 4]
        )
    except (OSError, EOFError, wave.Error):
        pass

    try:
        checks[2] = boundaries(read_json(mono / "chapters.json")) == (
            "1320.000",
            [(1, "0.000", "598.000"), (2, "598.000", "1318.000"), (3, "1318.000", "1320.000")],
        ) and boundaries(read_json(stereo / "chapters.json")) == (
            "700.000",
            [(1, "0.000", "603.000"), (2, "603.000", "700.000")],
        )
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
        pass

    try:
        mono_params, mono_count, mono_frames = read_wav(mono / "clean.wav")
        stereo_params, stereo_count, stereo_frames = read_wav(stereo / "clean.wav")
        checks[3] = (
            mono_count == 132_000
            and stereo_count == 70_000
            and chapter_audio_matches(mono, mono_params, mono_frames, 2, [0, 59_800, 131_800, 132_000])
            and chapter_audio_matches(stereo, stereo_params, stereo_frames, 4, [0, 60_300, 70_000])
        )
    except (OSError, EOFError, wave.Error):
        pass

    try:
        checks[4] = (
            read_json(mono / "chapters.json")
            == {"duration_seconds": "1320.000", "chapters": expected_mono_chapters()}
            and read_speaker_time(mono / "speaker_time.csv")
            == [
                {"speaker": "Alice", "duration_seconds": "7.000"},
                {"speaker": "Bob", "duration_seconds": "20.000"},
                {"speaker": "Carol", "duration_seconds": "5.500"},
            ]
            and read_json(stereo / "chapters.json")
            == {"duration_seconds": "700.000", "chapters": expected_stereo_chapters()}
            and read_speaker_time(stereo / "speaker_time.csv")
            == [
                {"speaker": "Dana", "duration_seconds": "4.000"},
                {"speaker": "Eli", "duration_seconds": "12.000"},
            ]
        )
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError, csv.Error):
        pass

    notes = [
        f"main check {number} failed: {label}"
        for number, (passed, label) in enumerate(zip(checks, labels), 1)
        if not passed
    ]
    return checks, notes


def edge_check(workspace: Path, statuses: dict[str, bool]) -> tuple[bool, str]:
    if not statuses.get("edge_silence"):
        return False, "all-silence command failed"
    output = workspace / "output/edge_silence"
    try:
        source_params, _, _ = read_wav(workspace / "inputs/edge_silence.wav")
        clean_params, frame_count, frames = read_wav(output / "clean.wav")
        passed = (
            source_params == (1, 2, 80, "NONE", "not compressed")
            and clean_params == source_params
            and frame_count == 0
            and frames == b""
            and read_json(output / "chapters.json")
            == {"duration_seconds": "0.000", "chapters": []}
            and not list((output / "chapters").glob("*.wav"))
            and read_speaker_time(output / "speaker_time.csv")
            == [{"speaker": "Ghost", "duration_seconds": "0.000"}]
            and not (workspace / "output/clean.wav").exists()
        )
        return passed, "" if passed else "all-silence output is not exact"
    except (OSError, EOFError, UnicodeError, ValueError, json.JSONDecodeError, csv.Error, wave.Error):
        return False, "all-silence output is missing or unreadable"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    arguments = parser.parse_args()
    candidate = arguments.workspace.resolve()
    artifact = (candidate / "solution/audio_chapters.py").is_file()

    main_work, main_holder, main_statuses, notes = run_fixture(candidate, "main")
    try:
        parseable = outputs_parse(main_work, main_statuses)
        checks, main_notes = main_checks(main_work)
        notes.extend(main_notes)
    finally:
        main_holder.cleanup()

    edge_work, edge_holder, edge_statuses, edge_notes = run_fixture(candidate, "edge")
    try:
        edge_passed, edge_note = edge_check(edge_work, edge_statuses)
        notes.extend(edge_notes)
        if edge_note and edge_note not in notes:
            notes.append(edge_note)
    finally:
        edge_holder.cleanup()

    passed = sum(checks)
    if passed == 5 and edge_passed:
        level = 5
    elif passed == 5:
        level = 4
    elif passed:
        level = 3
    elif parseable:
        level = 2
    elif artifact:
        level = 1
    else:
        level = 0
    print(
        json.dumps(
            {
                "status": "pass" if level == 5 else "fail",
                "progress_level": level,
                "main_checks_passed": passed,
                "main_checks_total": 5,
                "edge_check_passed": edge_passed,
                "notes": notes,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
