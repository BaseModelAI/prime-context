import unittest
from transit_fares import settle
class FollowTests(unittest.TestCase):
 def base_rules(self):return {"station_zones":{"A":1},"fares":{"1":{"offpeak":"4.00","peak":"4.00"}},"peak_windows":[],"missing_tap_penalty":"4.00"}
 def trip(self,day,n):return [{"id":f"{n}a","rider":"r","kind":"in","station":"A","at":f"{day}T10:00:00"},{"id":f"{n}b","rider":"r","kind":"out","station":"A","at":f"{day}T10:10:00"}]
 def test_concession_starts_on_effective_day(self):
  riders={"r":{"start":"2026-01-06","discount_percent":50}};rows=settle(self.trip("2026-01-05",1)+self.trip("2026-01-06",2),self.base_rules(),riders);self.assertEqual([x["amount"] for x in rows],["4.00","2.00"])
 def test_weekly_cap_after_daily_cap(self):
  rules=self.base_rules();rules["daily_cap"]="3.00";riders={"r":{"start":"2026-01-01","discount_percent":0,"weekly_cap":"5.00"}};rows=settle(self.trip("2026-01-05",1)+self.trip("2026-01-06",2),rules,riders);self.assertEqual([(x["kind"],x["amount"]) for x in rows],[("trip","4.00"),("daily_cap","-1.00"),("trip","4.00"),("daily_cap","-1.00"),("weekly_cap","-1.00")])
 def test_sunday_and_monday_are_different_weeks(self):
  riders={"r":{"start":"2026-01-01","discount_percent":0,"weekly_cap":"5.00"}};rows=settle(self.trip("2026-01-04",1)+self.trip("2026-01-05",2),self.base_rules(),riders);self.assertNotIn("weekly_cap",[x["kind"] for x in rows])
