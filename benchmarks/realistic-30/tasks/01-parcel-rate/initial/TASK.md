# Parcel Rate Optimizer

Implement the `parcelrate` package using only the Python standard library.

Initial API:
- `rate(parcels, services) -> dict`.
- A parcel has `id`, positive integer `weight_g`, and `zone`.
- A service has `name`, `zones`, positive integer `max_weight_g`, `base_cents`, and `per_kg_cents`.

Initial behavior:
- A service is eligible when the parcel zone is listed and its weight does not exceed the service maximum.
- Billable kilograms are `ceil(weight_g / 1000)`.
- Cost is `base_cents + billable_kilograms * per_kg_cents`.
- Choose the lowest-cost eligible service; break equal-cost ties by service name.
- Return `{"quotes": [{"id", "service", "cost_cents"}, ...], "unrated": [...]}` with both lists in parcel input order.
- Do not mutate inputs.

Run `python run_tests.py`. Edit only files under `parcelrate/`. Keep the active goal open for staged pivots.
