#!/usr/bin/env python3.12
"""Create the initial fixture for task 29. Later-stage inputs are not created here."""
from __future__ import annotations
import argparse, csv, json, random, shutil, sqlite3
from pathlib import Path

TASK_ID = 29
SEED = 20260831 + TASK_ID

def write_csv(path: Path, rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        csv.writer(f, lineterminator="\n").writerows(rows)

def seed(workspace: Path, fixture: str) -> None:
    rng = random.Random(SEED)
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    here = Path(__file__).resolve().parent
    shutil.copy2(here / "TASK.md", workspace / "TASK.md")
    shutil.copytree(here / "visible" / "budgetdesk", workspace / "budgetdesk")
    (workspace / "inputs" / "statements").mkdir(parents=True)
    (workspace / "output").mkdir()
    (workspace / "workspace").mkdir()
    accounts = {"accounts": [
        {"source_account":"checking-001","name":"Household Checking","kind":"checking","dialect":"bank_a"},
        {"source_account":"savings-01","name":"Reserve Savings","kind":"savings","dialect":"bank_b"},
    ]}
    (workspace / "inputs" / "accounts.json").write_text(json.dumps(accounts, indent=2)+"\n", encoding="utf-8")
    rules = [
        {"pattern":"TRANSFER (TO|FROM)","category":"Internal Transfer","kind":"transfer"},
        {"pattern":"RENT","category":"Housing","kind":"spending"},
        {"pattern":"GROCER","category":"Groceries","kind":"spending"},
        {"pattern":"UTILIT","category":"Utilities","kind":"spending"},
        {"pattern":"PAYROLL|FREELANCE","category":"Earned Income","kind":"income"},
    ]
    (workspace / "inputs" / "category_rules.json").write_text(json.dumps(rules, indent=2)+"\n", encoding="utf-8")
    budgets={"Housing":"1300.00","Groceries":"200.00","Utilities":"150.00","Home Office":"250.00","Internet":"60.00"}
    (workspace / "inputs" / "budgets.json").write_text(json.dumps(budgets, indent=2, sort_keys=True)+"\n", encoding="utf-8")
    spaces = rng.choice(["  ", "   "])
    write_csv(workspace/"inputs/statements/checking-001.csv", [
        ["id","date","description","amount"],
        ["a-pay","2025-05-02","  ACME PAYROLL  ","3000.00"],
        ["a-rent","2025-05-03","MAY"+spaces+"RENT","-1200.00"],
        ["a-grocery","2025-05-08","Neighborhood GROCER","-45.50"],
        ["shared-7","2025-05-15","TRANSFER TO SAVINGS","-500.00"],
        ["a-grocery","2025-05-08","Neighborhood GROCER","-45.50"],
    ])
    write_csv(workspace/"inputs/statements/savings-01.csv", [
        ["Transaction ID","Posted","Details","Debit","Credit"],
        ["shared-7","05/15/2025","TRANSFER FROM CHECKING","","500.00"],
        ["b-freelance","05/20/2025","Freelance payment","","1100.00"],
        ["b-grocery","05/22/2025","Market grocer","73.00",""],
        ["b-util","05/28/2025","City utilities","120.00",""],
    ])
    # Both fixture names have the same ordinary initial state. The one edge is
    # introduced only by the private split-stage payload.
    db = sqlite3.connect(workspace / "workspace" / "budget.db")
    db.executescript("""
      CREATE TABLE schema_version(version INTEGER NOT NULL);
      INSERT INTO schema_version VALUES (1);
      CREATE TABLE accounts(id TEXT PRIMARY KEY, name TEXT, kind TEXT);
      CREATE TABLE transactions(
        id INTEGER PRIMARY KEY,
        account TEXT NOT NULL,
        external_id TEXT NOT NULL,
        posted TEXT NOT NULL,
        memo TEXT NOT NULL,
        amount TEXT NOT NULL,
        category TEXT NOT NULL
      );
    """)
    db.execute("INSERT INTO accounts VALUES (?,?,?)", ("legacy-card", "Archived Card", "credit"))
    db.execute("INSERT INTO transactions VALUES (1,?,?,?,?,?,?)",
               ("legacy-card","legacy-april","2025-04-30","ARCHIVED PURCHASE","-9.99","Uncategorized"))
    db.commit(); db.close()

def main() -> None:
    p=argparse.ArgumentParser()
    p.add_argument("--workspace", type=Path, required=True)
    p.add_argument("--fixture", choices=("main","edge"), required=True)
    a=p.parse_args(); seed(a.workspace, a.fixture)
if __name__ == "__main__": main()
