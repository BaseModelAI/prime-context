#!/usr/bin/env python3
"""Run a retained, four-wide vanilla-versus-current realistic-30 benchmark round."""

from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import random
import secrets
import shutil
import subprocess
import sys
import time
from typing import Any

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
VARIANTS = ("vanilla", "progressive")
SAMPLE_SIZE = 10
TIMEOUT_SECONDS = 600
MAX_WORKERS = 4


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
benchmark = load_module("run", HERE / "run.py")
sys.modules["run"] = benchmark
major = load_module("prime_context_major_spec", HERE / "major-spec.py")


def select_tasks(
    value: str | None,
    seed: int | None,
    available: set[int],
    excluded: set[int] | None = None,
) -> tuple[list[int], int | None, str]:
    excluded = excluded or set()
    unknown = excluded - available
    if unknown:
        raise ValueError(f"unknown excluded task ids: {sorted(unknown)}")
    if value:
        selected = benchmark.parse_task_ids(value, available)
        overlap = set(selected) & excluded
        if overlap:
            raise ValueError(f"explicit tasks overlap exclusions: {sorted(overlap)}")
        return selected, seed, "explicit-regression-retest"
    eligible = sorted(available - excluded)
    if len(eligible) < SAMPLE_SIZE:
        raise ValueError(f"need at least {SAMPLE_SIZE} eligible tasks, found {len(eligible)}")
    chosen_seed = seed if seed is not None else secrets.randbits(63)
    selected = random.Random(chosen_seed).sample(eligible, SAMPLE_SIZE)
    return selected, chosen_seed, "random-without-replacement"


def run_arm(
    runtime: dict[str, Any],
    task_dir: Path,
    scenario: dict[str, Any],
    auth_file: Path,
    config: dict[str, Any],
) -> dict[str, Any]:
    controlled = json.loads(json.dumps(scenario))
    controlled["benchmark"].update(
        {
            "provider": config["provider"],
            "model": config["model"],
            "thinking": config["thinking"],
            "condition_timeout_seconds": TIMEOUT_SECONDS,
        }
    )
    try:
        return benchmark.run_condition(
            runtime["name"],
            task_dir,
            controlled,
            runtime["root"],
            None,
            None,
            auth_file,
            TIMEOUT_SECONDS,
            config["reserve_tokens"],
            docker_image=runtime["image"],
            global_agents_file=runtime["agents_file"],
            container_package=runtime["container_package"],
            retain_docker_artifacts=True,
        )
    except Exception as exc:
        return major.failed_result(controlled, runtime["name"], exc)


def strict_correct(result: dict[str, Any]) -> bool:
    return bool(result["task_completed"] and result["final_response_exact"])


def metric_delta(candidate: float, reference: float) -> dict[str, float | None]:
    return {
        "candidate": candidate,
        "reference": reference,
        "delta": candidate - reference,
        "delta_percent": ((candidate / reference) - 1.0) * 100.0 if reference else None,
    }


def analyze_pair(task_id: int, slug: str, pair: dict[str, dict[str, Any]]) -> dict[str, Any]:
    vanilla = pair["vanilla"]
    progressive = pair["progressive"]
    vanilla_strict = strict_correct(vanilla)
    progressive_strict = strict_correct(progressive)
    comparison: dict[str, Any] = {
        "strict_correctness_regression": vanilla_strict and not progressive_strict,
        "strict_correctness_gain": progressive_strict and not vanilla_strict,
        "matched_strict_correct": vanilla_strict and progressive_strict,
        "efficiency": None,
    }
    if vanilla_strict and progressive_strict:
        vm = vanilla["recursive_metrics"]
        pm = progressive["recursive_metrics"]
        comparison["efficiency"] = {
            "wall_seconds": metric_delta(progressive["wall_seconds"], vanilla["wall_seconds"]),
            "model_calls": metric_delta(pm["model_calls"], vm["model_calls"]),
            "compactions": metric_delta(pm["compactions"], vm["compactions"]),
            "total_tokens": metric_delta(pm["usage"]["totalTokens"], vm["usage"]["totalTokens"]),
            "api_cost": metric_delta(pm["cost"]["total"], vm["cost"]["total"]),
        }
    return {
        "task_id": task_id,
        "task_slug": slug,
        "arms": {
            name: {
                "strict_correct": strict_correct(result),
                "task_completed": result["task_completed"],
                "tests": f"{result['passing_tests']}/{result['total_tests']}",
                "goal_status": result["goal_status"],
                "final_response_exact": result["final_response_exact"],
                "error": result["error"],
                "wall_seconds": result["wall_seconds"],
                "lifecycle_wall_seconds": result.get("lifecycle_wall_seconds"),
                "model_calls": result["recursive_metrics"]["model_calls"],
                "compactions": result["recursive_metrics"]["compactions"],
                "total_tokens": result["recursive_metrics"]["usage"]["totalTokens"],
                "api_cost": result["recursive_metrics"]["cost"]["total"],
                "docker_artifacts": result.get("docker_artifacts"),
            }
            for name, result in pair.items()
        },
        "comparison": comparison,
    }


