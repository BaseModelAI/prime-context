# Eligibility threshold and seat caps pivot

Preserve the initial API and add keyword-only `min_basis_points=0` and `caps=None`.
- A positive-vote party qualifies iff `votes[p] * 10000 >= sum(all votes) * min_basis_points`; the boundary is inclusive.
- Excluded parties remain in the result with zero.
- Missing caps mean `seats`; caps are nonnegative.
- Apply constrained Hamilton: repeatedly fix every active party whose exact quota is at least its remaining cap, remove it, and recompute remaining quotas. When no cap binds, Hamilton-allocate the remainder.
- If eligible caps cannot cover all seats, raise exactly `ValueError("eligible caps cannot cover seats")`.
- Validate nonnegative integer seats, votes, caps and `0 <= min_basis_points <= 10000` with `ValueError`.
