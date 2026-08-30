import unittest
from signal_lab import estimate_delay
class FollowTests(unittest.TestCase):
 def test_positive_delay(self):
  self.assertEqual((lambda x:(x.lag,x.score,x.overlap))(estimate_delay([1,2,3],[0,1,2,3],2)),(1,14,3))
 def test_negative_delay(self):
  x=estimate_delay([0,1,2],[1,2,0],2);self.assertEqual((x.lag,x.score,x.overlap),(-1,5,2))
 def test_zero_tie_and_validation(self):
  self.assertEqual(estimate_delay([0,0,0,0],[0,0,0,0],3).lag,0)
  with self.assertRaises(ValueError):estimate_delay([1],[1],-1)
