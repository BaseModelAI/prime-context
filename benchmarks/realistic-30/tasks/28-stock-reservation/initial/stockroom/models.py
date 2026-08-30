from dataclasses import dataclass

@dataclass(frozen=True)
class Line:
    sku: str
    quantity: int

@dataclass(frozen=True)
class Reservation:
    id: str
    lines: tuple[Line, ...]
    expires_at: int | None = None
