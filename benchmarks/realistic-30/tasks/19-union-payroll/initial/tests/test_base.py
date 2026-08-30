import copy, unittest
from union_payroll import calculate_pay
class BaseTests(unittest.TestCase):
 def s(self,id,e,start,end):return {"id":id,"employee":e,"start":start,"end":end}
 def test_regular_shift(self):
  r=calculate_pay([self.s("s","a","2026-01-05T09:00","2026-01-05T17:00")],{"a":{"hourly_rate":"20"}});self.assertEqual(r["employees"][0],{"employee":"a","regular_hours":"8.00","overtime_hours":"0.00","doubletime_hours":"0.00","differential":"0.00","gross":"160.00"})
 def test_weekly_overtime(self):
  shifts=[self.s(str(i),"a",f"2026-01-{5+i:02d}T09:00",f"2026-01-{5+i:02d}T18:00") for i in range(5)];row=calculate_pay(shifts,{"a":{"hourly_rate":"10"}})["employees"][0];self.assertEqual((row["regular_hours"],row["overtime_hours"],row["gross"]),("40.00","5.00","475.00"))
 def test_multiple_employees_pure_and_overlap_rejected(self):
  shifts=[self.s("b","b","2026-01-05T09:00","2026-01-05T10:00"),self.s("a","a","2026-01-05T09:00","2026-01-05T10:00")];before=copy.deepcopy(shifts);self.assertEqual([x["employee"] for x in calculate_pay(shifts,{"a":{"hourly_rate":"1"},"b":{"hourly_rate":"2"}})["employees"]],["a","b"]);self.assertEqual(shifts,before)
  with self.assertRaises(ValueError):calculate_pay([self.s("1","a","2026-01-05T09:00","2026-01-05T10:00"),self.s("2","a","2026-01-05T09:30","2026-01-05T10:30")],{"a":{"hourly_rate":"1"}})
