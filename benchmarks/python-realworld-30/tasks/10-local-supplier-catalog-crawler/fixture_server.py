#!/usr/bin/env python3
"""Loopback-only supplier catalog fixture service for Task 10."""

import argparse
import html
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import random
import threading
import time
from urllib.parse import urlsplit

SEED = 20260831 + 10


def build_pages(fixture):
    """Return request-target -> HTML and the one transient target."""
    rng = random.Random(SEED)
    if fixture == "edge":
        rows_by_page = {
            1: [("EDGE-001", "Query & Link", "1.25", "USD", "7", "1")],
            2: [("EDGE-002", "Arrived <Safely>", "2.50", "USD", "3", "1")],
        }
        targets = {1: "/", 2: "/?page=2&channel=a%26b"}
    else:
        rows_by_page = {}
        for page in range(1, 41):
            page_rows = []
            for slot in range(8):
                number = (page - 1) * 8 + slot + 1
                sku = f"SKU-{number:04d}"
                marker = " & Workshop" if number % 37 == 0 else ""
                name = f"Supplier Part {number:04d}{marker}"
                price = f"{rng.randrange(125, 25000) / 100:.2f}"
                currency = ("USD", "EUR", "GBP")[rng.randrange(3)]
                stock = str(rng.randrange(0, 501))
                revision = str(rng.randrange(1, 8))
                page_rows.append((sku, name, price, currency, stock, revision))
            rows_by_page[page] = page_rows
        rows_by_page[1].extend([
            ("ACME-001", "Acme & Sons", "10.00", "USD", "4", "1"),
            ("ENTITY-001", "Safety <Shield> & Clamp", "12.50", "EUR", "9", "2"),
        ])
        rows_by_page[5].append(("REV-ONLY", "Revision Two", "5.00", "USD", "1", "2"))
        rows_by_page[6].append(("REV-ONLY", "Revision Ten", "7.00", "USD", "8", "10"))
        rows_by_page[25].append(("ACME-001", "Acme & Sons Deluxe", "11.00", "USD", "12", "3"))
        targets = {1: "/"}
        targets.update({page: f"/catalog?page={page}" for page in range(2, 41)})

    pages = {}
    last_page = max(rows_by_page)
    for page, rows in rows_by_page.items():
        body = ["<!doctype html><html><head><title>Catalog</title></head><body>"]
        body.append("<table><thead><tr><th>Item</th></tr></thead><tbody>")
        for sku, name, price, currency, stock, revision in rows:
            body.append(
                f'<tr data-sku="{html.escape(sku, quote=True)}">'
                f'<td class="name">{html.escape(name)}</td>'
                f'<td class="price">{html.escape(price)}</td>'
                f'<td class="currency">{html.escape(currency)}</td>'
                f'<td class="stock">{html.escape(stock)}</td>'
                f'<td class="revision">{html.escape(revision)}</td></tr>'
            )
        body.append("</tbody></table>")
        body.append('<script>var fake = "<tr data-sku=\"SCRIPT-FAKE\">";</script>')
        if page < last_page:
            if fixture == "edge":
                href = "?page=2&amp;channel=a%26b"
            elif page % 2:
                href = f"/catalog?page={page + 1}"
            else:
                href = f"?page={page + 1}"
            body.append(f'<a rel="next" href="{href}">Next page</a>')
        if fixture == "main" and page == 1:
            body.append('<a rel="next" href="{DECOY_ORIGIN}/trap">Mirror pagination</a>')
        body.append("</body></html>")
        pages[targets[page]] = "".join(body)
    transient = "/catalog?page=17" if fixture == "main" else None
    return pages, transient


def append_log(path, record):
    if path is not None:
        with path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    parser.add_argument("--log", type=Path)
    args = parser.parse_args()
    pages, transient = build_pages(args.fixture)
    transient_seen = set()

    class DecoyHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            append_log(args.log, {"server": "decoy", "target": self.path})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<!doctype html><p>off-origin trap</p>")

        def log_message(self, format, *values):
            return

    decoy = HTTPServer(("127.0.0.1", 0), DecoyHandler)
    decoy_thread = threading.Thread(target=decoy.serve_forever, daemon=True)
    decoy_thread.start()
    decoy_origin = f"http://127.0.0.1:{decoy.server_port}"

    class CatalogHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            append_log(args.log, {"server": "catalog", "target": self.path, "at": time.monotonic()})
            if self.path == transient and self.path not in transient_seen:
                transient_seen.add(self.path)
                self.send_response(429)
                self.send_header("Retry-After", "1")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            content = pages.get(self.path)
            if content is None:
                self.send_error(404)
                return
            payload = content.replace("{DECOY_ORIGIN}", decoy_origin).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, format, *values):
            return

    catalog = HTTPServer(("127.0.0.1", args.port), CatalogHandler)
    print(f"LISTENING {catalog.server_port}", flush=True)
    try:
        catalog.serve_forever()
    finally:
        catalog.server_close()
        decoy.shutdown()
        decoy.server_close()


if __name__ == "__main__":
    main()
