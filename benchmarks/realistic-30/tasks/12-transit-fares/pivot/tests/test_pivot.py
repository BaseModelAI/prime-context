import unittest
from transit_fares import settle
class PivotTests(unittest.TestCase):
 def rules(self):return {"station_zones":{"A":1},"fares":{"1":{"offpeak":"3.00","peak":"3.00"}},"peak_windows":[],"missing_tap_penalty":"5.00","daily_cap":"5.00"}
 def trip(self,rider,day,hour,n):return [{"id":f"{n}a","rider":rider,"kind":"in","station":"A","at":f"{day}T{hour}:00:00"},{"id":f"{n}b","rider":rider,"kind":"out","station":"A","at":f"{day}T{hour}:10:00"}]
 def test_cap_adjustment_exact_amount(self):
  rows=settle(self.trip("r","2026-01-05","10:00",1)+self.trip("r","2026-01-05","12:00",2),self.rules());self.assertEqual([x["amount"] for x in rows],["3.00","3.00","-1.00"]);self.assertEqual(rows[-1]["kind"],"daily_cap")
 def test_service_day_boundary_splits_caps(self):
  taps=self.trip("r","2026-01-05","03:59",1)+self.trip("r","2026-01-05","04:00",2);rows=settle(taps,self.rules());self.assertEqual([x["service_day"] for x in rows],["2026-01-04","2026-01-05"]);self.assertNotIn("daily_cap",[x["kind"] for x in rows])
 def test_interleaved_riders_cap_independently(self):
  taps=self.trip("a","2026-01-05","10:00",1)+self.trip("b","2026-01-05","10:30",2)+self.trip("a","2026-01-05","11:00",3);rows=settle(taps,self.rules());self.assertEqual([(x["rider"],x["kind"],x["amount"]) for x in rows],[("a","trip","3.00"),("a","trip","3.00"),("a","daily_cap","-1.00"),("b","trip","3.00")])
