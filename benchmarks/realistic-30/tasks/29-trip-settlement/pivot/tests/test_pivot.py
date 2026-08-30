import unittest
from tripsplit import settle
class PivotTests(unittest.TestCase):
 def test_subset_only(self):
  expense={"payer":"Ana","amount":"30.00","shares":{"Bo":1,"Cy":1}};self.assertEqual(settle(["Ana","Bo","Cy"],[expense]),[{"from":"Bo","to":"Ana","amount":"15.00"},{"from":"Cy","to":"Ana","amount":"15.00"}])
 def test_weighted_rounding(self):
  expense={"payer":"Ana","amount":"10.00","shares":{"Ana":1,"Bo":2,"Cy":3}};self.assertEqual(settle(["Ana","Bo","Cy"],[expense]),[{"from":"Bo","to":"Ana","amount":"3.33"},{"from":"Cy","to":"Ana","amount":"5.00"}])
 def test_custom_and_default_mix(self):
  expenses=[{"payer":"Ana","amount":"12.00","shares":{"Bo":1,"Cy":1}},{"payer":"Dee","amount":"8.00"}];self.assertEqual(settle(["Ana","Bo","Cy","Dee"],expenses),[{"from":"Bo","to":"Ana","amount":"8.00"},{"from":"Cy","to":"Ana","amount":"2.00"},{"from":"Cy","to":"Dee","amount":"6.00"}])
