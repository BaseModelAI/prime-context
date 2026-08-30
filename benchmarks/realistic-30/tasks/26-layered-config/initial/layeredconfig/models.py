from dataclasses import dataclass

class ExpansionError(ValueError):
    pass

@dataclass(frozen=True)
class MergeResult:
    config: dict[str, object]
    sources: dict[str, str]
    def explain(self, pointer: str) -> dict[str, object]:
        raise NotImplementedError
