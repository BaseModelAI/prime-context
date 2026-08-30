# Mixed materials and cutouts pivot

Preserve uniform behavior and add:
- Optional `conductivity`, a grid matching temperatures.
- Each real cell has a positive Decimal conductivity. A cutout is `None` in both temperature and conductivity grids.
- With no conductivity argument, every real cell has conductivity 1 and no cutouts are allowed.
- Across two real neighbors use symmetric face conductance `g = 2*k1*k2/(k1+k2)`.
- The update contribution is `alpha * g * (neighbor - cell)`.
- Outside and cutout edges are insulated.
- Fixed cells still override after the simultaneous flux calculation.
- Reject mismatched cutouts, nonpositive conductivity, and fixed coordinates on cutouts.
