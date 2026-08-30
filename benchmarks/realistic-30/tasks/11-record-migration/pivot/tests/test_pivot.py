import unittest
from record_migrate import migrate, VersionError
class PivotTests(unittest.TestCase):
 def edge(self,id,a,b,c,ops=()):return {"id":id,"from":a,"to":b,"cost":c,"operations":list(ops)}
 def test_cheaper_two_edge_path_beats_direct(self):
  g=[self.edge("direct","v1","v3",5),self.edge("a","v1","v2",1,[{"id":"x","op":"add_default","path":"/x","value":1}]),self.edge("b","v2","v3",1,[{"id":"y","op":"add_default","path":"/y","value":2}])];self.assertEqual(migrate({},g,"v1","v3"),{"record":{"x":1,"y":2},"edge_ids":["a","b"]})
 def test_equal_cost_uses_edge_id_sequence(self):
  g=[self.edge("b","v1","v2",1),self.edge("z","v2","v4",1),self.edge("a","v1","v3",1),self.edge("y","v3","v4",1)];self.assertEqual(migrate({},g,"v1","v4")["edge_ids"],["a","y"])
 def test_unreachable_version(self):
  with self.assertRaises(VersionError) as cm:migrate({},[self.edge("a","v1","v2",1)],"v2","v1")
  self.assertEqual((cm.exception.source,cm.exception.target),("v2","v1"))
