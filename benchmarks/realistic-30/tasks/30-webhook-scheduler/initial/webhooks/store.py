from __future__ import annotations

class WebhookScheduler:
    def __init__(self, sender, *, clock, executor, max_attempts=3, backoff_base=1.0, max_per_host=2):
        raise NotImplementedError
