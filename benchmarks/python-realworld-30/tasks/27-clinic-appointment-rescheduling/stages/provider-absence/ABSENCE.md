# Provider absence update

Re-run the command from `TASK.md`. The half-open interval in
`inputs/provider_absence.json` is removed from that provider's availability.
An appointment may not overlap any part of it.

Reschedule affected unlocked appointments. An existing appointment keeps its
appointment ID, patient, type, site, and priority. It may use any listed
provider and any capable room at that site. Locked appointments never move.

Choose the complete schedule by these global lexicographic objectives, in this
order:

1. maximize the number of scheduled appointments;
2. minimize the number of existing appointments whose provider, room, or start
   differs from `appointments.csv`;
3. minimize the sum of absolute start-time differences in minutes for those
   appointments;
4. maximize how many scheduled existing appointments keep their original
   provider; and
5. choose the lexicographically earliest sorted `(start, appointment_id,
   provider_id, room_id)` list for moved or newly added appointments.

Keep `baseline_issues.csv` as validation of the originally supplied schedule,
without applying the absence. Regenerate `schedule.csv` for current inputs.
Also write:

- `output/changes.csv`, exact header
  `appointment_id,patient_id,change_kind,old_provider_id,new_provider_id,old_room_id,new_room_id,old_start,new_start,minutes_moved`.
  Include changed existing appointments as `moved`, sorted by appointment ID.
  `minutes_moved` is the absolute integer start difference.
- `output/unscheduled.csv`, exact header
  `appointment_id,patient_id,reason`. Use `NO_FEASIBLE_SLOT` and sort by
  appointment ID.

A provider or room change at the same time is still a move with zero minutes.
Write empty reports with their header when there are no rows.
