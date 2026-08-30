from __future__ import annotations
import json
from pathlib import Path
from .models import Module

class BuildPlanner:
    def __init__(self, modules: dict[str, Module]):
        self.modules = modules

    @classmethod
    def from_dict(cls, config: dict) -> "BuildPlanner":
        raise NotImplementedError

    @classmethod
    def load(cls, path: str | Path) -> "BuildPlanner":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf8")))

    def plan(self, targets: list[str] | None = None) -> list[str]:
        raise NotImplementedError
