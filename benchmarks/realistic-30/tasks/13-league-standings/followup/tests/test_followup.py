import unittest
from league_table import League
class FollowTests(unittest.TestCase):
 def rec(self,seq,id,h,a,hg,ag):return {"seq":seq,"type":"record","match":{"id":id,"home":h,"away":a,"home_goals":hg,"away_goals":ag}}
 def test_correction_replaces_result(self):
  l=League();l.apply(self.rec(1,"m","A","B",2,0));l.apply({"seq":2,"type":"correct","target":"m","match":{"id":"m","home":"A","away":"B","home_goals":0,"away_goals":1}});self.assertEqual([x.team for x in l.table()],["B","A"])
 def test_void_removes_match(self):
  l=League();l.apply(self.rec(1,"m","A","B",2,0));l.apply({"seq":2,"type":"void","target":"m"});self.assertEqual(l.table(),())
 def test_historical_table_and_monotonic_sequence(self):
  l=League();l.apply(self.rec(1,"m","A","B",2,0));l.apply({"seq":2,"type":"correct","target":"m","match":{"id":"m","home":"A","away":"B","home_goals":0,"away_goals":1}});self.assertEqual([x.team for x in l.table(as_of=1)],["A","B"]);self.assertEqual([x.team for x in l.table()],["B","A"])
  with self.assertRaises(ValueError):l.apply({"seq":2,"type":"void","target":"m"})
