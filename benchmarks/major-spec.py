#!/usr/bin/env python3
"""Run the three-arm benchmark used after each major-spec implementation step."""

from __future__ import annotations

import argparse
import atexit
import concurrent.futures
import json
from pathlib import Path
import random
import secrets
import shlex
import shutil
import subprocess
import tarfile
import time
from typing import Any

import run as benchmark

CONFIG_PATH = Path(__file__).resolve().with_name("major-spec.json")
VARIANTS = ["vanilla", "published", "progressive"]
BOOLEAN_CHECKS = [
    "external_tests_pass",
    "protected_files_unchanged",
    "goal_completed_after_lock",
    "interventions_accepted",
    "intervention_order_ok",
]
LOWER_IS_BETTER = ["wall_seconds", "total_tokens", "compactions", "api_cost", "model_calls"]


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text())


def docker_image_labels(image: str) -> dict[str, str] | None:
    inspected = subprocess.run(
        ["docker", "image", "inspect", image],
        text=True,
        capture_output=True,
        timeout=60,
    )
    if inspected.returncode != 0:
        return None
    details = json.loads(inspected.stdout)[0]
    return details.get("Config", {}).get("Labels") or {}


def image_matches(image: str, expected_labels: dict[str, str]) -> bool:
    labels = docker_image_labels(image)
    return labels is not None and all(labels.get(key) == value for key, value in expected_labels.items())


def build_image(
    dockerfile: Path,
    context: Path,
    target: str,
    tag: str,
    build_args: dict[str, str],
) -> None:
    command = [
        "docker",
        "build",
        "--network",
        "host",
        "--file",
        str(dockerfile),
        "--target",
        target,
        "--tag",
        tag,
    ]
    for key, value in build_args.items():
        command.extend(["--build-arg", f"{key}={value}"])
    command.append(str(context))
    subprocess.run(command, text=True, check=True, timeout=3600)


def progressive_dockerfile_text(source: str) -> str:
    published = "\nFROM vanilla AS published\n"
    progressive = "\nFROM vanilla AS progressive\n"
    if source.count(published) != 1 or source.count(progressive) != 1:
        raise ValueError("benchmark Dockerfile must contain one published and one progressive stage")
    published_start = source.index(published)
    progressive_start = source.index(progressive)
    if published_start >= progressive_start:
        raise ValueError("published benchmark stage must precede progressive stage")
    return source[:published_start] + source[progressive_start:]


def build_progressive_package(source: Path, build_context: Path) -> str:
    build_context.mkdir(parents=True, exist_ok=False)
    docker_root = Path(__file__).resolve().parent / "docker"
    dockerfile = progressive_dockerfile_text((docker_root / "Dockerfile").read_text())
    (build_context / "Dockerfile").write_text(dockerfile)
    shutil.copy2(docker_root / "patch-prime-agent.mjs", build_context / "patch-prime-agent.mjs")
    shutil.copy2(docker_root / "smoke-prime-agent.mjs", build_context / "smoke-prime-agent.mjs")
    shutil.copy2(docker_root / "type-smoke-prime-agent.ts", build_context / "type-smoke-prime-agent.ts")
    destination = build_context / "prime-agent-context-progressive.tgz"
    if source.is_file():
        shutil.copy2(source, destination)
        with tarfile.open(source, "r:gz") as archive:
            package_file = archive.extractfile("package/package.json")
            if package_file is None:
                raise RuntimeError(f"package/package.json missing from {source}")
            return str(json.loads(package_file.read()).get("version") or "working")
    if not (source / "package.json").is_file():
        raise RuntimeError(f"progressive source is not a package directory or tarball: {source}")
    subprocess.run(["npm", "run", "build"], cwd=source, text=True, check=True, timeout=600)
    packed = subprocess.run(
        ["npm", "pack", "--pack-destination", str(build_context)],
        cwd=source,
        text=True,
        capture_output=True,
        check=True,
        timeout=300,
    )
    tarballs = [path for path in build_context.glob("*.tgz") if path != destination]
    if len(tarballs) != 1:
        raise RuntimeError(f"npm pack did not create one tarball: {packed.stdout}{packed.stderr}")
    tarballs[0].replace(destination)
    package = json.loads((source / "package.json").read_text())
    return str(package.get("version") or "working")


