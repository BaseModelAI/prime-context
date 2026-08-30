import unittest
from authz import PolicyEngine
class FollowTests(unittest.TestCase):
 def make(self,extra=()):
  grants=[{"id":"source","subject":"alice","resource":"org","actions":["read"]},*extra];deleg=[{"id":"del","from":"alice","to":"bob","resource":"project","actions":["read"],"not_before":"2026-01-01T00:00:00","expires":"2026-02-01T00:00:00"}];return PolicyEngine({"org":None,"project":"org"},grants,delegations=deleg)
 def test_active_delegation_transfers_allow(self):
  d=self.make().authorize("bob","project","read",at="2026-01-15T12:00:00");self.assertEqual((d.allowed,d.reason_ids),(True,("del:source",)))
 def test_expired_or_omitted_time_ignores_delegation(self):
  e=self.make();self.assertFalse(e.authorize("bob","project","read").allowed);self.assertFalse(e.authorize("bob","project","read",at="2026-02-01T00:00:00").allowed)
 def test_direct_deny_blocks_same_level_delegation(self):
  deny={"id":"block","subject":"bob","resource":"project","actions":["read"],"effect":"deny"};d=self.make([deny]).authorize("bob","project","read",at="2026-01-15T00:00:00");self.assertEqual((d.allowed,d.reason_ids),(False,("block",)))
