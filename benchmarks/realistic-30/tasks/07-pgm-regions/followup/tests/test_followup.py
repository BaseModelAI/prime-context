import unittest
from pgm_regions import Image, analyze_regions
class FollowTests(unittest.TestCase):
 def test_filled_block_perimeter(self):
  r=analyze_regions(Image(2,2,1,((1,1),(1,1))),1)[0];self.assertEqual((r.area,r.perimeter,r.holes),(4,8,0))
 def test_ring_has_one_hole(self):
  r=analyze_regions(Image(3,3,1,((1,1,1),(1,0,1),(1,1,1))),1)[0];self.assertEqual((r.area,r.perimeter,r.holes),(8,16,1))
 def test_l_shape_and_unrelated_region(self):
  image=Image(4,3,1,((1,0,0,1),(1,1,0,0),(0,0,0,0)));regions=analyze_regions(image,1);self.assertEqual((regions[0].area,regions[0].perimeter,regions[0].holes),(3,8,0));self.assertEqual((regions[1].area,regions[1].perimeter,regions[1].holes),(1,4,0))
