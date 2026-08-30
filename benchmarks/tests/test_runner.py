import gzip
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest


RUNNER_PATH = Path(__file__).resolve().parents[1] / "run.py"
SPEC = importlib.util.spec_from_file_location("prime_context_benchmark", RUNNER_PATH)
runner = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(runner)

VANILLA_CURRENT_PATH = Path(__file__).resolve().parents[1] / "vanilla-current.py"
VANILLA_CURRENT_SPEC = importlib.util.spec_from_file_location("prime_context_vanilla_current", VANILLA_CURRENT_PATH)
vanilla_current = importlib.util.module_from_spec(VANILLA_CURRENT_SPEC)
assert VANILLA_CURRENT_SPEC.loader is not None
VANILLA_CURRENT_SPEC.loader.exec_module(vanilla_current)


class BenchmarkRunnerTests(unittest.TestCase):
    def test_corpus_contains_all_staged_tasks(self):
        index = json.loads((runner.TASK_SET / "tasks.json").read_text())
        self.assertEqual([item["id"] for item in index["tasks"]], list(range(1, 31)))
        for item in index["tasks"]:
            task_dir = runner.TASK_SET / item["path"]
            scenario = json.loads((task_dir / "scenario.json").read_text())
            self.assertEqual(
                [prompt["stage"] for prompt in scenario["prompts"]],
                ["initial", "steering", "pivot", "followup", "lock"],
            )
            self.assertEqual(scenario["expected"]["passing_tests"], 9)
            self.assertEqual(scenario["expected"]["total_tests"], 9)
            self.assertTrue((task_dir / "legacy-runner.py").is_file())
            for stage in ["initial", "pivot", "followup"]:
                self.assertTrue(any((task_dir / stage).rglob("*")))

    def test_recursive_metrics_include_children_cost_cache_and_compactions(self):
        sessions = [
            {
                "rlm_depth": 0,
                "model_calls": 2,
                "tool_calls": 3,
                "tool_results": 3,
                "visible_tool_bytes": 100,
                "compactions": 1,
                "goal_contexts": 2,
                "usage": {"input": 100, "output": 20, "cacheRead": 300, "cacheWrite": 0, "totalTokens": 420},
                "cost": {"input": 1.0, "output": 0.2, "cacheRead": 0.3, "cacheWrite": 0.0, "total": 1.5},
            },
            {
                "rlm_depth": 1,
                "model_calls": 1,
                "tool_calls": 1,
                "tool_results": 1,
                "visible_tool_bytes": 50,
                "compactions": 2,
                "goal_contexts": 0,
                "usage": {"input": 50, "output": 10, "cacheRead": 50, "cacheWrite": 0, "totalTokens": 110},
                "cost": {"input": 0.5, "output": 0.1, "cacheRead": 0.05, "cacheWrite": 0.0, "total": 0.65},
            },
        ]
        result = runner.aggregate_sessions(sessions)
        self.assertEqual(result["child_sessions"], 1)
        self.assertEqual(result["model_calls"], 3)
        self.assertEqual(result["compactions"], 3)
        self.assertEqual(result["usage"]["totalTokens"], 530)
        self.assertAlmostEqual(result["cost"]["total"], 2.15)
        self.assertAlmostEqual(result["prompt_cache_reuse"], 350 / 500)

    def test_archive_metrics_read_sidecars_and_legacy_records(self):
        with TemporaryDirectory() as temporary:
            pc_home = Path(temporary)
            session = pc_home / "sessions" / "s1"
            observations = session / "observations"
            observations.mkdir(parents=True)
            result_bytes = b"alpha\nbeta\n"
            stdout_bytes = b"trace\n"
            result_file = observations / "o1.result.0001.txt.gz"
            stdout_file = observations / "o1.stdout.0001.txt.gz"
            legacy_file = observations / "legacy.txt.gz"
            result_file.write_bytes(gzip.compress(result_bytes))
            stdout_file.write_bytes(gzip.compress(stdout_bytes))
            legacy_file.write_bytes(gzip.compress(b"old"))
            sidecar = {
                "schema": "prime-context.exchange/v2",
                "id": "o1",
                "parts": [
                    {"name": "result", "kind": "result", "textBytes": len(result_bytes), "chunks": [
                        {"relativeFile": "observations/o1.result.0001.txt.gz", "textBytes": len(result_bytes)},
                    ]},
                    {"name": "stdout", "kind": "stdout", "textBytes": len(stdout_bytes), "chunks": [
                        {"relativeFile": "observations/o1.stdout.0001.txt.gz", "textBytes": len(stdout_bytes)},
                    ]},
                ],
            }
            (observations / "o1.meta.json").write_text(json.dumps(sidecar))
            (session / "index.json").write_text(json.dumps({
                "schema": "prime-context.observation-index/v1",
                "observations": [
                    {"schema": "prime-context.exchange/v2", "id": "o1", "relativeFile": "observations/o1.meta.json"},
                    {"id": "legacy", "relativeFile": "observations/legacy.txt.gz", "textBytes": 3},
                ],
            }))
            (session / "session.json").write_text(json.dumps({
                "metrics": {"sourceBytesArchived": 23, "cacheReadTokens": 17},
            }))

            metrics = runner.prime_context_archives(pc_home)
            self.assertEqual(metrics["count"], 2)
            self.assertEqual(metrics["source_bytes"], len(result_bytes) + 3)
            self.assertEqual(metrics["chunk_count"], 3)
            self.assertEqual(metrics["max_chunk_bytes"], len(result_bytes))
            self.assertEqual(metrics["source_bytes_archived"], 23)
            self.assertEqual(metrics["cache_read_tokens"], 17)
            self.assertEqual(
                metrics["compressed_bytes"],
                result_file.stat().st_size + stdout_file.stat().st_size + legacy_file.stat().st_size,
            )

    def test_retained_docker_command_omits_auto_remove(self):
        command = runner.docker_base_command(
            Path("/tmp/run"), None, "benchmark:image", "agent", "network", remove_container=False
        )
        self.assertNotIn("--rm", command)
        disposable = runner.docker_base_command(
            Path("/tmp/run"), None, "benchmark:image", "agent", "network"
        )
        self.assertIn("--rm", disposable)

    def test_test_result_requires_an_anchored_runtime_line(self):
        self.assertEqual(
            runner.test_result_summary("exit 0\nTEST_RESULT PASS 6/6\ntrace"),
            {"status": "PASS", "passing": 6, "total": 6},
        )
        self.assertIsNone(runner.test_result_summary("print('TEST_RESULT PASS 6/6')"))

    def test_turn_end_exposes_terminal_tool_results(self):
        event = {
            "type": "turn_end",
            "toolResults": [{
                "role": "toolResult",
                "toolCallId": "call-1",
                "toolName": "ipython",
                "content": [{"type": "text", "text": "TEST_RESULT PASS 6/6\n"}],
            }],
        }
        self.assertEqual(runner.rpc_tool_results(event), [{
            "tool_call_id": "call-1",
            "tool_name": "ipython",
            "is_error": False,
            "body": "TEST_RESULT PASS 6/6\n",
        }])

    def test_task_selection_rejects_unknown_ids(self):
        with self.assertRaisesRegex(ValueError, "unknown task ids"):
            runner.parse_task_ids("1,31", set(range(1, 31)))

    def test_random_selection_honors_exclusions(self):
        excluded = {2, 8, 9, 18, 22}
        selected, seed, method = vanilla_current.select_tasks(None, None, set(range(1, 31)), excluded)
        self.assertEqual(len(selected), 10)
        self.assertEqual(len(set(selected)), 10)
        self.assertTrue(set(selected).isdisjoint(excluded))
        self.assertIsNotNone(seed)
        self.assertEqual(method, "random-without-replacement")

    def test_random_selection_requires_ten_eligible_tasks(self):
        with self.assertRaisesRegex(ValueError, "need at least 10 eligible tasks"):
            vanilla_current.select_tasks(None, None, set(range(1, 11)), {1})


if __name__ == "__main__":
    unittest.main()
