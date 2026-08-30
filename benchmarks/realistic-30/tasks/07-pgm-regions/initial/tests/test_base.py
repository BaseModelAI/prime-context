import unittest
from fractions import Fraction
from pgm_regions import Image, read_pgm, label_components
class BaseTests(unittest.TestCase):
 def test_raster_regions_exact_geometry(self):
  image=Image(3,2,1,((1,0,1),(1,0,0)));regions=label_components(image,1);self.assertEqual(len(regions),2);self.assertEqual((regions[0].id,regions[0].area,regions[0].bbox,regions[0].centroid),(1,2,(0,0,0,1),(Fraction(0),Fraction(1,2))));self.assertEqual((regions[1].area,regions[1].bbox),(1,(2,0,2,0)))
 def test_empty_foreground(self):
  self.assertEqual(label_components(Image(2,2,9,((0,0),(0,0))),1),())
 def test_p2_comments_whitespace_and_validation(self):
  image=read_pgm(b"P2 # title\n 3 2\n# max\n 5\n1 0 5  2 3 4\n");self.assertEqual((image.width,image.height,image.maxval,image.rows),(3,2,5,((1,0,5),(2,3,4))))
  with self.assertRaises(ValueError):Image(2,2,3,((0,1),(2,)))
  with self.assertRaises(ValueError):Image(1,1,3,((4,),))
