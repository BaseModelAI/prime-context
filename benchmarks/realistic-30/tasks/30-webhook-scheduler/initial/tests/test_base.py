import concurrent.futures, unittest
from webhooks import SendResult, WebhookScheduler
class FakeClock:
 def __init__(self,now):self.now=now
 def __call__(self):return self.now
 def set(self,value):self.now=value
class ImmediateExecutor:
 def submit(self,fn,*args):
  f=concurrent.futures.Future()
  try:f.set_result(fn(*args))
  except BaseException as e:f.set_exception(e)
  return f
class BaseTests(unittest.TestCase):
 def test_success_posts_canonical_json(self):
  calls=[]
  def send(*args):calls.append(args);return SendResult(204)
  s=WebhookScheduler(send,clock=FakeClock(10),executor=ImmediateExecutor());s.submit("https://x.test/h",{"b":2,"a":1},delivery_id="d1")
  self.assertEqual(s.pump(),1);self.assertEqual(calls[0][1],b'{"a":1,"b":2}');self.assertEqual(calls[0][2],{"Content-Type":"application/json"});v=s.get("d1");self.assertEqual((v.state,v.attempts,v.last_status),("succeeded",1,204));self.assertEqual(s.pump(),0)
 def test_not_before_and_fifo(self):
  clock=FakeClock(10);seen=[]
  def send(url,*_):seen.append(url);return 204
  s=WebhookScheduler(send,clock=clock,executor=ImmediateExecutor());s.submit("A",{},delivery_id="A",not_before=12);s.submit("B",{},delivery_id="B");s.submit("C",{},delivery_id="C")
  self.assertEqual(s.pump(),2);self.assertEqual(seen,["B","C"]);clock.set(11);self.assertEqual(s.pump(),0);clock.set(12);self.assertEqual(s.pump(),1);self.assertEqual(seen,["B","C","A"])
 def test_permanent_400_is_not_retried(self):
  clock=FakeClock(0);calls=[]
  def send(*_):calls.append(1);return 400
  s=WebhookScheduler(send,clock=clock,executor=ImmediateExecutor(),max_attempts=5);s.submit("https://x.test",{},delivery_id="d");s.pump();self.assertEqual((s.get("d").state,s.get("d").attempts),("failed",1));clock.set(100);self.assertEqual(s.pump(),0);self.assertEqual(len(calls),1)
