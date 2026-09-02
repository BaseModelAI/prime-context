# Clinic appointment rescheduling

Build a Python 3.12 standard-library-only scheduler. Implement this command:

```bash
python -m solution.clinic_schedule inputs --output output
```

Do not modify `inputs/`. Create `output/` when needed and replace reports rather
than appending. All datetimes are fixed local clinic times in ISO
`YYYY-MM-DDTHH:MM` format. Do not use the wall clock.

## Initial inputs

- `appointments.csv` has
  `appointment_id,patient_id,provider_id,type_id,site_id,room_id,start,priority`.
  Priority is an integer; a larger value is more important.
- `appointment_types.csv` has
  `type_id,duration_minutes,room_kind,required_equipment`. The equipment field
  is blank when none is required.
- `providers.csv` lists `provider_id,name`.
- `provider_availability.csv` has half-open available intervals
  `provider_id,site_id,start,end`.
- `patient_windows.csv` has half-open acceptable intervals
  `patient_id,start,end`. An appointment must fit wholly in one window.
- `rooms.csv` has `room_id,site_id,room_kind`.
- `room_equipment.csv` lists `(room_id,equipment_id)` capabilities.
- `locked_appointments.csv` has one `appointment_id` per locked appointment.
- `travel_buffers.csv` has `from_site,to_site,minutes`. Missing pairs are not
  allowed; same-site rows have zero minutes.
- `settings.json` supplies `slot_minutes`. Starts must be on that many minutes
  from midnight. End is start plus the appointment type duration.

CSV files are UTF-8 with headers. IDs are case-sensitive. Intervals are
half-open, so an appointment ending when another starts does not overlap.

## Validity rules

A scheduled appointment must:

1. start on the slot grid and fit in one patient window;
2. fit in one availability interval for its assigned provider at its site;
3. use a room at the same site with exactly the required room kind and, when
   nonblank, the required equipment;
4. overlap neither another appointment for that provider nor another use of
   that room; and
5. leave the travel buffer between consecutive appointments of the same
   provider at different sites. For appointments `a` then `b`, require
   `a.end + travel[a.site,b.site] <= b.start`.

The initial schedule contains only existing appointments. Preserve its IDs,
patients, types, sites, priorities, providers, rooms, and starts while
normalizing the derived fields. A locked appointment may never change its
provider, room, site, start, or scheduled state.

## Initial outputs

Write CSV using `csv.writer`-compatible quoting and LF line endings.

- `output/baseline_issues.csv`, exact header
  `appointment_id,code,detail`. Emit every issue in appointment-ID then code
  order. The possible codes are `BAD_SLOT`, `PATIENT_WINDOW`,
  `PROVIDER_AVAILABILITY`, `ROOM_CAPABILITY`, `PROVIDER_OVERLAP`,
  `ROOM_OVERLAP`, and `TRAVEL_BUFFER`. Use the conflicting appointment or
  resource ID as `detail` when applicable, otherwise the failed resource ID.
- `output/schedule.csv`, exact header
  `appointment_id,patient_id,provider_id,type_id,site_id,room_id,start,end,priority,locked`.
  Include scheduled appointments only, sorted by appointment ID. Write locked
  as lowercase `true` or `false`.

For stage 1, `schedule.csv` is the normalized supplied schedule even when
`baseline_issues.csv` reports a problem; validation does not silently move an
appointment. The supplied main fixture has 250 sparse appointments. Later
ordinary follow-up requests can add disruption files and output requirements.
