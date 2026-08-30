import unittest
from league_table import League
class BaseTests(unittest.TestCase):
 def test_win_draw_and_statistics(self):
  l=League();l.record("m1","A","B",2,0);l.record("m2","A","C",1,1);rows={x.team:x for x in l.table()};self.assertEqual((rows["A"].played,rows["A"].won,rows["A"].drawn,rows["A"].points,rows["A"].goal_difference),(2,1,1,4,2));self.assertEqual(rows["B"].lost,1)
 def test_deterministic_sorting(self):
  l=League();l.record("m1","Zulu","Alpha",0,0);self.assertEqual([x.team for x in l.table()],["Alpha","Zulu"]);self.assertEqual([x.rank for x in l.table()],[1,2])
 def test_invalid_record_is_atomic(self):
  l=League();l.record("m1","A","B",1,0);before=l.table()
  with self.assertRaises(ValueError):l.record("m2","A","A",1,0)
  self.assertEqual(l.table(),before)
  with self.assertRaises(ValueError):l.record("m1","A","C",1,0)
