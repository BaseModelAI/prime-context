import unittest
from telemetry_codec import Frame, encode_value, decode_value, encode_message, decode_message
class FollowTests(unittest.TestCase):
 def test_nested_value_round_trip_inside_frame(self):
  value={"name":"probe","samples":[1,-2,None],"raw":b"\x00"};f=encode_message(9,value);self.assertIsInstance(f,Frame);self.assertEqual(decode_message(f),value)
 def test_dictionary_encoding_is_canonical(self):
  self.assertEqual(encode_value({"z":1,"a":2}),encode_value({"a":2,"z":1}));self.assertEqual(decode_value(encode_value({"a":[True,False]})),{"a":[True,False]})
 def test_integer_bounds_and_bad_encodings(self):
  for n in [-(2**63),2**63-1]:self.assertEqual(decode_value(encode_value(n)),n)
  with self.assertRaises(ValueError):encode_value(2**63)
  with self.assertRaises(ValueError):decode_value(bytes.fromhex("0400000001ff"))
  with self.assertRaises(ValueError):decode_value(encode_value(None)+b"\x00")
  duplicate=bytes.fromhex("0700000002 0000000161 00 0000000161 01")
  with self.assertRaises(ValueError):decode_value(duplicate)
