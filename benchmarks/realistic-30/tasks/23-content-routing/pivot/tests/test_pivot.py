import unittest
from contentrouter import ContentRouter
class LocaleTests(unittest.TestCase):
 def test_exact_locale(self):
  r=ContentRouter.from_dict({"default_locale":"en","routes":[{"id":"en","path":"/welcome","locale":"en","text":"Hello"},{"id":"fr","path":"/welcome","locale":"fr","text":"Salut"}]});x=r.resolve("/welcome",locale="FR");self.assertEqual((x.route_id,x.text,x.locale),("fr","Salut","fr"))
 def test_parent_then_default_fallback(self):
  r=ContentRouter.from_dict({"default_locale":"en","routes":[{"id":"en","path":"/welcome","locale":"en","text":"Hello"},{"id":"fr","path":"/welcome","locale":"fr","text":"Salut"}]});self.assertEqual(r.resolve("/welcome",locale="fr-CA").route_id,"fr");self.assertEqual(r.resolve("/welcome",locale="es-MX").route_id,"en")
 def test_named_template(self):
  r=ContentRouter.from_dict({"default_locale":"en","templates":{"card":"$title [$slug]"},"routes":[{"id":"post","path":"/posts/{slug}","locale":"en","template":"card","content":{"title":"News"}}]});x=r.resolve("/posts/launch");self.assertEqual((x.text,x.params,x.locale),("News [launch]",{"slug":"launch"},"en"))
