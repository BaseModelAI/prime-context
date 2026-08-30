# Minimal master-file parser

Final requirements:
- `parse_zone(text, origin, default_ttl=300) -> Zone` parses a deterministic line-oriented master-file subset.
- Support `$ORIGIN name` and `$TTL positive_integer` directives.
- Record grammar is `owner [ttl] TYPE value` for the existing four types.
- A record line beginning with whitespace omits the owner and reuses the previous record owner.
- `;` starts a comment outside a quoted string. Use shell-like quoting for TXT values containing spaces.
- Directives affect following records; `$ORIGIN` canonicalizes subsequent relative owners and CNAME targets.
- Reject an omitted owner before any explicit owner, malformed lines, unsupported directives, and unterminated quotes.
- Feed parsed records through the same compiler and resolver semantics.
