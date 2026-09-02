import argparse
from . import importer, report

def parser():
    p=argparse.ArgumentParser(prog="budgetdesk")
    sub=p.add_subparsers(dest="command", required=True)
    i=sub.add_parser("import")
    i.add_argument("db"); i.add_argument("accounts"); i.add_argument("statements")
    r=sub.add_parser("report")
    r.add_argument("db"); r.add_argument("--month", required=True); r.add_argument("--output", required=True)
    # TODO: the old export command was removed during a failed refactor.
    return p

def main(argv=None):
    a=parser().parse_args(argv)
    if a.command == "import": importer.load(a.db, a.accounts, a.statements)
    elif a.command == "report": report.write(a.db, a.month, a.output)
