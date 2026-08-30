import unittest
from lockresolve import resolve, ResolutionError
class FollowTests(unittest.TestCase):
 def test_root_extra_adds_dependency(self):
  repo={"web":{"1.0.0":{"dependencies":{},"extras":{"tls":{"crypto":">=1.0.0"}}}},"crypto":{"1.0.0":{}}};self.assertEqual(resolve(repo,{"web[tls]":">=1.0.0"}),{"crypto":"1.0.0","web":"1.0.0"})
 def test_transitive_extra(self):
  repo={"app":{"1.0.0":{"db[postgres]":">=1.0.0"}},"db":{"1.0.0":{"dependencies":{},"extras":{"postgres":{"driver":"==2.0.0"}}}},"driver":{"2.0.0":{}}};self.assertEqual(resolve(repo,{"app":"==1.0.0"}),{"app":"1.0.0","db":"1.0.0","driver":"2.0.0"})
 def test_features_union_and_unknown_rejected(self):
  repo={"p":{"1.0.0":{"dependencies":{},"extras":{"x":{"xdep":"*"},"y":{"ydep":"*"}}}},"xdep":{"1.0.0":{}},"ydep":{"1.0.0":{}}};self.assertEqual(set(resolve(repo,{"p[x,y]":"*"})),{"p","xdep","ydep"})
  with self.assertRaises(ResolutionError):resolve(repo,{"p[missing]":"*"})