def ensure_benchmark_images(
    config: dict[str, Any], progressive_source: str, build_root: Path
) -> dict[str, dict[str, Any]]:
    dockerfile = Path(__file__).resolve().parent / "docker" / "Dockerfile"
    docker_context = dockerfile.parent
    prime_agent_version = str(config["prime_agent_version"])
    revision = str(config["image_revision"])
    plugin_revision = str(config["plugin_image_revision"])
    common_labels = {
        "org.prime-context.benchmark": "true",
        "org.prime-context.prime-agent-version": prime_agent_version,
        "org.prime-context.image-revision": revision,
    }
    common_args = {
        "PRIME_AGENT_VERSION": prime_agent_version,
        "IMAGE_REVISION": revision,
    }

    base_image = str(config["base_image"])
    if not image_matches(base_image, {**common_labels, "org.prime-context.variant": "base"}):
        build_image(dockerfile, docker_context, "base", base_image, common_args)

    vanilla_image = str(config["vanilla_image"])
    if not image_matches(vanilla_image, {**common_labels, "org.prime-context.variant": "vanilla"}):
        build_image(dockerfile, docker_context, "vanilla", vanilla_image, common_args)

    published_source = str(config["published_prime_context"])
    published_version = published_source.rsplit("@", 1)[-1]
    published_image = str(config["published_image"])
    published_labels = {
        **common_labels,
        "org.prime-context.variant": "published",
        "org.prime-context.prime-context-version": published_version,
        "org.prime-context.plugin-image-revision": plugin_revision,
    }
    if not image_matches(published_image, published_labels):
        build_image(
            dockerfile,
            docker_context,
            "published",
            published_image,
            {
                **common_args,
                "PUBLISHED_CONTEXT_VERSION": published_version,
                "PLUGIN_IMAGE_REVISION": plugin_revision,
            },
        )

    source = Path(progressive_source).expanduser().resolve()
    context = build_root / "progressive-context"
    progressive_version = build_progressive_package(source, context)
    progressive_image = str(config["progressive_image"])
    build_image(
        context / "Dockerfile",
        context,
        "progressive",
        progressive_image,
        {
            **common_args,
            "PROGRESSIVE_CONTEXT_VERSION": progressive_version,
            "PLUGIN_IMAGE_REVISION": plugin_revision,
        },
    )
    labels = docker_image_labels(progressive_image) or {}
    if (
        labels.get("org.prime-context.prime-context-version") != progressive_version
        or labels.get("org.prime-context.plugin-image-revision") != plugin_revision
    ):
        raise RuntimeError("progressive image has the wrong Prime Context package metadata")

    return {
        "vanilla": {
            "image": vanilla_image,
            "prime_agent_version": prime_agent_version,
            "prime_context_version": None,
            "prime_context_source": None,
            "container_package": None,
        },
        "published": {
            "image": published_image,
            "prime_agent_version": prime_agent_version,
            "prime_context_version": published_version,
            "prime_context_source": published_source,
            "container_package": "/opt/prime-context",
        },
        "progressive": {
            "image": progressive_image,
            "prime_agent_version": prime_agent_version,
            "prime_context_version": progressive_version,
            "prime_context_source": progressive_source,
            "container_package": "/opt/prime-context",
        },
    }


def select_tasks(value: str | None, seed: int | None, available: set[int]) -> tuple[list[int], int | None, str]:
    if value:
        selected = benchmark.parse_task_ids(value, available)
        if len(selected) != 3:
            raise ValueError("--tasks must select exactly three task IDs")
        return selected, seed, "explicit"
    chosen_seed = seed if seed is not None else secrets.randbits(63)
    selected = random.Random(chosen_seed).sample(sorted(available), 3)
    return selected, chosen_seed, "random-without-replacement"


def prepare_variant(
    name: str,
    output: Path,
    image_runtime: dict[str, Any],
    session_policy: Path,
) -> dict[str, Any]:
    variant_root = output / "variants" / name
    variant_root.mkdir(parents=True, exist_ok=False)
    agents_file = variant_root / "_frozen" / "session-policy" / "AGENTS.md"
    agents_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(session_policy, agents_file)
    agents_file.chmod(0o444)
    return {"name": name, "root": variant_root, "agents_file": agents_file, **image_runtime}


def failed_result(task: dict[str, Any], variant: str, exc: Exception) -> dict[str, Any]:
    usage = {key: 0 for key in ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]}
    cost = {key: 0.0 for key in ["input", "output", "cacheRead", "cacheWrite", "total"]}
    return {
        "task_id": task["id"],
        "task_slug": task["slug"],
        "condition": variant,
        "task_completed": False,
        "error": f"{type(exc).__name__}: {exc}",
        "wall_seconds": 0.0,
        "passing_tests": 0,
        "total_tests": task["expected"]["total_tests"],
        "external_tests_pass": False,
        "protected_files_unchanged": False,
        "goal_status": None,
        "goal_completed_after_lock": False,
        "final_response_exact": False,
        "final_response": "",
        "intervention_order_ok": False,
        "interventions_accepted": False,
        "recursive_metrics": {
            "session_count": 0,
            "child_sessions": 0,
            "model_calls": 0,
            "tool_calls": 0,
            "tool_results": 0,
            "visible_tool_bytes": 0,
            "compactions": 0,
            "goal_contexts": 0,
            "usage": usage,
            "cost": cost,
            "prompt_cache_reuse": 0.0,
        },
        "prime_context_archives": {"count": 0, "source_bytes": 0, "compressed_bytes": 0},
        "interaction": {},
        "sessions": [],
        "verifier_stdout": "",
        "verifier_stderr": "",
    }


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
            "condition_timeout_seconds": config["timeout_seconds"],
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
            config["timeout_seconds"],
            config["reserve_tokens"],
            docker_image=runtime["image"],
            global_agents_file=runtime["agents_file"],
            container_package=runtime["container_package"],
        )
    except Exception as exc:
        return failed_result(controlled, runtime["name"], exc)


