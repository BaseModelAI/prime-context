# Region topology analysis

Final requirements:
- `analyze_regions(image, threshold, connectivity=4)` returns Regions with all earlier fields plus integer `perimeter` and `holes`.
- Perimeter counts unit grid edges between a region pixel and outside, a cut to background, or a different region.
- Hole detection uses 4-connected background components, even when foreground labeling uses connectivity 8.
- A hole is a background component that does not touch the image boundary and whose foreground boundary belongs only to that region.
- An unrelated foreground region must not change another region's metrics.
- Keep IDs and result order identical to `label_components` for the same connectivity.
