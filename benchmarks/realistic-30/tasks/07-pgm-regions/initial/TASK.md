# PGM Region Analyzer

Implement the `pgm_regions` package using only the Python standard library.

Initial API:
- Immutable `Image(width, height, maxval, rows)` with validated integer pixels.
- `read_pgm(data: bytes) -> Image` initially supports P2 ASCII PGM with comments and arbitrary header/data whitespace.
- `label_components(image, threshold, connectivity=4) -> tuple[Region, ...]`.
- Foreground means pixel value is at least threshold.
- Immutable `Region(id, area, bbox, centroid, perimeter=None, holes=None)`.

Initial behavior:
- IDs start at 1 in first-foreground-pixel raster order.
- `bbox` is inclusive `(min_x, min_y, max_x, max_y)`.
- Centroid is a pair of exact `Fraction` values.
- Initially support connectivity 4 and reject invalid/ragged images and out-of-range pixels.

Run `python run_tests.py`. Edit only files under `pgm_regions/`. Keep the active goal open for staged pivots.
