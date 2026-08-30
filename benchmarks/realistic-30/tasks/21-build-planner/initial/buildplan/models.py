from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Module:
    name: str
    deps: tuple[str, ...]
    sources: tuple[str, ...]
