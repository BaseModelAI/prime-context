from dataclasses import dataclass

@dataclass(frozen=True)
class SendResult:
    status: int

@dataclass(frozen=True)
class DeliveryView:
    id: str
    url: str
    state: str
    attempts: int
    next_attempt_at: float | None
    last_status: int | None
    last_error: str | None
