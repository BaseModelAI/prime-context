import unittest
from authz import PolicyEngine
class BaseTests(unittest.TestCase):
 def test_ancestor_grant_applies(self):
  e=PolicyEngine({"org":None,"project":"org"},[{"id":"g","subject":"alice","resource":"org","actions":["read"]}]);self.assertEqual((lambda d:(d.allowed,d.reason_ids))(e.authorize("alice","project","read")),(True,("g",)))
 def test_nearest_resource_grants_win(self):
  gs=[{"id":"root","subject":"alice","resource":"org","actions":["*"]},{"id":"local-b","subject":"alice","resource":"project","actions":["read"]},{"id":"local-a","subject":"alice","resource":"project","actions":["read"]}];d=PolicyEngine({"org":None,"project":"org"},gs).authorize("alice","project","read");self.assertEqual(d.reason_ids,("local-a","local-b"))
 def test_unmatched_and_invalid_cycle(self):
  e=PolicyEngine({"org":None},[]);self.assertEqual((e.authorize("nobody","org","read").allowed,e.authorize("nobody","org","read").reason_ids),(False,()))
  with self.assertRaises(ValueError):PolicyEngine({"a":"b","b":"a"},[])
