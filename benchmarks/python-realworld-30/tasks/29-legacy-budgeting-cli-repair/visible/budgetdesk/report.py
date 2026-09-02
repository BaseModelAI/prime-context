import json
from pathlib import Path

def write(db_path, month, output):
    # Broken placeholder retained to make the command discoverable.
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(json.dumps({"month": month, "income": 0}))
