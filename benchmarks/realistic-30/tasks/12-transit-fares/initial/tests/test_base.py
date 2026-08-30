import unittest
from transit_fares import settle
class BaseTests(unittest.TestCase):
 def rules(self):return {"station_zones":{"A":1,"B":2},"fares":{"1":{"offpeak":"2.00","peak":"2.50"},"2":{"offpeak":"3.00","peak":"3.50"}},"peak_windows":[["07:00","09:00"]],"missing_tap_penalty":"5.00"}
 def test_offpeak_two_zone_trip(self):
  taps=[{"id":"1","rider":"r","kind":"in","station":"A","at":"2026-01-05T10:00:00"},{"id":"2","rider":"r","kind":"out","station":"B","at":"2026-01-05T10:30:00"}];row=settle(taps,self.rules())[0];self.assertEqual((row["kind"],row["amount"],row["service_day"]),("trip","3.00","2026-01-05"))
 def test_peak_boundary_is_inclusive(self):
  taps=[{"id":"1","rider":"r","kind":"in","station":"A","at":"2026-01-05T07:00:00"},{"id":"2","rider":"r","kind":"out","station":"A","at":"2026-01-05T07:05:00"}];self.assertEqual(settle(taps,self.rules())[0]["amount"],"2.50")
 def test_unmatched_in_penalty(self):
  taps=[{"id":"x","rider":"r","kind":"in","station":"A","at":"2026-01-05T03:59:00"}];self.assertEqual(settle(taps,self.rules()),[{"rider":"r","kind":"missing","started_at":"2026-01-05T03:59:00","service_day":"2026-01-04","amount":"5.00"}])
