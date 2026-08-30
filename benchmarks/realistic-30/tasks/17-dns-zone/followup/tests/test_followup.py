import unittest
from dnszone import parse_zone
class FollowTests(unittest.TestCase):
 def test_directives_and_owner_reuse(self):
  text="$ORIGIN example.com.\n$TTL 600\nwww 60 A 192.0.2.1\n    AAAA 2001:db8::1\n";z=parse_zone(text,"invalid.test");self.assertEqual(z.resolve("www.example.com","A")[0].ttl,60);self.assertEqual((z.resolve("www.example.com","AAAA")[0].value,z.resolve("www.example.com","AAAA")[0].ttl),("2001:db8::1",600))
 def test_quoted_txt_and_comments(self):
  z=parse_zone('@ TXT "hello world" ; ignored\n',"example.com",90);self.assertEqual(z.resolve("example.com","TXT")[0].value,"hello world")
 def test_origin_change_affects_cname_target(self):
  text="$ORIGIN one.test.\na A 192.0.2.1\n$ORIGIN two.test.\nalias CNAME target\ntarget A 192.0.2.4\n";z=parse_zone(text,"start.test");self.assertEqual(z.resolve("alias.two.test","A")[0].value,"192.0.2.4")
