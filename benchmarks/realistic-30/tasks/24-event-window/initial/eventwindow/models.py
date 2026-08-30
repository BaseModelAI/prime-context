from dataclasses import dataclass

@dataclass(frozen=True)
class Event:
    id: str
    ts: int
    key: str
    value: int

@dataclass(frozen=True)
class Window:
    start: int
    end: int
    key: str
    count: int
    total: int
