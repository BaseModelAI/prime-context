import unittest
from union_payroll import calculate_pay
class FollowTests(unittest.TestCase):
 def shifts(self):return [{"id":"a","employee":"e","start":"2026-01-05T09:00","end":"2026-01-05T10:00"},{"id":"b","employee":"e","start":"2026-01-05T10:00","end":"2026-01-05T12:00"}]
 def test_shift_lines_allocate_current_pay(self):
  r=calculate_pay(self.shifts(),{"e":{"hourly_rate":"10"}},{"a":"9.00","b":"20.00"});self.assertEqual(r["shift_lines"],[{"id":"a","employee":"e","current":"10.00","prior":"9.00","adjustment":"1.00"},{"id":"b","employee":"e","current":"20.00","prior":"20.00","adjustment":"0.00"}]);self.assertEqual(r["total_adjustment"],"1.00")
 def test_overpayment_is_negative(self):
  r=calculate_pay(self.shifts()[:1],{"e":{"hourly_rate":"10"}},{"a":"12"});self.assertEqual((r["total_prior"],r["total_adjustment"]),("12.00","-2.00"))
 def test_unknown_prior_id_rejected(self):
  with self.assertRaises(ValueError):calculate_pay(self.shifts(),{"e":{"hourly_rate":"10"}},{"missing":"1"})
