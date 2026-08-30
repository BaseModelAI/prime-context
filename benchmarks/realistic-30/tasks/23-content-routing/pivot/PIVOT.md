# Locale fallback and named-template pivot

Preserve the initial API and add:
- Config may have `default_locale` and `templates`.
- Routes may have `locale`, and exactly one of `text` or `template`. A template route may have `content` values.
- Normalize locales to lowercase and replace `_` with `-`. Missing route locale is `*`.
- `resolve(..., locale=None)` uses this chain with duplicates removed: requested locale, less-specific parents, default locale, then `*`. Omitted locale starts at default locale.
- Select the first path match in the best locale-chain entry.
- Named templates must exist.
- Render precedence is route content, captures, caller values.
- Resolution locale reports the normalized selected route locale.
