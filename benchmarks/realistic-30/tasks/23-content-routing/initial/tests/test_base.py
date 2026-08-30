import unittest
from contentrouter import ContentRouter, NoRoute, Resolution
class BaseTests(unittest.TestCase):
 def test_literal(self):
  r=ContentRouter.from_dict({"routes":[{"id":"home","path":"/","text":"Home"}]});self.assertEqual(r.resolve("/"),Resolution("home","Home",{},"*"))
 def test_capture_render(self):
  r=ContentRouter.from_dict({"routes":[{"id":"article","path":"/articles/{slug}","text":"Article: $slug by $author"}]});self.assertEqual(r.resolve("/articles/intro",values={"author":"Ada"}),Resolution("article","Article: intro by Ada",{"slug":"intro"},"*"))
 def test_miss(self):
  r=ContentRouter.from_dict({"routes":[]})
  with self.assertRaises(NoRoute):r.resolve("/missing")
