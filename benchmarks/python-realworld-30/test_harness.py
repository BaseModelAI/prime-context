from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import run as benchmark
import run_codex as codex_benchmark


def attempt(*, wall: float, cost: float, progress: int = 5) -> dict:
    passed = progress == 5
    return {
        "agent_wall_seconds": wall,
        "lifecycle_wall_seconds": wall,
        "judge_seconds": 0.0,
        "judge": {
            "status": "pass" if passed else "fail",
            "progress_level": progress,
            "main_checks_passed": 5 if passed else progress,
            "edge_check_passed": passed,
        },
        "metrics": {
            "api_cost": {"total": cost},
            "provider_usage": {"totalTokens": 100},
        },
    }


def result(variant: str, value: dict, attempts: list[dict] | None = None) -> dict:
    values = attempts or [value]
    return {
        "variant": variant,
        "task_id": 1,
        "task_slug": "example",
        "pressure": "N",
        "primary_attempt": 0,
        "selected_attempt": 0,
        "retry_triggers": [],
        "attempts": values,
    }


class HarnessComparisonTests(unittest.TestCase):
    def test_provider_message_error_is_propagated(self) -> None:
        self.assertIsNone(benchmark.message_end_error({"type": "message_end", "message": {"stopReason": "stop"}}))
        self.assertEqual(
            benchmark.message_end_error({
                "type": "message_end",
                "message": {"stopReason": "error", "errorMessage": "WebSocket closed 1006"},
            }),
            "AgentError: WebSocket closed 1006",
        )

    def test_current_win_needs_no_retry_or_regression(self) -> None:
        vanilla = result("vanilla", attempt(wall=10.0, cost=0.10))
        current = result("current", attempt(wall=8.0, cost=0.08))
        self.assertEqual(benchmark.comparison_retry_reasons(vanilla, current), [])
        summary = benchmark.comprehensive_summary([vanilla, current])
        self.assertEqual(summary["regressions"], [])
        self.assertFalse(summary["publication_ready"])

    def test_vanilla_failure_is_a_current_correctness_win(self) -> None:
        vanilla_attempt = attempt(wall=12.0, cost=0.12, progress=3)
        vanilla_attempt["judge"]["main_checks_passed"] = 4
        vanilla_attempt["judge"]["edge_check_passed"] = True
        vanilla = result("vanilla", vanilla_attempt)
        current = result("current", attempt(wall=10.0, cost=0.10))
        summary = benchmark.comprehensive_summary([vanilla, current])
        self.assertEqual(summary["regressions"], [])
        self.assertEqual(len(summary["baseline_failures"]), 1)
        self.assertEqual(len(summary["current_correctness_wins"]), 1)
        self.assertEqual(summary["matched_strict_pass_comparisons"], [])

        full_results = []
        for task_id in range(1, 31):
            full_vanilla = result(
                "vanilla",
                vanilla_attempt if task_id == 30 else attempt(wall=12.0, cost=0.12),
            )
            full_current = result("current", attempt(wall=10.0, cost=0.10))
            full_vanilla["task_id"] = task_id
            full_current["task_id"] = task_id
            full_results.extend((full_vanilla, full_current))
        self.assertTrue(benchmark.comprehensive_summary(full_results)["publication_ready"])

    def test_current_metric_loss_gets_only_one_retry(self) -> None:
        vanilla = result("vanilla", attempt(wall=10.0, cost=0.10))
        current_attempt = attempt(wall=12.0, cost=0.12)
        current = result("current", current_attempt)
        self.assertEqual(
            benchmark.comparison_retry_reasons(vanilla, current),
            ["speed_regression", "cost_regression"],
        )
        current["attempts"].append(attempt(wall=11.0, cost=0.11))
        self.assertEqual(benchmark.comparison_retry_reasons(vanilla, current), [])
        self.assertEqual(
            benchmark.choose_better_attempt([
                attempt(wall=9.0, cost=0.05),
                attempt(wall=8.0, cost=0.15),
            ]),
            1,
        )
        summary = benchmark.comprehensive_summary([vanilla, current])
        self.assertEqual(
            {item["kind"] for item in summary["regressions"]},
            {"speed", "cost"},
        )


class CodexAdapterTests(unittest.TestCase):
    def test_commands_use_stdin_and_safe_resume_placement(self) -> None:
        initial = codex_benchmark.initial_command("codex", Path("/tmp/work"), Path("/tmp/last"))
        resumed = codex_benchmark.resume_command("codex", Path("/tmp/work"), "thread-1", Path("/tmp/last-2"))
        self.assertEqual(initial[-1], "-")
        self.assertEqual(resumed[-1], "-")
        self.assertIn('features.network_proxy.domains={ "127.0.0.1" = "allow" }', initial)
        self.assertLess(resumed.index('features.network_proxy.domains={ "127.0.0.1" = "allow" }'), resumed.index("resume"))
        self.assertEqual(resumed[-2], "thread-1")

    def test_codex_environment_is_an_explicit_allowlist(self) -> None:
        with tempfile.TemporaryDirectory(dir="/tmp") as temporary:
            codex_home = Path(temporary) / "codex-home"
            codex_home.mkdir()
            environment = codex_benchmark.clean_codex_environment(codex_home)
        self.assertEqual(environment["CODEX_HOME"], str(codex_home))
        self.assertEqual(environment["HOME"], str(codex_home.parent / "empty-home"))
        self.assertNotIn("OPENAI_API_KEY", environment)
        self.assertNotIn("PRIME_API_KEY", environment)
        self.assertEqual(set(environment), {
            "PATH", "HOME", "CODEX_HOME", "TERM", "LANG", "LC_ALL", "TZ",
            "PIP_NO_INDEX", "PIP_DISABLE_PIP_VERSION_CHECK", "UV_OFFLINE",
            "npm_config_offline", "npm_config_audit", "npm_config_fund",
            "PYTHONUTF8", "PYTHONDONTWRITEBYTECODE",
        })


if __name__ == "__main__":
    unittest.main()
