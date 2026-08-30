# Periodic NPV and yield solver

Final requirements:
- `npv(rate, cashflows) -> Decimal` computes `sum(cashflow[t] / (1 + rate) ** t)` using Decimal only.
- `irr(cashflows, low=Decimal("-0.9999"), high=Decimal("10"), tolerance=Decimal("1e-12")) -> Decimal`.
- IRR uses deterministic Decimal bisection over the inclusive bracket.
- Ignore zero cash flows when counting signs and require exactly one sign change in the ordered sequence.
- Require `low < high`, rates greater than -1, a positive tolerance, and endpoint NPVs that bracket zero.
- Return an endpoint if its NPV is within tolerance; otherwise return the first midpoint whose absolute NPV is within tolerance.
- Reject floats and malformed or unbracketed inputs.
