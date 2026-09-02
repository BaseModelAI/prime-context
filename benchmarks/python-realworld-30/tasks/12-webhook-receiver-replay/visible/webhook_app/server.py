"""HTTP receiver for webhook events.

The health endpoint and process lifecycle are present.  The event endpoints are
left for the task implementation.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .db import connect


class EventServer(ThreadingHTTPServer):
    db_path: str


class Handler(BaseHTTPRequestHandler):
    server: EventServer

    def _json_response(self, status: int, value: object) -> None:
        body = json.dumps(value, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path == "/health":
            self._json_response(200, {"ok": True})
            return
        # TODO: implement GET /events/<id>.
        self._json_response(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/events":
            self._json_response(404, {"error": "not found"})
            return
        # TODO: validate and persist the event.
        self._json_response(501, {"error": "event receiver not implemented"})

    def log_message(self, format: str, *args: object) -> None:
        # Keep stdout reserved for the required readiness line.
        return


def serve(db_path: str, port: int) -> None:
    # Initialize the database before announcing readiness.
    with connect(db_path):
        pass
    httpd = EventServer(("127.0.0.1", port), Handler)
    httpd.db_path = db_path
    selected_port = int(httpd.server_address[1])
    print(f"LISTENING {selected_port}", flush=True)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
