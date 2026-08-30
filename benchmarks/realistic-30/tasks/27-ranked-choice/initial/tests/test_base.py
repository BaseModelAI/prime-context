import unittest
from rankedchoice import tabulate
class BaseTests(unittest.TestCase):
 def test_first_round_majority(self):
  self.assertEqual(tabulate([["Ada","Lin"],["Ada"],["Lin","Ada"]]),{"winner":"Ada","rounds":[{"counts":{"Ada":2,"Lin":1},"exhausted":0,"eliminated":None}]})
 def test_transfer_elects_candidate(self):
  self.assertEqual(tabulate([["A"],["A","B"],["B"],["B"],["C","B"]]),{"winner":"B","rounds":[{"counts":{"A":2,"B":2,"C":1},"exhausted":0,"eliminated":"C"},{"counts":{"A":2,"B":3},"exhausted":0,"eliminated":None}]})
 def test_tie_elimination_and_exhaustion(self):
  self.assertEqual(tabulate([["A"],["B"],["C"],[]]),{"winner":"A","rounds":[{"counts":{"A":1,"B":1,"C":1},"exhausted":1,"eliminated":"C"},{"counts":{"A":1,"B":1},"exhausted":2,"eliminated":"B"},{"counts":{"A":1},"exhausted":3,"eliminated":None}]})