def write_progress(
    output: Path,
    manifest: dict[str, Any],
    task_meta: dict[int, dict[str, Any]],
    results: dict[tuple[int, str], dict[str, Any]],
    started: float,
) -> dict[str, Any]:
    pairs = []
    for task_id in manifest["sample"]["task_ids"]:
        pair = {name: results[(task_id, name)] for name in VARIANTS if (task_id, name) in results}
        if len(pair) == len(VARIANTS):
            pairs.append(analyze_pair(task_id, task_meta[task_id]["slug"], pair))
    payload = {
        "manifest": manifest,
        "elapsed_seconds": time.monotonic() - started,
        "completed_jobs": len(results),
        "total_jobs": len(manifest["queue"]),
        "pairs": pairs,
    }
    temporary = output / "progress.json.tmp"
    temporary.write_text(json.dumps(payload, indent=2) + "\n")
    temporary.replace(output / "progress.json")
    return payload


def write_final_report(output: Path, payload: dict[str, Any]) -> None:
    pairs = payload["pairs"]
    strict = {
        name: sum(bool(pair["arms"][name]["strict_correct"]) for pair in pairs)
        for name in VARIANTS
    }
    matched = [pair for pair in pairs if pair["comparison"]["matched_strict_correct"]]
    regressions = [pair["task_id"] for pair in pairs if pair["comparison"]["strict_correctness_regression"]]
    gains = [pair["task_id"] for pair in pairs if pair["comparison"]["strict_correctness_gain"]]
    summary = {
        **payload,
        "strict_correct_tasks": strict,
        "matched_strict_correct_tasks": len(matched),
        "strict_regression_task_ids": regressions,
        "strict_gain_task_ids": gains,
    }
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    lines = [
        "# Vanilla versus current Prime Context benchmark",
        "",
        f"- Tasks: `{payload['manifest']['sample']['task_ids']}`",
        f"- Seed: `{payload['manifest']['sample']['seed']}`",
        f"- Timeout: exactly `{TIMEOUT_SECONDS}` seconds from the initial instruction",
        f"- Maximum concurrent jobs: `{MAX_WORKERS}`",
        f"- Strict correct: vanilla `{strict['vanilla']}/{len(pairs)}`, progressive `{strict['progressive']}/{len(pairs)}`",
        f"- Strict regressions: `{regressions}`",
        f"- Strict gains: `{gains}`",
        "",
        "| Task | Vanilla | Progressive | V wall | P wall | V tokens | P tokens |",
        "|---:|:---:|:---:|---:|---:|---:|---:|",
    ]
    for pair in pairs:
        vanilla = pair["arms"]["vanilla"]
        progressive = pair["arms"]["progressive"]
        lines.append(
            f"| {pair['task_id']} | {'correct' if vanilla['strict_correct'] else 'incorrect'} "
            f"| {'correct' if progressive['strict_correct'] else 'incorrect'} "
            f"| {vanilla['wall_seconds']:.2f} | {progressive['wall_seconds']:.2f} "
            f"| {vanilla['total_tokens']:,} | {progressive['total_tokens']:,} |"
        )
    (output / "report.md").write_text("\n".join(lines) + "\n")


