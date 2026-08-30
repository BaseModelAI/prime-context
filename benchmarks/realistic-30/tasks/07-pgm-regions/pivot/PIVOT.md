# Binary PGM and diagonal connectivity pivot

Preserve P2 behavior and add:
- `read_pgm` supports P5 binary PGM.
- For `maxval < 256`, each sample is one unsigned byte.
- Otherwise each sample is two-byte unsigned big-endian.
- Comments and arbitrary whitespace are allowed between P5 header tokens; the binary raster begins after the required separator following `maxval`.
- Reject truncated or trailing raster bytes and pixel values above maxval.
- `label_components(..., connectivity=8)` includes diagonal neighbors.
- IDs remain based on each component's first raster pixel regardless of connectivity.
