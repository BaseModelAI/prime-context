# Retry and deterministic backoff pivot

Preserve the initial API and add:
- Response 408, 425, 429, all 5xx statuses, and sender exceptions are transient.
- Other non-2xx statuses fail immediately.
- After transient attempt number `n`, retry at `clock() + backoff_base * 2**(n-1)`.
- Stop after `max_attempts`; mark failed and clear `next_attempt_at`.
- A pending retry records the exception text in `last_error`; success clears it and sets status.
- No jitter and no sleeping. Exact injected clock deadlines control eligibility.
