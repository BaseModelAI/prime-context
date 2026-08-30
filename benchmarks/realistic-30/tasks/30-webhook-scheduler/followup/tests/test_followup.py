import concurrent.futures, io, json, unittest
from test_base import FakeClock, ImmediateExecutor
from webhooks import WebhookScheduler
from webhooks.cli import main
class ManualExecutor:
 def __init__(self):self.tasks=[]
 def submit(self,fn,*args):
  f=concurrent.futures.Future();self.tasks.append((f,fn,args));return f
 def finish(self,index,status=204):
  f,fn,args=self.tasks[index]
  try:f.set_result(fn(*args))
  except BaseException as e:f.set_exception(e)
class FollowTests(unittest.TestCase):
 def test_per_host_limit_does_not_block_other_hosts(self):
  ex=ManualExecutor();seen=[]
  def send(url,*_):seen.append(url);return 204
  s=WebhookScheduler(send,clock=FakeClock(0),executor=ex,max_per_host=2)
  for id,url in [("A1","https://A.test/x"),("A2","http://a.test:8080/y"),("A3","https://a.test/z"),("B1","https://b.test/x")]:s.submit(url,{},delivery_id=id)
  self.assertEqual(s.pump(),3);self.assertEqual([x[0] for x in [t[2] for t in ex.tasks]],["https://A.test/x","http://a.test:8080/y","https://b.test/x"]);ex.finish(0);self.assertEqual(s.pump(),1);self.assertEqual(ex.tasks[3][2][0],"https://a.test/z")
 def test_cancel_pending_behind_limit(self):
  ex=ManualExecutor();seen=[]
  def send(url,*_):seen.append(url);return 204
  s=WebhookScheduler(send,clock=FakeClock(0),executor=ex,max_per_host=1);s.submit("https://a.test/1",{},delivery_id="A1");s.submit("https://a.test/2",{},delivery_id="A2");self.assertEqual(s.pump(),1);self.assertTrue(s.cancel("A2"));self.assertEqual(s.get("A2").state,"cancelled");ex.finish(0);self.assertEqual(s.pump(),0);self.assertEqual(seen,["https://a.test/1"]);self.assertFalse(s.cancel("A2"))
 def test_json_cli(self):
  out=io.StringIO();rc=main(["--json","--id","cli-1","https://example.test/hook",'{"z":1}'],stdout=out,sender=lambda *_:201,executor=ImmediateExecutor(),clock=FakeClock(7));self.assertEqual(rc,0);self.assertTrue(out.getvalue().endswith("\n"));self.assertEqual(out.getvalue().count("\n"),1);self.assertEqual(json.loads(out.getvalue()),{"attempts":1,"id":"cli-1","last_error":None,"last_status":201,"next_attempt_at":None,"state":"succeeded","url":"https://example.test/hook"})
