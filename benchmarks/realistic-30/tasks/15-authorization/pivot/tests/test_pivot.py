import unittest
from authz import PolicyEngine
class PivotTests(unittest.TestCase):
 def resources(self):return {"org":None,"project":"org","secret":"project"}
 def test_nearer_deny_overrides_ancestor_allow(self):
  gs=[{"id":"a","subject":"alice","resource":"org","actions":["*"]},{"id":"d","subject":"alice","resource":"project","actions":["read"],"effect":"deny"}];d=PolicyEngine(self.resources(),gs).authorize("alice","secret","read");self.assertEqual((d.allowed,d.reason_ids),(False,("d",)))
 def test_nested_group_membership(self):
  gs=[{"id":"g","subject":"group:ops","resource":"org","actions":["read"]}];e=PolicyEngine(self.resources(),gs,memberships={"dev":["alice"],"ops":["group:dev"]});self.assertTrue(e.authorize("alice","project","read").allowed)
 def test_action_family_and_same_level_deny(self):
  gs=[{"id":"allow","subject":"alice","resource":"org","actions":["report:*"]},{"id":"deny","subject":"alice","resource":"org","actions":["report:delete"],"effect":"deny"}];e=PolicyEngine(self.resources(),gs);self.assertEqual(e.authorize("alice","org","report:view").reason_ids,("allow",));self.assertEqual((e.authorize("alice","org","report:delete").allowed,e.authorize("alice","org","report:delete").reason_ids),(False,("deny",)))
