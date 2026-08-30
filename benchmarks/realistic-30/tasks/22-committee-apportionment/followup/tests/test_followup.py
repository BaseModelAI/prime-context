import json, subprocess, sys, unittest
from committee import process_request
class FollowTests(unittest.TestCase):
 def test_process_request(self):
  self.assertEqual(process_request({"seats":3,"votes":{"x":9,"y":1},"min_basis_points":2000}),{"allocation":{"x":3,"y":0}})
 def test_single_json_cli(self):
  r=subprocess.run([sys.executable,"-m","committee.cli"],input='{"seats":4,"votes":{"B":1,"A":3}}',text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"allocation":{"A":3,"B":1}}\n')
 def test_ndjson_cli(self):
  src='{"votes":{"B":1,"A":1},"seats":2}\n\n{"seats":5,"votes":{"A":9,"B":1},"caps":{"A":3}}\n';r=subprocess.run([sys.executable,"-m","committee.cli","--ndjson"],input=src,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"allocation":{"A":1,"B":1}}\n{"allocation":{"A":3,"B":2}}\n')
