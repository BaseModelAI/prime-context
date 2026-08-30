# Time-bounded direct delegation

Final requirements:
- Constructor keyword `delegations=None` accepts records with unique `id`, `from`, `to`, `resource`, nonempty `actions`, inclusive ISO `not_before`, and exclusive ISO `expires`.
- `authorize(..., at=ISO_TIMESTAMP)` evaluates active delegations; omit `at` to ignore all delegations.
- An active delegation can transfer an effective allow from `from` to `to` for matching actions on its resource descendants.
- The source must itself be allowed at the requested resource/action by direct grants and groups.
- Delegation is not transitive and can never transfer or bypass a deny.
- A delegated allow competes at the delegation resource's specificity. Direct or group denies at the same specificity win.
- A winning delegated reason is `delegation_id:source_grant_id`; sort all reasons lexically.
- Validate timestamps, resource references, action patterns, and `not_before < expires`.
