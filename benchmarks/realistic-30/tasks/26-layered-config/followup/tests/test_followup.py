import json, subprocess, sys, tempfile, unittest
from pathlib import Path
from layeredconfig import ExpansionError, merge_layers, merge_layers_detailed
class FollowTests(unittest.TestCase):
 def test_environment_expansion(self):
  out=merge_layers([("x",{"url":"http://${HOST}:${PORT:-8080}","nested":["${HOST}","${EMPTY:-fallback}"],"number":7})],env={"HOST":"example.test","EMPTY":""});self.assertEqual(out,{"url":"http://example.test:8080","nested":["example.test",""],"number":7})
  with self.assertRaises(ExpansionError) as c:merge_layers([("x",{"required":"${NEEDED}"})],env={})
  self.assertIn("/required",str(c.exception));self.assertIn("NEEDED",str(c.exception))
 def test_explain(self):
  r=merge_layers_detailed([("base",{"db":{"host":"old","port":5432}}),("prod",{"db":{"host":"${HOST}"}})],env={"HOST":"new"});self.assertEqual(r.explain("/db/port"),{"path":"/db/port","value":5432,"source":"base"});self.assertEqual(r.explain("/db/host"),{"path":"/db/host","value":"new","source":"prod"})
 def test_json_cli(self):
  with tempfile.TemporaryDirectory() as d:
   base=Path(d)/"base.json";prod=Path(d)/"prod.json";base.write_text(json.dumps({"z":0,"tags":["a"],"host":"${HOST}"}));prod.write_text(json.dumps({"tags":["a","b"],"a":2}));r=subprocess.run([sys.executable,"-m","layeredconfig.cli","--layer",f"base={base}","--layer",f"prod={prod}","--list-policy","unique","--env","HOST=cli"],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"a":2,"host":"cli","tags":["a","b"],"z":0}\n')
