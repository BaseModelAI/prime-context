import json, subprocess, sys, unittest
class FollowTests(unittest.TestCase):
 def run_cli(self,text,*args):
  return subprocess.run([sys.executable,"-m","rankedchoice.cli",*args],input=text,text=True,capture_output=True)
 def test_json_cli(self):
  r=self.run_cli('{"ballots":[["X"],["Y","X"],["X"]]}');self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"rounds":[{"counts":{"X":2,"Y":1},"eliminated":null,"exhausted":0}],"winner":"X"}\n');self.assertEqual(r.stderr,"")
 def test_ndjson_preserves_order(self):
  src='{"ballots":[["M"],["N","M"],["M"]]}\n{"ballots":[["Z"]],"withdrawn":["Z"]}\n';r=self.run_cli(src,"--ndjson");self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout.splitlines(),['{"rounds":[{"counts":{"M":2,"N":1},"eliminated":null,"exhausted":0}],"winner":"M"}','{"rounds":[],"winner":null}'])
 def test_ndjson_blank_and_weighted(self):
  src='\n  \n{"ballots":[{"ranking":["Q","R"],"weight":2},["R"]],"withdrawn":["Q"]}\n\n';r=self.run_cli(src,"--ndjson");self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"rounds":[{"counts":{"R":3},"eliminated":null,"exhausted":0}],"winner":"R"}\n')
