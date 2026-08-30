import unittest
from tripsplit import settle
class BaseTests(unittest.TestCase):
 def test_two_people(self):
  self.assertEqual(settle(["Ana","Bo"],[{"payer":"Ana","amount":"20.00"}]),[{"from":"Bo","to":"Ana","amount":"10.00"}])
 def test_spare_cent_by_people_order(self):
  self.assertEqual(settle(["Ana","Bo","Cy"],[{"payer":"Ana","amount":"10.00"}]),[{"from":"Bo","to":"Ana","amount":"3.33"},{"from":"Cy","to":"Ana","amount":"3.33"}])
 def test_multiple_payers(self):
  expenses=[{"payer":"Ana","amount":"12.00"},{"payer":"Bo","amount":"6.00"}];self.assertEqual(settle(["Ana","Bo","Cy"],expenses),[{"from":"Cy","to":"Ana","amount":"6.00"}])
