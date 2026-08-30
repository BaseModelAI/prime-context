import copy, unittest
from record_migrate import apply_operations, MigrationError
class BaseTests(unittest.TestCase):
 def test_nested_rename_and_default(self):
  r={"profile":{"name":"Ada"}};ops=[{"id":"move","op":"rename","from":"/profile/name","path":"/profile/display"},{"id":"lang","op":"add_default","path":"/profile/lang","value":"en"}];self.assertEqual(apply_operations(r,ops),{"profile":{"display":"Ada","lang":"en"}})
 def test_strict_successful_coercions(self):
  r={"age":"42","enabled":"false","balance":"12.3400","code":7};ops=[{"id":"a","op":"coerce","path":"/age","target":"integer"},{"id":"e","op":"coerce","path":"/enabled","target":"boolean"},{"id":"b","op":"coerce","path":"/balance","target":"decimal-string"},{"id":"c","op":"coerce","path":"/code","target":"string"}];self.assertEqual(apply_operations(r,ops),{"age":42,"enabled":False,"balance":"12.34","code":"7"})
 def test_failure_reports_operation_and_preserves_input(self):
  r={"age":" 42"};before=copy.deepcopy(r)
  with self.assertRaises(MigrationError) as cm:apply_operations(r,[{"id":"age-int","op":"coerce","path":"/age","target":"integer"}])
  self.assertEqual((cm.exception.operation_id,cm.exception.path),("age-int","/age"));self.assertEqual(r,before)
