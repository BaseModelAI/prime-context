import copy, unittest
from parcelrate import rate
class BaseTests(unittest.TestCase):
 def test_selects_cheapest_service_in_input_order(self):
  parcels=[{"id":"p1","weight_g":1200,"zone":"A"},{"id":"p2","weight_g":500,"zone":"B"}]
  services=[{"name":"Express","zones":["A","B"],"max_weight_g":5000,"base_cents":100,"per_kg_cents":100},{"name":"Saver","zones":["A"],"max_weight_g":3000,"base_cents":150,"per_kg_cents":50}]
  self.assertEqual(rate(parcels,services),{"quotes":[{"id":"p1","service":"Saver","cost_cents":250},{"id":"p2","service":"Express","cost_cents":200}],"unrated":[]})
 def test_breaks_cost_ties_by_name(self):
  parcels=[{"id":"x","weight_g":1000,"zone":"Z"}];services=[{"name":"Zulu","zones":["Z"],"max_weight_g":1000,"base_cents":0,"per_kg_cents":200},{"name":"Alpha","zones":["Z"],"max_weight_g":1000,"base_cents":100,"per_kg_cents":100}]
  self.assertEqual(rate(parcels,services)["quotes"],[{"id":"x","service":"Alpha","cost_cents":200}])
 def test_unrated_and_inputs_unchanged(self):
  parcels=[{"id":"heavy","weight_g":9000,"zone":"A"},{"id":"remote","weight_g":400,"zone":"R"}];services=[{"name":"Local","zones":["A"],"max_weight_g":5000,"base_cents":10,"per_kg_cents":20}];before=copy.deepcopy((parcels,services))
  self.assertEqual(rate(parcels,services),{"quotes":[],"unrated":["heavy","remote"]});self.assertEqual((parcels,services),before)
