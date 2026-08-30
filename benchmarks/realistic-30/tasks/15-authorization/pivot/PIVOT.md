# Groups, denies, and action-family pivot

Preserve legacy allow grants and add constructor keyword `memberships=None`:
- Memberships map group names to user names or `group:<name>` entries and may be nested; reject group cycles.
- A grant subject may be a user name or `group:<name>`.
- A grant may set `effect` to `allow` or `deny`; omitted means allow.
- An action pattern may be exact, `*`, or end in `:*`, which matches the named action family prefix followed by a colon.
- First select matches at the nearest resource ancestor.
- At that specificity, any deny overrides every allow. Return all winning-effect grant IDs lexically.
- Membership and grant input order must not affect decisions.
