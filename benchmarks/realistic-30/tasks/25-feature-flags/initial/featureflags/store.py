from __future__ import annotations
from typing import Any, Mapping

def evaluate(config: Mapping[str, Any], flag_key: str, context: Mapping[str, Any] | None = None) -> bool:
    raise NotImplementedError

def explain(config: Mapping[str, Any], flag_key: str, context: Mapping[str, Any] | None = None) -> dict[str, Any]:
    raise NotImplementedError
