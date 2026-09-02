"""Statement adapters. bank_b support was never completed."""
def bank_a(row):
    return row["id"], row["date"], row["description"], row["amount"]

def bank_b(row):
    raise NotImplementedError("bank_b import")
