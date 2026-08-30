# Extra payments and rate resets pivot

Preserve the initial schedule and add keyword mappings keyed by 1-based period:
- `extra_payments` maps a period to a nonnegative Decimal extra amount.
- `rate_changes` maps a period to a new nonnegative annual Decimal rate effective for that period's interest.
- The original contractual level payment remains fixed after a rate reset.
- Add the extra after the contractual payment.
- Cap each total payment at opening balance plus rounded interest, never create a negative balance, and stop immediately after payoff.
- Round interest and monetary fields to cents using the original rule.
- Reject invalid period keys, float values, and negative mapped amounts atomically.
