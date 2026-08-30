import unittest
from telemetry_codec import Frame, FrameDecoder, encode_frame
class PivotTests(unittest.TestCase):
 def test_every_byte_can_be_a_chunk(self):
  expected=[Frame(1,b"abc"),Frame(2,b"")];d=FrameDecoder();out=[]
  for value in b"".join(map(encode_frame,expected)):out.extend(d.feed(bytes([value])))
  out.extend(d.finish());self.assertEqual(out,expected);self.assertEqual(d.dropped_bytes,0)
 def test_noise_is_counted_and_frames_preserved(self):
  a=encode_frame(Frame(1,b"a"));b=encode_frame(Frame(2,b"b"));d=FrameDecoder();self.assertEqual(d.feed(b"\x00\xff"+a+b"\x13"+b),[Frame(1,b"a"),Frame(2,b"b")]);self.assertEqual(d.finish(),[]);self.assertEqual(d.dropped_bytes,3)
 def test_oversize_candidate_resync_and_partial_finish(self):
  d=FrameDecoder(max_payload=8);valid=encode_frame(Frame(3,b"ok"));self.assertEqual(d.feed(bytes.fromhex("a55a01ffff")+valid),[Frame(3,b"ok")]);self.assertGreaterEqual(d.dropped_bytes,5);self.assertEqual(d.finish(),[])
  p=FrameDecoder();p.feed(bytes.fromhex("a55a01000361"))
  with self.assertRaises(ValueError):p.finish()
