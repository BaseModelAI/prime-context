import unittest
from dnszone import compile_zone, ResolutionError
class PivotTests(unittest.TestCase):
 def test_cname_chain_and_minimum_ttl(self):
  rs=[{"name":"app","type":"CNAME","value":"edge","ttl":100},{"name":"edge","type":"CNAME","value":"origin","ttl":40},{"name":"origin","type":"A","value":"192.0.2.9","ttl":60}];a=compile_zone(rs,"example.com").resolve("app.example.com","A")[0];self.assertEqual((a.name,a.value,a.ttl),("app.example.com.","192.0.2.9",40))
 def test_longest_wildcard_and_exact_suppression(self):
  rs=[{"name":"*.example.com.","type":"A","value":"192.0.2.1"},{"name":"*.deep.example.com.","type":"A","value":"192.0.2.2"},{"name":"exact.deep","type":"TXT","value":"exists"}];z=compile_zone(rs,"example.com");self.assertEqual(z.resolve("x.deep.example.com","A")[0].value,"192.0.2.2");self.assertEqual(z.resolve("exact.deep.example.com","A"),())
 def test_cname_cycle(self):
  z=compile_zone([{"name":"a","type":"CNAME","value":"b"},{"name":"b","type":"CNAME","value":"a"}],"example.com")
  with self.assertRaises(ResolutionError):z.resolve("a.example.com","A")
