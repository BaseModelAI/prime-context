import json, subprocess, sys, unittest
class FollowTests(unittest.TestCase):
 def run_cli(self,text):
  r=subprocess.run([sys.executable,"-m","tripsplit.cli"],input=text,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stderr);return [json.loads(x) for x in r.stdout.splitlines()]
 def test_single_request(self):
  q={"id":"one","people":["Ana","Bo"],"expenses":[{"payer":"Ana","amount":"4.00"}]};self.assertEqual(self.run_cli(json.dumps(q)+"\n"),[{"id":"one","settlements":[{"from":"Bo","to":"Ana","amount":"2.00"}]}])
 def test_multiple_requests_in_order(self):
  qs=[{"id":"a","people":["Ana"],"expenses":[]},{"id":"b","people":["Ana","Bo","Cy"],"expenses":[{"payer":"Cy","amount":"5.00","shares":{"Ana":1,"Bo":1}}]}];self.assertEqual(self.run_cli("\n".join(map(json.dumps,qs))+"\n"),[{"id":"a","settlements":[]},{"id":"b","settlements":[{"from":"Ana","to":"Cy","amount":"2.50"},{"from":"Bo","to":"Cy","amount":"2.50"}]}])
 def test_blank_lines_ignored(self):
  q={"id":"penny","people":["Ana","Bo"],"expenses":[{"payer":"Ana","amount":"0.01"}]};self.assertEqual(self.run_cli("\n"+json.dumps(q)+"\n\n"),[{"id":"penny","settlements":[]}])
