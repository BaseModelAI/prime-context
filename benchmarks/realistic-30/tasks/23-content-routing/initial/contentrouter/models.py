from dataclasses import dataclass

class NoRoute(LookupError):
    pass

@dataclass(frozen=True)
class Resolution:
    route_id: str
    text: str
    params: dict[str, str]
    locale: str = "*"
