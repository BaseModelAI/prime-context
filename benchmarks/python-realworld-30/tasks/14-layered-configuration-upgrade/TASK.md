# Layered Configuration Upgrade

Build a standard-library-only command-line tool that upgrades and merges a layered application configuration.

Run it as:

```bash
python -m solution.config_upgrade inputs \
  --output output/config.json \
  --report output/report.txt
```

The first positional argument is the directory containing these five files:

- `defaults.ini`
- `site.toml`
- `user.json`
- `runtime.json`
- `key_migrations.csv`

Create parent directories for both output paths when needed. All input text is UTF-8. Do not use third-party packages or network access.

## Parsing the layers

The configuration layers, from lowest to highest precedence, are:

1. `defaults.ini`
2. `site.toml`
3. `user.json`
4. `runtime.json`

`site.toml`, `user.json`, and `runtime.json` contain root objects. Parse TOML with `tomllib`.

In `defaults.ini`, section names are dotted object paths. A key in a section is a child of that object. For example, `password_secret` in `[database.credentials]` becomes `database.credentials.password_secret`. INI values use this fixture rule: try to decode the complete value as JSON, and use the resulting scalar, list, or object when that succeeds; otherwise use the text as a plain string. Disable `configparser` interpolation because `${...}` has the meaning described below.

## Key migrations

`key_migrations.csv` has the header `old_key,new_key`. Both columns are dotted paths.

Apply every migration separately to each parsed layer, before layers are merged. If an old path exists in a layer, remove it and place its value at the new path. If that same layer already contains both spellings, the value at the new spelling wins and the old spelling is only removed. Remove empty objects left behind by a migration. Migration destination paths are part of the known configuration schema.

## Merge rules

Merge the migrated layers in the stated precedence order.

- Merge objects recursively.
- A later scalar replaces an earlier value.
- A later list replaces the complete earlier list; do not append or merge list elements.
- JSON `null` in a later JSON layer deletes that key and its complete earlier value. A deletion of a missing key is harmless. Do not retain the deleting key with a `null` value.

## Substitutions

After the final merge, resolve every `${dotted.key}` token found anywhere inside a string value. References always read the final merged configuration and can themselves refer to strings containing substitutions. Replace a referenced scalar with `str(value)`. Thus booleans become `True` or `False`, and a string containing only one token is still a string after replacement.

A missing reference, a reference to an object or list, or a substitution cycle is a configuration error. On a configuration error:

- exit with status `2`;
- write a useful message to standard error naming the involved dotted key or keys; and
- do not write a partial `config.json`.

In particular, the withheld edge fixture contains two substitutions that form a cycle. The error must name both keys in that cycle.

## Known and unknown keys

The known schema is the set of dotted **leaf** paths present in the parsed and migrated `defaults.ini`, plus every `new_key` path in `key_migrations.csv`. A list is one leaf. After merge, retain all unknown keys in `config.json`, but list every final unknown leaf path in the report. A value that was deleted is not final and must not be reported as unknown.

## Outputs

Write `config.json` as one JSON object containing the fully migrated, merged, and substituted configuration. Use deterministic, sorted object keys. Values are not redacted in this file.

Write `report.txt` in this deterministic format:

```text
Layered Configuration Upgrade Report
[effective]
app.name = "Example"
database.credentials.password_secret = ***
[unknown]
WARNING unknown key: custom.theme
```

The example lines above illustrate the format; report the actual fixture values and paths.

- Under `[effective]`, write every final leaf as `dotted.path = rendered_value`, sorted by dotted path.
- Render a non-secret value as compact JSON (`ensure_ascii=False`, sorted object keys, and separators `,` and `:` with no added spaces).
- When the final component of a key ends with `_secret`, render its value as exactly `***` in the report. Keep its real value unchanged in `config.json`.
- Under `[unknown]`, write `WARNING unknown key: dotted.path` for every unknown final leaf, sorted by dotted path. If there are no unknown keys, leave the section with no warning lines.
- The report must not reveal an effective secret value.

Outputs must be deterministic and end with a newline.
