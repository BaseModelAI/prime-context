import unittest
from parcelrate import rate
class PivotTests(unittest.TestCase):
 def test_dimensional_weight_can_dominate(self):
  p=[{"id":"box","weight_g":1000,"zone":"A","dimensions_cm":[50,40,30]}];s=[{"name":"Ground","zones":["A"],"max_weight_g":20000,"base_cents":100,"per_kg_cents":100}]
  self.assertEqual(rate(p,s)["quotes"],[{"id":"box","service":"Ground","cost_cents":1300}])
 def test_service_divisor_and_length_limit(self):
  p=[{"id":"long","weight_g":500,"zone":"A","dimensions_cm":[40,20,10]}];s=[{"name":"Roomy","zones":["A"],"max_weight_g":5000,"base_cents":0,"per_kg_cents":100,"dim_divisor":8000,"max_length_cm":30},{"name":"Compact","zones":["A"],"max_weight_g":5000,"base_cents":100,"per_kg_cents":100,"dim_divisor":4000}]
  self.assertEqual(rate(p,s)["quotes"],[{"id":"long","service":"Compact","cost_cents":300}])
 def test_fuel_and_remote_surcharge(self):
  p=[{"id":"r","weight_g":1500,"zone":"R"}];s=[{"name":"Road","zones":["R"],"max_weight_g":5000,"base_cents":100,"per_kg_cents":200,"fuel_percent":10,"remote_zones":["R"],"remote_surcharge_cents":75}]
  self.assertEqual(rate(p,s)["quotes"],[{"id":"r","service":"Road","cost_cents":625}])
