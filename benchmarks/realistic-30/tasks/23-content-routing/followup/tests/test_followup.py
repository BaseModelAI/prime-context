import json, subprocess, sys, tempfile, unittest
from pathlib import Path
from contentrouter import ContentRouter
CFG={"default_locale":"en","routes":[{"id":"dynamic","path":"/docs/{slug}","locale":"en","priority":10,"text":"D $slug"},{"id":"static","path":"/docs/start","locale":"en","priority":0,"text":"S"}]}
class FollowTests(unittest.TestCase):
 def test_precedence_priority_specificity_order(self):
  self.assertEqual(ContentRouter.from_dict(CFG).resolve("/docs/start").route_id,"dynamic")
  equal={"default_locale":"en","routes":[{"id":"dynamic","path":"/docs/{slug}","locale":"en","text":"D"},{"id":"static","path":"/docs/start","locale":"en","text":"S"},{"id":"static2","path":"/docs/start","locale":"en","text":"S2"}]};self.assertEqual(ContentRouter.from_dict(equal).resolve("/docs/start").route_id,"static")
 def test_explain(self):
  e=ContentRouter.from_dict(CFG).explain("/docs/start");self.assertEqual([x["id"] for x in e["candidates"]],["dynamic","static"]);self.assertEqual({k:e["candidates"][0][k] for k in ["locale_rank","priority","literal_segments","order"]},{"locale_rank":0,"priority":10,"literal_segments":1,"order":0});self.assertTrue(e["candidates"][0]["selected"]);self.assertFalse(e["candidates"][1]["selected"])
 def test_json_cli(self):
  cfg={"default_locale":"en","routes":[{"id":"article","path":"/a/{slug}","locale":"en","text":"Hi $slug"}]}
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"router.json";p.write_text(json.dumps(cfg));r=subprocess.run([sys.executable,"-m","contentrouter.cli",str(p),"/a/x","--locale","EN"],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stderr,"");self.assertEqual(r.stdout,'{"locale":"en","params":{"slug":"x"},"route_id":"article","text":"Hi x"}\n')
