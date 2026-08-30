import unittest
from rankedchoice import tabulate
class PivotTests(unittest.TestCase):
 def test_weighted_and_legacy_mix(self):
  ballots=[{"ranking":["A","B"],"weight":2},{"ranking":["B"],"weight":1},["C","B"]];self.assertEqual(tabulate(ballots),{"winner":"A","rounds":[{"counts":{"A":2,"B":1,"C":1},"exhausted":0,"eliminated":"C"},{"counts":{"A":2,"B":2},"exhausted":0,"eliminated":"B"},{"counts":{"A":2},"exhausted":2,"eliminated":None}]})
 def test_withdrawn_candidates_skipped(self):
  self.assertEqual(tabulate([["A","B"],["A","C"],["B"],["C"]],withdrawn=["A"]),{"winner":"B","rounds":[{"counts":{"B":2,"C":2},"exhausted":0,"eliminated":"C"},{"counts":{"B":2},"exhausted":2,"eliminated":None}]})
 def test_all_candidates_withdrawn(self):
  self.assertEqual(tabulate([{"ranking":["A"],"weight":3}],withdrawn=["A"]),{"winner":None,"rounds":[]})
