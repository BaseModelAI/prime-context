# Split transaction follow-up

On each `import`, when `inputs/splits.csv` exists, validate and apply it after ordinary rows. Rows for one `(source_account, source_id)` form one group. `part` is a positive integer and unique within that group. Every amount is signed and has two decimals. Apply a group only when its parent exists and its part amounts sum exactly to the signed parent amount. Reapplying the same group replaces that parent’s prior parts without duplicates.

Write `output/split_errors.json` as a JSON array sorted by source account and source ID. Each rejected group is one object with `source_account`, `source_id`, and a short `error`. A rejected group leaves its parent unsplit. Valid groups in the same file must still be applied. The monthly report uses a valid group’s part categories and amounts instead of the parent category. Totals do not change.
