import importlib.util
from pathlib import Path
import sys
import unittest


BENCHMARK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BENCHMARK_DIR))
SPEC = importlib.util.spec_from_file_location("major_spec_benchmark", BENCHMARK_DIR / "major-spec.py")
major = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(major)


def cell(*, completed=True, tests=9, protected=True, error=None, tokens=100):
    return {
        "correctness": {
            "task_completed": completed,
            "passing_tests": tests,
            "total_tests": 9,
            "external_tests_pass": tests == 9,
            "protected_files_unchanged": protected,
            "goal_completed_after_lock": completed,
            "interventions_accepted": completed,
            "intervention_order_ok": completed,
            "final_response_exact": completed,
            "error": error,
        },
        "efficiency": {
            "condition_wall_seconds": 10.0,
            "usage": {"input": 20, "output": 10, "cacheRead": 70, "cacheWrite": 0, "totalTokens": tokens},
            "compactions": 1,
            "model_calls": 2,
            "api_cost": 1.0,
            "prompt_cache_reuse": 70 / 90,
            "visible_tool_bytes": 100,
        },
        "recursion": {"session_count": 1, "child_sessions": 0},
    }


class MajorSpecBenchmarkTests(unittest.TestCase):
    def test_random_selection_is_replayable_and_shared(self):
        first = major.select_tasks(None, 42, set(range(1, 31)))
        second = major.select_tasks(None, 42, set(range(1, 31)))
        self.assertEqual(first, second)
        self.assertEqual(len(first[0]), 3)
        self.assertEqual(len(set(first[0])), 3)

    def test_progressive_build_context_skips_published_stage(self):
        source = (BENCHMARK_DIR / "docker" / "Dockerfile").read_text()
        progressive = major.progressive_dockerfile_text(source)
        self.assertNotIn("FROM vanilla AS published", progressive)
        self.assertIn("FROM vanilla AS progressive", progressive)
        self.assertIn("FROM node:22.22.1-bookworm AS base", progressive)

    def test_baked_image_command_keeps_rpc_stdin_open(self):
        command = major.benchmark.docker_base_command(
            Path("/tmp/benchmark-arm"), None, "benchmark:test", "arm", "none"
        )
        self.assertIn("--interactive", command)
        self.assertNotIn("/opt/prime-agent-host", " ".join(command))

    def test_correctness_regression_blocks_efficiency_comparison(self):
        result = major.compare_cells(cell(completed=False, tests=8), cell())
        self.assertTrue(result["correctness_regression"])
        self.assertIn("task_completed", result["regressed_checks"])
        self.assertFalse(result["efficiency_comparable"])
        self.assertIsNone(result["efficiency"])

    def test_zero_reference_metric_still_reports_regression(self):
        published = cell()
        progressive = cell()
        published["efficiency"]["compactions"] = 0
        progressive["efficiency"]["compactions"] = 1
        progressive["efficiency"]["visible_tool_bytes"] = 200
        comparison = major.compare_cells(progressive, published)
        task = {
            "task_id": 1,
            "arms": {"published": published, "progressive": progressive},
            "comparisons": {"progressive_vs_published": comparison},
        }
        result = major.aggregate_comparison([task], "progressive", "published")
        self.assertIn("compactions", result["worse_metrics"])
        self.assertIn("visible_tool_bytes", result["worse_metrics"])
        self.assertIsNone(result["efficiency"]["compactions"]["delta_percent"])
        self.assertEqual(result["efficiency"]["visible_tool_bytes"]["delta_percent"], 100.0)


if __name__ == "__main__":
    unittest.main()
