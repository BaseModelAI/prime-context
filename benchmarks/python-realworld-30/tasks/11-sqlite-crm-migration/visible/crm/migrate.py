"""Schema migration command (incomplete)."""

from __future__ import annotations

import argparse
from pathlib import Path


def migrate(database: Path) -> None:
    """Upgrade *database* to CRM schema version 2."""
    raise NotImplementedError("implement the version-1 to version-2 migration")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upgrade a CRM database to schema version 2")
    parser.add_argument("database", type=Path)
    args = parser.parse_args()
    migrate(args.database)


if __name__ == "__main__":
    main()
