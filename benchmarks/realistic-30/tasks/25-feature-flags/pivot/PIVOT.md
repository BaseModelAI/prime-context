# Targeting and rollout pivot

Flags may now have ordered `targets` and an integer `rollout` percentage.

- Scan targets in list order. A target is `{"when": mapping, "value": bool}` and matches only when every key/value exactly matches context. First match wins.
- If no target matches and `rollout` exists with a string `context["subject"]`, compute a stable bucket in 0..9999:
  `n=0; for ch in f"{flag_key}:{subject}": n=(n*131+ord(ch))%10000`.
- Return `bucket < rollout * 100`. Rollout is 0..100.
- Without a usable subject, use default.
- Priority is first target, rollout, default. Preserve the original API.
