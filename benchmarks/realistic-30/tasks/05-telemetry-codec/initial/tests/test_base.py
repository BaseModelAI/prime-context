import unittest
from telemetry_codec import Frame, encode_frame, decode_frames
class BaseTests(unittest.TestCase):
 def test_exact_wire_encoding(self):
  f=Frame(7,b"abc");self.assertEqual(encode_frame(f),bytes.fromhex("a5 5a 07 00 03 61 62 63"));self.assertEqual(decode_frames(encode_frame(f)),[f])
 def test_concatenated_and_empty_payload_frames(self):
  frames=[Frame(0,b""),Frame(255,b"xyz")];self.assertEqual(decode_frames(b"".join(map(encode_frame,frames))),frames)
 def test_malformed_frames_and_types(self):
  with self.assertRaises(ValueError):decode_frames(b"xx\x00\x00\x00")
  with self.assertRaises(ValueError):decode_frames(bytes.fromhex("a55a01000561"))
  with self.assertRaises(ValueError):encode_frame(Frame(256,b""))
