import math, unittest
from signal_lab import analyze
class BaseTests(unittest.TestCase):
 def test_crossings_mean_and_rms(self):
  s=analyze([1,-1,1],8000);self.assertEqual((s.count,s.peak_abs,s.zero_crossings),(3,1,2));self.assertTrue(math.isclose(s.mean,1/3));self.assertTrue(math.isclose(s.rms,1.0))
 def test_asymmetric_samples(self):
  s=analyze([-3,4],44100);self.assertEqual((s.peak_abs,s.zero_crossings),(4,1));self.assertTrue(math.isclose(s.mean,0.5));self.assertTrue(math.isclose(s.rms,math.sqrt(12.5)))
 def test_empty_and_validation(self):
  self.assertEqual(analyze([],1).count,0);self.assertEqual(analyze([],1).rms,0)
  with self.assertRaises(ValueError):analyze([1],0)
  with self.assertRaises((TypeError,ValueError)):analyze([1.5],8000)
