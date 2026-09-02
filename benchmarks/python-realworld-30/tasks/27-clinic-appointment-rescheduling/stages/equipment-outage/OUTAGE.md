# Equipment outage and notices

The capability named by `inputs/equipment_outage.json` is unavailable for the
whole planning horizon. Treat that `(room_id, equipment_id)` pair as absent,
then regenerate the final schedule and every CSV while retaining all earlier
validity, displacement, lock, and optimization rules.

Replace `output/notices/` and write exactly one UTF-8 plain-text notice for
each row of `changes.csv` or `unscheduled.csv`. Use the patient's ID as the
filename plus `.txt`; patient IDs are unique in this fixture. Do not create
notices for unchanged appointments.

For a `changes.csv` row, the content is exactly:

```text
Appointment {appointment_id}
Patient {patient_id}
Status: {change_kind}
Old: {old_provider_id}|{old_room_id}|{old_start}
New: {new_provider_id}|{new_room_id}|{new_start}
```

For an unscheduled row, the content is exactly:

```text
Appointment {appointment_id}
Patient {patient_id}
Status: unscheduled
Reason: NO_FEASIBLE_SLOT
```

Each file ends with one newline. Empty old fields in an urgent scheduled
notice therefore appear as `Old: ||`.
