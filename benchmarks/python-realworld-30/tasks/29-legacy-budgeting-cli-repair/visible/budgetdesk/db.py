import sqlite3

def connect(path):
    db=sqlite3.connect(path)
    db.row_factory=sqlite3.Row
    return db

def migrate(db):
    # BUG: assumes an empty database and collides with the supplied v1 schema.
    db.execute("CREATE TABLE transactions(id INTEGER PRIMARY KEY, source_id TEXT, amount REAL)")
