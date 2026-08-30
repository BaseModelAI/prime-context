import unittest
from layeredconfig import merge_layers
class BaseTests(unittest.TestCase):
 def test_deep_merge(self):
  layers=[("base",{"db":{"host":"localhost","port":5432},"debug":False}),("prod",{"db":{"host":"db"},"debug":True})];self.assertEqual(merge_layers(layers),{"db":{"host":"db","port":5432},"debug":True})
 def test_type_replacement(self):
  self.assertEqual(merge_layers([("a",{"x":{"a":1},"y":1}),("b",{"x":[2],"y":{"b":3}})]),{"x":[2],"y":{"b":3}})
 def test_default_lists_and_null(self):
  self.assertEqual(merge_layers([("a",{"items":[1,2],"flag":"yes"}),("b",{"items":[3],"flag":None})]),{"items":[3],"flag":None})
