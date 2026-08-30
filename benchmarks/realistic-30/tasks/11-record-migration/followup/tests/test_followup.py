import unittest
from record_migrate import migrate_batch, BatchError
class FollowTests(unittest.TestCase):
 def graph(self):return [{"id":"upgrade","from":"v1","to":"v2","cost":1,"operations":[{"id":"age","op":"coerce","path":"/age","target":"integer"}]}]
 def schema(self):return {"required":["/id","/age"],"types":{"/id":"string","/age":"integer"}}
 def test_atomic_rejects_bad_record(self):
  records=[{"id":"a","age":"2"},{"id":"b","age":"bad"}]
  with self.assertRaises(BatchError) as cm:migrate_batch(records,self.graph(),"v1","v2",self.schema(),mode="atomic")
  self.assertEqual(cm.exception.index,1);self.assertEqual(records[0]["age"],"2")
 def test_lenient_preserves_order(self):
  r=migrate_batch([{"id":"a","age":"2"},{"id":"b","age":"bad"}],self.graph(),"v1","v2",self.schema(),mode="lenient");self.assertEqual(r[0],{"index":0,"record":{"id":"a","age":2},"edge_ids":["upgrade"]});self.assertEqual(r[1]["index"],1);self.assertEqual(r[1]["error"]["path"],"/age")
 def test_dry_run_omits_transformed_records(self):
  r=migrate_batch(iter([{"id":"a","age":"2"}]),self.graph(),"v1","v2",self.schema(),mode="lenient",dry_run=True);self.assertEqual(r,[{"index":0,"edge_ids":["upgrade"]}])
