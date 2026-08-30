import unittest
from union_payroll import calculate_pay
class PivotTests(unittest.TestCase):
 def s(self,id,day,start,end):return {"id":id,"employee":"a","start":f"2026-01-{day:02d}T{start}","end":f"2026-01-{day:02d}T{end}"}
 def test_daily_overtime_and_doubletime(self):
  c={"a":{"hourly_rate":"10","daily_overtime_after":8,"daily_doubletime_after":12}};row=calculate_pay([self.s("s",5,"08:00","22:00")],c)["employees"][0];self.assertEqual((row["regular_hours"],row["overtime_hours"],row["doubletime_hours"],row["gross"]),("8.00","4.00","2.00","180.00"))
 def test_night_differential(self):
  c={"a":{"hourly_rate":"20","night_differential":"2"}};row=calculate_pay([self.s("s",5,"20:00","23:59")|{"end":"2026-01-06T00:00"}],c)["employees"][0];self.assertEqual((row["differential"],row["gross"]),("4.00","84.00"))
 def test_daily_and_weekly_overtime_do_not_stack(self):
  c={"a":{"hourly_rate":"10","daily_overtime_after":8,"daily_doubletime_after":24}};shifts=[self.s(str(i),5+i,"08:00","18:00") for i in range(5)];row=calculate_pay(shifts,c)["employees"][0];self.assertEqual((row["regular_hours"],row["overtime_hours"],row["gross"]),("32.00","18.00","590.00"))
