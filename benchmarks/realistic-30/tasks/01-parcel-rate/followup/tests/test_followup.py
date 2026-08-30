import json, subprocess, sys, unittest
class FollowTests(unittest.TestCase):
 def run_cli(self,text,*args):
  return subprocess.run([sys.executable,"-m","parcelrate.cli",*args],input=text,text=True,capture_output=True)
 def test_single_json_request(self):
  q={"parcels":[{"id":"a","weight_g":500,"zone":"A"}],"services":[{"name":"S","zones":["A"],"max_weight_g":1000,"base_cents":10,"per_kg_cents":20}]};r=self.run_cli(json.dumps(q));self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"quotes":[{"cost_cents":30,"id":"a","service":"S"}],"unrated":[]}\n');self.assertEqual(r.stderr,"")
 def test_ndjson_preserves_request_order(self):
  a={"parcels":[{"id":"a","weight_g":1000,"zone":"A"}],"services":[]};b={"parcels":[{"id":"b","weight_g":1000,"zone":"B"}],"services":[{"name":"X","zones":["B"],"max_weight_g":1000,"base_cents":0,"per_kg_cents":5}]};r=self.run_cli(json.dumps(a)+"\n"+json.dumps(b)+"\n","--ndjson");self.assertEqual(r.returncode,0,r.stderr);self.assertEqual([json.loads(x) for x in r.stdout.splitlines()],[{"quotes":[],"unrated":["a"]},{"quotes":[{"cost_cents":5,"id":"b","service":"X"}],"unrated":[]}])
 def test_ndjson_skips_blank_lines_and_supports_pivot(self):
  q={"parcels":[{"id":"r","weight_g":1000,"zone":"R","dimensions_cm":[20,20,20]}],"services":[{"name":"D","zones":["R"],"max_weight_g":5000,"base_cents":0,"per_kg_cents":100,"fuel_percent":5}]};r=self.run_cli("\n"+json.dumps(q)+"\n\n","--ndjson");self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout),{"quotes":[{"cost_cents":210,"id":"r","service":"D"}],"unrated":[]})
