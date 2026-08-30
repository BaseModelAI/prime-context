import unittest
from committee import allocate
class BaseTests(unittest.TestCase):
 def test_basic_split(self):
  self.assertEqual(allocate(5,{"A":60,"B":40}),{"A":3,"B":2})
 def test_remainder_tie_uses_name(self):
  self.assertEqual(allocate(2,{"C":1,"B":1,"A":1}),{"A":1,"B":1,"C":0})
 def test_zero_vote_party_retained(self):
  self.assertEqual(allocate(3,{"empty":0,"only":7}),{"empty":0,"only":3})
