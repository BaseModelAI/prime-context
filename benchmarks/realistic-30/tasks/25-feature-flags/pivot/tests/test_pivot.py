import unittest
from featureflags import evaluate
class TargetTests(unittest.TestCase):
 def test_ordered_all_of_targets(self):
  c={"flags":{"f":{"default":False,"targets":[{"when":{"country":"US","plan":"pro"},"value":True},{"when":{"country":"US"},"value":False}]}}}
  self.assertIs(evaluate(c,"f",{"country":"US","plan":"pro"}),True);self.assertIs(evaluate(c,"f",{"country":"US","plan":"free"}),False);self.assertIs(evaluate(c,"f",{"country":"CA","plan":"pro"}),False)
 def test_stable_rollout(self):
  c={"flags":{"new-dashboard":{"default":False,"rollout":2}}}
  self.assertIs(evaluate(c,"new-dashboard",{"subject":"bob"}),True);self.assertIs(evaluate(c,"new-dashboard",{"subject":"alice"}),False);self.assertIs(evaluate(c,"new-dashboard",{"subject":"bob"}),True)
 def test_precedence_and_fallback(self):
  c={"flags":{"f":{"default":False,"targets":[{"when":{"blocked":True},"value":False}],"rollout":100}}}
  self.assertIs(evaluate(c,"f",{"blocked":True,"subject":"bob"}),False);self.assertIs(evaluate(c,"f",{"subject":"bob"}),True);self.assertIs(evaluate(c,"f",{}),False)
