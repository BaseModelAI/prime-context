import unittest
from layeredconfig import merge_layers, merge_layers_detailed
class PivotTests(unittest.TestCase):
 def test_delete_exactness(self):
  out=merge_layers([("base",{"db":{"user":"u","password":"p"},"keep":1}),("prod",{"db":{"password":{"$delete":True}},"missing":{"$delete":True},"literal":{"$delete":True,"x":1}})]);self.assertEqual(out,{"db":{"user":"u"},"keep":1,"literal":{"$delete":True,"x":1}})
 def test_list_policies(self):
  layers=[("base",{"tags":["a","b"],"objs":[{"id":1}]}),("prod",{"tags":["b","c"],"objs":[{"id":1},{"id":2}]})];self.assertEqual(merge_layers(layers,list_policy="append")["tags"],["a","b","b","c"]);self.assertEqual(merge_layers(layers,list_policy="unique"),{"tags":["a","b","c"],"objs":[{"id":1},{"id":2}]})
 def test_current_provenance(self):
  layers=[("base",{"db":{"host":"h","port":1},"tags":["a","b"],"gone":1}),("prod",{"db":{"host":"p"},"tags":["b","c"],"gone":{"$delete":True}})];r=merge_layers_detailed(layers,list_policy="unique");self.assertEqual(r.config,{"db":{"host":"p","port":1},"tags":["a","b","c"]});self.assertEqual(r.sources,{"":"prod","/db":"prod","/db/host":"prod","/db/port":"base","/tags":"prod","/tags/0":"base","/tags/1":"base","/tags/2":"prod"})
