import unittest
from pgm_regions import Image, read_pgm, label_components
class PivotTests(unittest.TestCase):
 def test_diagonal_contact_depends_on_connectivity(self):
  image=Image(2,2,1,((1,0),(0,1)));self.assertEqual(len(label_components(image,1,4)),2);r=label_components(image,1,8);self.assertEqual(len(r),1);self.assertEqual(r[0].area,2)
 def test_p5_eight_bit(self):
  image=read_pgm(b"P5\n2 1\n255\n"+bytes([0,255]));self.assertEqual(image.rows,((0,255),))
 def test_p5_sixteen_bit_comments_and_truncation(self):
  image=read_pgm(b"P5\n# sensor\n2 1\n1023\n"+bytes.fromhex("0001 03ff"));self.assertEqual(image.rows,((1,1023),))
  with self.assertRaises(ValueError):read_pgm(b"P5\n2 1\n1023\n\x00\x01\x03")
