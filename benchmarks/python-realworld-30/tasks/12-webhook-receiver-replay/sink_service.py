#!/usr/bin/env python3
"""Runner-owned loopback webhook sink for Task 12."""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading


class SinkServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, *, mode: str, log_path: Path | None):
        super().__init__(address, handler)
        self.mode = mode
        self.log_path = log_path
        self.counts: dict[str, int] = {}
        self.lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server: SinkServer

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        body = self.rfile.read(max(0, length))
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            payload = None
        kind = payload.get("kind", "") if isinstance(payload, dict) else ""

        with self.server.lock:
            attempt = self.server.counts.get(kind, 0) + 1
            self.server.counts[kind] = attempt
            status = 204
            if self.server.mode == "judge-main" and kind == "retry":
                status = 503 if attempt <= 5 else 204
            if self.server.log_path is not None:
                record = {
                    "attempt": attempt,
                    "content_type": self.headers.get("Content-Type"),
                    "kind": kind,
                    "path": self.path,
                    "payload": payload,
                }
                with self.server.log_path.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps(record, sort_keys=True) + "\n")

        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path == "/health":
            body = b'{"ok":true}\n'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument(
        "--mode", choices=("live", "judge-main", "judge-edge"), default="live"
    )
    parser.add_argument("--log", type=Path)
    args = parser.parse_args()

    server = SinkServer(
        ("127.0.0.1", args.port), Handler, mode=args.mode, log_path=args.log
    )
    print(f"LISTENING {server.server_address[1]}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
