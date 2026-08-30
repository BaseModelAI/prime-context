import unittest
from dna_align import align_local
class FollowTests(unittest.TestCase):
 def test_finds_internal_motif_and_coordinates(self):
  x=align_local("TTACGTAA","GGACGTCC",gap_open=-2,gap_extend=-1);self.assertEqual((x.score,x.aligned_a,x.aligned_b,x.start_a,x.end_a,x.start_b,x.end_b),(8,"ACGT","ACGT",2,6,2,6))
 def test_no_positive_alignment_is_empty(self):
  x=align_local("A","G");self.assertEqual((x.score,x.aligned_a,x.aligned_b,x.start_a,x.end_a,x.start_b,x.end_b),(0,"","",0,0,0,0))
 def test_equal_motifs_choose_earliest_start(self):
  x=align_local("ACGACG","ACG");self.assertEqual((x.start_a,x.end_a,x.aligned_a),(0,3,"ACG"))
