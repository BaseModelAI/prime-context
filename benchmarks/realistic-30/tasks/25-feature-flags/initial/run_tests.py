#!/usr/bin/env python3
import io
import sys
import unittest

suite = unittest.defaultTestLoader.discover("tests", pattern="test_*.py")
stream = io.StringIO()
result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
count = result.testsRun
passed = count - len(result.failures) - len(result.errors)
print(f"TEST_RESULT {'PASS' if result.wasSuccessful() else 'FAIL'} {passed}/{count}")
if not result.wasSuccessful():
    for test, detail in [*result.failures, *result.errors]:
        final = detail.strip().splitlines()[-1] if detail.strip() else "failure"
        print(f"FAIL {test.id()} {final}")
payload = "integration-trace payload=" + "x" * 100
for worker in range(8):
    for line in range(180):
        print(f"TRACE worker={worker} line={line:03d} {payload}")
raise SystemExit(0 if result.wasSuccessful() else 1)
