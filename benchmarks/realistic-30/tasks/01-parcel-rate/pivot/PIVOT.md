# Dimensional weight and surcharges pivot

Preserve the initial behavior and add:
- A parcel may have positive `dimensions_cm: [length, width, height]`.
- A service may have `dim_divisor`, defaulting to 5000 cubic centimeters per kilogram.
- For each service, billable kilograms are the maximum of actual kilograms and `ceil(volume_cm3 / dim_divisor)`.
- A service with `max_length_cm` is ineligible when any parcel dimension exceeds it.
- A service may have `fuel_percent`, a nonnegative integer. Add `ceil(linehaul_cost * fuel_percent / 100)` where linehaul cost is base plus weight pricing.
- A service may have `remote_zones` and `remote_surcharge_cents`; add the surcharge in those zones.
- Existing parcels and services without new fields retain their old results.
