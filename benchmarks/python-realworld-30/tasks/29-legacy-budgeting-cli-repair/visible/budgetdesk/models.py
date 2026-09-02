from dataclasses import dataclass

@dataclass(frozen=True)
class SourceKey:
    source_account: str
    source_id: str
