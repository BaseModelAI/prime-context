import csv, json
from pathlib import Path
from .db import connect, migrate

def load(db_path, accounts_path, statements_path):
    db=connect(db_path)
    migrate(db)
    accounts=json.loads(Path(accounts_path).read_text())["accounts"]
    for account in accounts:
        path=Path(statements_path)/(account["source_account"]+".csv")
        for row in csv.DictReader(path.open()):
            # BUG: knows only one dialect, uses float, and has no durable identity.
            db.execute("INSERT INTO transactions(source_id, amount) VALUES (?,?)", (row["id"], float(row["amount"])))
    db.commit(); db.close()