def report_cell(result: dict[str, Any]) -> dict[str, Any]:
    recursive = result["recursive_metrics"]
    return {
        "correctness": {
            "task_completed": result["task_completed"],
            "passing_tests": result["passing_tests"],
            "total_tests": result["total_tests"],
            "external_tests_pass": result["external_tests_pass"],
            "protected_files_unchanged": result["protected_files_unchanged"],
            "goal_completed_after_lock": result["goal_completed_after_lock"],
            "interventions_accepted": result["interventions_accepted"],
            "intervention_order_ok": result["intervention_order_ok"],
            "final_response_exact": result["final_response_exact"],
            "error": result["error"],
        },
        "efficiency": {
            "condition_wall_seconds": result["wall_seconds"],
            "usage": recursive["usage"],
            "compactions": recursive["compactions"],
            "model_calls": recursive["model_calls"],
            "api_cost": recursive["cost"]["total"],
            "prompt_cache_reuse": recursive["prompt_cache_reuse"],
            "visible_tool_bytes": recursive["visible_tool_bytes"],
        },
        "recursion": {
            "session_count": recursive["session_count"],
            "child_sessions": recursive["child_sessions"],
        },
    }


def compare_cells(candidate: dict[str, Any], reference: dict[str, Any]) -> dict[str, Any]:
    candidate_correctness = candidate["correctness"]
    reference_correctness = reference["correctness"]
    regressed: list[str] = []
    gained: list[str] = []
    if reference_correctness["task_completed"] and not candidate_correctness["task_completed"]:
        regressed.append("task_completed")
    if candidate_correctness["task_completed"] and not reference_correctness["task_completed"]:
        gained.append("task_completed")
    if candidate_correctness["passing_tests"] < reference_correctness["passing_tests"]:
        regressed.append("passing_tests")
    elif candidate_correctness["passing_tests"] > reference_correctness["passing_tests"]:
        gained.append("passing_tests")
    for check in BOOLEAN_CHECKS:
        if reference_correctness[check] and not candidate_correctness[check]:
            regressed.append(check)
        elif candidate_correctness[check] and not reference_correctness[check]:
            gained.append(check)
    if candidate_correctness["error"] and not reference_correctness["error"]:
        regressed.append("error")
    comparable = bool(candidate_correctness["task_completed"] and reference_correctness["task_completed"])
    efficiency: dict[str, Any] | None = None
    if comparable:
        efficiency = {}
        fields = {
            "wall_seconds": "condition_wall_seconds",
            "total_tokens": ("usage", "totalTokens"),
            "compactions": "compactions",
            "api_cost": "api_cost",
            "model_calls": "model_calls",
            "visible_tool_bytes": "visible_tool_bytes",
        }
        for label, field in fields.items():
            if isinstance(field, tuple):
                candidate_value = candidate["efficiency"][field[0]][field[1]]
                reference_value = reference["efficiency"][field[0]][field[1]]
            else:
                candidate_value = candidate["efficiency"][field]
                reference_value = reference["efficiency"][field]
            efficiency[label] = {
                "candidate": candidate_value,
                "reference": reference_value,
                "delta": candidate_value - reference_value,
                "delta_percent": ((candidate_value / reference_value) - 1.0) * 100.0
                if reference_value
                else None,
            }
        efficiency["prompt_cache_reuse"] = {
            "candidate": candidate["efficiency"]["prompt_cache_reuse"],
            "reference": reference["efficiency"]["prompt_cache_reuse"],
            "delta_points": 100.0
            * (
                candidate["efficiency"]["prompt_cache_reuse"]
                - reference["efficiency"]["prompt_cache_reuse"]
            ),
        }
    return {
        "correctness_regression": bool(regressed),
        "regressed_checks": list(dict.fromkeys(regressed)),
        "correctness_gain": bool(gained),
        "gained_checks": list(dict.fromkeys(gained)),
        "final_response_regression": bool(
            reference_correctness["final_response_exact"]
            and not candidate_correctness["final_response_exact"]
        ),
        "efficiency_comparable": comparable,
        "efficiency": efficiency,
    }


