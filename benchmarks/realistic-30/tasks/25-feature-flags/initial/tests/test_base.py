import unittest
from featureflags import evaluate
class BaseTests(unittest.TestCase):
 def test_true_default(self):self.assertIs(evaluate({"flags":{"f":{"default":True}}},"f"),True)
 def test_false_default_ignores_context(self):self.assertIs(evaluate({"flags":{"f":{"default":False}}},"f",{"anything":1}),False)
 def test_unknown_flag(self):
  with self.assertRaises(KeyError) as caught:evaluate({"flags":{}},"missing")
  self.assertEqual(caught.exception.args,("missing",))
