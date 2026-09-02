"""Command-line entry point for webhook_app."""

from __future__ import annotations

import argparse

from .server import serve
from .worker import run_worker


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="python -m webhook_app")
    commands = result.add_subparsers(dest="command", required=True)

    serve_parser = commands.add_parser("serve")
    serve_parser.add_argument("--db", required=True)
    serve_parser.add_argument("--port", required=True, type=int)

    worker_parser = commands.add_parser("worker")
    worker_parser.add_argument("--db", required=True)
    worker_parser.add_argument("--sink-url-file", required=True)
    worker_parser.add_argument("--now", required=True)
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "serve":
        serve(args.db, args.port)
        return 0
    if args.command == "worker":
        return run_worker(args.db, args.sink_url_file, args.now)
    raise AssertionError("unreachable")


if __name__ == "__main__":
    raise SystemExit(main())