def task_report(task_id: int, slug: str, results: list[dict[str, Any]]) -> dict[str, Any]:
    arms = {item["condition"]: report_cell(item) for item in results}
    return {
        "task_id": task_id,
        "task_slug": slug,
        "arms": arms,
        "comparisons": {
            "published_vs_vanilla": compare_cells(arms["published"], arms["vanilla"]),
            "progressive_vs_published": compare_cells(arms["progressive"], arms["published"]),
            "progressive_vs_vanilla": compare_cells(arms["progressive"], arms["vanilla"]),
        },
    }


def aggregate_comparison(
    task_reports: list[dict[str, Any]], candidate_name: str, reference_name: str
) -> dict[str, Any]:
    comparison_name = f"{candidate_name}_vs_{reference_name}"
    correctness_regressions = [
        item["task_id"]
        for item in task_reports
        if item["comparisons"][comparison_name]["correctness_regression"]
    ]
    correctness_gains = [
        item["task_id"]
        for item in task_reports
        if item["comparisons"][comparison_name]["correctness_gain"]
    ]
    comparable = [
        item for item in task_reports if item["comparisons"][comparison_name]["efficiency_comparable"]
    ]
    fields = {
        "wall_seconds": "condition_wall_seconds",
        "total_tokens": ("usage", "totalTokens"),
        "compactions": "compactions",
        "api_cost": "api_cost",
        "model_calls": "model_calls",
        "visible_tool_bytes": "visible_tool_bytes",
    }
    efficiency: dict[str, Any] = {}
    worse: list[str] = []
    for label, field in fields.items():
        def value(item: dict[str, Any], arm: str) -> float:
            data = item["arms"][arm]["efficiency"]
            return data[field[0]][field[1]] if isinstance(field, tuple) else data[field]

        candidate_total = sum(value(item, candidate_name) for item in comparable)
        reference_total = sum(value(item, reference_name) for item in comparable)
        delta_percent = (
            ((candidate_total / reference_total) - 1.0) * 100.0 if reference_total else None
        )
        efficiency[label] = {
            "candidate": candidate_total,
            "reference": reference_total,
            "delta": candidate_total - reference_total,
            "delta_percent": delta_percent,
        }
        if candidate_total > reference_total:
            worse.append(label)
    usage_keys = ["input", "cacheRead", "cacheWrite"]
    cache_reuse: dict[str, float] = {}
    for arm in [candidate_name, reference_name]:
        usage = {
            key: sum(item["arms"][arm]["efficiency"]["usage"][key] for item in comparable)
            for key in usage_keys
        }
        prompt_tokens = usage["input"] + usage["cacheRead"] + usage["cacheWrite"]
        cache_reuse[arm] = usage["cacheRead"] / prompt_tokens if prompt_tokens else 0.0
    cache_delta = 100.0 * (cache_reuse[candidate_name] - cache_reuse[reference_name])
    if comparable and cache_delta < 0:
        worse.append("prompt_cache_reuse")
    efficiency["prompt_cache_reuse"] = {
        "candidate": cache_reuse[candidate_name],
        "reference": cache_reuse[reference_name],
        "delta_points": cache_delta,
    }
    return {
        "correctness_regression_task_ids": correctness_regressions,
        "correctness_gain_task_ids": correctness_gains,
        "final_response_regression_task_ids": [
            item["task_id"]
            for item in task_reports
            if item["comparisons"][comparison_name]["final_response_regression"]
        ],
        "comparable_task_ids": [item["task_id"] for item in comparable],
        "efficiency": efficiency if comparable else None,
        "worse_metrics": list(dict.fromkeys(worse)),
        "critical_cost_regression": bool(
            comparable
            and efficiency["api_cost"]["candidate"] > efficiency["api_cost"]["reference"]
            and (
                efficiency["api_cost"]["reference"] == 0
                or (
                    efficiency["api_cost"]["delta_percent"] is not None
                    and efficiency["api_cost"]["delta_percent"] > 20.0
                )
            )
        ),
    }


