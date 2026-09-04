from __future__ import annotations

import unittest

import run as benchmark


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


if __name__ == "__main__":
    unittest.main()
