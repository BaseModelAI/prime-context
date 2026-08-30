import unittest
from test_base import FakeClock, ImmediateExecutor
from webhooks import WebhookScheduler
class RetryTests(unittest.TestCase):
 def test_transient_retry_waits_exact_deadline(self):
  c=FakeClock(100);out=iter([500,204]);s=WebhookScheduler(lambda *_:next(out),clock=c,executor=ImmediateExecutor(),max_attempts=3,backoff_base=5);s.submit("https://x.test",{},delivery_id="d");s.pump();v=s.get("d");self.assertEqual((v.state,v.attempts,v.next_attempt_at),("pending",1,105));c.set(104.999);self.assertEqual(s.pump(),0);c.set(105);self.assertEqual(s.pump(),1);self.assertEqual((s.get("d").state,s.get("d").attempts),("succeeded",2))
 def test_exponential_backoff_exhaustion(self):
  c=FakeClock(0);calls=[]
  def send(*_):calls.append(1);return 503
  s=WebhookScheduler(send,clock=c,executor=ImmediateExecutor(),max_attempts=3,backoff_base=2);s.submit("https://x.test",{},delivery_id="d");s.pump();self.assertEqual(s.get("d").next_attempt_at,2);c.set(2);s.pump();self.assertEqual(s.get("d").next_attempt_at,6);c.set(6);s.pump();self.assertEqual((s.get("d").state,s.get("d").next_attempt_at),("failed",None));c.set(100);self.assertEqual(s.pump(),0);self.assertEqual(len(calls),3)
 def test_exception_then_success(self):
  c=FakeClock(20);count=[0]
  def send(*_):
   count[0]+=1
   if count[0]==1:raise OSError("down")
   return 201
  s=WebhookScheduler(send,clock=c,executor=ImmediateExecutor(),backoff_base=3);s.submit("https://x.test",{},delivery_id="d");s.pump();v=s.get("d");self.assertEqual((v.state,v.next_attempt_at,v.attempts),("pending",23,1));self.assertIn("down",v.last_error);c.set(23);s.pump();v=s.get("d");self.assertEqual((v.state,v.attempts,v.last_status,v.last_error),("succeeded",2,201,None));c.set(99);self.assertEqual(s.pump(),0)
