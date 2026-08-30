# Alias and wildcard resolution pivot

Preserve direct behavior and add:
- For a non-CNAME query with no matching direct type, follow one CNAME at each owner until the requested type is found.
- Reject multiple CNAMEs at one owner and coexistence of CNAME with other record types.
- Detect cycles and chains longer than 16 by raising `ResolutionError`.
- The returned terminal answers use the original query name and their TTL is the minimum across the CNAME chain and terminal record.
- If an exact owner does not exist, use the longest wildcard owner whose `*.` suffix matches the query name.
- A wildcard may provide a terminal type or CNAME. Synthesized answers use the query name.
- Exact-owner existence suppresses wildcard use even when the exact owner lacks the requested type.
