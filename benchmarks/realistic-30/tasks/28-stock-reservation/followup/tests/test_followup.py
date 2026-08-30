import json, subprocess, sys, unittest
from stockroom import Inventory, Line, Reservation
class FollowTests(unittest.TestCase):
 def test_snapshot_roundtrip(self):
  i=Inventory({"B":1,"A":5});i.reserve(Reservation("r1",(Line("A",2),),5));i.advance_time(2);expected={"stock":{"A":5,"B":1},"now":2,"seen_ids":["r1"],"open":[{"id":"r1","lines":[{"sku":"A","quantity":2}],"expires_at":5}]};self.assertEqual(i.snapshot(),expected);self.assertEqual(Inventory.from_snapshot(expected).snapshot(),expected)
 def test_nonmutating_explain(self):
  i=Inventory({"A":5});i.reserve(Reservation("held",(Line("A",3),)));before=i.snapshot();self.assertEqual(i.explain(Reservation("new",(Line("A",4),),9)),{"id":"new","status":"insufficient","reason":"insufficient_stock","shortages":[{"sku":"A","requested":4,"available":2}],"expires_at":9,"now":0});self.assertEqual(i.snapshot(),before)
 def test_ndjson_cli(self):
  data='{"op":"reserve","reservation":{"id":"r1","lines":[{"sku":"A","quantity":2}],"expires_at":3}}\n{"op":"advance","now":3}\n';r=subprocess.run([sys.executable,"-m","stockroom.cli","--stock",'{"A":5}'],input=data,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,'{"op":"reserve","status":"accepted"}\n{"expired":["r1"],"op":"advance"}\n')
