import json, subprocess, sys, unittest
from eventwindow import Event, EventWindow
class FollowTests(unittest.TestCase):
 def test_snapshot_roundtrip(self):
  w=EventWindow(10,2);w.add(Event("a",2,"x",4));w.advance_watermark(5);expected={"size":10,"allowed_lateness":2,"watermark":5,"seen_ids":["a"],"open_windows":[{"start":0,"end":10,"key":"x","count":1,"total":4}]};self.assertEqual(w.snapshot(),expected);self.assertEqual(EventWindow.from_snapshot(expected).snapshot(),expected)
 def test_nonmutating_explain(self):
  w=EventWindow(10,2);w.advance_watermark(12);before=w.snapshot();self.assertEqual(w.explain(Event("n",8,"x",7)),{"event_id":"n","status":"late","reason":"window_finalized","window_start":0,"window_end":10,"watermark":12,"final_at":12});self.assertEqual(w.snapshot(),before)
 def test_ndjson_cli(self):
  input_text='{"op":"add","event":{"id":"a","ts":1,"key":"x","value":3}}\n{"op":"watermark","value":12}\n';r=subprocess.run([sys.executable,"-m","eventwindow.cli","--size","10","--allowed-lateness","2"],input=input_text,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"op":"add","status":"accepted"}\n{"emitted":[{"count":1,"end":10,"key":"x","start":0,"total":3}],"op":"watermark"}\n')
