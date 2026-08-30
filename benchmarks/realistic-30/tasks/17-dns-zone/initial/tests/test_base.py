import unittest
from dnszone import compile_zone
class BaseTests(unittest.TestCase):
 def test_relative_and_case_insensitive_a(self):
  z=compile_zone([{"name":"WWW","type":"A","value":"192.0.2.1","ttl":60}],"Example.COM.");a=z.resolve("www.example.com","A");self.assertEqual((a[0].name,a[0].value,a[0].ttl),("www.example.com.","192.0.2.1",60))
 def test_default_ttl_and_sorted_values(self):
  z=compile_zone([{"name":"@","type":"TXT","value":"z"},{"name":"@","type":"TXT","value":"a"}],"example.com",120);self.assertEqual([(x.value,x.ttl) for x in z.resolve("example.com.","TXT")],[ ("a",120),("z",120)])
 def test_missing_and_invalid_address(self):
  z=compile_zone([],"example.com");self.assertEqual(z.resolve("none.example.com","A"),())
  with self.assertRaises(ValueError):compile_zone([{"name":"x","type":"A","value":"999.1.1.1"}],"example.com")
