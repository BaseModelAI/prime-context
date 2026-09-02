# SQLite CRM migration

Repair the editable `crm/` package so this command upgrades the supplied database:

```bash
python -m crm.migrate workspace/crm.db
```

Use only the Python standard library. The input database has `PRAGMA user_version=1` and a legacy table with these columns:

```text
contacts(id, name, email, phone, notes)
```

The command must migrate it to schema version 2.

## Version 2 schema

Create these two tables, with the columns in the shown order:

```text
contacts(id, display_name, notes)
contact_methods(contact_id, kind, value, normalized_value, is_primary)
```

`contacts.id` remains the integer primary key. `contact_methods.contact_id` refers to it. `kind` is `email` or `phone`, and `is_primary` is the integer `0` or `1`. You may add constraints and indexes, but do not add columns. Set `PRAGMA user_version=2` after a successful migration.

## Migration rules

- Preserve the ID of every contact that is not merged. Copy its `name` to `display_name`.
- Treat a null or whitespace-only email or phone as missing.
- Store `value` as the original email or phone with surrounding whitespace removed.
- Normalize an email by trimming surrounding whitespace and applying `casefold()`.
- Normalize a phone by removing all non-digits. Prefix the digits with `+` only when the trimmed original starts with `+`. A phone with no digits is missing.
- Contacts with the same nonempty normalized email are duplicates. Merge the whole group into its lowest contact ID. Use that lowest-ID row's name as `display_name` and remove the other contact rows.
- Move every distinct method in a merged group to the surviving contact. Methods are distinct by `(kind, normalized_value)`. When duplicate methods occur, keep the `value` from the lowest source contact ID.
- For each contact and method kind, mark the first distinct method encountered in ascending source-contact ID order as primary. Mark later distinct methods of that kind as non-primary.
- Trim notes before testing them. Concatenate distinct, nonempty notes in ascending source-contact ID order with a single newline. Store an empty string when there are no notes.
- Perform the migration as one transaction so a failure does not leave a partial schema.

Running the command on an already migrated version-2 database must succeed and make no further logical change.
