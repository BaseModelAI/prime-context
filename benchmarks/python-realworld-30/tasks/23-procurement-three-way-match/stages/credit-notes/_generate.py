#!/usr/bin/env python3
"""Generate the hidden credit-note follow-up payload."""

import argparse
import random
import xml.etree.ElementTree as ET
from pathlib import Path

SEED = 20260831 + 23


def generate(output: Path, fixture: str) -> None:
    (output / "stage.json").unlink(missing_ok=True)
    random.Random(SEED)
    inputs = output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    root = ET.Element("credit_notes")
    if fixture == "main":
        entries = [
            ("line_credit", {"credit_id": "CR-L-001", "supplier_id": "SUP-ALPHA", "invoice_id": "INV-100-A", "invoice_line_id": "INV-100-A-1", "amount": "100.00"}),
            ("line_credit", {"credit_id": "CR-L-002", "supplier_id": "SUP-BETA", "invoice_id": "INV-200", "invoice_line_id": "INV-200-2", "amount": "50.00"}),
            ("line_credit", {"credit_id": "CR-L-003", "supplier_id": "SUP-DELTA", "invoice_id": "INV-403", "invoice_line_id": "INV-403-L02", "amount": "12.50"}),
            ("header_credit", {"credit_id": "CR-H-001", "supplier_id": "SUP-ALPHA", "amount": "75.00"}),
            ("header_credit", {"credit_id": "CR-H-002", "supplier_id": "SUP-BETA", "amount": "40.00"}),
            ("header_credit", {"credit_id": "CR-H-003", "supplier_id": "SUP-GAMMA", "amount": "10.00"}),
        ]
    else:
        entries = [
            ("line_credit", {"credit_id": "EDGE-CREDIT", "supplier_id": "SUP-EDGE", "invoice_id": "INV-EDGE", "invoice_line_id": "INV-EDGE-L1", "amount": "150.00"}),
        ]
    for tag, attrs in entries:
        ET.SubElement(root, tag, attrs)
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(inputs / "credit_notes.xml", encoding="utf-8", xml_declaration=True)
    with (inputs / "credit_notes.xml").open("a", encoding="utf-8") as handle:
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)


if __name__ == "__main__":
    main()