def main() -> int:
    defaults = major.load_config()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--round", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--tasks", help="explicit task IDs for a focused regression retest")
    parser.add_argument("--seed", type=int, help="replay a random selection; omit for a fresh round")
    parser.add_argument("--exclude-tasks", help="task IDs excluded from a fresh random selection")
    parser.add_argument("--progressive-source", default=str(PROJECT_ROOT))
    parser.add_argument("--auth-file", type=Path, default=Path.home() / ".prime" / "agent" / "auth.json")
    args = parser.parse_args()

    task_index = benchmark.load_task_index()
    available = set(task_index)
    try:
        excluded = set(benchmark.parse_task_ids(args.exclude_tasks, available)) if args.exclude_tasks else set()
        task_ids, seed, method = select_tasks(args.tasks, args.seed, available, excluded)
    except ValueError as exc:
        parser.error(str(exc))
    auth_file = args.auth_file.expanduser().resolve()
    if not auth_file.is_file():
        parser.error(f"Prime Agent auth file not found: {auth_file}")
    if not shutil.which("docker") or not shutil.which("npm"):
        parser.error("docker and npm are required")

    active_images = {
        str(defaults[key])
        for key in ["base_image", "vanilla_image", "published_image", "progressive_image"]
    }
    benchmark.cleanup_docker_artifacts(active_images)
    output = args.output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=False)
    config = {**defaults, "timeout_seconds": TIMEOUT_SECONDS}
    build_root = output / "_image-build"
    try:
        image_runtimes = major.ensure_benchmark_images(config, args.progressive_source, build_root)
    finally:
        shutil.rmtree(build_root, ignore_errors=True)

    session_policy = (HERE / defaults["session_policy"]).resolve()
    runtimes = {
        name: major.prepare_variant(name, output, image_runtimes[name], session_policy)
        for name in VARIANTS
    }
    task_meta = {
        task_id: json.loads((task_index[task_id] / "scenario.json").read_text())
        for task_id in task_ids
    }
    queue_order = [
        {"position": position, "task_id": task_id, "variant": name}
        for position, (task_id, name) in enumerate(
            ((task_id, name) for task_id in task_ids for name in VARIANTS), start=1
        )
    ]
    git_head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=PROJECT_ROOT, text=True, capture_output=True, check=True
    ).stdout.strip()
    manifest = {
        "schema": "prime-context.vanilla-current-benchmark/v1",
        "round": args.round,
        "sample": {
            "method": method,
            "seed": seed,
            "task_ids": task_ids,
            "excluded_task_ids": sorted(excluded),
        },
        "runtime": {
            "provider": config["provider"],
            "model": config["model"],
            "thinking": config["thinking"],
            "condition_timeout_seconds": TIMEOUT_SECONDS,
            "timeout_origin": "initial-instruction-send",
            "max_parallel_jobs": MAX_WORKERS,
            "git_head": git_head,
        },
        "arms": {
            name: {
                "image": runtime["image"],
                "prime_agent_version": runtime["prime_agent_version"],
                "prime_context_version": runtime["prime_context_version"],
            }
            for name, runtime in runtimes.items()
        },
        "queue": queue_order,
        "retain_completed_containers": True,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    results: dict[tuple[int, str], dict[str, Any]] = {}
    started = time.monotonic()
    futures: dict[concurrent.futures.Future, tuple[int, str]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for item in queue_order:
            task_id = item["task_id"]
            name = item["variant"]
            futures[executor.submit(run_arm, runtimes[name], task_index[task_id], task_meta[task_id], auth_file, config)] = (
                task_id,
                name,
            )
        for future in concurrent.futures.as_completed(futures):
            task_id, name = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                result = major.failed_result(task_meta[task_id], name, exc)
            results[(task_id, name)] = result
            payload = write_progress(output, manifest, task_meta, results, started)
            print(
                json.dumps(
                    {
                        "event": "job_complete",
                        "task_id": task_id,
                        "variant": name,
                        "completed_jobs": payload["completed_jobs"],
                        "strict_correct": strict_correct(result),
                        "tests": f"{result['passing_tests']}/{result['total_tests']}",
                        "wall_seconds": result["wall_seconds"],
                        "error": result["error"],
                        "docker": result.get("docker_artifacts"),
                    }
                ),
                flush=True,
            )
    payload = write_progress(output, manifest, task_meta, results, started)
    write_final_report(output, payload)
    print(json.dumps({"event": "round_complete", "output": str(output)}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
