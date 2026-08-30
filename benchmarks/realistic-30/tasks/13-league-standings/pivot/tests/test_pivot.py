import unittest
from league_table import League
class PivotTests(unittest.TestCase):
 def test_custom_scoring(self):
  l=League(win_points=2,draw_points=1,loss_points=0);l.record("m","A","B",1,0);self.assertEqual([(x.team,x.points) for x in l.table()],[("A",2),("B",0)])
 def test_head_to_head_precedes_overall_goal_difference(self):
  l=League(head_to_head=True)
  for args in [("ab","A","B",1,0),("bc","B","C",3,0),("ca","C","A",1,0),("ad","A","D",0,10),("bd","B","D",0,1),("cd","C","D",0,1)]:l.record(*args)
  tied=[x.team for x in l.table() if x.points==3];self.assertEqual(tied,["B","A","C"])
 def test_disabled_uses_overall_tiebreakers(self):
  l=League();l.record("ab","A","B",1,0);l.record("ac","A","C",0,10);l.record("bc","B","C",4,0);self.assertEqual([x.team for x in l.table()],["C","B","A"])