def build_summary(
    raw_results: list[dict[str, Any]], task_reports: list[dict[str, Any]], elapsed: float
) -> dict[str, Any]:
    arms = benchmark.aggregate_cohort(
        raw_results,
        elapsed,
        condition_order=VARIANTS,
        comparison_pairs=[],
    )["conditions"]
    comparisons = {
        "published_vs_vanilla": aggregate_comparison(task_reports, "published", "vanilla"),
        "progressive_vs_published": aggregate_comparison(task_reports, "progressive", "published"),
        "progressive_vs_vanilla": aggregate_comparison(task_reports, "progressive", "vanilla"),
    }
    primary = comparisons["progressive_vs_published"]
    if primary["correctness_regression_task_ids"]:
        gate = "FAIL_CORRECTNESS"
    elif not primary["comparable_task_ids"]:
        gate = "NO_COMPARABLE_TASKS"
    elif primary["worse_metrics"]:
        gate = "WARN_EFFICIENCY"
    else:
        gate = "PASS"
    return {
        "arms": arms,
        "comparisons": comparisons,
        "release_gate": {
            "status": gate,
            "primary_reference": "published",
            "critical_cost_regression": primary["critical_cost_regression"],
        },
        "cohort_elapsed_seconds": elapsed,
    }


def markdown_report(report: dict[str, Any]) -> str:
    manifest = report["manifest"]
    lines = [
        f"# Major-spec benchmark: {manifest['step']}",
        "",
        f"- Tasks: {', '.join(map(str, manifest['sample']['task_ids']))}",
        f"- Selection: {manifest['sample']['method']} (seed: {manifest['sample']['seed']})",
        f"- Runtime: `{manifest['runtime']['provider']}/{manifest['runtime']['model']}` at `{manifest['runtime']['thinking']}` effort",
        f"- Published Prime Context: `{manifest['arms']['published']['resolved_version']}`",
        f"- Progressive Prime Context: `{manifest['arms']['progressive']['resolved_version']}`",
        "",
        "## Correctness",
        "",
        "| Task | Variant | Complete | Tests | Protected | Goal after lock | Error |",
        "|---:|---|:---:|---:|:---:|:---:|---|",
    ]
    for task in report["tasks"]:
        for variant in VARIANTS:
            correctness = task["arms"][variant]["correctness"]
            lines.append(
                f"| {task['task_id']} | {variant} | {'yes' if correctness['task_completed'] else 'no'} "
                f"| {correctness['passing_tests']}/{correctness['total_tests']} "
                f"| {'yes' if correctness['protected_files_unchanged'] else 'no'} "
                f"| {'yes' if correctness['goal_completed_after_lock'] else 'no'} "
                f"| {correctness['error'] or ''} |"
            )
    if "summary" not in report:
        return "\n".join(lines) + "\n"
    summary = report["summary"]
    lines.extend(
        [
            "",
            "## Aggregate arms",
            "",
            "| Variant | Completed | Tests | Tokens | Compactions | Calls | API cost | Wall seconds | Cache reuse | Visible tool bytes |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for variant in VARIANTS:
        arm = summary["arms"][variant]
        lines.append(
            f"| {variant} | {arm['tasks_completed']}/{arm['tasks']} "
            f"| {arm['passing_tests']}/{arm['expected_tests']} "
            f"| {arm['usage']['totalTokens']} | {arm['compactions']} | {arm['model_calls']} "
            f"| {arm['api_cost']:.4f} | {arm['wall_seconds']:.1f} "
            f"| {100.0 * arm['prompt_cache_reuse']:.1f}% | {arm['visible_tool_bytes']} |"
        )
    comparison_specs = [
        ("published_vs_vanilla", "Published versus vanilla", "Published", "Vanilla"),
        ("progressive_vs_published", "Progressive versus published", "Progressive", "Published"),
        ("progressive_vs_vanilla", "Progressive versus vanilla", "Progressive", "Vanilla"),
    ]
    for key, title, candidate_label, reference_label in comparison_specs:
        comparison = summary["comparisons"][key]
        lines.extend(
            [
                "",
                f"## {title}",
                "",
                f"- Correctness regressions: {comparison['correctness_regression_task_ids'] or 'none'}",
                f"- Correctness gains: {comparison['correctness_gain_task_ids'] or 'none'}",
                f"- Final-response capture regressions: {comparison['final_response_regression_task_ids'] or 'none'}",
                f"- Matched-correct tasks: {comparison['comparable_task_ids'] or 'none'}",
                f"- Worse efficiency metrics: {comparison['worse_metrics'] or 'none'}",
                f"- Critical cost regression (>20%): {'yes' if comparison['critical_cost_regression'] else 'no'}",
            ]
        )
        if not comparison["efficiency"]:
            continue
        lines.extend(
            [
                "",
                f"| Metric on matched-correct tasks | {candidate_label} | {reference_label} | Delta |",
                "|---|---:|---:|---:|",
            ]
        )
        for metric in [
            "total_tokens",
            "compactions",
            "model_calls",
            "api_cost",
            "wall_seconds",
            "visible_tool_bytes",
        ]:
            values = comparison["efficiency"][metric]
            delta = values["delta_percent"]
            lines.append(
                f"| {metric} | {values['candidate']:.4f} | {values['reference']:.4f} "
                f"| {delta:.1f}% |" if delta is not None else
                f"| {metric} | {values['candidate']:.4f} | {values['reference']:.4f} | n/a |"
            )
        cache = comparison["efficiency"]["prompt_cache_reuse"]
        lines.append(
            f"| prompt_cache_reuse | {100.0 * cache['candidate']:.1f}% "
            f"| {100.0 * cache['reference']:.1f}% | {cache['delta_points']:.1f} points |"
        )
    lines.extend(
        [
            "",
            "## Gate",
            "",
            f"**{summary['release_gate']['status']}**",
        ]
    )
    return "\n".join(lines) + "\n"


def write_report(
    output: Path,
    manifest: dict[str, Any],
    task_reports: list[dict[str, Any]],
    raw_results: list[dict[str, Any]],
    benchmark_started: float,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "schema": "prime-context.major-spec-benchmark/v1",
        "manifest": manifest,
        "tasks": task_reports,
    }
    if task_reports:
        report["summary"] = build_summary(
            raw_results, task_reports, time.monotonic() - benchmark_started
        )
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (output / "report.md").write_text(markdown_report(report))
    return report


def run_preflight(
    output: Path, runtimes: dict[str, dict[str, Any]], auth_file: Path
) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    for name, runtime in runtimes.items():
        probe_root = runtime["root"] / "preflight"
        for directory in ["work", "home", "config", "pc-home", "sessions"]:
            (probe_root / directory).mkdir(parents=True, exist_ok=True)
        (probe_root / "config" / "AGENTS.md").touch()
        shutil.copy2(auth_file, probe_root / "config" / "auth.json")
        (probe_root / "config" / "auth.json").chmod(0o600)
        preflight_config = load_config()
        (probe_root / "config" / "settings.json").write_text(
            json.dumps(
                {
                    "defaultProvider": preflight_config["provider"],
                    "defaultModel": preflight_config["model"],
                    "defaultThinkingLevel": preflight_config["thinking"],
                    "telemetry": {"enabled": False, "noticeShown": True},
                    "packages": [runtime["container_package"]]
                    if runtime["container_package"]
                    else [],
                },
                indent=2,
            )
            + "\n"
        )
        (probe_root / "work" / "context-check.mjs").write_text(
            "import { readFileSync } from 'node:fs';\n"
            "import { loadProjectContextFiles } from '/usr/local/lib/node_modules/prime-agent/dist/core/resource-loader.js';\n"
            "const files = loadProjectContextFiles({ agentDir: '/sandbox/config', cwd: '/sandbox/work' });\n"
            "const expected = readFileSync('/sandbox/config/AGENTS.md', 'utf8');\n"
            "if (!files.some((item) => item.path === '/sandbox/config/AGENTS.md' && item.content === expected)) process.exit(1);\n"
        )
        if runtime["container_package"]:
            extension_check = (
                "test -e /opt/prime-context/package.json && "
                f"actual=$(node -p \"require('/opt/prime-context/package.json').version\") && test \"$actual\" = {shlex.quote(str(runtime['prime_context_version']))}"
            )
        else:
            extension_check = "test ! -e /opt/prime-context"
        suffix = int(time.time_ns() % 1_000_000_000)
        container_name = f"pcbench-preflight-{name}-{suffix}"
        network_name = f"{container_name}-net"
        subnet, gateway = benchmark.allocate_private_network()
        proxy: benchmark.ConnectProxy | None = None
        completed: subprocess.CompletedProcess[str] | None = None
        rpc_completed: subprocess.CompletedProcess[str] | None = None
        command_entries: list[dict[str, Any]] = []
        commands_ok = False
        preflight_error: str | None = None
        try:
            subprocess.run(
                [
                    "docker",
                    "network",
                    "create",
                    "--driver",
                    "bridge",
                    "--internal",
                    "--label",
                    "prime-context-benchmark=true",
                    "--subnet",
                    subnet,
                    "--gateway",
                    gateway,
                    network_name,
                ],
                text=True,
                capture_output=True,
                check=True,
                timeout=60,
            )
            proxy = benchmark.ConnectProxy(gateway)
            proxy.start()
            command = benchmark.docker_base_command(
                probe_root,
                None,
                runtime["image"],
                container_name,
                network_name,
                None,
                None,
                proxy.url,
                runtime["agents_file"],
            ) + [
                "sh",
                "-lc",
                "node --version && npm --version && python3 --version && uv --version && "
                f"test ! -e {shlex.quote(str(Path.home() / '.prime'))} && "
                f"test ! -e {shlex.quote(str(PROJECT_ROOT))} && "
                "test -e /usr/local/lib/node_modules/prime-agent/package.json && "
                f"actual=$(node -p \"require('/usr/local/lib/node_modules/prime-agent/package.json').version\") && test \"$actual\" = {shlex.quote(str(runtime['prime_agent_version']))} && "
                "node /usr/local/share/prime-context-benchmark/patch-prime-agent.mjs --check && "
                "node /usr/local/share/prime-context-benchmark/smoke-prime-agent.mjs && "
                "test -r /sandbox/config/AGENTS.md && "
                "node /sandbox/work/context-check.mjs && "
                "! (printf 'mutation' >> /sandbox/config/AGENTS.md) 2>/dev/null && "
                f"{extension_check} && "
                "prime-agent --help >/dev/null && "
                "/opt/prime-agent-kernel/bin/python -c 'import agent_message, agent_observe, attach_image, bs4, compact, dill, dotenv, edit, goal, httpx, ipykernel, linear, lxml, notion, numpy, pandas, pydantic, refine, requests, rlm, rlm_heartbeat, scipy, tomli, tyro, websearch, yaml; assert callable(goal.complete)' && "
                "curl -sS --max-time 30 -o /dev/null https://chatgpt.com && "
                "touch /sandbox/work/write-check",
            ]
            completed = subprocess.run(command, text=True, capture_output=True, timeout=300)
            rpc_arguments = [
                "prime-agent",
                "--daemon-socket",
                "/sandbox/preflight.sock",
                "--mode",
                "rpc",
                "--cwd",
                "/sandbox/work",
                "--session-dir",
                "/sandbox/sessions",
                "--provider",
                preflight_config["provider"],
                "--model",
                preflight_config["model"],
                "--thinking",
                preflight_config["thinking"],
                "--no-prompt-templates",
                "--no-themes",
            ]
            if not runtime["container_package"]:
                rpc_arguments.append("--no-extensions")
            rpc_container_name = f"{container_name}-commands"
            rpc_command = benchmark.docker_base_command(
                probe_root,
                None,
                runtime["image"],
                rpc_container_name,
                network_name,
                None,
                None,
                proxy.url,
                runtime["agents_file"],
            ) + rpc_arguments
            rpc_completed = subprocess.run(
                rpc_command,
                input=json.dumps({"id": "commands", "type": "get_commands"}) + "\n",
                text=True,
                capture_output=True,
                timeout=120,
            )
            for line in rpc_completed.stdout.splitlines():
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("id") == "commands" and event.get("success"):
                    command_entries = (event.get("data") or {}).get("commands") or []
                    break
            has_pc = any(
                item.get("name") == "pc" and item.get("source") == "extension"
                for item in command_entries
            )
            commands_ok = has_pc if runtime["container_package"] else not has_pc
        except Exception as exc:
            preflight_error = f"{type(exc).__name__}: {exc}"
        finally:
            subprocess.run(
                ["docker", "rm", "--force", f"{container_name}-commands", container_name],
                text=True,
                capture_output=True,
                timeout=60,
            )
            if proxy is not None:
                proxy.close()
            subprocess.run(
                ["docker", "network", "rm", network_name],
                text=True,
                capture_output=True,
                timeout=60,
            )
        checks[name] = {
            "passed": (
                completed is not None
                and completed.returncode == 0
                and rpc_completed is not None
                and rpc_completed.returncode == 0
                and commands_ok
            ),
            "pc_command_registered": any(
                item.get("name") == "pc" and item.get("source") == "extension"
                for item in command_entries
            ),
            "commands": command_entries,
            "stdout": completed.stdout if completed else "",
            "stderr": "\n".join(
                part
                for part in [
                    completed.stderr if completed else preflight_error or "",
                    rpc_completed.stderr if rpc_completed else "",
                ]
                if part
            ),
        }
    payload = {"schema": "prime-context.major-spec-preflight/v1", "checks": checks}
    (output / "preflight.json").write_text(json.dumps(payload, indent=2) + "\n")
    return payload


def main() -> int:
    defaults = load_config()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--step", required=True, help="major-spec step label, for example step-01")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--tasks", help="exactly three task IDs; omit for a random sample")
    parser.add_argument("--seed", type=int, help="replayable random-selection seed")
    parser.add_argument("--progressive-source", default=str(benchmark.PROJECT_ROOT))
    parser.add_argument(
        "--auth-file", type=Path, default=Path.home() / ".prime" / "agent" / "auth.json"
    )
    parser.add_argument("--timeout", type=int, default=defaults["timeout_seconds"])
    parser.add_argument("--reserve-tokens", type=int, default=defaults["reserve_tokens"])
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()

    task_index = benchmark.load_task_index()
    try:
        task_ids, seed, method = select_tasks(args.tasks, args.seed, set(task_index))
    except ValueError as exc:
        parser.error(str(exc))
    auth_file = args.auth_file.expanduser().resolve()
    if not auth_file.exists():
        parser.error(f"Prime Agent auth file not found: {auth_file}")
    if not shutil.which("docker"):
        parser.error("docker is required")
    if not shutil.which("npm"):
        parser.error("npm is required to pack the progressive extension")

    active_images = {
        str(defaults[key])
        for key in ["base_image", "vanilla_image", "published_image", "progressive_image"]
    }
    atexit.register(benchmark.cleanup_docker_artifacts, active_images)
    benchmark.cleanup_docker_artifacts(active_images)

    output = args.output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=False)
    session_policy = (CONFIG_PATH.parent / defaults["session_policy"]).resolve()
    if not session_policy.is_file():
        parser.error(f"session policy not found: {session_policy}")
    config = {
        **defaults,
        "timeout_seconds": args.timeout,
        "reserve_tokens": args.reserve_tokens,
    }

    setup_started = time.monotonic()
    image_build_root = output / "_image-build"
    try:
        image_runtimes = ensure_benchmark_images(
            config, args.progressive_source, image_build_root
        )
    finally:
        shutil.rmtree(image_build_root, ignore_errors=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            name: executor.submit(
                prepare_variant, name, output, image_runtimes[name], session_policy
            )
            for name in VARIANTS
        }
        runtimes = {name: futures[name].result() for name in VARIANTS}
    setup_elapsed = time.monotonic() - setup_started

    manifest = {
        "schema": "prime-context.major-spec-benchmark-run/v1",
        "step": args.step,
        "sample": {"method": method, "seed": seed, "task_ids": task_ids},
        "runtime": {
            "provider": config["provider"],
            "model": config["model"],
            "thinking": config["thinking"],
            "base_image": config["base_image"],
            "condition_timeout_seconds": config["timeout_seconds"],
            "reserve_tokens": config["reserve_tokens"],
            "global_agents_file": "/sandbox/config/AGENTS.md",
            "session_policy_source": str(session_policy),
        },
        "isolation": {
            "container_per_task_variant": True,
            "private_network_per_task_variant": True,
            "public_https_relay_only": True,
            "private_network_destinations_denied": True,
            "read_only_container_root": True,
            "global_home_mounted": False,
            "project_mounted": False,
            "auth_copied_per_arm": True,
            "session_policy_read_only": True,
            "session_policy_loaded_before_initial_prompt": True,
            "fresh_writable_state_per_arm": True,
        },
        "arms": {
            name: {
                "image": runtime["image"],
                "reusable_image": True,
                "prime_agent_version": runtime["prime_agent_version"],
                "prime_context_source": runtime["prime_context_source"],
                "resolved_version": runtime["prime_context_version"],
            }
            for name, runtime in runtimes.items()
        },
        "setup_elapsed_seconds": setup_elapsed,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    if args.preflight_only:
        payload = run_preflight(output, runtimes, auth_file)
        passed = all(item["passed"] for item in payload["checks"].values())
        print(json.dumps({"preflight_passed": passed, "output": str(output)}))
        return 0 if passed else 1

    raw_results: list[dict[str, Any]] = []
    task_reports: list[dict[str, Any]] = []
    benchmark_started = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for task_id in task_ids:
            task_dir = task_index[task_id]
            scenario = json.loads((task_dir / "scenario.json").read_text())
            futures = {
                name: executor.submit(
                    run_arm, runtimes[name], task_dir, scenario, auth_file, config
                )
                for name in VARIANTS
            }
            results = [futures[name].result() for name in VARIANTS]
            raw_results.extend(results)
            current = task_report(task_id, scenario["slug"], results)
            task_reports.append(current)
            task_output = output / "tasks" / f"task-{task_id:02d}-{scenario['slug']}"
            task_output.mkdir(parents=True, exist_ok=True)
            (task_output / "triple-analysis.json").write_text(
                json.dumps(current, indent=2) + "\n"
            )
            report = write_report(output, manifest, task_reports, raw_results, benchmark_started)
            print(
                json.dumps(
                    {
                        "task_id": task_id,
                        "arms": {
                            name: {
                                "completed": current["arms"][name]["correctness"]["task_completed"],
                                "tests": f"{current['arms'][name]['correctness']['passing_tests']}/{current['arms'][name]['correctness']['total_tests']}",
                            }
                            for name in VARIANTS
                        },
                        "progressive_vs_published_regression": current["comparisons"][
                            "progressive_vs_published"
                        ]["correctness_regression"],
                        "current_gate": report["summary"]["release_gate"]["status"],
                    }
                ),
                flush=True,
            )
    final_report = write_report(output, manifest, task_reports, raw_results, benchmark_started)
    print(
        json.dumps(
            {
                "report": str(output / "report.md"),
                "gate": final_report["summary"]["release_gate"]["status"],
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
