# Local Supplier Catalog Crawler

Build a small, deterministic supplier-catalog synchronization command using only the Python standard library.

Run it as:

```bash
python -m solution.catalog_sync --base-url-file inputs/base_url.txt --output output/catalog.csv
```

The first input file contains one UTF-8 line: the base URL of a local loopback catalog server. Start from that URL. The server exposes HTML catalog pages and may return a temporary response while you crawl it.

## Requirements

- Use `urllib.request` for HTTP and subclass `html.parser.HTMLParser` for HTML parsing. Do not use external packages, a browser, shell HTTP tools, or concurrent requests.
- Parse catalog rows from table rows whose `data-sku` attribute is present. Each such row has cells with the classes `name`, `price`, `currency`, `stock`, and `revision`.
- Extract these exact fields: `sku,name,price,currency,stock,revision`. Treat `revision` as a base-10 integer when selecting a record. Preserve the field text supplied by the page in the final CSV.
- HTML character references in attributes, links, and cell text must be decoded. Ignore text inside `script` elements.
- Pagination links are `a` elements whose `rel` attribute contains the token `next`. Resolve relative links against the page that contained them. Follow every such link only when its scheme, host, and effective port match the initial base URL. Never request an off-origin link.
- Visit each reachable same-origin catalog URL once. If a request returns HTTP status `429`, read its `Retry-After` header, wait that many seconds, and retry that URL once. Do not retry a second `429` or other HTTP failures.
- A SKU may appear more than once. Keep the row with the highest numeric revision. If the same SKU and revision repeat, keep the first row seen.
- Create the output parent directory if needed.

## Output

Write `output/catalog.csv` as UTF-8 text with LF line endings. The header must be exactly:

```text
sku,name,price,currency,stock,revision
```

Emit one row per retained SKU, sorted by `sku` in ascending Unicode code-point order. Use normal Python CSV quoting rules. Do not add any other columns, comments, timestamps, or nondeterministic content.

The held-out edge case uses a query-relative next link containing an HTML-encoded ampersand. Decode and resolve it correctly while keeping the request on the original origin.
