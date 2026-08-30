import unittest
from dna_align import align_global
class BaseTests(unittest.TestCase):
 def test_exact_match(self):
  x=align_global("ACG","ACG");self.assertEqual((x.score,x.aligned_a,x.aligned_b,x.start_a,x.end_a),(6,"ACG","ACG",0,3))
 def test_gap_and_mismatch_choice(self):
  x=align_global("AC","A");self.assertEqual((x.score,x.aligned_a,x.aligned_b),(0,"AC","A-"))
 def test_deterministic_tie_and_validation(self):
  x=align_global("A","G",match=1,mismatch=0,gap=0);self.assertEqual((x.aligned_a,x.aligned_b),("-A","G-"))
  with self.assertRaises(ValueError):align_global("AX","A")
